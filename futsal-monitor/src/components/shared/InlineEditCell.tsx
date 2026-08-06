import { useState, useEffect } from 'react'
import { evaluarEstadoCampo, obtenerClasesVisualesCampo } from '@/utils/formValidation'
import { esRegistroHistorico } from '@/domain/dates/dates'
import { ConfirmationModal } from './ConfirmationModal'

interface InlineEditCellProps {
  value: number
  onSave: (newValue: number, motivo?: string) => void
  min?: number
  max?: number
  fechaRegistro?: string
  entidad?: string
}

export function InlineEditCell({
  value,
  onSave,
  min = 0,
  max = 10,
  fechaRegistro,
  entidad = 'RPE'
}: InlineEditCellProps) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState<number | string>(value)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingValue, setPendingValue] = useState<number | null>(null)

  useEffect(() => {
    setVal(value)
  }, [value])

  const resVal = evaluarEstadoCampo(val, { required: true, min, max })
  const { inputClasses } = obtenerClasesVisualesCampo(resVal)

  const handleCommit = (targetVal: number) => {
    if (resVal.estado === 'invalid') return

    if (targetVal !== value) {
      const isHistoric = fechaRegistro ? esRegistroHistorico(fechaRegistro) : false
      if (isHistoric) {
        setPendingValue(targetVal)
        setShowConfirmModal(true)
      } else {
        onSave(targetVal)
      }
    }
  }

  if (editing) {
    return (
      <>
        <input
          type="number"
          min={min}
          max={max}
          className={`w-14 rounded px-1.5 py-0.5 text-xs font-semibold border ${inputClasses}`}
          value={val}
          onChange={(e) => setVal(e.target.value === '' ? '' : Number(e.target.value))}
          onBlur={() => {
            setEditing(false)
            if (val !== '' && !isNaN(Number(val))) {
              handleCommit(Number(val))
            } else {
              setVal(value)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setEditing(false)
              if (val !== '' && !isNaN(Number(val))) {
                handleCommit(Number(val))
              } else {
                setVal(value)
              }
            } else if (e.key === 'Escape') {
              setEditing(false)
              setVal(value)
            }
          }}
          autoFocus
        />

        {showConfirmModal && pendingValue !== null && (
          <ConfirmationModal
            open={showConfirmModal}
            onClose={() => {
              setShowConfirmModal(false)
              setPendingValue(null)
              setVal(value)
            }}
            onConfirm={(motivo) => {
              setShowConfirmModal(false)
              onSave(pendingValue, motivo)
              setPendingValue(null)
            }}
            entidad={entidad}
            valorAnterior={value}
            valorNuevo={pendingValue}
            descripcion={`Modificación de ${entidad} histórico con antigüedad superior a 7 días.`}
          />
        )}
      </>
    )
  }

  return (
    <>
      <span
        onClick={() => setEditing(true)}
        className="cursor-pointer hover:bg-primary-50 px-1 py-0.5 rounded transition-colors block w-full text-center"
      >
        {value}
      </span>

      {showConfirmModal && pendingValue !== null && (
        <ConfirmationModal
          open={showConfirmModal}
          onClose={() => {
            setShowConfirmModal(false)
            setPendingValue(null)
            setVal(value)
          }}
          onConfirm={(motivo) => {
            setShowConfirmModal(false)
            onSave(pendingValue, motivo)
            setPendingValue(null)
          }}
          entidad={entidad}
          valorAnterior={value}
          valorNuevo={pendingValue}
          descripcion={`Modificación de ${entidad} histórico con antigüedad superior a 7 días.`}
        />
      )}
    </>
  )
}
