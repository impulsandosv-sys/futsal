import { useState } from 'react'
import { useStore } from '@/store/store'
import { DataTable, DataRow, DataCell } from '@/components/shared/DataTable'
import { Filters } from '@/components/shared/Filters'
import { Modal } from '@/components/shared/Modal'
import type { Partido } from '@/types'

export function MatchesPage() {
  const { partidos, rpe_partido, jugadoras, filters, addPartido, updatePartido } = useStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Partido | null>(null)
  const [form, setForm] = useState<Partido>({
    id_partido: '', fecha: '', rival: '', competicion: '', resultado: '', lugar: 'Local',
  })

  const [rpeModalOpen, setRpeModalOpen] = useState(false)
  const [rpePartido, setRpePartido] = useState<string>('')
  const [rpeForm, setRpeForm] = useState({ id_jugadora: '', minutos_jugados: 0, rpe: 5 })

  const filtered = partidos.filter((p) => {
    if (filters.fecha_desde && p.fecha < filters.fecha_desde) return false
    if (filters.fecha_hasta && p.fecha > filters.fecha_hasta) return false
    return true
  })

  const handleAddRPE = async () => {
    const { addRPE_Partido } = useStore.getState()
    await addRPE_Partido({
      id_partido: rpePartido,
      id_jugadora: rpeForm.id_jugadora,
      minutos_jugados: rpeForm.minutos_jugados,
      rpe: rpeForm.rpe,
      fecha: partidos.find(p => p.id_partido === rpePartido)?.fecha || '',
      carga_ua: rpeForm.rpe * rpeForm.minutos_jugados,
    })
    setRpeModalOpen(false)
    setRpeForm({ id_jugadora: '', minutos_jugados: 0, rpe: 5 })
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
          const cargaTotal = rpes.reduce((s, r) => s + r.carga_ua, 0)
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
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Fecha</label>
            <input type="date" className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </div>
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
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Jugadora</label>
            <select className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={rpeForm.id_jugadora} onChange={(e) => setRpeForm({ ...rpeForm, id_jugadora: e.target.value })}>
              <option value="">Seleccionar</option>
              {jugadoras.filter(j => j.activa).map((j) => (
                <option key={j.id_jugadora} value={j.id_jugadora}>{j.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Minutos jugados</label>
            <input type="number" className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={rpeForm.minutos_jugados} onChange={(e) => setRpeForm({ ...rpeForm, minutos_jugados: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">RPE (1-10)</label>
            <input type="number" min={1} max={10} className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={rpeForm.rpe} onChange={(e) => setRpeForm({ ...rpeForm, rpe: Number(e.target.value) })} />
          </div>
          <div className="text-[10px] text-surface-500">
            Carga estimada: <strong>{rpeForm.rpe * rpeForm.minutos_jugados} UA</strong>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setRpeModalOpen(false)} className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded">Cancelar</button>
          <button onClick={handleAddRPE} className="text-xs text-white bg-primary-600 px-3 py-1.5 rounded hover:bg-primary-700">Añadir RPE</button>
        </div>
      </Modal>
    </div>
  )
}
