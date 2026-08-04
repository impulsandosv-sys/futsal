import { useState } from 'react'
import { useStore } from '@/store/store'
import { Modal } from '@/components/shared/Modal'
import { validarEjercicioFuerza, normalizarNombreEjercicio } from '@/domain/neuromuscular/fuerzaEngine'
import type { EjercicioFuerza, CategoriaEjercicioFuerza } from '@/types'

const CATEGORIAS: { value: CategoriaEjercicioFuerza; label: string }[] = [
  { value: 'sentadilla', label: 'Sentadilla' },
  { value: 'bisagra_cadera', label: 'Bisagra de Cadera' },
  { value: 'unilateral_rodilla', label: 'Unilateral Rodilla' },
  { value: 'empuje', label: 'Empuje' },
  { value: 'traccion', label: 'Tracción' },
  { value: 'gemelo', label: 'Gemelo / Tobillo' },
  { value: 'core', label: 'Core' },
  { value: 'aductor', label: 'Aductor' },
  { value: 'isquios', label: 'Isquios' },
  { value: 'pliometria', label: 'Pliometría' },
  { value: 'movilidad', label: 'Movilidad' },
  { value: 'otro', label: 'Otro' },
]

interface ExerciseManagerModalProps {
  open: boolean
  onClose: () => void
}

export function ExerciseManagerModal({ open, onClose }: ExerciseManagerModalProps) {
  const ejercicios = useStore((s) => s.ejercicios_fuerza)
  const trabajos = useStore((s) => s.trabajos_fuerza)
  const addEjercicio = useStore((s) => s.addEjercicioFuerza)
  const updateEjercicio = useStore((s) => s.updateEjercicioFuerza)
  const activateEjercicio = useStore((s) => s.activateEjercicioFuerza)
  const deactivateEjercicio = useStore((s) => s.deactivateEjercicioFuerza)

  const [editingExercise, setEditingExercise] = useState<EjercicioFuerza | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState<CategoriaEjercicioFuerza>('sentadilla')
  const [notas, setNotas] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const handleOpenForm = (exercise?: EjercicioFuerza) => {
    setErrors([])
    if (exercise) {
      setEditingExercise(exercise)
      setNombre(exercise.nombre)
      setCategoria(exercise.categoria)
      setNotas(exercise.notas || '')
    } else {
      setEditingExercise(null)
      setNombre('')
      setCategoria('sentadilla')
      setNotas('')
    }
    setIsFormOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors([])

    const normalizado = normalizarNombreEjercicio(nombre)
    const payload = {
      nombre: nombre.trim(),
      nombre_normalizado: normalizado,
      categoria,
      activo: editingExercise ? editingExercise.activo : true,
      notas: notas.trim() || null,
    }

    const validationErrors = validarEjercicioFuerza(
      payload,
      ejercicios,
      editingExercise?.id_ejercicio
    )

    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    const now = new Date().toISOString()
    if (editingExercise) {
      await updateEjercicio({
        ...editingExercise,
        ...payload,
        updatedAt: now,
      })
    } else {
      await addEjercicio({
        ...payload,
        id_ejercicio: 'ej_' + Date.now(),
        createdAt: now,
        updatedAt: now,
      })
    }

    setIsFormOpen(false)
  }

  const handleToggleActive = async (exercise: EjercicioFuerza) => {
    setErrors([])
    if (exercise.activo) {
      const activosCount = ejercicios.filter((e) => e.activo).length
      if (activosCount <= 1) {
        setErrors(['No se puede desactivar el último ejercicio activo del catálogo.'])
        return
      }
      await deactivateEjercicio(exercise.id_ejercicio)
    } else {
      await activateEjercicio(exercise.id_ejercicio)
    }
  }

  const getUsageCount = (id_ejercicio: string) => {
    return trabajos.filter((t) => t.id_ejercicio === id_ejercicio).length
  }

  return (
    <Modal open={open} onClose={onClose} title="Gestión del Catálogo de Ejercicios">
      <div className="space-y-4">
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-xs space-y-1">
            {errors.map((err, idx) => (
              <p key={idx}>{err}</p>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center pb-2 border-b border-surface-200">
          <p className="text-xs text-surface-500">
            Ejercicios disponibles ({ejercicios.filter((e) => e.activo).length} activos de {ejercicios.length} totales)
          </p>
          {!isFormOpen && (
            <button
              onClick={() => handleOpenForm()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm"
            >
              + Crear Ejercicio
            </button>
          )}
        </div>

        {isFormOpen ? (
          <form onSubmit={handleSave} className="bg-surface-50 p-4 rounded-md border border-surface-200 space-y-3">
            <h4 className="text-xs font-bold text-surface-800">
              {editingExercise ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}
            </h4>
            <div>
              <label className="block text-[11px] font-medium text-surface-600 mb-1">
                Nombre del Ejercicio *
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded border-surface-300 text-xs px-2.5 py-1.5"
                placeholder="Ej. Sentadilla Trasera"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-surface-600 mb-1">Categoría *</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaEjercicioFuerza)}
                className="w-full rounded border-surface-300 text-xs px-2.5 py-1.5"
              >
                {CATEGORIAS.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-surface-600 mb-1">Notas / Descripción</label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                className="w-full rounded border-surface-300 text-xs px-2.5 py-1.5"
                placeholder="Detalles técnicos o variantes..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-3 py-1 text-xs text-surface-600 hover:bg-surface-200 rounded"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded shadow-sm"
              >
                Guardar Ejercicio
              </button>
            </div>
          </form>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2">
            {ejercicios.length === 0 ? (
              <p className="text-center py-6 text-xs text-surface-400">
                No hay ejercicios en el catálogo. Crea el primero.
              </p>
            ) : (
              ejercicios.map((ex) => {
                const usage = getUsageCount(ex.id_ejercicio)
                const catLabel = CATEGORIAS.find((c) => c.value === ex.categoria)?.label || ex.categoria
                return (
                  <div
                    key={ex.id_ejercicio}
                    className={`flex items-center justify-between p-3 rounded-md border text-xs ${
                      ex.activo ? 'bg-white border-surface-200' : 'bg-surface-100 border-surface-200 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-surface-900">{ex.nombre}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-100 text-surface-600">
                          {catLabel}
                        </span>
                        {!ex.activo && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                            Inactivo
                          </span>
                        )}
                      </div>
                      {ex.notas && <p className="text-[11px] text-surface-500 mt-0.5">{ex.notas}</p>}
                      <p className="text-[10px] text-surface-400 mt-0.5">
                        Uso en historial: {usage} registro{usage !== 1 ? 's' : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenForm(ex)}
                        className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggleActive(ex)}
                        className={`text-xs font-medium ${
                          ex.activo ? 'text-amber-600 hover:text-amber-800' : 'text-emerald-600 hover:text-emerald-800'
                        }`}
                      >
                        {ex.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
