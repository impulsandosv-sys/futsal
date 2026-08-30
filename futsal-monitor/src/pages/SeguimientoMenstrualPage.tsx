import React, { useState, useMemo } from 'react'
import { useStore } from '@/store/store'
import { DataTable, DataRow, DataCell } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { getTodayLocalISO } from '@/domain/dates/dates'
import { sumarDias, calcularDiferenciaDias } from '@/domain/menstrual/menstrualEngine'
import type { RegistroMenstrual } from '@/types'
import { Link } from 'react-router-dom'

import { DecisionMenstrualModal } from '@/components/menstrual/DecisionMenstrualModal'

export function SeguimientoMenstrualPage() {
  const [modalMenstrualOpen, setModalMenstrualOpen] = useState(false)
  const [modalMenstrualData, setModalMenstrualData] = useState<{id: number, name: string} | null>(null)
  const {
    registros_menstruales,
    jugadoras,
    alertas,
    addRegistroMenstrual,
    updateRegistroMenstrual,
    deleteRegistroMenstrual,
    updateAlertaEstado
  } = useStore()

  const hoyStr = getTodayLocalISO()
  const jugadorasActivas = useMemo(() => jugadoras.filter((j) => j.activa !== false), [jugadoras])

  // Form State
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedJugadoraId, setSelectedJugadoraId] = useState<string>('')
  const [fechaInicio, setFechaInicio] = useState<string>(hoyStr)
  const [impactoPercibido, setImpactoPercibido] = useState<number>(3)
  const [comentario, setComentario] = useState<string>('')
  const [notaAjuste, setNotaAjuste] = useState<string>('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [registroToDelete, setRegistroToDelete] = useState<RegistroMenstrual | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Filter state for history table
  const [filterJugadora, setFilterJugadora] = useState<string>('todas')

  const resetForm = () => {
    setEditingId(null)
    setSelectedJugadoraId('')
    setFechaInicio(hoyStr)
    setImpactoPercibido(3)
    setComentario('')
    setNotaAjuste('')
    setFormError(null)
  }

  const handleEditClick = (reg: RegistroMenstrual) => {
    setEditingId(reg.id ?? null)
    setSelectedJugadoraId(reg.id_jugadora)
    setFechaInicio(reg.fecha_inicio)
    setImpactoPercibido(reg.impacto_percibido)
    setComentario(reg.comentario || '')
    setNotaAjuste(reg.nota_ajuste || '')
    setFormError(null)
    setFormSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(null)

    if (!selectedJugadoraId) {
      setFormError('Selecciona una jugadora')
      return
    }

    if (!fechaInicio) {
      setFormError('La fecha de inicio es obligatoria')
      return
    }

    if (fechaInicio > hoyStr) {
      setFormError('No se permiten fechas de inicio futuras')
      return
    }

    setSubmitting(true)
    try {
      if (editingId !== null) {
        await updateRegistroMenstrual(editingId, {
            fecha_inicio: fechaInicio,
            impacto_percibido: Number(impactoPercibido),
            comentario: comentario.trim() || null,
            nota_ajuste: notaAjuste.trim() || null
          })
        setFormSuccess('Registro actualizado correctamente')
        resetForm()
      } else {
        await addRegistroMenstrual({
          id_jugadora: selectedJugadoraId,
          fecha_inicio: fechaInicio,
          impacto_percibido: Number(impactoPercibido),
          comentario: comentario.trim() || null,
          nota_ajuste: notaAjuste.trim() || null
        })
        setFormSuccess('Registro guardado correctamente')
        resetForm()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el registro'
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (registroToDelete && registroToDelete.id !== undefined) {
      setDeleteError(null)
      try {
        await deleteRegistroMenstrual(registroToDelete.id)
        setDeleteModalOpen(false)
        setRegistroToDelete(null)
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Error al eliminar el registro.'
        setDeleteError(message)
      }
    }
  }

  // 1. Resumen "Hoy"
  const registrosHoy = useMemo(() => {
    return registros_menstruales.filter((r) => r.fecha_inicio === hoyStr)
  }, [registros_menstruales, hoyStr])

  // 2. Resumen "Últimos 7 días" (hoy y 6 días previos)
  const hace6Dias = sumarDias(hoyStr, -6)
  const registrosUltimos7Dias = useMemo(() => {
    return registros_menstruales.filter(
      (r) => r.fecha_inicio >= hace6Dias && r.fecha_inicio <= hoyStr
    )
  }, [registros_menstruales, hace6Dias, hoyStr])

  // 3. Recordatorios estimados activos
  const recordatoriosEstimados = useMemo(() => {
    return alertas.filter(
      (a) => a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA' && a.estado !== 'descartada' && a.estado !== 'resuelta'
    )
  }, [alertas])

  // Historial filtrado
  const historialFiltrado = useMemo(() => {
    if (filterJugadora === 'todas') return registros_menstruales
    return registros_menstruales.filter((r) => r.id_jugadora === filterJugadora)
  }, [registros_menstruales, filterJugadora])

  const getImpactoBadge = (impacto: number) => {
    if (impacto <= 3) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
    if (impacto <= 6) {
      return 'bg-amber-50 text-amber-700 border-amber-200'
    }
    return 'bg-rose-50 text-rose-700 border-rose-200'
  }

  return (
    <div className="space-y-6">
      {/* Header y Disclaimer */}
      <div>
        <h1 className="text-xl font-bold text-surface-900">Seguimiento menstrual</h1>
        <p className="text-xs text-surface-600 mt-0.5">
          Registro voluntario comunicado por la jugadora. Úsalo como contexto individual; no determina por sí solo la carga, el riesgo ni la disponibilidad.
        </p>
      </div>

      {/* Grid Superior: Formulario + Resúmenes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Formulario */}
        <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-surface-200 shadow-sm">
          <h2 className="text-sm font-bold text-surface-800 mb-3">
            {editingId !== null ? 'Editar registro de inicio' : 'Registrar nuevo inicio'}
          </h2>

          {formError && (
            <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="mb-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
              {formSuccess}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Selector Jugadora */}
              <div>
                <label htmlFor="select-jugadora" className="block text-[11px] font-medium text-surface-700 mb-1">
                  Jugadora *
                </label>
                <select
                  id="select-jugadora"
                  aria-label="Jugadora"
                  value={selectedJugadoraId}
                  onChange={(e) => setSelectedJugadoraId(e.target.value)}
                  disabled={editingId !== null}
                  className="w-full text-xs rounded-lg border border-surface-300 px-2.5 py-1.5 bg-white text-surface-800 focus:border-primary-500 focus:outline-none disabled:bg-surface-100"
                >
                  <option value="">Seleccionar jugadora activa...</option>
                  {jugadorasActivas.map((j) => (
                    <option key={j.id_jugadora} value={j.id_jugadora}>
                      {j.nombre} ({j.posicion})
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha de Inicio */}
              <div>
                <label htmlFor="input-fecha-inicio" className="block text-[11px] font-medium text-surface-700 mb-1">
                  Fecha de inicio comunicada *
                </label>
                <input
                  id="input-fecha-inicio"
                  aria-label="Fecha de inicio comunicada"
                  type="date"
                  max={hoyStr}
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full text-xs rounded-lg border border-surface-300 px-2.5 py-1.5 bg-white text-surface-800 focus:border-primary-500 focus:outline-none"
                />
              </div>

              {/* Impacto Percibido */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="input-impacto" className="text-[11px] font-medium text-surface-700">
                    Impacto percibido *
                  </label>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getImpactoBadge(impactoPercibido)}`}>
                    {impactoPercibido}/10
                  </span>
                </div>
                <input
                  id="input-impacto"
                  aria-label="Impacto percibido"
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={impactoPercibido}
                  onChange={(e) => setImpactoPercibido(parseInt(e.target.value, 10))}
                  className="w-full accent-primary-600 h-2 bg-surface-200 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-surface-400 mt-0.5">
                  <span>0 (Sin impacto)</span>
                  <span>5 (Moderado)</span>
                  <span>10 (Severo)</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Comentario */}
              <div>
                <label htmlFor="input-comentario" className="block text-[11px] font-medium text-surface-700 mb-1">
                  Comentario de la jugadora (opcional)
                </label>
                <input
                  id="input-comentario"
                  aria-label="Comentario de la jugadora"
                  type="text"
                  maxLength={200}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Ej: Molestia lumbar leve, sensación de fatiga..."
                  className="w-full text-xs rounded-lg border border-surface-300 px-2.5 py-1.5 bg-white text-surface-800 focus:border-primary-500 focus:outline-none"
                />
              </div>

              {/* Nota de ajuste del PF */}
              <div>
                <label htmlFor="input-nota-ajuste" className="block text-[11px] font-medium text-surface-700 mb-1">
                  Nota de ajuste / conversación del PF (opcional)
                </label>
                <input
                  id="input-nota-ajuste"
                  aria-label="Nota de ajuste del preparador físico"
                  type="text"
                  maxLength={200}
                  value={notaAjuste}
                  onChange={(e) => setNotaAjuste(e.target.value)}
                  placeholder="Ej: Ajuste manual en bloque de fuerza, charla post-entreno..."
                  className="w-full text-xs rounded-lg border border-surface-300 px-2.5 py-1.5 bg-white text-surface-800 focus:border-primary-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-end gap-2 pt-1">
              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 text-xs font-medium text-surface-600 bg-surface-100 hover:bg-surface-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Guardando...' : editingId !== null ? 'Actualizar registro' : 'Guardar registro'}
              </button>
            </div>
          </form>
        </div>

        {/* Resúmenes Hoy y Últimos 7 Días */}
        <div className="space-y-4">
          {/* Tarjeta Hoy */}
          <div className="bg-white p-3.5 rounded-xl border border-surface-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-surface-100 pb-2 mb-2">
              <h3 className="text-xs font-bold text-surface-800 uppercase tracking-wide">
                Hoy ({hoyStr})
              </h3>
              <span className="text-[10px] bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded font-semibold">
                {registrosHoy.length} {registrosHoy.length === 1 ? 'inicio' : 'inicios'}
              </span>
            </div>
            {registrosHoy.length === 0 ? (
              <p className="text-xs text-surface-500 italic">No hay inicios comunicados hoy.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {registrosHoy.map((r) => {
                  const j = jugadoras.find((x) => x.id_jugadora === r.id_jugadora)
                  return (
                    <li key={r.id} className="flex items-center justify-between p-1.5 rounded-lg bg-surface-50 border border-surface-100">
                      <span className="font-medium text-surface-800">{j?.nombre || r.id_jugadora}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${getImpactoBadge(r.impacto_percibido)}`}>
                        Imp: {r.impacto_percibido}/10
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Tarjeta Últimos 7 días */}
          <div className="bg-white p-3.5 rounded-xl border border-surface-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-surface-100 pb-2 mb-2">
              <h3 className="text-xs font-bold text-surface-800 uppercase tracking-wide">
                Últimos 7 días
              </h3>
              <span className="text-[10px] bg-surface-100 text-surface-700 px-1.5 py-0.5 rounded font-semibold">
                {registrosUltimos7Dias.length}
              </span>
            </div>
            <p className="text-[10px] text-surface-400 mb-2">
              Último inicio comunicado (no presupone duración ni estado activo actual):
            </p>
            {registrosUltimos7Dias.length === 0 ? (
              <p className="text-xs text-surface-500 italic">Sin inicios en los últimos 7 días.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {registrosUltimos7Dias.map((r) => {
                  const j = jugadoras.find((x) => x.id_jugadora === r.id_jugadora)
                  return (
                    <li key={r.id} className="flex items-center justify-between p-1.5 rounded-lg bg-surface-50 border border-surface-100">
                      <div>
                        <span className="font-medium text-surface-800 block">{j?.nombre || r.id_jugadora}</span>
                        <span className="text-[10px] text-surface-400">Inicio: {r.fecha_inicio}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${getImpactoBadge(r.impacto_percibido)}`}>
                        Imp: {r.impacto_percibido}/10
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Recordatorios Estimados */}
      <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-surface-200 pb-2">
          <div>
            <h2 className="text-sm font-bold text-surface-800 uppercase tracking-wide">
              Recordatorios estimados ({recordatoriosEstimados.length})
            </h2>
            <p className="text-[11px] text-surface-500">
              Estimaciones calculadas a partir del historial real. Ventana activa: 3 días antes hasta 7 días después de la fecha estimada.
            </p>
          </div>
          <Link
            to="/alertas"
            className="text-xs text-primary-600 hover:underline font-medium"
          >
            Ver en Centro de Alertas →
          </Link>
        </div>

        {recordatoriosEstimados.length === 0 ? (
          <p className="text-xs text-surface-500 italic py-2">
            No hay recordatorios estimados activos en este momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {recordatoriosEstimados.map((alerta) => {
              const jug = jugadoras.find((j) => j.id_jugadora === alerta.id_jugadora)
              const diff = calcularDiferenciaDias(hoyStr, alerta.fecha)
              const diasTexto =
                diff === 0
                  ? 'Estimado hoy'
                  : diff > 0
                  ? `Estimado en ${diff} día(s)`
                  : `Estimado hace ${Math.abs(diff)} día(s)`

              let sustentoParsed: {
                fecha_estimada?: string
                ultimo_inicio?: string
                mediana_intervalos?: number
                intervalos_usados?: number[]
                variabilidad_reciente?: boolean
                fecha_activacion?: string
                fecha_caducidad?: string
              } | null = null
              try {
                if (alerta.datos_sustento) sustentoParsed = JSON.parse(alerta.datos_sustento)
              } catch {
                // Ignore parse errors
              }

              const tieneVariabilidad = sustentoParsed?.variabilidad_reciente === true

              return (
                <div
                  key={alerta.id}
                  className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col justify-between space-y-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Link
                        to={`/jugadoras/${alerta.id_jugadora}`}
                        className="font-bold text-xs text-primary-700 hover:underline"
                      >
                        {jug?.nombre || alerta.id_jugadora}
                      </Link>
                      <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300">
                        {diasTexto}
                      </span>
                    </div>

                    <p className="text-xs text-surface-700 font-medium">
                      Fecha estimada: <span className="font-bold text-surface-900">{alerta.fecha}</span>
                    </p>

                    {sustentoParsed?.ultimo_inicio && (
                      <p className="text-[10px] text-surface-500">
                        Último inicio: {sustentoParsed.ultimo_inicio} (Mediana: {sustentoParsed.mediana_intervalos}d)
                      </p>
                    )}

                    {tieneVariabilidad && (
                      <div className="text-[10px] text-amber-800 bg-amber-100/70 p-1.5 rounded border border-amber-200">
                        Variabilidad reciente en intervalos ({sustentoParsed?.intervalos_usados?.join(', ')} días). Confirmar contexto.
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-1.5 pt-1 border-t border-amber-200/50 flex-wrap">
                    <button
                      onClick={() => alerta.id !== undefined && updateAlertaEstado(alerta.id, 'descartada')}
                      className="text-[10px] px-2 py-1 rounded bg-white text-surface-700 border border-surface-300 hover:bg-surface-100 font-medium"
                    >
                      Descartar
                    </button>
                    <button
                      onClick={() => alerta.id !== undefined && updateAlertaEstado(alerta.id, 'resuelta')}
                      className="text-[10px] px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
                    >
                      Resolver
                    </button>
                    {(() => {
                      const ultimoRegistro = registros_menstruales
                        .filter(r => r.id_jugadora === alerta.id_jugadora)
                        .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))[0]

                      return ultimoRegistro ? (
                        <button
                          onClick={() => { setModalMenstrualData({id: ultimoRegistro.id!, name: jug?.nombre || alerta.id_jugadora}); setModalMenstrualOpen(true); }}
                          className="text-[10px] px-2 py-1 rounded bg-primary-600 text-white hover:bg-primary-700 font-medium"
                        >
                          Decisión
                        </button>
                      ) : null
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Historial de Registros Comunicados */}
      <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-200 pb-3">
          <div>
            <h2 className="text-sm font-bold text-surface-800 uppercase tracking-wide">
              Historial de registros comunicados ({historialFiltrado.length})
            </h2>
            <p className="text-[11px] text-surface-500">
              Registro cronológico individual para contexto del preparador físico.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="select-filtro-jugadora" className="text-[11px] font-medium text-surface-600">Filtrar por jugadora:</label>
            <select
              id="select-filtro-jugadora"
              aria-label="Filtrar por jugadora"
              value={filterJugadora}
              onChange={(e) => setFilterJugadora(e.target.value)}
              className="border border-surface-300 rounded-lg px-2.5 py-1 bg-white text-surface-800 text-xs focus:border-primary-500 focus:outline-none"
            >
              <option value="todas">Todas las jugadoras ({jugadoras.length})</option>
              {jugadoras.map((j) => (
                <option key={j.id_jugadora} value={j.id_jugadora}>
                  {j.nombre} {j.activa === false ? '(Inactiva)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          headers={['Fecha inicio', 'Jugadora', 'Impacto', 'Comentario', 'Acción registrada', 'Nota de ajuste', 'Acciones']}
          emptyMessage="No hay registros menstruales en el historial."
        >
          {historialFiltrado.map((reg) => {
            const jug = jugadoras.find((j) => j.id_jugadora === reg.id_jugadora)
            return (
              <DataRow key={reg.id}>
                <DataCell className="font-bold text-xs text-surface-800 whitespace-nowrap">
                  {reg.fecha_inicio}
                </DataCell>
                <DataCell>
                  <Link
                    to={`/jugadoras/${reg.id_jugadora}`}
                    className="font-semibold text-xs text-primary-600 hover:underline block"
                  >
                    {jug?.nombre || reg.id_jugadora}
                  </Link>
                  {jug?.posicion && (
                    <span className="text-[10px] text-surface-400 block">
                      {jug.posicion} {jug.activa === false ? '• Inactiva' : ''}
                    </span>
                  )}
                </DataCell>
                <DataCell>
                  <span className={`inline-block border rounded px-1.5 py-0.5 text-[10px] font-bold ${getImpactoBadge(reg.impacto_percibido)}`}>
                    {reg.impacto_percibido}/10
                  </span>
                </DataCell>
                <DataCell className="text-xs text-surface-600 max-w-xs">
                  {reg.comentario || <span className="text-surface-300 italic">—</span>}
                </DataCell>
                <DataCell className="text-xs text-surface-600">
                  {reg.accion_ajuste ? (
                    <span className="inline-block bg-surface-100 text-surface-700 px-2 py-0.5 rounded text-[10px] font-medium border border-surface-200">
                      {reg.accion_ajuste.replace(/_/g, ' ')}
                    </span>
                  ) : (
                    <span className="text-surface-300 italic">—</span>
                  )}
                  {reg.fecha_decision && <div className="text-[9px] text-surface-400 mt-0.5">{reg.fecha_decision}</div>}
                </DataCell>
                <DataCell className="text-xs text-surface-600 max-w-xs">
                  {reg.nota_ajuste || <span className="text-surface-300 italic">—</span>}
                </DataCell>
                <DataCell>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => { setModalMenstrualData({id: reg.id!, name: jug?.nombre || reg.id_jugadora}); setModalMenstrualOpen(true); }}
                      className="text-[11px] text-surface-700 bg-white border border-surface-300 font-medium px-1.5 py-0.5 rounded hover:bg-surface-50"
                    >
                      Decisión
                    </button>
                    <button
                      onClick={() => handleEditClick(reg)}
                      className="text-[11px] text-primary-600 hover:text-primary-800 font-medium px-1.5 py-0.5 rounded hover:bg-primary-50"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => {
                        setRegistroToDelete(reg)
                        setDeleteModalOpen(true)
                      }}
                      className="text-[11px] text-red-600 hover:text-red-800 font-medium px-1.5 py-0.5 rounded hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </DataCell>
              </DataRow>
            )
          })}
        </DataTable>
      </div>

      {/* Modal para Eliminar */}
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setRegistroToDelete(null)
        }}
        title="Eliminar registro menstrual"
      >
        <div className="space-y-3 text-xs">
          <p className="text-surface-700">
            ¿Estás seguro de que deseas eliminar el registro de inicio del {registroToDelete?.fecha_inicio}? Esta acción no se puede deshacer.
          </p>
            {deleteError && (
              <div className="bg-red-50 text-red-600 p-2 rounded-md">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setDeleteModalOpen(false)
                setRegistroToDelete(null)
              }}
              className="px-3 py-1.5 rounded-lg bg-surface-100 text-surface-700 hover:bg-surface-200 text-xs font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 text-xs font-semibold"
            >
              Eliminar registro
            </button>
          </div>
        </div>
      </Modal>

      {modalMenstrualData && (
        <DecisionMenstrualModal
          open={modalMenstrualOpen}
          onClose={() => setModalMenstrualOpen(false)}
          registroId={modalMenstrualData.id}
          jugadoraName={modalMenstrualData.name}
        />
      )}
    </div>
  )
}
