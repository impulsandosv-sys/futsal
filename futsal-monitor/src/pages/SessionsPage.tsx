import { useState, useEffect, useRef, useMemo } from 'react'
import { useStore } from '@/store/store'
import { DataTable, DataRow, DataCell } from '@/components/shared/DataTable'
import { Filters } from '@/components/shared/Filters'
import { Modal } from '@/components/shared/Modal'
import { DatePicker } from '@/components/shared/DatePicker'
import { calcularCompletitudSesion } from '@/domain/monitoring/monitoring'
import { calcularCargaUA, calcularCargaMediaRealizada } from '@/domain/calculations/loadCalculations'
import type { Sesion, TipoDia, TipoSesion, SesionRPE } from '@/types'
import { getTodayLocalISO } from '@/domain/dates/dates'
import { WeeklyCalendar } from '@/components/planning/WeeklyCalendar'

export function SessionsPage() {
  const { sesiones, partidos, jugadoras, sesion_rpe, filters, addSesion, updateSesion } = useStore()
  const [view, setView] = useState<'plan' | 'historial'>('plan')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Sesion | null>(null)
  const [form, setForm] = useState<Sesion>({
    id_sesion: '', fecha: getTodayLocalISO(),
    tipo_dia: 'Entreno', tipo_sesion: 'Fisico', duracion_planificada_min: 60,
    objetivo_principal: '', observaciones_grupo: '', estado: 'planificada',
  })

  const [rpeModalOpen, setRpeModalOpen] = useState(false)
  const [rpeSession, setRpeSession] = useState<Sesion | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)

  interface RpeEntryState {
    rpe: number | '';
    duracion_min: number | '';
    asistencia: 'completa' | 'parcial' | 'ausente' | 'no_convocada' | 'excusada' | 'sin_registrar';
    motivo_participacion_reducida: string;
    comentario_staff: string;
  }
  const [rpeEntriesState, setRpeEntriesState] = useState<Record<string, RpeEntryState>>({})

  const activas = useMemo(() => jugadoras.filter(j => j.activa !== false), [jugadoras])

  useEffect(() => {
    if (rpeSession) {
      const existing = sesion_rpe.filter(r => r.id_sesion === rpeSession.id_sesion)
      const entries: Record<string, RpeEntryState> = {}
      const baseDuration = rpeSession.duracion_real_grupal_min ?? rpeSession.duracion_planificada_min ?? ''
      for (const j of activas) {
        const match = existing.find(r => r.id_jugadora === j.id_jugadora)
        entries[j.id_jugadora] = {
          rpe: (match?.rpe !== null && match?.rpe !== undefined) ? match.rpe : '',
          duracion_min: (match?.duracion_min !== null && match?.duracion_min !== undefined) ? match.duracion_min : baseDuration,
          asistencia: match?.asistencia ?? 'sin_registrar',
          motivo_participacion_reducida: match?.motivo_participacion_reducida ?? '',
          comentario_staff: match?.comentario_staff ?? '',
        }
      }
      setRpeEntriesState(entries)
    }
  }, [rpeSession, sesion_rpe, activas])

  const openRpeModal = (s: Sesion) => {
    setRpeSession(s)
    setRpeModalOpen(true)
  }

  const { saveRpeBatch, cancelSesion, duplicateSesion } = useStore()
  const handleCrearCompensatorio = async (jugadora: import('@/types').Jugadora) => {
    if (!rpeSession) return
    const id = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const compensatorio: Sesion = {
      id_sesion: id,
      fecha: getTodayLocalISO(), // Hoy
      tipo_dia: 'Entreno',
      tipo_sesion: 'Compensatorio',
      objetivo_principal: `Compensatorio para ${jugadora.nombre} (Origen: ${rpeSession.id_sesion})`,
      observaciones_grupo: '',
      estado: 'planificada',
      sesion_origen_id: rpeSession.id_sesion,
      duracion_planificada_min: 30
    }
    await useStore.getState().addSesion(compensatorio)
    alert(`Se ha creado una sesión compensatoria para ${jugadora.nombre} en Plan Semanal.`)
  }

  const handleSaveRpe = async () => {
    if (!rpeSession) return
    if (isSubmittingRef.current) return

    isSubmittingRef.current = true
    setIsSubmitting(true)

    try {
      const batch: SesionRPE[] = []
      for (const [id_jugadora, entry] of Object.entries(rpeEntriesState)) {
        if (entry.asistencia === 'sin_registrar') continue // No guardamos si no se ha registrado

        const esAusente = ['ausente', 'no_convocada', 'excusada'].includes(entry.asistencia)
        const rpeVal = esAusente || entry.rpe === '' ? null : Number(entry.rpe)
        const durVal = esAusente || entry.duracion_min === '' ? null : Number(entry.duracion_min)
        const cargaVal = calcularCargaUA(rpeVal, durVal)

        const payload: Omit<SesionRPE, 'id'> = {
          id_sesion: rpeSession.id_sesion,
          id_jugadora,
          rpe: rpeVal,
          duracion_min: durVal,
          carga_ua: cargaVal,
          fecha: rpeSession.fecha,
          asistencia: entry.asistencia,
          motivo_participacion_reducida: entry.motivo_participacion_reducida,
          comentario_staff: entry.comentario_staff,
        }

        const existing = sesion_rpe.find(
          (r) => r.id_sesion === rpeSession.id_sesion && r.id_jugadora === id_jugadora
        )
        if (existing) {
          batch.push({ ...existing, ...payload })
        } else {
          batch.push(payload)
        }
      }
      await saveRpeBatch(batch)
      setRpeModalOpen(false)
      setRpeSession(null)
    } catch (err) {
      console.error('Error guardando batch RPE:', err)
      throw err
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const filtered = sesiones.filter((s) => {
    if (filters.fecha_desde && s.fecha < filters.fecha_desde) return false
    if (filters.fecha_hasta && s.fecha > filters.fecha_hasta) return false
    if (filters.tipo_sesion && s.tipo_sesion !== filters.tipo_sesion) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-surface-800">Sesiones y Planificación</h1>
          <div className="flex bg-surface-100 rounded p-0.5">
            <button
              onClick={() => setView('plan')}
              className={`px-3 py-1 text-xs font-medium rounded ${view === 'plan' ? 'bg-white shadow-sm text-primary-700' : 'text-surface-600 hover:text-surface-900'}`}
            >
              Plan Semanal
            </button>
            <button
              onClick={() => setView('historial')}
              className={`px-3 py-1 text-xs font-medium rounded ${view === 'historial' ? 'bg-white shadow-sm text-primary-700' : 'text-surface-600 hover:text-surface-900'}`}
            >
              Historial
            </button>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setForm({
          id_sesion: `ses_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, fecha: getTodayLocalISO(),
          tipo_dia: 'Entreno', tipo_sesion: 'Fisico', duracion_planificada_min: 60,
          objetivo_principal: '', observaciones_grupo: '', estado: 'planificada',
        }); setModalOpen(true) }}
          className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700"
        >
          + Nueva sesión
        </button>
      </div>

      <Filters showDate showSessionType />

      {view === 'plan' ? (
        <WeeklyCalendar 
          fechaBase={filters.fecha_desde || getTodayLocalISO()} 
          sesiones={sesiones} 
          partidos={partidos} 
          onSelectSesion={(s) => { setEditing(s); setForm(s); setModalOpen(true) }}
          onAddSesion={(fecha) => {
            setEditing(null)
            setForm({
              id_sesion: `ses_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, 
              fecha,
              tipo_dia: 'Entreno', tipo_sesion: 'Fisico', duracion_planificada_min: 60,
              objetivo_principal: '', observaciones_grupo: '', estado: 'planificada',
            })
            setModalOpen(true)
          }}
        />
      ) : (
        <DataTable
          headers={['ID', 'Fecha', 'Tipo día', 'Tipo sesión', 'Duración', 'Estado', 'Objetivo', 'Completitud', 'Acciones']}
          emptyMessage="No hay sesiones registradas"
        >
          {filtered.map((s) => (
            <DataRow key={s.id_sesion}>
              <DataCell className="font-mono text-[10px] text-surface-500">{s.id_sesion}</DataCell>
              <DataCell>{s.fecha}</DataCell>
              <DataCell>{s.tipo_dia}</DataCell>
              <DataCell>{s.tipo_sesion}</DataCell>
              <DataCell>{s.duracion_real_grupal_min ? `${s.duracion_real_grupal_min} min (R)` : `${s.duracion_planificada_min || 0} min (P)`}</DataCell>
              <DataCell>
                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium capitalize ${
                  s.estado === 'planificada' ? 'text-amber-700 bg-amber-50' : 'text-blue-700 bg-blue-50'
                }`}>
                  {s.estado || 'realizada'}
                </span>
              </DataCell>
              <DataCell className="max-w-[150px] truncate">{s.objetivo_principal || '—'}</DataCell>
              <DataCell>
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  (() => {
                    const rpes = sesion_rpe.filter(r => r.id_sesion === s.id_sesion)
                    const comp = calcularCompletitudSesion(jugadoras, rpes)
                    if (comp >= 90) return 'text-green-700 bg-green-50'
                    if (comp >= 50) return 'text-amber-700 bg-amber-50'
                    return 'text-red-700 bg-red-50'
                  })()
                }`}>
                  {(() => {
                    const rpes = sesion_rpe.filter(r => r.id_sesion === s.id_sesion)
                    return calcularCompletitudSesion(jugadoras, rpes)
                  })()}%
                </span>
              </DataCell>
              <DataCell>
                <button onClick={() => { setEditing(s); setForm(s); setModalOpen(true) }}
                  className="text-[10px] text-primary-600 hover:underline mr-2">Editar</button>
                {s.estado !== 'cancelada' && (
                  <button onClick={() => openRpeModal(s)}
                    className="text-[10px] text-primary-600 hover:underline font-semibold mr-2">RPE</button>
                )}
                {s.estado === 'planificada' && (
                  <button onClick={() => { if(confirm('¿Cancelar sesión?')) cancelSesion(s.id_sesion).catch(e => alert(e.message)) }}
                    className="text-[10px] text-red-600 hover:underline font-semibold mr-2">Cancelar</button>
                )}
                <button onClick={() => { duplicateSesion(s.id_sesion, s.fecha).catch(e => alert(e.message)) }}
                    className="text-[10px] text-surface-600 hover:underline">Duplicar</button>
              </DataCell>
            </DataRow>
          ))}
        </DataTable>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar sesión' : 'Nueva sesión'}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">ID Sesión *</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs text-surface-700 bg-white"
              value={form.id_sesion} onChange={(e) => setForm({ ...form, id_sesion: e.target.value })}
              disabled={!!editing} />
          </div>
          <DatePicker
            label="Fecha"
            value={form.fecha}
            onChange={(fecha) => setForm({ ...form, fecha })}
          />
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Tipo de día</label>
            <select className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs bg-white text-surface-700"
              value={form.tipo_dia} onChange={(e) => setForm({ ...form, tipo_dia: e.target.value as TipoDia })}>
              <option value="Entreno">Entreno</option>
              <option value="Partido">Partido</option>
              <option value="Descanso">Descanso</option>
              <option value="Viaje">Viaje</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Tipo de sesión</label>
            <select className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs bg-white text-surface-700"
              value={form.tipo_sesion} onChange={(e) => setForm({ ...form, tipo_sesion: e.target.value as TipoSesion })}>
              <option value="Fisico">Físico</option>
              <option value="Tecnico">Técnico</option>
              <option value="Tactico">Táctico</option>
              <option value="Pista">Pista</option>
              <option value="Partido">Partido</option>
              <option value="Recuperacion">Recuperación</option>
              <option value="Preventivo">Preventivo</option>
              <option value="Gimnasio">Gimnasio</option>
              <option value="Readaptacion">Readaptación</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Duración Planificada (min)</label>
            <input type="number" className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs text-surface-700 bg-white"
              value={form.duracion_planificada_min || ''} onChange={(e) => setForm({ ...form, duracion_planificada_min: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Duración Real (min)</label>
            <input type="number" className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs text-surface-700 bg-white"
              value={form.duracion_real_grupal_min || ''} onChange={(e) => setForm({ ...form, duracion_real_grupal_min: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Estado</label>
            <select className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs bg-white text-surface-700"
              value={form.estado || 'realizada'} onChange={(e) => setForm({ ...form, estado: e.target.value as any })}>
              <option value="realizada">Realizada</option>
              <option value="planificada">Planificada</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">RPE Objetivo</label>
            <input type="number" step="0.1" className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs text-surface-700 bg-white"
              value={form.rpe_objetivo || ''} onChange={(e) => setForm({ ...form, rpe_objetivo: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Participantes Previstos</label>
            <input type="number" className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs text-surface-700 bg-white"
              value={form.participantes_previstos || ''} onChange={(e) => setForm({ ...form, participantes_previstos: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Objetivo principal</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs text-surface-700 bg-white"
              value={form.objetivo_principal} onChange={(e) => setForm({ ...form, objetivo_principal: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Observaciones grupo</label>
            <textarea className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs text-surface-700 bg-white" rows={2}
              value={form.observaciones_grupo} onChange={(e) => setForm({ ...form, observaciones_grupo: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setModalOpen(false)} className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded">Cancelar</button>
          <button onClick={async () => {
            if (editing) await updateSesion(form); else await addSesion(form)
            setModalOpen(false)
          }} className="text-xs text-white bg-primary-600 px-3 py-1.5 rounded hover:bg-primary-700">
            {editing ? 'Guardar' : 'Crear sesión'}
          </button>
        </div>
      </Modal>

      <Modal open={rpeModalOpen} onClose={() => setRpeModalOpen(false)} title={`RPE y Asistencia — ${rpeSession?.fecha || ''}`}>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="bg-surface-50 p-2 border border-surface-200 rounded text-[10px] text-surface-600 mb-2">
            <div className="flex justify-between items-center mb-1">
              <span><strong>Duración:</strong> {rpeSession?.duracion_planificada_min} min planif. | {rpeSession?.duracion_real_grupal_min || '-'} min real</span>
              <span><strong>RPE Obj:</strong> {rpeSession?.rpe_objetivo || 'No dif.'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span><strong>Carga Indiv.:</strong> Obj. {rpeSession?.duracion_planificada_min && rpeSession.rpe_objetivo ? Math.round(rpeSession.duracion_planificada_min * rpeSession.rpe_objetivo) : '-'} UA | Media {Math.round(calcularCargaMediaRealizada(Object.values(rpeEntriesState).map(e => ({ carga_ua: calcularCargaUA(e.rpe !== '' ? Number(e.rpe) : null, e.duracion_min !== '' ? Number(e.duracion_min) : null) })))) || '-'} UA</span>
              <span><strong>Carga Total:</strong> {rpeSession?.participantes_previstos && rpeSession.duracion_planificada_min && rpeSession.rpe_objetivo ? Math.round(rpeSession.duracion_planificada_min * rpeSession.rpe_objetivo * rpeSession.participantes_previstos) : 'Objetivo total no definido'} | Real {Math.round(Object.values(rpeEntriesState).reduce((acc, e) => acc + (calcularCargaUA(e.rpe !== '' ? Number(e.rpe) : null, e.duracion_min !== '' ? Number(e.duracion_min) : null) || 0), 0))} UA</span>
            </div>
          </div>
          {activas.map((j) => {
            const baseDuration = rpeSession?.duracion_real_grupal_min ?? rpeSession?.duracion_planificada_min ?? ''
            const entry = rpeEntriesState[j.id_jugadora] || {
              rpe: '',
              duracion_min: baseDuration,
              asistencia: 'sin_registrar',
              motivo_participacion_reducida: '',
              comentario_staff: '',
            }
            const isAusente = ['ausente', 'no_convocada', 'excusada'].includes(entry.asistencia)
            const rpeVal = isAusente || entry.rpe === '' ? null : Number(entry.rpe)
            const durVal = isAusente || entry.duracion_min === '' ? null : Number(entry.duracion_min)
            const cargaVal = calcularCargaUA(rpeVal, durVal)

            return (
              <div key={j.id_jugadora} className="py-2.5 border-b border-surface-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-surface-700">{j.nombre}</span>
                    <span className="text-[9px] text-surface-400">{j.posicion}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-[10px] text-surface-600 font-semibold font-mono">
                      {cargaVal !== null ? `${cargaVal} UA` : <span className="text-amber-600 font-sans text-[9px] font-normal">Dato incompleto</span>}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] font-medium text-surface-500 block mb-0.5">Asistencia</label>
                    <select
                      className={`w-full border rounded px-1 py-1 text-[10px] ${entry.asistencia === 'sin_registrar' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-surface-200 bg-white text-surface-700'}`}
                      value={entry.asistencia}
                      onChange={(e) => setRpeEntriesState({
                        ...rpeEntriesState,
                        [j.id_jugadora]: { ...entry, asistencia: e.target.value as any }
                      })}
                    >
                      <option value="sin_registrar">Sin registrar</option>
                      <option value="completa">Completa</option>
                      <option value="parcial">Parcial</option>
                      <option value="ausente">Ausente</option>
                      <option value="no_convocada">No convocada</option>
                      <option value="excusada">Excusada</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-medium text-surface-500 block mb-0.5">RPE (1-10)</label>
                    <select
                      className="w-full border border-surface-200 rounded px-1 py-1 text-[10px] bg-white text-surface-700 disabled:opacity-50"
                      value={entry.rpe}
                      disabled={isAusente}
                      onChange={(e) => setRpeEntriesState({
                        ...rpeEntriesState,
                        [j.id_jugadora]: { ...entry, rpe: e.target.value === '' ? '' : Number(e.target.value) }
                      })}
                    >
                      <option value="">—</option>
                      {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-medium text-surface-500 block mb-0.5">Duración (min)</label>
                    <input
                      type="number"
                      disabled={isAusente}
                      className="w-full border border-surface-200 rounded px-1.5 py-0.5 text-[10px] text-surface-700 bg-white disabled:opacity-50"
                      value={entry.duracion_min}
                      onChange={(e) => setRpeEntriesState({
                        ...rpeEntriesState,
                        [j.id_jugadora]: { ...entry, duracion_min: e.target.value === '' ? '' : Number(e.target.value) }
                      })}
                    />
                  </div>
                </div>
                {entry.asistencia === 'parcial' && (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <input
                        placeholder="Motivo participación reducida..."
                        className="w-full border border-surface-200 rounded px-2 py-1 text-[9px] text-surface-700 bg-white"
                        value={entry.motivo_participacion_reducida}
                        onChange={(e) => setRpeEntriesState({
                          ...rpeEntriesState,
                          [j.id_jugadora]: { ...entry, motivo_participacion_reducida: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <input
                        placeholder="Comentario staff..."
                        className="w-full border border-surface-200 rounded px-2 py-1 text-[9px] text-surface-700 bg-white"
                        value={entry.comentario_staff}
                        onChange={(e) => setRpeEntriesState({
                          ...rpeEntriesState,
                          [j.id_jugadora]: { ...entry, comentario_staff: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                )}
                {['parcial', 'ausente', 'no_convocada', 'excusada'].includes(entry.asistencia) && (
                  <div className="mt-1 flex justify-end">
                    <button 
                      onClick={() => handleCrearCompensatorio(j)}
                      className="text-[9px] text-primary-600 font-medium hover:underline flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Crear sesión compensatoria
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setRpeModalOpen(false)} disabled={isSubmitting} className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded disabled:opacity-50">Cancelar</button>
          <button onClick={handleSaveRpe} disabled={isSubmitting} className="text-xs text-white bg-primary-600 px-3 py-1.5 rounded hover:bg-primary-700 disabled:opacity-50">
            {isSubmitting ? 'Guardando...' : 'Guardar RPE'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
