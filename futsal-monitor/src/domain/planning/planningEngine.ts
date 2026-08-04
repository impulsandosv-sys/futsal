import { parseISO, differenceInCalendarDays } from 'date-fns'
import type { Partido, SesionRPE } from '@/types'

/**
 * Calcula la etiqueta MD (Match Day) para una fecha de sesión dada, basándose en la lista de partidos.
 * Si hay múltiples partidos y la relación MD no es inequívoca, devuelve un string vacío o null.
 * Se utilizan fechas locales 'YYYY-MM-DD'.
 */
export function calcularEtiquetaMD(fechaSesion: string, partidos: Partido[]): string | null {
  if (partidos.length === 0) return null

  const fSesion = parseISO(fechaSesion)

  if (partidos.length === 1) {
    const fPartido = parseISO(partidos[0].fecha)
    const diff = differenceInCalendarDays(fSesion, fPartido)
    if (diff === 0) return 'MD'
    return diff > 0 ? `MD+${diff}` : `MD${diff}`
  }

  // Si hay más de un partido en la semana, la etiqueta puede ser ambigua.
  // Regla: si coincide exactamente con un partido, es 'MD'.
  const partidosHoy = partidos.filter(p => p.fecha === fechaSesion)
  if (partidosHoy.length > 0) return 'MD'

  // Si no es el día de partido, calcular la distancia a cada partido.
  // Retornamos null si hay más de 1 partido y no es el día de partido, para evitar ambigüedades falsas.
  return null
}

/**
 * Evalúa si una sesión planificada o realizada puede ser eliminada (borrado destructivo).
 * Regla: Una sesión realizada o con registros individuales NO debe poder eliminarse, solo cancelarse.
 */
export function canDeleteSession(sesionId: string, estado: string | undefined, rpes: SesionRPE[]): boolean {
  if (estado === 'realizada') return false
  
  const hasRPEs = rpes.some(rpe => rpe.id_sesion === sesionId && (
    (rpe.rpe !== undefined && rpe.rpe !== null) ||
    (rpe.carga_ua !== undefined && rpe.carga_ua !== null) ||
    (rpe.asistencia && rpe.asistencia !== 'sin_registrar')
  ))
  
  if (hasRPEs) return false
  return true
}
