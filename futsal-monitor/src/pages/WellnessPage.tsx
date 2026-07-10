import { useState } from 'react'
import { useStore } from '@/store/store'
import { PaginatedTable, PRow, PCell } from '@/components/shared/PaginatedTable'
import { Filters } from '@/components/shared/Filters'
import { Modal } from '@/components/shared/Modal'
import { getWellnessLevel, getWellnessThreshold, calcularScoreWellness } from '@/utils/calculations'
import type { Wellness } from '@/types'

export function WellnessPage() {
  const { wellness, jugadoras, addWellness, updateWellness, filters } = useStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Wellness | null>(null)
  const [form, setForm] = useState({
    id_jugadora: '', fecha: new Date().toISOString().split('T')[0],
    calidad_sueno: 7, fatiga: 5, dolor_muscular: 5, estres: 5, estado_animo: 7, dolor_especifico: '',
  })

  const filtered = wellness.filter((w) => {
    if (filters.id_jugadora && w.id_jugadora !== filters.id_jugadora) return false
    if (filters.fecha_desde && w.fecha < filters.fecha_desde) return false
    if (filters.fecha_hasta && w.fecha > filters.fecha_hasta) return false
    return true
  })

  const handleNew = () => {
    setEditing(null)
    setForm({
      id_jugadora: '', fecha: new Date().toISOString().split('T')[0],
      calidad_sueno: 7, fatiga: 5, dolor_muscular: 5, estres: 5, estado_animo: 7, dolor_especifico: '',
    })
    setModalOpen(true)
  }

  const handleEdit = (w: Wellness) => {
    setEditing(w)
    setForm({
      id_jugadora: w.id_jugadora, fecha: w.fecha,
      calidad_sueno: w.calidad_sueno, fatiga: w.fatiga, dolor_muscular: w.dolor_muscular,
      estres: w.estres, estado_animo: w.estado_animo, dolor_especifico: w.dolor_especifico,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    const score = calcularScoreWellness(form)
    if (editing) {
      await updateWellness({ ...editing, ...form, score_wellness: score })
    } else {
      await addWellness({ ...form, score_wellness: score })
    }
    setModalOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-surface-800">Wellness Diario</h1>
        <button onClick={handleNew} className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700">
          + Nuevo registro
        </button>
      </div>

      <Filters showPlayer showDate />

      <PaginatedTable
        headers={['Fecha', 'Jugadora', 'Sueño', 'Fatiga', 'Dolor Musc.', 'Estrés', 'Ánimo', 'Score', 'Dolor Esp.']}
        emptyMessage="No hay registros de wellness"
        pageSize={25}
      >
        {filtered.map((w) => {
          const jug = jugadoras.find((j) => j.id_jugadora === w.id_jugadora)
          return (
            <PRow key={w.id} onClick={() => handleEdit(w)}>
              <PCell className="text-surface-500">{w.fecha}</PCell>
              <PCell className="font-medium">{jug?.nombre || w.id_jugadora}</PCell>
              <PCell>{w.calidad_sueno}</PCell>
              <PCell>{w.fatiga}</PCell>
              <PCell>{w.dolor_muscular}</PCell>
              <PCell>{w.estres}</PCell>
              <PCell>{w.estado_animo}</PCell>
              <PCell>
                <span className={`font-semibold ${getWellnessThreshold(getWellnessLevel(w.score_wellness)).color.split(' ')[0]}`}>
                  {w.score_wellness}
                </span>
              </PCell>
              <PCell className="text-surface-500 max-w-[120px] truncate">{w.dolor_especifico || '—'}</PCell>
            </PRow>
          )
        })}
      </PaginatedTable>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar wellness' : 'Nuevo wellness'}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Jugadora</label>
            <select
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.id_jugadora}
              onChange={(e) => setForm({ ...form, id_jugadora: e.target.value })}
            >
              <option value="">Seleccionar jugadora</option>
              {jugadoras.filter(j => j.activa).map((j) => (
                <option key={j.id_jugadora} value={j.id_jugadora}>{j.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Fecha</label>
            <input type="date" className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Calidad de sueño (1-10)</label>
            <input type="number" min={1} max={10} className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.calidad_sueno} onChange={(e) => setForm({ ...form, calidad_sueno: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Fatiga (1-10)</label>
            <input type="number" min={1} max={10} className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.fatiga} onChange={(e) => setForm({ ...form, fatiga: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Dolor muscular (1-10)</label>
            <input type="number" min={1} max={10} className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.dolor_muscular} onChange={(e) => setForm({ ...form, dolor_muscular: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Estrés (1-10)</label>
            <input type="number" min={1} max={10} className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.estres} onChange={(e) => setForm({ ...form, estres: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Estado de ánimo (1-10)</label>
            <input type="number" min={1} max={10} className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.estado_animo} onChange={(e) => setForm({ ...form, estado_animo: Number(e.target.value) })} />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Dolor específico</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.dolor_especifico} onChange={(e) => setForm({ ...form, dolor_especifico: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setModalOpen(false)} className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded">Cancelar</button>
          <button onClick={handleSave} className="text-xs text-white bg-primary-600 px-3 py-1.5 rounded hover:bg-primary-700">
            {editing ? 'Guardar cambios' : 'Añadir'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
