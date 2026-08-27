import { useState, useEffect } from 'react'
import { Modal } from '@/components/shared/Modal'
import type { AccionAjusteMenstrual } from '@/types'
import { getTodayLocalISO } from '@/domain/dates/dates'
import { useStore } from '@/store/store'

interface DecisionMenstrualModalProps {
  open: boolean
  onClose: () => void
  registroId: number
  jugadoraName: string
}

const OPCIONES_ACCION: { value: AccionAjusteMenstrual | ''; label: string }[] = [
  { value: '', label: '-- Seleccionar Acción (Opcional) --' },
  { value: 'SIN_CAMBIOS', label: 'Sin cambios' },
  { value: 'CONVERSACION_MANTENIDA', label: 'Conversación mantenida' },
  { value: 'AJUSTE_TAREA_INDIVIDUAL', label: 'Ajuste en tarea individual' },
  { value: 'AJUSTE_VOLUMEN', label: 'Ajuste de volumen' },
  { value: 'AJUSTE_INTENSIDAD', label: 'Ajuste de intensidad' },
  { value: 'RECUPERACION_SEGUIMIENTO', label: 'Recuperación y seguimiento' }
]

export function DecisionMenstrualModal({ open, onClose, registroId, jugadoraName }: DecisionMenstrualModalProps) {
  const registros = useStore((s) => s.registros_menstruales)
  const updateRegistroMenstrual = useStore((s) => s.updateRegistroMenstrual)

  const registro = registros.find(r => r.id === registroId)

  const [fechaDecision, setFechaDecision] = useState('')
  const [accionAjuste, setAccionAjuste] = useState<AccionAjusteMenstrual | ''>('')
  const [notaAjuste, setNotaAjuste] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && registro) {
      setAccionAjuste(registro.accion_ajuste ?? '')
      setNotaAjuste(registro.nota_ajuste ?? '')
      setFechaDecision(registro.fecha_decision ?? getTodayLocalISO())
      setError('')
    }
  }, [open, registro])

  if (!registro) return null

  const handleSave = async () => {
    try {
      setError('')
      const updateData = {
        fecha_inicio: registro.fecha_inicio,
        impacto_percibido: registro.impacto_percibido,
        comentario: registro.comentario,
        nota_ajuste: notaAjuste.trim() === '' ? null : notaAjuste,
        accion_ajuste: accionAjuste === '' ? null : accionAjuste,
        fecha_decision: fechaDecision === '' ? null : fechaDecision,
      }
      await updateRegistroMenstrual(registroId, updateData)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al guardar la decisión.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Decisión operativa menstrual" width="max-w-lg">
      <div className="space-y-4">
        <p className="text-xs text-surface-500 bg-surface-50 p-3 rounded-lg">
          Registro manual de una decisión profesional. No modifica automáticamente la carga, el riesgo ni la disponibilidad.
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-100">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-surface-700 mb-1">Jugadora</label>
            <input type="text" readOnly value={jugadoraName} className="w-full text-xs p-2 border border-surface-300 rounded-md bg-surface-100 text-surface-600" />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-700 mb-1">Inicio comunicado</label>
            <input type="date" readOnly value={registro.fecha_inicio} className="w-full text-xs p-2 border border-surface-300 rounded-md bg-surface-100 text-surface-600" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-700 mb-1">Fecha de decisión</label>
          <input
            type="date"
            value={fechaDecision}
            onChange={(e) => setFechaDecision(e.target.value)}
            max={getTodayLocalISO()}
            className="w-full text-xs p-2 border border-surface-300 rounded-md focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-700 mb-1">Acción principal</label>
          <select
            value={accionAjuste}
            onChange={(e) => setAccionAjuste(e.target.value as AccionAjusteMenstrual | '')}
            className="w-full text-xs p-2 border border-surface-300 rounded-md focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          >
            {OPCIONES_ACCION.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-700 mb-1">Nota de ajuste / conversación</label>
          <textarea
            value={notaAjuste}
            onChange={(e) => setNotaAjuste(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="Opcional. Máx 200 caracteres."
            className="w-full text-xs p-2 border border-surface-300 rounded-md focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
          <div className="text-right text-[10px] text-surface-400 mt-1">
            {notaAjuste.length} / 200
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-surface-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-surface-700 bg-white border border-surface-300 rounded-md hover:bg-surface-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
          >
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  )
}
