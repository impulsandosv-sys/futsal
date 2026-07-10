import { useState } from 'react'
import { useStore } from '@/store/store'
import { DataTable, DataRow, DataCell } from '@/components/shared/DataTable'
import { Filters } from '@/components/shared/Filters'
import { Modal } from '@/components/shared/Modal'
import { AlertBadge } from '@/components/shared/AlertBadge'
import type { Lesion, FaseRTP, Disponibilidad } from '@/types'

export function InjuriesPage() {
  const { lesiones, jugadoras, addLesion, updateLesion } = useStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Lesion | null>(null)
  const [form, setForm] = useState<Lesion>({
    id_lesion: '', id_jugadora: '', fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: '', tipo: '', localizacion: '', mecanismo: '', severidad_dias_baja: 0,
    disponibilidad: 'Lesionada', comentario_fisio_medico: '', fase_rtp: 'N/A', disponible: false,
  })

  const activas = lesiones.filter((l) => !l.disponible)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-surface-800">Lesiones y Readaptación</h1>
        <button onClick={() => { setEditing(null); setForm({
          id_lesion: '', id_jugadora: '', fecha_inicio: new Date().toISOString().split('T')[0],
          fecha_fin: '', tipo: '', localizacion: '', mecanismo: '', severidad_dias_baja: 0,
          disponibilidad: 'Lesionada', comentario_fisio_medico: '', fase_rtp: 'N/A', disponible: false,
        }); setModalOpen(true) }}
          className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700"
        >
          + Nueva lesión
        </button>
      </div>

      {activas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-red-700 mb-2">Lesiones activas ({activas.length})</h3>
          <div className="space-y-1">
            {activas.map((l) => {
              const jug = jugadoras.find((j) => j.id_jugadora === l.id_jugadora)
              return (
                <div key={l.id_lesion} className="flex items-center justify-between text-[10px] text-red-600">
                  <span>{jug?.nombre || l.id_jugadora} - {l.tipo} ({l.localizacion})</span>
                  <span>Fase: {l.fase_rtp}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Filters showPlayer showDate showStatus />

      <DataTable
        headers={['ID', 'Jugadora', 'Inicio', 'Fin', 'Tipo', 'Localización', 'Días baja', 'Fase RTP', 'Disponible', 'Acciones']}
        emptyMessage="No hay lesiones registradas"
      >
        {lesiones.map((l) => {
          const jug = jugadoras.find((j) => j.id_jugadora === l.id_jugadora)
          return (
            <DataRow key={l.id_lesion}>
              <DataCell className="font-mono text-[10px] text-surface-500">{l.id_lesion}</DataCell>
              <DataCell className="font-medium">{jug?.nombre || l.id_jugadora}</DataCell>
              <DataCell>{l.fecha_inicio}</DataCell>
              <DataCell className="text-surface-500">{l.fecha_fin || '—'}</DataCell>
              <DataCell>{l.tipo}</DataCell>
              <DataCell>{l.localizacion}</DataCell>
              <DataCell>{l.severidad_dias_baja}</DataCell>
              <DataCell>
                <span className={`text-[10px] ${l.fase_rtp !== 'N/A' ? 'text-amber-600 font-medium' : 'text-surface-400'}`}>
                  {l.fase_rtp.replace(/_/g, ' ')}
                </span>
              </DataCell>
              <DataCell>
                {l.disponible ? <AlertBadge level="bajo" label="Sí" /> : <AlertBadge level="alto" label="No" />}
              </DataCell>
              <DataCell>
                <button onClick={() => { setEditing(l); setForm(l); setModalOpen(true) }}
                  className="text-[10px] text-primary-600 hover:underline">Editar</button>
              </DataCell>
            </DataRow>
          )
        })}
      </DataTable>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar lesión' : 'Nueva lesión'} width="max-w-3xl">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">ID Lesión *</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.id_lesion} onChange={(e) => setForm({ ...form, id_lesion: e.target.value })}
              disabled={!!editing} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Jugadora</label>
            <select className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.id_jugadora} onChange={(e) => setForm({ ...form, id_jugadora: e.target.value })}>
              <option value="">Seleccionar</option>
              {jugadoras.map((j) => <option key={j.id_jugadora} value={j.id_jugadora}>{j.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Fecha inicio</label>
            <input type="date" className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Fecha fin</label>
            <input type="date" className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Tipo</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              placeholder="Ej: Rot fibrilar, Esguince..." />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Localización</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.localizacion} onChange={(e) => setForm({ ...form, localizacion: e.target.value })}
              placeholder="Ej: Isquiotibial der." />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Mecanismo</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.mecanismo} onChange={(e) => setForm({ ...form, mecanismo: e.target.value })}
              placeholder="Traumático, sobrecarga..." />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Días de baja</label>
            <input type="number" className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.severidad_dias_baja} onChange={(e) => setForm({ ...form, severidad_dias_baja: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Fase RTP</label>
            <select className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.fase_rtp} onChange={(e) => setForm({ ...form, fase_rtp: e.target.value as FaseRTP })}>
              <option value="N/A">N/A</option>
              <option value="Fase_1_Reposo">Fase 1 - Reposo</option>
              <option value="Fase_2_Movilidad">Fase 2 - Movilidad</option>
              <option value="Fase_3_Fuerza">Fase 3 - Fuerza</option>
              <option value="Fase_4_Reentreno">Fase 4 - Reentreno</option>
              <option value="Fase_5_Alta_Competitiva">Fase 5 - Alta competitiva</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Disponibilidad</label>
            <select className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.disponibilidad} onChange={(e) => {
                const v = e.target.value as Disponibilidad
                setForm({ ...form, disponibilidad: v, disponible: v === 'Disponible' })
              }}>
              <option value="Disponible">Disponible</option>
              <option value="Lesionada">Lesionada</option>
              <option value="Readaptacion">Readaptación</option>
              <option value="Carga_Gestionada">Carga Gestionada</option>
              <option value="Descanso">Descanso</option>
            </select>
          </div>
          <div className="col-span-3">
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Comentario fisio/médico</label>
            <textarea className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs" rows={2}
              value={form.comentario_fisio_medico} onChange={(e) => setForm({ ...form, comentario_fisio_medico: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setModalOpen(false)} className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded">Cancelar</button>
          <button onClick={async () => {
            if (editing) await updateLesion(form); else await addLesion(form)
            setModalOpen(false)
          }} className="text-xs text-white bg-primary-600 px-3 py-1.5 rounded hover:bg-primary-700">
            {editing ? 'Guardar' : 'Registrar lesión'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
