import { getTodayLocalISO, validateFechaLocalISO } from '@/domain/dates/dates'

export type EstadoCampoValidacion = 'pendiente' | 'invalid' | 'valid'

export interface ResultadoValidacionCampo {
  estado: EstadoCampoValidacion
  mensaje: string | null
}

export interface ReglasValidacionInput {
  required?: boolean
  min?: number
  max?: number
  isDate?: boolean
  allowFutureDate?: boolean
  customValidator?: (val: any) => string | null
}

/**
 * Evalúa el estado de validación de un campo de formulario distinguiendo:
 * - 'pendiente': campo vacío obligatorio (borde amarillo, mensaje "Requerido").
 * - 'invalid': valor fuera de rango o mal formateado (borde rojo, mensaje de error específico).
 * - 'valid': valor dentro de rango o opcional no rellenado (borde verde, sin error).
 */
export function evaluarEstadoCampo(val: any, reglas: ReglasValidacionInput): ResultadoValidacionCampo {
  const isNil = val === null || val === undefined || (typeof val === 'string' && val.trim() === '')
  
  if (isNil) {
    if (reglas.required) {
      return { estado: 'pendiente', mensaje: 'Requerido' }
    }
    return { estado: 'valid', mensaje: null }
  }

  // Validaciones numéricas (ej. RPE, minutos, dolor)
  if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)) && reglas.min !== undefined)) {
    const num = Number(val)
    if (isNaN(num)) {
      return { estado: 'invalid', mensaje: 'Debe ser un número válido' }
    }
    if (reglas.min !== undefined && num < reglas.min) {
      return { estado: 'invalid', mensaje: `El valor mínimo permitido es ${reglas.min}` }
    }
    if (reglas.max !== undefined && num > reglas.max) {
      return { estado: 'invalid', mensaje: `El valor máximo permitido es ${reglas.max}` }
    }
  }

  // Validaciones de fecha
  if (reglas.isDate) {
    const errFecha = validateFechaLocalISO(val, 'fecha')
    if (errFecha) {
      return { estado: 'invalid', mensaje: errFecha }
    }
    if (!reglas.allowFutureDate && typeof val === 'string') {
      const hoyStr = getTodayLocalISO()
      if (val > hoyStr) {
        return { estado: 'invalid', mensaje: 'La fecha no puede ser futura' }
      }
    }
  }

  // Validador personalizado
  if (reglas.customValidator) {
    const errCustom = reglas.customValidator(val)
    if (errCustom) {
      return { estado: 'invalid', mensaje: errCustom }
    }
  }

  return { estado: 'valid', mensaje: null }
}

/**
 * Retorna las clases de estilación CSS y mensaje visual según la Regla 2 (Pendiente vs Inválido vs Válido).
 */
export function obtenerClasesVisualesCampo(res: ResultadoValidacionCampo): {
  inputClasses: string
  messageClasses?: string
  messageText?: string
} {
  switch (res.estado) {
    case 'pendiente':
      return {
        inputClasses: 'border-amber-400 focus:ring-amber-500 focus:border-amber-500 bg-amber-50/20 text-surface-900',
        messageClasses: 'text-amber-600 text-[11px] font-medium mt-1 block',
        messageText: res.mensaje || 'Requerido'
      }
    case 'invalid':
      return {
        inputClasses: 'border-rose-500 ring-1 ring-rose-500 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/40 text-rose-900',
        messageClasses: 'text-rose-600 text-[11px] font-medium mt-1 block',
        messageText: res.mensaje || 'Valor inválido'
      }
    case 'valid':
    default:
      return {
        inputClasses: 'border-emerald-500 focus:ring-emerald-500 focus:border-emerald-500 text-surface-900',
        messageText: undefined
      }
  }
}
