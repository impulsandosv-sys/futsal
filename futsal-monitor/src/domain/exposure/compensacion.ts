import type { CompensacionPostPartido, RPE_Partido } from '@/types'

/**
 * Calcula el déficit de minutos de compensación para una jugadora.
 * Solo calcula déficit si existe un objetivo explícito.
 * Si el déficit calculado es negativo (jugó más que el objetivo), se devuelve 0.
 *
 * @param minutosJugados Minutos jugados en el partido (obtenidos de RPE_Partido)
 * @param minutosObjetivo Objetivo de minutos (si está definido)
 * @returns Déficit de minutos o null si no hay objetivo
 */
export function calcularDeficitCompensacion(
  minutosJugados: number,
  minutosObjetivo?: number | null
): number | null {
  if (minutosObjetivo === undefined || minutosObjetivo === null) {
    return null
  }
  
  const deficit = minutosObjetivo - minutosJugados
  return Math.max(0, deficit)
}

/**
 * Deriva el estado por defecto de una compensación en base al déficit.
 * Si no hay objetivo, el estado es 'pendiente'.
 * Si el déficit es 0, el estado puede considerarse 'omitida' (ya que no necesita).
 * Si hay déficit, el estado será 'pendiente' hasta que el usuario lo cambie.
 */
export function inferirEstadoCompensacion(
  deficit: number | null,
  estadoActual: CompensacionPostPartido['estado']
): CompensacionPostPartido['estado'] {
  // Si ya tiene un estado terminal decidido por el usuario, no lo sobreescribimos
  if (estadoActual === 'realizada' || estadoActual === 'omitida' || estadoActual === 'planificada') {
    return estadoActual
  }
  
  if (deficit === null) {
    return 'pendiente'
  }
  
  if (deficit === 0) {
    return 'omitida'
  }
  
  return 'pendiente'
}
