import { useId } from 'react'
import { evaluarEstadoCampo, obtenerClasesVisualesCampo } from '@/utils/formValidation'

export interface DatePickerProps {
  value: string
  onChange: (newValue: string) => void
  label?: string
  required?: boolean
  allowFuture?: boolean
  disabled?: boolean
  className?: string
  placeholder?: string
}

export function DatePicker({
  value,
  onChange,
  label,
  required = true,
  allowFuture = false,
  disabled = false,
  className = '',
  placeholder
}: DatePickerProps) {
  const inputId = useId()

  const resVal = evaluarEstadoCampo(value, {
    required,
    isDate: true,
    allowFutureDate: allowFuture
  })

  const { inputClasses, messageClasses, messageText } = obtenerClasesVisualesCampo(resVal)

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-surface-800 flex items-center justify-between">
          <span>{label}</span>
          {required && <span className="text-amber-600 font-normal text-[10px]">*</span>}
        </label>
      )}

      <input
        id={inputId}
        type="date"
        value={value || ''}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`px-3 py-1.5 text-xs font-medium bg-white rounded-lg border focus:outline-none transition-colors ${inputClasses} ${
          disabled ? 'bg-surface-100 text-surface-400 cursor-not-allowed border-surface-300' : ''
        }`}
      />

      {messageText && <span className={messageClasses}>{messageText}</span>}
    </div>
  )
}
