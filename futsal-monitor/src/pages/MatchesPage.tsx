import { useState } from 'react'
import { useStore } from '@/store/store'
import { DataTable, DataRow, DataCell } from '@/components/shared/DataTable'
import { Filters } from '@/components/shared/Filters'
import { Modal } from '@/components/shared/Modal'
import { DatePicker } from '@/components/shared/DatePicker'
import type { Partido, ParticipacionPartido } from '@/types'

export function MatchesPage() {
  const { partidos, rpe_partido, jugadoras, filters, addPartido, updatePartido } = useStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Partido | null>(null)
  const [form, setForm] = useState<Partido>({
    id_partido: '', fecha: '', rival: '', competicion: '', resultado: '', lugar: 'Local',
  })

  const [rpeModalOpen, setRpeModalOpen] = useState(false)
  const [rpePartido, setRpePartido] = useState<string>('')
  const [rpeForm, setRpeForm] = useState<{
    id_jugadora: string;
    minutos_jugados: number | '';
    rpe: number | '';
    participacion: ParticipacionPartido | '';
    motivo_participacion_reducida: string;
  }>({ id_jugadora: '', minutos_jugados: 0, rpe: 5, participacion: '', motivo_participacion_reducida: '' })
  
  const [confirmClearData, setConfirmClearData] = useState<{ pendingParticipacion: ParticipacionPartido } | null>(null)

  const filtered = partidos.filter((p) => {
    if (filters.fecha_desde && p.fecha < filters.fecha_desde) return false
    if (filters.fecha_hasta && p.fecha > filters.fecha_hasta) return false
    return true
  })

  const handleAddRPE = async () => {
    const { addRPE_Partido } = useStore.getState()
    const isZero = rpeForm.participacion === 'no_convocada' || rpeForm.participacion === 'convocada_sin_minutos'
    const finalMinutos = isZero ? 0 : (rpeForm.minutos_jugados === '' ? null : Number(rpeForm.minutos_jugados))
    const finalRpe = isZero ? null : (rpeForm.rpe === '' ? null : Number(rpeForm.rpe))
    
    await addRPE_Partido({
      id_partido: rpePartido,
      id_jugadora: rpeForm.id_jugadora,
      minutos_jugados: finalMinutos,
      rpe: finalRpe,
      fecha: partidos.find(p => p.id_partido === rpePartido)?.fecha || '',
      carga_ua: (finalRpe ?? 0) * (finalMinutos ?? 0),
      participacion: rpeForm.participacion || undefined,
      motivo_participacion_reducida: rpeForm.motivo_participacion_reducida || undefined
    })
    setRpeModalOpen(false)
    setRpeForm({ id_jugadora: '', minutos_jugados: 0, rpe: 5, participacion: '', motivo_participacion_reducida: '' })
  }

  const handleParticipacionChange = (nuevaPart: ParticipacionPartido) => {
    const isCurrentlyFilled = (rpeForm.minutos_jugados !== 0 && rpeForm.minutos_jugados !== '') || (rpeForm.rpe !== '' && rpeForm.rpe !== null)
    const clearsData = nuevaPart === 'no_convocada' || nuevaPart === 'convocada_sin_minutos'
    
    if (isCurrentlyFilled && clearsData) {
      setConfirmClearData({ pendingParticipacion: nuevaPart })
    } else {
      applyParticipacion(nuevaPart)
    }
  }

  const applyParticipacion = (part: ParticipacionPartido) => {
    setConfirmClearData(null)
    const newForm = { ...rpeForm, participacion: part }
    if (part === 'completa') {
      newForm.minutos_jugados = 40
    } else if (part === 'no_convocada' || part === 'convocada_sin_minutos') {
      newForm.minutos_jugados = 0
      newForm.rpe = ''
    }
    setRpeForm(newForm)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-surface-800">Partidos</h1>
        <div className="flex gap-2">
          <button onClick={() => { setEditing(null); setForm({
            id_partido: '', fecha: '', rival: '', competicion: '', resultado: '', lugar: 'Local',
          }); setModalOpen(true) }}
            className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700"
          >
            + Nuevo partido
          </button>
        </div>
      </div>

      <Filters showDate />

      <DataTable
        headers={['ID', 'Fecha', 'Rival', 'Competición', 'Resultado', 'Lugar', 'RPE', 'Acciones']}
        emptyMessage="No hay partidos registrados"
      >
        {filtered.map((p) => {
          const rpes = rpe_partido.filter((r) => r.id_partido === p.id_partido)
          const cargaTotal = rpes.reduce((s, r) => s + (r.carga_ua || 0), 0)
          return (
            <DataRow key={p.id_partido}>
              <DataCell className="font-mono text-[10px] text-surface-500">{p.id_partido}</DataCell>
              <DataCell>{p.fecha}</DataCell>
              <DataCell className="font-medium">{p.rival}</DataCell>
              <DataCell>{p.competicion}</DataCell>
              <DataCell>{p.resultado || '—'}</DataCell>
              <DataCell>{p.lugar}</DataCell>
              <DataCell>
                <button onClick={() => { setRpePartido(p.id_partido); setRpeModalOpen(true) }}
                  className="text-primary-600 hover:underline">
                  {rpes.length > 0 ? `${Math.round(cargaTotal)} UA (${rpes.length})` : 'Añadir RPE'}
                </button>
              </DataCell>
              <DataCell>
                <button onClick={() => { setEditing(p); setForm(p); setModalOpen(true) }}
                  className="text-[10px] text-primary-600 hover:underline">Editar</button>
              </DataCell>
            </DataRow>
          )
        })}
      </DataTable>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar partido' : 'Nuevo partido'}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">ID Partido *</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.id_partido} onChange={(e) => setForm({ ...form, id_partido: e.target.value })}
              disabled={!!editing} />
          </div>
          <DatePicker
            label="Fecha"
            value={form.fecha}
            onChange={(fecha) => setForm({ ...form, fecha })}
          />
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Rival</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.rival} onChange={(e) => setForm({ ...form, rival: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Competición</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.competicion} onChange={(e) => setForm({ ...form, competicion: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Resultado</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.resultado} onChange={(e) => setForm({ ...form, resultado: e.target.value })}
              placeholder="Ej: 3-2" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Lugar</label>
            <select className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value as Partido['lugar'] })}>
              <option value="Local">Local</option>
              <option value="Visitante">Visitante</option>
              <option value="Neutral">Neutral</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setModalOpen(false)} className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded">Cancelar</button>
          <button onClick={async () => {
            if (editing) await updatePartido(form); else await addPartido(form)
            setModalOpen(false)
          }} className="text-xs text-white bg-primary-600 px-3 py-1.5 rounded hover:bg-primary-700">
            {editing ? 'Guardar' : 'Crear partido'}
          </button>
        </div>
      </Modal>

      <Modal open={rpeModalOpen} onClose={() => setRpeModalOpen(false)} title="Añadir RPE de partido" width="max-w-md">
        <div className="space-y-4">
          {confirmClearData && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-xs flex flex-col gap-2">
              <p>Cambiar a este estado borrará los minutos y el RPE actuales. ¿Estás seguro?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmClearData(null)} className="px-2 py-1 bg-white border border-red-200 rounded">Cancelar</button>
                <button onClick={() => applyParticipacion(confirmClearData.pendingParticipacion)} className="px-2 py-1 bg-red-600 text-white rounded">Sí, borrar</button>
              </div>
            </div>
          )}
          
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Jugadora</label>
            <select className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={rpeForm.id_jugadora} onChange={(e) => setRpeForm({ ...rpeForm, id_jugadora: e.target.value })}>
              <option value="">Seleccionar</option>
              {jugadoras.filter(j => j.activa !== false).map((j) => (
                <option key={j.id_jugadora} value={j.id_jugadora}>{j.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Participación</label>
            <select className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={rpeForm.participacion} onChange={(e) => handleParticipacionChange(e.target.value as ParticipacionPartido)}>
              <option value="">Seleccionar</option>
              <option value="completa">Completa (40 mins)</option>
              <option value="parcial">Parcial (1-39 mins)</option>
              <option value="modificada">Modificada</option>
              <option value="convocada_sin_minutos">Convocada sin minutos (0 mins)</option>
              <option value="no_convocada">No convocada (0 mins)</option>
            </select>
          </div>
          
          {rpeForm.participacion === 'modificada' && (
            <div>
              <label className="text-[10px] font-medium text-surface-600 block mb-1">Motivo (Obligatorio)</label>
              <textarea className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
                value={rpeForm.motivo_participacion_reducida} onChange={(e) => setRpeForm({ ...rpeForm, motivo_participacion_reducida: e.target.value })} />
            </div>
          )}

          {rpeForm.participacion !== 'no_convocada' && rpeForm.participacion !== 'convocada_sin_minutos' && (
            <>
              <div>
                <label className="text-[10px] font-medium text-surface-600 block mb-1">Minutos jugados</label>
                <input type="number" min={0} max={40} className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs disabled:bg-surface-100"
                  value={rpeForm.minutos_jugados} disabled={rpeForm.participacion === 'completa'}
                  onChange={(e) => setRpeForm({ ...rpeForm, minutos_jugados: e.target.value === '' ? '' : Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-[10px] font-medium text-surface-600 block mb-1">RPE (1-10)</label>
                <input type="number" min={1} max={10} className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
                  value={rpeForm.rpe} onChange={(e) => setRpeForm({ ...rpeForm, rpe: e.target.value === '' ? '' : Number(e.target.value) })} />
              </div>
            </>
          )}

          <div className="text-[10px] text-surface-500">
            Carga estimada: <strong>{(Number(rpeForm.rpe) || 0) * (Number(rpeForm.minutos_jugados) || 0)} UA</strong>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => { setRpeModalOpen(false); setConfirmClearData(null); }} className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded">Cancelar</button>
          <button onClick={handleAddRPE} disabled={!!confirmClearData} className="text-xs text-white bg-primary-600 px-3 py-1.5 rounded hover:bg-primary-700 disabled:opacity-50">Añadir RPE</button>
        </div>
      </Modal>
    </div>
  )
}
