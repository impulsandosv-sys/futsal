import { useState, useEffect } from 'react'
import { Modal } from './Modal'

export interface ConfirmationModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (motivo: string) => void
  title?: string
  entidad: string
  valorAnterior: string | number | boolean | null
  valorNuevo: string | number | boolean | null
  descripcion?: string
}

export function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title = 'Confirmación de cambio crítico',
  entidad,
  valorAnterior,
  valorNuevo,
  descripcion
}: ConfirmationModalProps) {
  const [motivo, setMotivo] = useState('')
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setMotivo('')
      setErrorMotivo(null)
    }
  }, [open])

  // Manejador de tecla Escape para abortar el cambio
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const handleConfirm = () => {
    const trimmed = motivo.trim()
    if (!trimmed) {
      setErrorMotivo('El motivo es obligatorio para registrar el cambio en auditoría')
      return
    }

    setErrorMotivo(null)
    onConfirm(trimmed)
  }

  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-md">
      <div className="space-y-4">
        {descripcion && (
          <p className="text-xs text-surface-600 leading-relaxed bg-surface-50 p-2.5 rounded-lg border border-surface-200">
            {descripcion}
          </p>
        )}

        {/* Resumen del cambio: Valor anterior vs. Valor nuevo */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-xs">
          <div>
            <span className="text-[11px] font-medium text-surface-500 uppercase tracking-wider block">Valor anterior</span>
            <span className="font-semibold text-rose-700 mt-0.5 block truncate">
              {valorAnterior !== null && valorAnterior !== undefined ? String(valorAnterior) : '(vacío)'}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-surface-500 uppercase tracking-wider block">Valor nuevo</span>
            <span className="font-semibold text-emerald-700 mt-0.5 block truncate">
              {valorNuevo !== null && valorNuevo !== undefined ? String(valorNuevo) : '(vacío)'}
            </span>
          </div>
        </div>

        {/* Motivo obligatorio del cambio */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="motivo-input" className="text-xs font-semibold text-surface-800 flex items-center justify-between">
            <span>Motivo de la modificación ({entidad})</span>
            <span className="text-amber-600 font-normal text-[10px]">* Obligatorio</span>
          </label>
          <textarea
            id="motivo-input"
            rows={3}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value)
              if (e.target.value.trim()) setErrorMotivo(null)
            }}
            placeholder="Describa el motivo o justificación técnica de este cambio..."
            className={`w-full p-2.5 text-xs font-normal border rounded-lg focus:outline-none transition-colors ${
              errorMotivo
                ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/40 text-rose-900'
                : 'border-surface-300 focus:ring-primary-500 focus:border-primary-500 text-surface-900 bg-white'
            }`}
          />
          {errorMotivo && <span className="text-rose-600 text-[11px] font-medium block">{errorMotivo}</span>}
        </div>

        {/* Botones de acción: Cancelar vs Confirmar */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-surface-700 bg-surface-100 hover:bg-surface-200 border border-surface-300 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors"
          >
            Confirmar cambio
          </button>
        </div>
      </div>
    </Modal>
  )
}
