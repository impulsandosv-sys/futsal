import { useState } from 'react'
import { useStore } from '@/store/store'
import { useNavigate } from 'react-router-dom'
import { DataTable, DataRow, DataCell } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { Filters } from '@/components/shared/Filters'
import { AlertBadge } from '@/components/shared/AlertBadge'
import { calcularIMC } from '@/utils/calculations'
import type { Jugadora, Posicion } from '@/types'

export function PlayersPage() {
  const { jugadoras, lesiones, addJugadora, updateJugadora, deleteJugadora } = useStore()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Jugadora | null>(null)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState<Jugadora>({
    id_jugadora: '', nombre: '', fecha_nacimiento: '', posicion: 'Ala',
    altura_cm: 165, peso_kg: 60, imc: 0, grasa: 0, anos_experiencia_futsal: 0,
    historial_lesional: '', notas: '', activa: true,
  })

  const lesionesActivas = lesiones.filter(l => !l.disponible)
  const idsLesionadas = new Set(lesionesActivas.map(l => l.id_jugadora))

  const handleEdit = (j: Jugadora) => {
    setEditing(j)
    setForm({ ...j })
    setModalOpen(true)
  }

  const handleNew = () => {
    setEditing(null)
    setFormError('')
    setForm({
      id_jugadora: '', nombre: '', fecha_nacimiento: '', posicion: 'Ala',
      altura_cm: 165, peso_kg: 60, imc: 0, grasa: 0, anos_experiencia_futsal: 0,
      historial_lesional: '', notas: '', activa: true,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    setFormError('')
    const imc = calcularIMC(form.peso_kg, form.altura_cm)
    const data = { ...form, imc }
    try {
      if (editing) {
        await updateJugadora(data)
      } else {
        await addJugadora(data)
      }
      setModalOpen(false)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-surface-800">Jugadoras</h1>
        <button onClick={handleNew} className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700 transition-colors">
          + Nueva jugadora
        </button>
      </div>

      <Filters showPlayer={false} showDate={false} />

      <DataTable
        headers={['ID', 'Nombre', 'Posición', 'Edad', 'Altura', 'Peso', 'IMC', 'Estado', 'Acciones']}
        emptyMessage="No hay jugadoras registradas"
      >
        {jugadoras.map((j) => {
          const edad = j.fecha_nacimiento
            ? Math.floor((Date.now() - new Date(j.fecha_nacimiento).getTime()) / 31557600000)
            : null
          const lesionada = idsLesionadas.has(j.id_jugadora)
          return (
            <DataRow key={j.id_jugadora}>
              <DataCell className="font-mono text-[10px] text-surface-500">{j.id_jugadora}</DataCell>
              <DataCell>
                <button
                  onClick={() => navigate(`/jugadoras/${j.id_jugadora}`)}
                  className="text-primary-600 hover:underline font-medium text-left"
                >
                  {j.nombre}
                </button>
              </DataCell>
              <DataCell>{j.posicion}</DataCell>
              <DataCell>{edad !== null ? `${edad} años` : '—'}</DataCell>
              <DataCell>{j.altura_cm} cm</DataCell>
              <DataCell>{j.peso_kg} kg</DataCell>
              <DataCell>{j.imc}</DataCell>
              <DataCell>
                {lesionada ? (
                  <AlertBadge level="alto" label="Lesionada" />
                ) : (
                  <AlertBadge level="bajo" label="Disponible" />
                )}
              </DataCell>
              <DataCell>
                <button onClick={() => handleEdit(j)} className="text-[10px] text-primary-600 hover:underline mr-2">
                  Editar
                </button>
                <button onClick={() => deleteJugadora(j.id_jugadora)} className="text-[10px] text-red-500 hover:underline">
                  Eliminar
                </button>
              </DataCell>
            </DataRow>
          )
        })}
      </DataTable>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar jugadora' : 'Nueva jugadora'}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">ID Jugadora *</label>
            <input
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.id_jugadora}
              onChange={(e) => setForm({ ...form, id_jugadora: e.target.value.toUpperCase() })}
              disabled={!!editing}
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Nombre *</label>
            <input
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Fecha nacimiento</label>
            <input
              type="date"
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.fecha_nacimiento}
              onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Posición</label>
            <select
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.posicion}
              onChange={(e) => setForm({ ...form, posicion: e.target.value as Posicion })}
            >
              <option value="Portera">Portera</option>
              <option value="Cierre">Cierre</option>
              <option value="Ala">Ala</option>
              <option value="Pivot">Pivot</option>
              <option value="Universal">Universal</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Altura (cm)</label>
            <input
              type="number"
              min={100}
              max={220}
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.altura_cm}
              onChange={(e) => setForm({ ...form, altura_cm: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Peso (kg)</label>
            <input
              type="number"
              step="0.1"
              min={30}
              max={120}
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.peso_kg}
              onChange={(e) => setForm({ ...form, peso_kg: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">% Grasa</label>
            <input
              type="number"
              step="0.1"
              min={0}
              max={50}
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.grasa}
              onChange={(e) => setForm({ ...form, grasa: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Años experiencia</label>
            <input
              type="number"
              min={0}
              max={30}
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.anos_experiencia_futsal}
              onChange={(e) => setForm({ ...form, anos_experiencia_futsal: Number(e.target.value) })}
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Historial lesional</label>
            <textarea
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              rows={2}
              value={form.historial_lesional}
              onChange={(e) => setForm({ ...form, historial_lesional: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Notas</label>
            <textarea
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              rows={2}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          {formError && <p className="text-xs text-red-600 mr-auto">{formError}</p>}
          <button onClick={() => setModalOpen(false)} className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded">
            Cancelar
          </button>
          <button onClick={handleSave} className="text-xs text-white bg-primary-600 px-3 py-1.5 rounded hover:bg-primary-700">
            {editing ? 'Guardar cambios' : 'Añadir jugadora'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
