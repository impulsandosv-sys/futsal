import React from 'react'
import { Modal } from '@/components/shared/Modal'
import { useStore } from '@/store/store'
import type { PlantillaFuerza } from '@/types'
import { getFinalidadLabel } from '@/domain/neuromuscular/fuerzaEngine'

interface TemplateDetailModalProps {
  isOpen: boolean
  onClose: () => void
  template: PlantillaFuerza | null
  onApply?: (template: PlantillaFuerza) => void
}

export const TemplateDetailModal: React.FC<TemplateDetailModalProps> = ({
  isOpen,
  onClose,
  template,
  onApply,
}) => {
  const { ejercicios_fuerza } = useStore()

  if (!template) return null

  return (
    <Modal open={isOpen} onClose={onClose} title={`Detalle de Plantilla: ${template.nombre}`}>
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between bg-surface-50 p-3 rounded border border-surface-200">
          <div>
            <span className="text-[10px] text-surface-500 uppercase block font-semibold">
              Finalidad Propuesta
            </span>
            <span className="font-semibold text-surface-800">
              {template.finalidad ? getFinalidadLabel(template.finalidad) : 'Sin finalidad'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-surface-500 uppercase block font-semibold">
              Estado
            </span>
            <span
              className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                template.activa
                  ? 'bg-green-100 text-green-800'
                  : 'bg-surface-200 text-surface-700'
              }`}
            >
              {template.activa ? 'Activa' : 'Archivada'}
            </span>
          </div>
        </div>

        {template.descripcion && (
          <div className="bg-white p-3 rounded border border-surface-200">
            <span className="text-[10px] text-surface-500 uppercase block font-semibold mb-1">
              Descripción / Notas de Prescripción
            </span>
            <p className="text-surface-700">{template.descripcion}</p>
          </div>
        )}

        <div>
          <h4 className="font-semibold text-surface-800 mb-2">
            Ejercicios Prescritos ({template.ejercicios.length})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {template.ejercicios.map((ej, index) => {
              const catalogEj = ejercicios_fuerza.find((e) => e.id_ejercicio === ej.id_ejercicio)
              const nombreEjercicio =
                catalogEj?.nombre || ej.ejercicio_nombre_historico || 'Ejercicio desconocido'
              const isInactive = catalogEj && !catalogEj.activo

              return (
                <div
                  key={index}
                  className="p-2.5 bg-surface-50 rounded border border-surface-200 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-surface-800">
                      {index + 1}. {nombreEjercicio} {isInactive ? '(Inactivo)' : ''}
                    </span>
                    <span className="text-[10px] text-surface-500">
                      {ej.series_propuestas || 1} series propuestas
                    </span>
                  </div>

                  <div className="flex gap-4 text-surface-600 text-[11px]">
                    {ej.repeticiones_propuestas !== undefined && (
                      <span>Reps obj: <strong>{ej.repeticiones_propuestas}</strong></span>
                    )}
                    {ej.carga_kg_propuesta !== undefined && (
                      <span>Carga obj: <strong>{ej.carga_kg_propuesta} kg</strong></span>
                    )}
                    {ej.rpe_objetivo !== undefined && (
                      <span>RPE obj: <strong>{ej.rpe_objetivo}</strong></span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-surface-200">
          <span className="text-[10px] text-surface-400">
            Creada: {new Date(template.createdAt).toLocaleDateString('es-ES')}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-surface-300 text-surface-700 hover:bg-surface-100 rounded transition-colors"
            >
              Cerrar
            </button>
            {template.activa && onApply && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onApply(template)
                }}
                className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded transition-colors"
              >
                Aplicar a Jugadora
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
