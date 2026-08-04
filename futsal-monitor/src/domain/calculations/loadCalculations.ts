import type { MonotonyStrain } from '@/types'

export function calcularIMC(peso_kg: number, altura_cm: number): number {
  if (altura_cm <= 0) return 0
  return Math.round((peso_kg / ((altura_cm / 100) ** 2)) * 10) / 10
}

export function calcularScoreWellness(w: {
  calidad_sueno?: number | null
  fatiga?: number | null
  dolor_muscular?: number | null
  estres?: number | null
  estado_animo?: number | null
}): number {
  let sum = 0
  let count = 0

  if (w.calidad_sueno !== undefined && w.calidad_sueno !== null && !isNaN(w.calidad_sueno)) {
    sum += w.calidad_sueno
    count++
  }
  if (w.fatiga !== undefined && w.fatiga !== null && !isNaN(w.fatiga)) {
    sum += (11 - w.fatiga)
    count++
  }
  if (w.dolor_muscular !== undefined && w.dolor_muscular !== null && !isNaN(w.dolor_muscular)) {
    sum += (11 - w.dolor_muscular)
    count++
  }
  if (w.estres !== undefined && w.estres !== null && !isNaN(w.estres)) {
    sum += (11 - w.estres)
    count++
  }
  if (w.estado_animo !== undefined && w.estado_animo !== null && !isNaN(w.estado_animo)) {
    sum += w.estado_animo
    count++
  }

  if (count === 0) return 0
  return Math.round((sum / count) * 10) / 10
}

export function calcularCargaUA(rpe?: number | null, duracion?: number | null): number | null {
  if (rpe === undefined || rpe === null || isNaN(rpe) || duracion === undefined || duracion === null || isNaN(duracion)) {
    return null
  }
  return rpe * duracion
}

export function calcularCargaObjetivoIndividual(duracion_planificada_min?: number, rpe_objetivo?: number): number | null {
  if (!duracion_planificada_min || !rpe_objetivo) return null
  return duracion_planificada_min * rpe_objetivo
}

export function calcularCargaObjetivoTotalEquipo(
  duracion_planificada_min?: number,
  rpe_objetivo?: number,
  participantes_previstos?: number
): number | null {
  if (!duracion_planificada_min || !rpe_objetivo || participantes_previstos === undefined || participantes_previstos === null) {
    return null
  }
  return duracion_planificada_min * rpe_objetivo * participantes_previstos
}

export function calcularCargaMediaRealizada(rpes: Array<{ carga_ua?: number | null, asistencia?: string, participacion?: string }>): number {
  if (!rpes || rpes.length === 0) return 0
  let totalCarga = 0
  let count = 0
  for (const rpe of rpes) {
    // Si la asistencia es nula o es una ausencia que no permite carga, la ignoramos.
    // Sin embargo, si tiene carga_ua, asumimos que fue registrada (para compatibilidad).
    if (rpe.carga_ua !== undefined && rpe.carga_ua !== null && !isNaN(rpe.carga_ua)) {
      totalCarga += rpe.carga_ua
      count++
    }
  }
  if (count === 0) return 0
  return Math.round(totalCarga / count)
}

export function calcularMonotonyStrain(cargasDiarias: number[]): MonotonyStrain {
  if (cargasDiarias.length === 0) {
    return { monotonia: 0, strain: 0, carga_semanal_media: 0, carga_semanal_std: 0 }
  }
  
  const media = cargasDiarias.reduce((a, b) => a + b, 0) / cargasDiarias.length
  const varianza = cargasDiarias.reduce((a, b) => a + Math.pow(b - media, 2), 0) / cargasDiarias.length
  const std = Math.sqrt(varianza)
  const monotonia = std > 0 ? Math.round((media / std) * 100) / 100 : 0
  const cargaSemanal = cargasDiarias.reduce((a, b) => a + b, 0)
  const strain = Math.round(cargaSemanal * monotonia * 10) / 10
  
  return {
    monotonia,
    strain,
    carga_semanal_media: Math.round(media * 10) / 10,
    carga_semanal_std: Math.round(std * 10) / 10,
  }
}

export function calcularACWREWMA(cargaDiaria: number[], lambda = 2 / 29): number {
  if (cargaDiaria.length === 0) return 0
  
  let cronica = cargaDiaria[0]
  for (let i = 1; i < cargaDiaria.length; i++) {
    cronica = lambda * cargaDiaria[i] + (1 - lambda) * cronica
  }
  const aguda = cargaDiaria[cargaDiaria.length - 1]
  return cronica > 0 ? Math.round((aguda / cronica) * 100) / 100 : 1
}

export function calcularCargaACWR(cargaSemanal: number[]): number {
  if (cargaSemanal.length === 0) return 0

  let promedioContinua = cargaSemanal[0]
  for (let i = 1; i < cargaSemanal.length; i++) {
    const alpha = Math.min(0.5, 0.05 * i)
    promedioContinua = alpha * cargaSemanal[i] + (1 - alpha) * promedioContinua
  }

  return Math.round(promedioContinua * 10) / 10
}

export function calcularTendenciaACWR(cargasSemanal: number[]): number {
  if (cargasSemanal.length < 2) return cargasSemanal[0] || 0

  let tendencia = cargasSemanal[0]

  for (let i = 1; i < cargasSemanal.length; i++) {
    const peso = i <= 2 ? 0.5 : Math.max(0.2, 1 - i / 8)
    tendencia = peso * cargasSemanal[i] + (1 - peso) * tendencia
  }

  return Math.round(tendencia * 10) / 10
}

export function calcularTendenciaWellness(puntuaciones: number[]): number {
  if (puntuaciones.length < 2) return puntuaciones[0] || 0

  let tendencia = puntuaciones[0]
  const alpha = 0.4

  for (let i = 1; i < puntuaciones.length; i++) {
    tendencia = alpha * puntuaciones[i] + (1 - alpha) * tendencia
  }

  return Math.round(tendencia * 10) / 10
}

export function getPercentilEquipo(array: number[]): { p25: number; p50: number; p75: number } {
  if (!array || !Array.isArray(array)) return { p25: 0, p50: 0, p75: 0 }

  const validValues = array.filter(v => typeof v === 'number' && Number.isFinite(v))
  if (validValues.length === 0) return { p25: 0, p50: 0, p75: 0 }

  const sorted = [...validValues].sort((a, b) => a - b)
  const length = sorted.length

  const getPercentilValue = (percentile: number): number => {
    if (length === 1) return sorted[0]
    const rawIdx = (percentile / 100) * (length - 1)
    const clampedIdx = Math.max(0, Math.min(length - 1, Math.round(rawIdx)))
    return sorted[clampedIdx]
  }

  return {
    p25: getPercentilValue(25),
    p50: getPercentilValue(50),
    p75: getPercentilValue(75),
  }
}
