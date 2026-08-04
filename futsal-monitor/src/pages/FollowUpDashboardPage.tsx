import { useStore } from '@/store/store'
import { Link } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { parseISO, subDays, addDays, format } from 'date-fns'
import { construirPanelHoy } from '@/domain/followUp/followUpEngine'
import { exportToExcel } from '@/utils/export'
import { construirDTOStaffSeguimientoDiario } from '@/domain/privacy/exportPrivacy'
import { db } from '@/db/database'
import { calcularVentanaPropagacion } from '@/utils/importEngine'
import { getWeekId } from '@/domain/dates/dates'
import { recalcularReadinessJugadora } from '@/services/readiness'
import { recalcularResumenSemanal } from '@/services/resumenSemanal'

export function FollowUpDashboardPage() {
  const {
    jugadoras,
    wellness,
    lesiones,
    alertas,
    historial_importaciones,
    loadAll,
    sesiones,
    sesion_rpe
  } = useStore()

  // 1. Selector de fecha operativa (por defecto hoy local)
  const hoyLocalStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const [fechaOperativa, setFechaOperativa] = useState<string>(hoyLocalStr)

  // 2. Estado para recálculo manual de derivados
  const [recalculating, setRecalculating] = useState(false)
  const [recalcProgress, setRecalcProgress] = useState(0)
  const [recalcError, setRecalcError] = useState<string | null>(null)

  // 3. Estado de colapso/acordeón para prioridades
  const [colapsados, setColapsados] = useState<Record<string, boolean>>({
    revision_prioritaria: false,
    revisar_hoy: false,
    seguimiento_semana: false,
    rutinario: true
  })

  const toggleSeccion = (sec: string) => {
    setColapsados(prev => ({ ...prev, [sec]: !prev[sec] }))
  }

  // Calcular RPE pendientes (sesiones realizadas en el pasado respecto a la fecha operativa)
  const rpePendientesMap = useMemo(() => {
    const map: Record<string, boolean> = {}
    const sesionesPasadasRealizadas = sesiones.filter(s => 
      s.estado === 'realizada' && s.fecha < fechaOperativa
    )
    if (sesionesPasadasRealizadas.length === 0) return map

    jugadoras.forEach(j => {
      if (j.activa === false) return
      let pendiente = false
      for (const s of sesionesPasadasRealizadas) {
        const match = sesion_rpe.find(r => r.id_sesion === s.id_sesion && r.id_jugadora === j.id_jugadora)
        if (!match) {
          pendiente = true; break
        }
        if (match.asistencia === 'sin_registrar' || (!match.asistencia)) {
          pendiente = true; break
        }
        if (['completa', 'parcial'].includes(match.asistencia) && (match.rpe === null || match.rpe === undefined)) {
          pendiente = true; break
        }
      }
      map[j.id_jugadora] = pendiente
    })
    return map
  }, [sesiones, sesion_rpe, fechaOperativa, jugadoras])

  // 4. Ejecutar el motor de panel hoy
  const { resumen, jugadorasPanel } = useMemo(() => {
    return construirPanelHoy(
      jugadoras,
      wellness,
      lesiones,
      alertas,
      fechaOperativa,
      historial_importaciones,
      hoyLocalStr,
      rpePendientesMap
    )
  }, [jugadoras, wellness, lesiones, alertas, fechaOperativa, historial_importaciones, hoyLocalStr, rpePendientesMap])

  // Filtrar jugadoras por prioridad para las listas
  const prioritarias = useMemo(() => jugadorasPanel.filter(jp => jp.prioridad === 'revision_prioritaria'), [jugadorasPanel])
  const hoy = useMemo(() => jugadorasPanel.filter(jp => jp.prioridad === 'revisar_hoy'), [jugadorasPanel])
  const estaSemana = useMemo(() => jugadorasPanel.filter(jp => jp.prioridad === 'seguimiento_semana'), [jugadorasPanel])
  const rutina = useMemo(() => jugadorasPanel.filter(jp => jp.prioridad === 'rutinario'), [jugadorasPanel])
  const pendientes = useMemo(() => jugadorasPanel.filter(jp => jp.estadoWellness === 'pendiente'), [jugadorasPanel])

  // Identificar si hay algún log con derivados pendientes en toda la base de datos
  const hasDerivadosPendientes = useMemo(() => {
    return historial_importaciones.some(h => h.derivadosPendientes)
  }, [historial_importaciones])

  // Recálculo manual de derivados desde el panel
  const handleRecalculateDerived = async () => {
    setRecalculating(true)
    setRecalcProgress(10)
    setRecalcError(null)

    try {
      if ((window as any).__forceRecalcFailure || localStorage.getItem('forceRecalcFailure') === 'true') {
        throw new Error('DEV_MOCK_ERROR: Fallo forzado de recálculo en desarrollo.')
      }
      const allWellness = await db.wellness.toArray()
      const affectedJugadoras = Array.from(new Set(allWellness.map(w => w.id_jugadora)))
      const affectedDates = Array.from(new Set(allWellness.map(w => w.fecha)))
      const propagatedDates = calcularVentanaPropagacion(affectedDates)
      const affectedWeeks = Array.from(new Set(propagatedDates.map(d => getWeekId(d))))

      const totalSteps = affectedJugadoras.length * (propagatedDates.length + affectedWeeks.length + 1)
      let stepCount = 0

      const store = useStore.getState()

      for (const jId of affectedJugadoras) {
        for (const fecha of propagatedDates) {
          await recalcularReadinessJugadora(jId, fecha)
          stepCount++
          setRecalcProgress(Math.min(95, Math.round((stepCount / totalSteps) * 95)))
        }
        for (const sem of affectedWeeks) {
          await recalcularResumenSemanal(jId, sem)
          stepCount++
          setRecalcProgress(Math.min(95, Math.round((stepCount / totalSteps) * 95)))
        }
        await store.evaluarSeguimientoJugadora(jId)
        stepCount++
        setRecalcProgress(Math.min(95, Math.round((stepCount / totalSteps) * 95)))
      }

      // Marcar todas las importaciones pendientes como resueltas
      const pendingImports = historial_importaciones.filter(h => h.derivadosPendientes)
      for (const h of pendingImports) {
        if (h.id) {
          await db.historial_importaciones.update(h.id, { derivadosPendientes: false })
        }
      }

      await loadAll()
      setRecalcProgress(100)
      alert('Indicadores derivados recalculados correctamente en segundo plano.')
    } catch (err: any) {
      console.error(err)
      setRecalcError(err.message || 'Error al recalcular indicadores')
    } finally {
      setRecalculating(false)
    }
  }

  // Navegación de fecha
  const irAyer = () => {
    const d = parseISO(fechaOperativa)
    setFechaOperativa(format(subDays(d, 1), 'yyyy-MM-dd'))
  }

  const irManana = () => {
    const d = parseISO(fechaOperativa)
    setFechaOperativa(format(addDays(d, 1), 'yyyy-MM-dd'))
  }

  const irHoy = () => {
    setFechaOperativa(hoyLocalStr)
  }

  const exportarSeguimiento = () => {
    const rawData = jugadorasPanel.map(jp => ({
      nombre: jp.nombre,
      posicion: jp.posicion,
      disponibilidad: jp.disponibilidad,
      estadoWellness: jp.estadoWellness,
      prioridad: jp.prioridad.toUpperCase().replace('_', ' '),
      motivos: jp.motivos.map(m => m.mensaje).join('; '),
      adherencia7d: jp.adherencia7d.fraccion,
      adherencia28d: jp.adherencia28d.fraccion
    }))
    const dtoData = construirDTOStaffSeguimientoDiario(rawData)
    exportToExcel(dtoData, `panel_hoy_${fechaOperativa}`)
  }

  return (
    <div className="space-y-6">
      {/* 1. Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">Panel Hoy</h1>
          <p className="text-[10px] text-surface-500 italic mt-0.5">
            Herramienta de apoyo a la decisión. No predice lesiones ni sustituye la valoración del staff.
          </p>
        </div>

        {/* Controladores de Fecha */}
        <div className="flex flex-wrap items-center gap-2 bg-surface-50 border border-surface-200 rounded-lg p-1.5 shadow-sm">
          <button
            onClick={irAyer}
            className="px-2.5 py-1 text-xs text-surface-600 hover:bg-white rounded transition-colors font-medium border border-transparent hover:border-surface-200"
          >
            ← Ayer
          </button>
          <button
            onClick={irHoy}
            disabled={fechaOperativa === hoyLocalStr}
            className="px-2.5 py-1 text-xs bg-white text-primary-700 disabled:text-surface-400 disabled:bg-transparent rounded transition-all font-semibold border border-surface-200 disabled:border-transparent shadow-sm disabled:shadow-none"
          >
            Hoy
          </button>
          <button
            onClick={irManana}
            className="px-2.5 py-1 text-xs text-surface-600 hover:bg-white rounded transition-colors font-medium border border-transparent hover:border-surface-200"
          >
            Mañana →
          </button>
          <div className="h-4 w-px bg-surface-300 mx-1" />
          <input
            type="date"
            value={fechaOperativa}
            onChange={(e) => e.target.value && setFechaOperativa(e.target.value)}
            className="bg-white border border-surface-300 rounded text-xs px-2 py-1 font-mono text-surface-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* 2. Tarjetas de Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Respuestas Pendientes */}
        <div className="bg-white border border-surface-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Wellness Pendiente</div>
            <div className="text-3xl font-extrabold text-surface-700 mt-1">{resumen.pendientesWellness}</div>
          </div>
          <div className="text-[10px] text-surface-500 mt-2 font-mono">
            {resumen.totalJugadoras - resumen.pendientesWellness} / {resumen.totalJugadoras} respondieron
          </div>
        </div>

        {/* Revisión Prioritaria */}
        <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Revisión Prioritaria</div>
            <div className="text-3xl font-extrabold text-red-600 mt-1">{resumen.revisionPrioritariaCount}</div>
          </div>
          <div className="text-[10px] text-red-600 font-semibold mt-2 flex items-center gap-1">
            <span>🔴 Atención inmediata hoy</span>
          </div>
        </div>

        {/* Revisar Hoy */}
        <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Revisar Hoy</div>
            <div className="text-3xl font-extrabold text-amber-600 mt-1">{resumen.revisarHoyCount}</div>
          </div>
          <div className="text-[10px] text-amber-600 font-semibold mt-2">
            <span>🟡 Seguimiento moderado</span>
          </div>
        </div>

        {/* Calidad de datos / Datos pendientes */}
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Datos Pendientes</div>
            <div className="text-3xl font-extrabold text-blue-600 mt-1">{resumen.datosPendientesCount}</div>
          </div>
          <div className="text-[10px] text-blue-600 font-semibold mt-2">
            <span>🔵 Incompletos / Recálculos</span>
          </div>
        </div>
      </div>

      {/* Recálculo de derivados en ejecución */}
      {(recalculating || recalcError) && (
        <div className="bg-white border border-surface-200 rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex justify-between text-xs font-semibold text-surface-700">
            <span>{recalcError ? 'Error en recálculo' : 'Recalculando readiness y alertas lógicas...'}</span>
            {!recalcError && <span>{recalcProgress}%</span>}
          </div>
          {recalcError ? (
            <p className="text-xs text-red-600 font-medium">{recalcError}</p>
          ) : (
            <div className="w-full bg-surface-200 rounded-full h-2">
              <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${recalcProgress}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Banner de recálculo pendiente */}
      {hasDerivadosPendientes && !recalculating && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚠️</span>
            <div>
              <h4 className="text-xs font-bold text-amber-800">Recálculo de Indicadores Derivados Pendiente</h4>
              <p className="text-[10px] text-amber-600 mt-0.5">
                Hay importaciones recientes que no completaron el cálculo de readiness y alertas. Es aconsejable recalcular ahora.
              </p>
            </div>
          </div>
          <button
            onClick={handleRecalculateDerived}
            className="text-[10px] bg-amber-600 text-white font-semibold px-3 py-1.5 rounded hover:bg-amber-700 whitespace-nowrap shadow-sm transition-all"
          >
            Recalcular ahora
          </button>
        </div>
      )}

      {/* 3. Panel de Listados e Interfaz Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda / Central: Clasificación de Jugadoras (2/3 de ancho) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-surface-700 uppercase tracking-wider">Seguimiento de Jugadoras</h2>
            <button
              onClick={exportarSeguimiento}
              className="text-[10px] bg-primary-600 text-white font-bold px-2.5 py-1 rounded hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-1"
            >
              <span>📥</span> Exportar a Excel
            </button>
          </div>

          {/* Sección 1: Revisión Prioritaria */}
          <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleSeccion('revision_prioritaria')}
              className="w-full flex items-center justify-between px-4 py-3 bg-red-50/50 hover:bg-red-50 transition-colors border-b border-surface-100"
            >
              <div className="flex items-center gap-2">
                <span className="text-red-500">🔴</span>
                <span className="text-xs font-bold text-red-800">REVISIÓN PRIORITARIA ({prioritarias.length})</span>
              </div>
              <span className="text-xs text-surface-400">{colapsados.revision_prioritaria ? 'Mostrar ▼' : 'Ocultar ▲'}</span>
            </button>

            {!colapsados.revision_prioritaria && (
              <div className="p-4 divide-y divide-surface-100 space-y-4">
                {prioritarias.length === 0 ? (
                  <p className="text-xs text-surface-400 italic text-center py-4">No hay jugadoras en revisión prioritaria hoy.</p>
                ) : (
                  prioritarias.map(jp => <CardJugadora key={jp.id_jugadora} jp={jp} />)
                )}
              </div>
            )}
          </div>

          {/* Sección 2: Revisar Hoy */}
          <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleSeccion('revisar_hoy')}
              className="w-full flex items-center justify-between px-4 py-3 bg-amber-50/30 hover:bg-amber-50/50 transition-colors border-b border-surface-100"
            >
              <div className="flex items-center gap-2">
                <span className="text-amber-500">🟡</span>
                <span className="text-xs font-bold text-amber-800">REVISAR HOY ({hoy.length})</span>
              </div>
              <span className="text-xs text-surface-400">{colapsados.revisar_hoy ? 'Mostrar ▼' : 'Ocultar ▲'}</span>
            </button>

            {!colapsados.revisar_hoy && (
              <div className="p-4 divide-y divide-surface-100 space-y-4">
                {hoy.length === 0 ? (
                  <p className="text-xs text-surface-400 italic text-center py-4">No hay jugadoras para revisar hoy.</p>
                ) : (
                  hoy.map(jp => <CardJugadora key={jp.id_jugadora} jp={jp} />)
                )}
              </div>
            )}
          </div>

          {/* Sección 3: Seguimiento esta semana */}
          <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleSeccion('seguimiento_semana')}
              className="w-full flex items-center justify-between px-4 py-3 bg-blue-50/20 hover:bg-blue-50/30 transition-colors border-b border-surface-100"
            >
              <div className="flex items-center gap-2">
                <span className="text-blue-500">🔵</span>
                <span className="text-xs font-bold text-blue-800">SEGUIMIENTO ESTA SEMANA ({estaSemana.length})</span>
              </div>
              <span className="text-xs text-surface-400">{colapsados.seguimiento_semana ? 'Mostrar ▼' : 'Ocultar ▲'}</span>
            </button>

            {!colapsados.seguimiento_semana && (
              <div className="p-4 divide-y divide-surface-100 space-y-4">
                {estaSemana.length === 0 ? (
                  <p className="text-xs text-surface-400 italic text-center py-4">No hay jugadoras en seguimiento esta semana.</p>
                ) : (
                  estaSemana.map(jp => <CardJugadora key={jp.id_jugadora} jp={jp} />)
                )}
              </div>
            )}
          </div>

          {/* Sección 4: Rutinario */}
          <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleSeccion('rutinario')}
              className="w-full flex items-center justify-between px-4 py-3 bg-green-50/20 hover:bg-green-50/30 transition-colors border-b border-surface-100"
            >
              <div className="flex items-center gap-2">
                <span className="text-green-500">🟢</span>
                <span className="text-xs font-bold text-green-800">SEGUIMIENTO RUTINARIO ({rutina.length})</span>
              </div>
              <span className="text-xs text-surface-400">{colapsados.rutinario ? 'Mostrar ▼' : 'Ocultar ▲'}</span>
            </button>

            {!colapsados.rutinario && (
              <div className="p-4 divide-y divide-surface-100 space-y-4">
                {rutina.length === 0 ? (
                  <p className="text-xs text-surface-400 italic text-center py-4">No hay jugadoras en seguimiento rutinario.</p>
                ) : (
                  rutina.map(jp => <CardJugadora key={jp.id_jugadora} jp={jp} />)
                )}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Calidad de datos, Pendientes y Chasing (1/3 de ancho) */}
        <div className="space-y-6">
          {/* Cuestionarios Pendientes de Enviar */}
          <div className="bg-white rounded-xl border border-surface-200 p-4 shadow-sm space-y-4">
            <div className="border-b border-surface-100 pb-2">
              <h3 className="text-xs font-bold text-surface-700 uppercase tracking-wider flex items-center justify-between">
                <span>Respuestas Pendientes ({pendientes.length})</span>
                {pendientes.length > 0 && <span className="animate-pulse bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded">FALTA HOY</span>}
              </h3>
            </div>

            {pendientes.length === 0 ? (
              <p className="text-xs text-surface-400 italic py-2">Todas las jugadoras respondieron hoy.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pendientes.map(p => (
                  <div key={p.id_jugadora} className="flex items-center justify-between p-2 rounded bg-surface-50 border border-surface-150 text-xs">
                    <div>
                      <div className="font-semibold text-surface-700">{p.nombre}</div>
                      <div className="text-[10px] text-surface-400">{p.posicion} · {p.disponibilidad}</div>
                    </div>
                    <Link
                      to={`/jugadoras/${p.id_jugadora}`}
                      className="text-[10px] text-primary-600 hover:underline hover:text-primary-700 font-semibold"
                    >
                      Ver perfil
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Calidad de Datos & Avisos */}
          <div className="bg-white rounded-xl border border-surface-200 p-4 shadow-sm space-y-4">
            <div className="border-b border-surface-100 pb-2">
              <h3 className="text-xs font-bold text-surface-700 uppercase tracking-wider">
                Avisos de Calidad de Datos
              </h3>
            </div>

            <div className="space-y-3">
              {/* Recuento de Incompletos */}
              {jugadorasPanel.filter(jp => jp.estadoWellness === 'incompleto').length > 0 && (
                <div className="p-2.5 rounded bg-blue-50 text-blue-800 border border-blue-100 text-xs space-y-1.5">
                  <div className="font-bold">⚠️ Wellness Incompleto hoy</div>
                  <div className="text-[10px] text-blue-600">
                    Las siguientes jugadoras enviaron el wellness pero les faltan campos descriptivos:
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {jugadorasPanel.filter(jp => jp.estadoWellness === 'incompleto').map(jp => (
                      <span key={jp.id_jugadora} className="bg-white px-2 py-0.5 rounded text-[9px] font-medium border border-blue-150">
                        {jp.nombre}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recuento de Historiales Insuficientes */}
              {jugadorasPanel.filter(jp => jp.calidadDatos.includes('historial_insuficiente')).length > 0 && (
                <div className="p-2.5 rounded bg-surface-50 text-surface-800 border border-surface-200 text-xs space-y-1">
                  <div className="font-bold text-surface-700">ℹ️ Historial Insuficiente para baseline</div>
                  <div className="text-[10px] text-surface-500">
                    Estas jugadoras tienen menos de 10 registros de wellness en los últimos 28 días. Los cambios individuales y z-scores no se pueden calcular:
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {jugadorasPanel.filter(jp => jp.calidadDatos.includes('historial_insuficiente')).map(jp => (
                      <span key={jp.id_jugadora} className="bg-white px-2 py-0.5 rounded text-[9px] font-medium border border-surface-250">
                        {jp.nombre}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recuento de RPE Pendiente */}
              {jugadorasPanel.filter(jp => jp.calidadDatos.includes('rpe_pendiente')).length > 0 && (
                <div className="p-2.5 rounded bg-purple-50 text-purple-800 border border-purple-100 text-xs space-y-1">
                  <div className="font-bold text-purple-700">⏳ Asistencia/RPE Pendiente</div>
                  <div className="text-[10px] text-purple-600">
                    Estas jugadoras no tienen asistencia o RPE registrado para sesiones pasadas realizadas:
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {jugadorasPanel.filter(jp => jp.calidadDatos.includes('rpe_pendiente')).map(jp => (
                      <span key={jp.id_jugadora} className="bg-white px-2 py-0.5 rounded text-[9px] font-medium border border-purple-250">
                        {jp.nombre}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Si todo está bien */}
              {jugadorasPanel.filter(jp => jp.estadoWellness === 'incompleto').length === 0 &&
                jugadorasPanel.filter(jp => jp.calidadDatos.includes('historial_insuficiente')).length === 0 &&
                jugadorasPanel.filter(jp => jp.calidadDatos.includes('rpe_pendiente')).length === 0 && (
                  <p className="text-xs text-surface-400 italic">No hay avisos de calidad de datos.</p>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CardJugadora({ jp }: { jp: any }) {
  const [showMore, setShowMore] = useState(false)
  const visibleMotivos = showMore ? jp.motivos : jp.motivos.slice(0, 3)

  return (
    <div className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-start justify-between gap-4">
      <div className="space-y-2 flex-1">
        {/* Info Jugadora */}
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-bold text-surface-800">{jp.nombre}</h3>
          <span className="text-[10px] text-surface-400 font-medium">({jp.posicion})</span>
          {jp.disponibilidad !== 'Disponible' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
              {jp.disponibilidad}
            </span>
          )}
          {jp.calidadDatos.includes('historial_insuficiente') && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-100 text-surface-600 border border-surface-200">
              Historial insuficiente
            </span>
          )}
        </div>

        {/* Adherencias */}
        <div className="flex items-center gap-4 text-[10px] text-surface-500 font-mono">
          <div>
            Adherencia 7d: <span className="font-semibold text-surface-700">{jp.adherencia7d.fraccion} ({jp.adherencia7d.porcentaje}%)</span>
            {jp.adherencia7d.nota && <span className="text-[9px] text-amber-600 ml-1">({jp.adherencia7d.nota})</span>}
          </div>
          <div className="w-px h-3 bg-surface-200" />
          <div>
            Adherencia 28d: <span className="font-semibold text-surface-700">{jp.adherencia28d.fraccion} ({jp.adherencia28d.porcentaje}%)</span>
            {jp.adherencia28d.nota && <span className="text-[9px] text-amber-600 ml-1">({jp.adherencia28d.nota})</span>}
          </div>
        </div>

        {/* Motivos descriptivos */}
        {jp.motivos.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {visibleMotivos.map((m: any, idx: number) => {
              const bg = m.categoria === 'revision_prioritaria' ? 'bg-red-50 text-red-800 border-red-100' :
                         m.categoria === 'revisar_hoy' ? 'bg-amber-50/50 text-amber-800 border-amber-100/50' :
                         'bg-blue-50/30 text-blue-800 border-blue-100/30'
              return (
                <div key={idx} className={`text-[10px] px-2.5 py-1.5 rounded-lg border font-medium ${bg}`}>
                  {m.mensaje}
                </div>
              )
            })}

            {jp.motivos.length > 3 && (
              <button
                onClick={() => setShowMore(!showMore)}
                className="text-[10px] text-primary-600 hover:underline font-semibold block"
              >
                {showMore ? 'Ver menos' : `Ver más (+${jp.motivos.length - 3})`}
              </button>
            )}
          </div>
        )}

        {/* Componentes de wellness actual contra referencia si existen */}
        {jp.wellnessActual && jp.referencia && (
          <div className="mt-2 p-2 rounded-lg bg-surface-50 border border-surface-150 grid grid-cols-5 gap-1 text-center">
            {Object.keys(jp.referencia.valoresReferencia).map((k) => {
              if (k === 'score_wellness') return null
              const label = k === 'calidad_sueno' ? 'Sueño' : k === 'fatiga' ? 'Fatiga' : k === 'dolor_muscular' ? 'Dolor M.' : k === 'estres' ? 'Estrés' : 'Ánimo'
              const currentVal = jp.wellnessActual[k]
              const refVal = jp.referencia.valoresReferencia[k]
              const diff = currentVal - refVal
              const worseIsLower = k === 'calidad_sueno' || k === 'estado_animo'
              const isWorse = worseIsLower ? diff < 0 : diff > 0
              return (
                <div key={k} className="text-[9px]">
                  <span className="text-surface-400 block font-medium">{label}</span>
                  <span className="font-semibold text-surface-700 block mt-0.5">{currentVal ?? '—'}/10</span>
                  <span className={`block font-mono text-[8px] font-medium ${isWorse ? 'text-red-500' : 'text-green-500'}`}>
                    {diff === 0 ? '=' : diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex md:flex-col items-center justify-end gap-2 shrink-0 self-center md:self-start">
        <Link
          to={`/jugadoras/${jp.id_jugadora}`}
          className="text-xs bg-surface-100 hover:bg-surface-200 border border-surface-300 font-semibold px-3 py-1.5 rounded-lg text-surface-700 shadow-sm transition-all"
        >
          Ver perfil
        </Link>
      </div>
    </div>
  )
}
