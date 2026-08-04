import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/store/store'
import { parseISO, subDays, addDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { construirDecisionDiaria } from '@/domain/dailyDecision/dailyDecisionEngine'

export function DailyDecisionPage() {
  const {
    jugadoras,
    wellness,
    lesiones,
    alertas,
    pruebas_cmj,
    sesion_rpe,
    rpe_partido
  } = useStore()

  const hoyLocalStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const [fechaOperativa, setFechaOperativa] = useState<string>(hoyLocalStr)

  const cambiarFechaDias = (delta: number) => {
    try {
      const d = parseISO(fechaOperativa)
      const nueva = delta > 0 ? addDays(d, delta) : subDays(d, Math.abs(delta))
      setFechaOperativa(format(nueva, 'yyyy-MM-dd'))
    } catch {
      setFechaOperativa(hoyLocalStr)
    }
  }

  const resumenData = useMemo(() => {
    return construirDecisionDiaria(
      jugadoras,
      wellness,
      lesiones,
      alertas,
      pruebas_cmj || [],
      sesion_rpe || [],
      rpe_partido || [],
      fechaOperativa
    )
  }, [jugadoras, wellness, lesiones, alertas, pruebas_cmj, sesion_rpe, rpe_partido, fechaOperativa])

  const fechaFormateada = useMemo(() => {
    try {
      return format(parseISO(fechaOperativa), "eeee, d 'de' MMMM 'de' yyyy", { locale: es })
    } catch {
      return fechaOperativa
    }
  }, [fechaOperativa])

  return (
    <div className="space-y-6">
      {/* 1. Header principal y selector de fecha */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-surface-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-surface-900">Decisión diaria</h1>
          <p className="text-xs text-surface-500 mt-1">
            Síntesis operativa por jugadora para la planificación previa a la sesión · <span className="capitalize font-medium text-surface-700">{fechaFormateada}</span>
          </p>
        </div>

        {/* Controles de fecha */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => cambiarFechaDias(-1)}
            className="px-2.5 py-1.5 text-xs font-medium text-surface-700 bg-surface-100 hover:bg-surface-200 border border-surface-300 rounded-lg transition-colors"
            title="Día anterior"
          >
            ← Ayer
          </button>

          {fechaOperativa !== hoyLocalStr && (
            <button
              onClick={() => setFechaOperativa(hoyLocalStr)}
              className="px-2.5 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition-colors"
            >
              Hoy
            </button>
          )}

          <button
            onClick={() => cambiarFechaDias(1)}
            className="px-2.5 py-1.5 text-xs font-medium text-surface-700 bg-surface-100 hover:bg-surface-200 border border-surface-300 rounded-lg transition-colors"
            title="Día siguiente"
          >
            Mañana →
          </button>

          <input
            type="date"
            value={fechaOperativa}
            onChange={(e) => e.target.value && setFechaOperativa(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium text-surface-800 bg-surface-50 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* 2. Tarjetas de Resumen KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm">
          <span className="text-[11px] font-medium text-surface-500 uppercase tracking-wider block">Plantilla activa</span>
          <span className="text-2xl font-bold text-surface-900 mt-1 block">{resumenData.totalActivas}</span>
          <span className="text-[10px] text-surface-400 block mt-0.5">Jugadoras disponibles en lista</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm">
          <span className="text-[11px] font-medium text-surface-500 uppercase tracking-wider block">Alertas activas</span>
          <span className={`text-2xl font-bold mt-1 block ${resumenData.totalAlertasActivas > 0 ? 'text-red-600' : 'text-surface-900'}`}>
            {resumenData.totalAlertasActivas}
          </span>
          <span className="text-[10px] text-surface-400 block mt-0.5">Sin resolver a la fecha</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm">
          <span className="text-[11px] font-medium text-surface-500 uppercase tracking-wider block">Pendientes Wellness</span>
          <span className={`text-2xl font-bold mt-1 block ${resumenData.totalPendientesWellness > 0 ? 'text-amber-600' : 'text-surface-900'}`}>
            {resumenData.totalPendientesWellness}
          </span>
          <span className="text-[10px] text-surface-400 block mt-0.5">Sin registro en fecha seleccionada</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm">
          <span className="text-[11px] font-medium text-surface-500 uppercase tracking-wider block">Bajas / Readaptación</span>
          <span className={`text-2xl font-bold mt-1 block ${resumenData.totalLesionadasOReadaptacion > 0 ? 'text-amber-700' : 'text-surface-900'}`}>
            {resumenData.totalLesionadasOReadaptacion}
          </span>
          <span className="text-[10px] text-surface-400 block mt-0.5">Con restricción de disponibilidad</span>
        </div>
      </div>

      {/* 3. Banner informativo de regla de ordenación */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-900 flex items-center gap-2">
        <span className="text-base">ℹ️</span>
        <div>
          <span className="font-semibold">Criterio de ordenación:</span> Se muestran primero las jugadoras con elementos pendientes de revisión (Alertas activas → Lesión/Readaptación → Sin wellness del día → Orden alfabético).
        </div>
      </div>

      {/* 4. Listado operativo por jugadora */}
      {resumenData.jugadoras.length === 0 ? (
        <div className="bg-white p-8 text-center rounded-xl border border-surface-200 text-surface-500 text-xs">
          No hay jugadoras activas en la plantilla.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-surface-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Jugadora</th>
                  <th className="py-3 px-4">Disponibilidad</th>
                  <th className="py-3 px-4">Wellness ({fechaOperativa})</th>
                  <th className="py-3 px-4">Alertas</th>
                  <th className="py-3 px-4">Último CMJ registrado</th>
                  <th className="py-3 px-4">Carga sRPE (Últimos 7 días)</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-150 text-surface-800">
                {resumenData.jugadoras.map((j) => (
                  <tr
                    key={j.id_jugadora}
                    className={`hover:bg-surface-50 transition-colors ${
                      j.requiereRevision ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    {/* Jugadora */}
                    <td className="py-3 px-4 font-medium">
                      <Link
                        to={`/jugadoras/${j.id_jugadora}`}
                        className="text-surface-900 hover:text-primary-600 font-bold block"
                      >
                        {j.nombre}
                      </Link>
                      <span className="text-[10px] text-surface-400 block font-normal">{j.posicion || 'Sin posición'}</span>
                    </td>

                    {/* Disponibilidad */}
                    <td className="py-3 px-4">
                      {j.disponibilidad === 'Disponible' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800 border border-green-200">
                          ✓ Disponible
                        </span>
                      ) : j.disponibilidad === 'Readaptacion' ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            🔄 Readaptación
                          </span>
                          {j.detalleLesion && (
                            <span className="text-[10px] text-surface-500 block italic">{j.detalleLesion}</span>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800 border border-red-200">
                            ⛔ Lesionada
                          </span>
                          {j.detalleLesion && (
                            <span className="text-[10px] text-surface-500 block italic">{j.detalleLesion}</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Wellness */}
                    <td className="py-3 px-4">
                      {j.wellnessDia ? (
                        <div className="space-y-0.5">
                          <span className="font-bold text-surface-900 text-xs">
                            {j.wellnessDia.score_wellness} / 100
                          </span>
                          <div className="flex gap-1 text-[9px] text-surface-500">
                            <span>Sueño: {j.wellnessDia.calidad_sueno}</span>
                            <span>·</span>
                            <span>Fatiga: {j.wellnessDia.fatiga}</span>
                            <span>·</span>
                            <span>Dolor: {j.wellnessDia.dolor_muscular}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-surface-100 text-surface-600 border border-surface-200">
                          Sin registro hoy
                        </span>
                      )}
                    </td>

                    {/* Alertas */}
                    <td className="py-3 px-4">
                      {j.alertasActivasCount > 0 ? (
                        <Link
                          to="/alertas"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800 border border-red-200 hover:bg-red-200 transition-colors"
                        >
                          ⚠️ {j.alertasActivasCount} activa(s)
                        </Link>
                      ) : (
                        <span className="text-[11px] text-surface-400">Sin alertas</span>
                      )}
                    </td>

                    {/* CMJ Reciente */}
                    <td className="py-3 px-4">
                      {j.cmjReciente ? (
                        <div className="space-y-0.5">
                          <span className="font-bold text-surface-900">
                            {j.cmjReciente.altura_cm.toFixed(1)} cm
                          </span>
                          <span className="text-[10px] text-surface-400 block">
                            Medido: {j.cmjReciente.fecha}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-surface-400 italic">Sin CMJ registrado</span>
                      )}
                    </td>

                    {/* Carga sRPE 7 días */}
                    <td className="py-3 px-4">
                      {j.carga7d ? (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-surface-900">
                            {j.carga7d.cargaAcumulada7d} UA
                          </span>
                          <span className="text-[10px] text-surface-500 block">
                            {j.carga7d.numSesiones} sesión(es) (última: {j.carga7d.ultimaSesionFecha || 'N/A'})
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-surface-400 italic">Sin sRPE reciente</span>
                      )}
                    </td>

                    {/* Acción */}
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/jugadoras/${j.id_jugadora}`}
                        className="px-2.5 py-1 text-[11px] font-semibold text-surface-700 bg-surface-100 hover:bg-surface-200 border border-surface-300 rounded transition-colors"
                      >
                        Ver ficha →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
