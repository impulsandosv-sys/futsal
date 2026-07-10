import { useState } from 'react'
import { useStore } from '@/store/store'
import { DataTable, DataRow, DataCell } from '@/components/shared/DataTable'
import { Filters } from '@/components/shared/Filters'
import { Modal } from '@/components/shared/Modal'
import type { Sesion, TipoDia, TipoSesion } from '@/types'

export function SessionsPage() {
  const { sesiones, filters, addSesion, updateSesion } = useStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Sesion | null>(null)
  const [form, setForm] = useState<Sesion>({
    id_sesion: '', fecha: new Date().toISOString().split('T')[0],
    tipo_dia: 'Entreno', tipo_sesion: 'Fisico', duracion_min: 60,
    objetivo_principal: '', observaciones_grupo: '',
  })

  const filtered = sesiones.filter((s) => {
    if (filters.fecha_desde && s.fecha < filters.fecha_desde) return false
    if (filters.fecha_hasta && s.fecha > filters.fecha_hasta) return false
    if (filters.tipo_sesion && s.tipo_sesion !== filters.tipo_sesion) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-surface-800">Sesiones de Entrenamiento</h1>
        <button onClick={() => { setEditing(null); setForm({
          id_sesion: '', fecha: new Date().toISOString().split('T')[0],
          tipo_dia: 'Entreno', tipo_sesion: 'Fisico', duracion_min: 60,
          objetivo_principal: '', observaciones_grupo: '',
        }); setModalOpen(true) }}
          className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700"
        >
          + Nueva sesión
        </button>
      </div>

      <Filters showDate showSessionType />

      <DataTable
        headers={['ID', 'Fecha', 'Tipo día', 'Tipo sesión', 'Duración', 'Objetivo', 'Observaciones', 'Acciones']}
        emptyMessage="No hay sesiones registradas"
      >
        {filtered.map((s) => (
          <DataRow key={s.id_sesion}>
            <DataCell className="font-mono text-[10px] text-surface-500">{s.id_sesion}</DataCell>
            <DataCell>{s.fecha}</DataCell>
            <DataCell>{s.tipo_dia}</DataCell>
            <DataCell>{s.tipo_sesion}</DataCell>
            <DataCell>{s.duracion_min} min</DataCell>
            <DataCell className="max-w-[200px] truncate">{s.objetivo_principal}</DataCell>
            <DataCell className="max-w-[200px] truncate text-surface-500">{s.observaciones_grupo || '—'}</DataCell>
            <DataCell>
              <button onClick={() => { setEditing(s); setForm(s); setModalOpen(true) }}
                className="text-[10px] text-primary-600 hover:underline">Editar</button>
            </DataCell>
          </DataRow>
        ))}
      </DataTable>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar sesión' : 'Nueva sesión'}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">ID Sesión *</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.id_sesion} onChange={(e) => setForm({ ...form, id_sesion: e.target.value })}
              disabled={!!editing} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Fecha</label>
            <input type="date" className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Tipo de día</label>
            <select className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.tipo_dia} onChange={(e) => setForm({ ...form, tipo_dia: e.target.value as TipoDia })}>
              <option value="Entreno">Entreno</option>
              <option value="Partido">Partido</option>
              <option value="Descanso">Descanso</option>
              <option value="Viaje">Viaje</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Tipo de sesión</label>
            <select className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.tipo_sesion} onChange={(e) => setForm({ ...form, tipo_sesion: e.target.value as TipoSesion })}>
              <option value="Fisico">Físico</option>
              <option value="Tecnico">Técnico</option>
              <option value="Tactico">Táctico</option>
              <option value="Partido">Partido</option>
              <option value="Recuperacion">Recuperación</option>
              <option value="Preventivo">Preventivo</option>
              <option value="Gimnasio">Gimnasio</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Duración (min)</label>
            <input type="number" className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.duracion_min} onChange={(e) => setForm({ ...form, duracion_min: Number(e.target.value) })} />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Objetivo principal</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.objetivo_principal} onChange={(e) => setForm({ ...form, objetivo_principal: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Observaciones grupo</label>
            <textarea className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs" rows={2}
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
    </div>
  )
}
