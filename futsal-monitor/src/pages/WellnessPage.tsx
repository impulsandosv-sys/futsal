import { useState } from 'react'
import { useStore } from '@/store/store'
import { PaginatedTable, PRow, PCell } from '@/components/shared/PaginatedTable'
import { Filters } from '@/components/shared/Filters'
import { Modal } from '@/components/shared/Modal'
import { getWellnessLevel, getWellnessThreshold } from '@/domain/monitoring/monitoring'
import { calcularScoreWellness } from '@/domain/calculations/loadCalculations'
import type { Wellness } from '@/types'
import { getTodayLocalISO } from '@/domain/dates/dates'

export function WellnessPage() {
  const { wellness, jugadoras, addWellness, updateWellness, filters } = useStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Wellness | null>(null)
  const [form, setForm] = useState({
    id_jugadora: '',
    fecha: getTodayLocalISO(),
    calidad_sueno: '' as any,
    fatiga: '' as any,
    dolor_muscular: '' as any,
    estres: '' as any,
    estado_animo: '' as any,
    dolor_especifico: '',
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
      id_jugadora: '',
      fecha: getTodayLocalISO(),
      calidad_sueno: '' as any,
      fatiga: '' as any,
      dolor_muscular: '' as any,
      estres: '' as any,
      estado_animo: '' as any,
      dolor_especifico: '',
    })
    setModalOpen(true)
  }

  const handleEdit = (w: Wellness) => {
    setEditing(w)
    setForm({
      id_jugadora: w.id_jugadora,
      fecha: w.fecha,
      calidad_sueno: (w.calidad_sueno !== null && w.calidad_sueno !== undefined) ? w.calidad_sueno : '' as any,
      fatiga: (w.fatiga !== null && w.fatiga !== undefined) ? w.fatiga : '' as any,
      dolor_muscular: (w.dolor_muscular !== null && w.dolor_muscular !== undefined) ? w.dolor_muscular : '' as any,
      estres: (w.estres !== null && w.estres !== undefined) ? w.estres : '' as any,
      estado_animo: (w.estado_animo !== null && w.estado_animo !== undefined) ? w.estado_animo : '' as any,
      dolor_especifico: w.dolor_especifico || '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.id_jugadora) {
      alert('Selecciona una jugadora')
      return
    }
    if (!form.fecha) {
      alert('La fecha es obligatoria')
      return
    }

    const payload = {
      id_jugadora: form.id_jugadora,
      fecha: form.fecha,
      calidad_sueno: form.calidad_sueno === '' ? null : Number(form.calidad_sueno),
      fatiga: form.fatiga === '' ? null : Number(form.fatiga),
      dolor_muscular: form.dolor_muscular === '' ? null : Number(form.dolor_muscular),
      estres: form.estres === '' ? null : Number(form.estres),
      estado_animo: form.estado_animo === '' ? null : Number(form.estado_animo),
      dolor_especifico: form.dolor_especifico,
    } as any

    const duplicate = wellness.find(
      (w) => w.id_jugadora === payload.id_jugadora && w.fecha === payload.fecha && (!editing || w.id !== editing.id)
    )

    if (duplicate) {
      const confirmEdit = window.confirm(
        'Ya existe un registro de wellness para esta jugadora en esta fecha. ¿Deseas sobreescribir el registro existente?'
      )
      if (confirmEdit) {
        const score = calcularScoreWellness(payload)
        await updateWellness({ ...duplicate, ...payload, score_wellness: score })
        setModalOpen(false)
        return
      }
      return
    }

    const score = calcularScoreWellness(payload)
    if (editing) {
      await updateWellness({ ...editing, ...payload, score_wellness: score })
    } else {
      await addWellness({ ...payload, score_wellness: score })
    }
    setModalOpen(false)
  }

  const renderSelectOptions = (minLabel: string, maxLabel: string) => (
    <>
      <option value="">No respondido</option>
      <option value={1}>1 - {minLabel}</option>
      {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        <option key={n} value={n}>{n}</option>
      ))}
      <option value={10}>10 - {maxLabel}</option>
    </>
  )

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
              <PCell>{(w.calidad_sueno !== null && w.calidad_sueno !== undefined) ? w.calidad_sueno : '—'}</PCell>
              <PCell>{(w.fatiga !== null && w.fatiga !== undefined) ? w.fatiga : '—'}</PCell>
              <PCell>{(w.dolor_muscular !== null && w.dolor_muscular !== undefined) ? w.dolor_muscular : '—'}</PCell>
              <PCell>{(w.estres !== null && w.estres !== undefined) ? w.estres : '—'}</PCell>
              <PCell>{(w.estado_animo !== null && w.estado_animo !== undefined) ? w.estado_animo : '—'}</PCell>
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
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs bg-white text-surface-700"
              value={form.id_jugadora}
              onChange={(e) => setForm({ ...form, id_jugadora: e.target.value })}
            >
              <option value="">Seleccionar jugadora</option>
              {jugadoras.filter(j => j.activa !== false).map((j) => (
                <option key={j.id_jugadora} value={j.id_jugadora}>{j.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Fecha</label>
            <input type="date" className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs text-surface-700 bg-white"
              value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Calidad de sueño</label>
            <select
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs bg-white text-surface-700"
              value={form.calidad_sueno}
              onChange={(e) => setForm({ ...form, calidad_sueno: e.target.value === '' ? '' : Number(e.target.value) })}
            >
              {renderSelectOptions('muy malo', 'excelente')}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Fatiga</label>
            <select
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs bg-white text-surface-700"
              value={form.fatiga}
              onChange={(e) => setForm({ ...form, fatiga: e.target.value === '' ? '' : Number(e.target.value) })}
            >
              {renderSelectOptions('nada', 'extremo')}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Dolor muscular</label>
            <select
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs bg-white text-surface-700"
              value={form.dolor_muscular}
              onChange={(e) => setForm({ ...form, dolor_muscular: e.target.value === '' ? '' : Number(e.target.value) })}
            >
              {renderSelectOptions('nada', 'extremo')}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Estrés</label>
            <select
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs bg-white text-surface-700"
              value={form.estres}
              onChange={(e) => setForm({ ...form, estres: e.target.value === '' ? '' : Number(e.target.value) })}
            >
              {renderSelectOptions('nada', 'extremo')}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Estado de ánimo</label>
            <select
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs bg-white text-surface-700"
              value={form.estado_animo}
              onChange={(e) => setForm({ ...form, estado_animo: e.target.value === '' ? '' : Number(e.target.value) })}
            >
              {renderSelectOptions('muy bajo', 'excelente')}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Dolor específico</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs bg-white text-surface-700"
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
