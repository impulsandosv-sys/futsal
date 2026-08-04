import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/shared/Modal'
import { useStore } from '@/store/store'
import type { PlantillaFuerza, EjercicioPropuestoPlantilla, FinalidadSesionFuerza } from '@/types'
import { FINALIDADES_FUERZA, getFinalidadLabel } from '@/domain/neuromuscular/fuerzaEngine'

interface TemplateFormModalProps {
  isOpen: boolean
  onClose: () => void
  templateToEdit?: PlantillaFuerza | null
}

export const TemplateFormModal: React.FC<TemplateFormModalProps> = ({
  isOpen,
  onClose,
  templateToEdit,
}) => {
  const { ejercicios_fuerza, addPlantillaFuerza, updatePlantillaFuerza } = useStore()

  const [nombre, setNombre] = useState('')
  const [finalidad, setFinalidad] = useState<FinalidadSesionFuerza | ''>('')
  const [descripcion, setDescripcion] = useState('')
  const [ejercicios, setEjercicios] = useState<EjercicioPropuestoPlantilla[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  const defaultEjercicioId =
    ejercicios_fuerza.find((e) => e.activo)?.id_ejercicio || ''

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('')
      if (templateToEdit) {
        setNombre(templateToEdit.nombre)
        setFinalidad(templateToEdit.finalidad || '')
        setDescripcion(templateToEdit.descripcion || '')
        setEjercicios(templateToEdit.ejercicios || [])
      } else {
        setNombre('')
        setFinalidad('')
        setDescripcion('')
        setEjercicios([
          {
            id_ejercicio: defaultEjercicioId,
            series_propuestas: 3,
            repeticiones_propuestas: 10,
            carga_kg_propuesta: undefined,
            rpe_objetivo: undefined,
            observacion_propuesta: '',
          },
        ])
      }
    }
  }, [isOpen, templateToEdit, defaultEjercicioId])

  const handleAddEjercicio = () => {
    if (!defaultEjercicioId) return
    setEjercicios([
      ...ejercicios,
      {
        id_ejercicio: defaultEjercicioId,
        series_propuestas: 3,
        repeticiones_propuestas: 10,
        carga_kg_propuesta: undefined,
        rpe_objetivo: undefined,
        observacion_propuesta: '',
      },
    ])
  }

  const handleRemoveEjercicio = (index: number) => {
    setEjercicios(ejercicios.filter((_, i) => i !== index))
  }

  const handleEjercicioChange = (index: number, field: keyof EjercicioPropuestoPlantilla, value: any) => {
    const updated = [...ejercicios]
    updated[index] = { ...updated[index], [field]: value }
    setEjercicios(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!nombre.trim()) {
      setErrorMsg('El nombre de la plantilla es obligatorio.')
      return
    }

    if (ejercicios.length === 0) {
      setErrorMsg('La plantilla debe incluir al menos un ejercicio prescrito.')
      return
    }

    const hasInvalidEjercicio = ejercicios.some((ej) => !ej.id_ejercicio)
    if (hasInvalidEjercicio) {
      setErrorMsg('Selecciona un ejercicio válido para cada ítem de la plantilla.')
      return
    }

    const now = new Date().toISOString()
    if (templateToEdit) {
      const updatedPlantilla: PlantillaFuerza = {
        ...templateToEdit,
        nombre: nombre.trim(),
        finalidad: finalidad ? (finalidad as FinalidadSesionFuerza) : null,
        descripcion: descripcion.trim() || null,
        ejercicios,
        updatedAt: now,
      }
      await updatePlantillaFuerza(updatedPlantilla)
    } else {
      const newPlantilla: PlantillaFuerza = {
        id_plantilla: `pl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        nombre: nombre.trim(),
        finalidad: finalidad ? (finalidad as FinalidadSesionFuerza) : null,
        descripcion: descripcion.trim() || null,
        activa: true,
        ejercicios,
        createdAt: now,
        updatedAt: now,
      }
      await addPlantillaFuerza(newPlantilla)
    }

    onClose()
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={templateToEdit ? 'Editar Plantilla de Fuerza' : 'Nueva Plantilla de Fuerza'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-surface-700 mb-1">
            Nombre de la Plantilla *
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Rutina Fuerza Máxima A"
            className="w-full px-3 py-2 border border-surface-300 rounded text-xs focus:ring-1 focus:ring-primary-500 focus:outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-surface-700 mb-1">
              Finalidad Propuesta
            </label>
            <select
              value={finalidad}
              onChange={(e) => setFinalidad(e.target.value as FinalidadSesionFuerza)}
              className="w-full px-3 py-2 border border-surface-300 rounded text-xs bg-white focus:ring-1 focus:ring-primary-500 focus:outline-none"
            >
              <option value="">Sin finalidad específica</option>
              {FINALIDADES_FUERZA.map((f) => (
                <option key={f} value={f}>
                  {getFinalidadLabel(f)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-700 mb-1">
              Descripción / Notas
            </label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Instrucciones generales de la rutina..."
              className="w-full px-3 py-2 border border-surface-300 rounded text-xs focus:ring-1 focus:ring-primary-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="border-t border-surface-200 pt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-surface-800">Ejercicios Prescritos *</h4>
            <button
              type="button"
              onClick={handleAddEjercicio}
              className="px-2 py-1 bg-surface-100 hover:bg-surface-200 text-surface-700 text-xs font-medium rounded border border-surface-300 transition-colors"
            >
              + Añadir Ejercicio
            </button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {ejercicios.map((ej, index) => {
              return (
                <div key={index} className="p-3 bg-surface-50 border border-surface-200 rounded text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={ej.id_ejercicio}
                      onChange={(e) => handleEjercicioChange(index, 'id_ejercicio', e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-surface-300 rounded bg-white text-xs font-medium"
                    >
                      {ejercicios_fuerza.map((e) => (
                        <option key={e.id_ejercicio} value={e.id_ejercicio} disabled={!e.activo}>
                          {e.nombre} {!e.activo ? '(Inactivo)' : ''}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleRemoveEjercicio(index)}
                      className="text-red-500 hover:text-red-700 font-bold px-2"
                      title="Eliminar ejercicio"
                    >
                      ×
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[10px] text-surface-500">Series *</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={ej.series_propuestas ?? ''}
                        onChange={(e) =>
                          handleEjercicioChange(index, 'series_propuestas', e.target.value ? parseInt(e.target.value) : undefined)
                        }
                        className="w-full px-2 py-1 border border-surface-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-surface-500">Reps Propuest.</label>
                      <input
                        type="number"
                        min="1"
                        value={ej.repeticiones_propuestas ?? ''}
                        onChange={(e) =>
                          handleEjercicioChange(index, 'repeticiones_propuestas', e.target.value ? parseInt(e.target.value) : undefined)
                        }
                        className="w-full px-2 py-1 border border-surface-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-surface-500">Carga kg</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={ej.carga_kg_propuesta ?? ''}
                        onChange={(e) =>
                          handleEjercicioChange(index, 'carga_kg_propuesta', e.target.value ? parseFloat(e.target.value) : undefined)
                        }
                        className="w-full px-2 py-1 border border-surface-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-surface-500">RPE Objetivo</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.5"
                        value={ej.rpe_objetivo ?? ''}
                        onChange={(e) =>
                          handleEjercicioChange(index, 'rpe_objetivo', e.target.value ? parseFloat(e.target.value) : undefined)
                        }
                        className="w-full px-2 py-1 border border-surface-300 rounded text-xs"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-surface-200">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-surface-300 text-surface-700 hover:bg-surface-100 rounded text-xs transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded text-xs font-semibold transition-colors"
          >
            {templateToEdit ? 'Guardar Cambios' : 'Crear Plantilla'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
