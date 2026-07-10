import { format, parseISO, startOfWeek, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Wellness, RPE_Entreno, RPE_Partido, Sesion, Partido, ResumenSemanal } from '@/types'

export function calcularIMC(peso_kg: number, altura_cm: number): number {
  if (altura_cm <= 0) return 0
  return Math.round((peso_kg / ((altura_cm / 100) ** 2)) * 10) / 10
}

export function calcularScoreWellness(w: Omit<Wellness, 'score_wellness' | 'id'>): number {
  return Math.round(
    (w.calidad_sueno + w.fatiga + w.dolor_muscular + w.estres + w.estado_animo) / 5 * 10
  ) / 10
}

export function calcularCargaUA(rpe: number, duracion: number): number {
  return rpe * duracion
}

export function getWeekId(fecha: string): string {
  const d = parseISO(fecha)
  return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

export function formatWeek(weekId: string): string {
  const d = parseISO(weekId)
  const end = addDays(d, 6)
  return `${format(d, 'd MMM', { locale: es })} - ${format(end, 'd MMM yyyy', { locale: es })}`
}

export function calcularResumenSemanal(
  jugadoraId: string,
  semana: string,
  sesiones: Sesion[],
  partidos: Partido[],
  rpe_entreno: RPE_Entreno[],
  rpe_partido: RPE_Partido[],
  wellnessList: Wellness[],
  historicoSemanas: ResumenSemanal[],
): ResumenSemanal {
  const weekStart = parseISO(semana)
  const weekEnd = addDays(weekStart, 6)
  const weekStartStr = semana
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

  const rpeEntrenoSemana = rpe_entreno.filter(
    (r) => r.id_jugadora === jugadoraId && r.fecha >= weekStartStr && r.fecha <= weekEndStr
  )
  const rpePartidoSemana = rpe_partido.filter(
    (r) => r.id_jugadora === jugadoraId && r.fecha >= weekStartStr && r.fecha <= weekEndStr
  )

  const cargaEntreno = rpeEntrenoSemana.reduce((sum, r) => sum + r.carga_ua, 0)
  const cargaPartido = rpePartidoSemana.reduce((sum, r) => sum + r.carga_ua, 0)
  const cargaTotal = cargaEntreno + cargaPartido
  const numSesiones = new Set(rpeEntrenoSemana.map((r) => r.id_sesion)).size

  const wellnessSemana = wellnessList.filter(
    (w) => w.id_jugadora === jugadoraId && w.fecha >= weekStartStr && w.fecha <= weekEndStr
  )
  const wellnessMedio = wellnessSemana.length > 0
    ? Math.round(wellnessSemana.reduce((s, w) => s + w.score_wellness, 0) / wellnessSemana.length * 10) / 10
    : 0

  const semanasPrevias = historicoSemanas
    .filter((rs) => rs.id_jugadora === jugadoraId && rs.semana < semana)
    .sort((a, b) => b.semana.localeCompare(a.semana))
    .slice(0, 4)

  const cargasPrevias = semanasPrevias.map((rs) => rs.carga_total)
  const cargaCronica = cargasPrevias.length > 0
    ? Math.round((cargasPrevias.reduce((s, c) => s + c, 0) + cargaTotal) / (cargasPrevias.length + 1) * 10) / 10
    : cargaTotal

  const acwr = cargaCronica > 0
    ? Math.round(cargaTotal / cargaCronica * 100) / 100
    : 1

  let estado = 'normal'
  if (acwr > 1.5) estado = 'alto'
  else if (acwr > 1.3) estado = 'elevado'
  else if (acwr < 0.5) estado = 'muy_bajo'
  else if (acwr < 0.8) estado = 'bajo'

  return {
    semana,
    id_jugadora: jugadoraId,
    carga_entreno: Math.round(cargaEntreno * 10) / 10,
    carga_partido: Math.round(cargaPartido * 10) / 10,
    carga_total: Math.round(cargaTotal * 10) / 10,
    carga_cronica: cargaCronica,
    acwr,
    estado,
    num_sesiones: numSesiones,
    wellness_medio: wellnessMedio,
  }
}

export function getWellnessThreshold(status: string): { color: string; label: string } {
  switch (status) {
    case 'critico': return { color: 'text-red-600 bg-red-50', label: 'Crítico' }
    case 'bajo': return { color: 'text-amber-600 bg-amber-50', label: 'Bajo' }
    case 'normal': return { color: 'text-green-600 bg-green-50', label: 'Normal' }
    case 'bueno': return { color: 'text-emerald-600 bg-emerald-50', label: 'Bueno' }
    default: return { color: 'text-surface-500 bg-surface-100', label: 'Sin datos' }
  }
}

export function getWellnessLevel(score: number): string {
  if (score <= 0) return 'sin_datos'
  if (score < 4) return 'critico'
  if (score < 6) return 'bajo'
  if (score < 8) return 'normal'
  return 'bueno'
}

export function getLoadStatus(acwr: number): { color: string; label: string } {
  if (acwr >= 1.5) return { color: 'text-red-600 bg-red-50', label: 'Riesgo lesión' }
  if (acwr >= 1.3) return { color: 'text-amber-600 bg-amber-50', label: 'Elevado' }
  if (acwr <= 0.5) return { color: 'text-blue-600 bg-blue-50', label: 'Muy bajo' }
  if (acwr <= 0.8) return { color: 'text-amber-600 bg-amber-50', label: 'Bajo' }
  return { color: 'text-green-600 bg-green-50', label: 'Óptimo' }
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

export function getPercentilEquipo(array: number[], _percentiles?: number[]): { p25: number, p50: number, p75: number } {
  if (array.length === 0) return { p25: 0, p50: 0, p75: 0 }

  const sorted = [...array].sort((a, b) => a - b)
  const length = sorted.length

  const getIndex = (percentile: number): number => {
    const idx = (percentile / 100) * (length - 1) + 1
    return Math.round(idx)
  }

  return {
    p25: sorted[getIndex(25)] || sorted[Math.floor(length * 0.25)],
    p50: sorted[getIndex(50)] || sorted[Math.floor(length * 0.5)],
    p75: sorted[getIndex(75)] || sorted[Math.floor(length * 0.75)],
  }
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

export interface EquipoMetrics {
  promedioWellness: number
  tendenciaWellness: number
  cargaUA: number
  cargaACWR: number
  percentiles: { p25: number, p50: number, p75: number }
}
