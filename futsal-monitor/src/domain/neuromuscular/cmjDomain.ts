export type EstadoValidacionCMJ =
  | 'valido'
  | 'duplicado'
  | 'conflicto'
  | 'requiere_revision'
  | 'error'

export interface MedicionCMJNormalizada {
  idJugadora: string
  aliasOrigen: string
  origenAlias: 'chronojump'

  idProtocolo: string
  fecha: string // YYYY-MM-DD local estricto
  intento: number // entero positivo (1, 2, 3...)

  alturaSaltoCm: number
  tiempoVueloMs?: number | null
  unidadAltura: 'cm'

  seleccionadoComoMejor: boolean

  estado: EstadoValidacionCMJ
  motivoEstado?: string

  fuente: 'chronojump'

  // Preparados para T-04B; T-04A no los rellena desde archivo
  nombreArchivo?: string
  idLote?: string
  filaOrigen?: number
  fechaImportacion?: string
}

/**
 * Banda técnica provisional de plausibilidad de altura de salto CMJ (femenino).
 * 10 cm a 70 cm. Valores fuera de este rango se marcan como 'requiere_revision'.
 * Control técnico revisable, no norma clínica ni diagnóstico.
 */
export const BANDA_PLAUSIBILIDAD_CMJ = {
  MIN_CM: 10,
  MAX_CM: 70,
} as const
