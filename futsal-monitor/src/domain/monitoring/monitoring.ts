import { parseISO, addDays, format } from 'date-fns'
import { UMBRALES } from '@/config/monitoringThresholds'
import { 
  calcularMonotonyStrain 
} from '../calculations/loadCalculations'
import { obtenerCargasDiariasJugadora } from '../calculations/dailyLoad'
import { obtenerFechasUltimosDias } from '../dates/dates'
import type { 
  Jugadora, Wellness, Sesion, Partido, Lesion, 
  ResumenSemanal, Alerta, SesionRPE, Readiness, 
  RPE_Partido, ReadinessInput, ReadinessNivel 
} from '@/types'

export interface PrioridadRevisionResultado {
  jugadora: Jugadora
  prioridad: 'prioritaria' | 'hoy' | 'semana' | 'rutinario'
  factores: string[]
  ultimoWellness: Wellness | null
  ultimoRS: ResumenSemanal | null
  lesionActiva: Lesion | null
  tendenciaWellness: number
  tendenciaACWR: number
  rsSemanaActual: ResumenSemanal | null
  rsSemanaPasada: ResumenSemanal | null
}

export interface EquipoResumen {
  carga_total: number
  carga_media: number
  acwr_medio: number
  wellness_medio: number
  con_datos: number
  prioritarias: number
  elevado: number
}

export interface ResumenHoy {
  pctRespuestas: number
  wellnessScoreMedio: number
  jugadorasSinWellness: Jugadora[]
  jugadorasConWellnessCount: number
  sesionHoy: Sesion | undefined
  partidoHoy: Partido | undefined
  lesionesActivasCount: number
  enReadaptacionCount: number
}

export interface ResumenDashboard {
  activasCount: number
  lesionadasActivasCount: number
  wellnessMedio: number
  jugConAlertasCount: number
  cargaSemanalTotal: number
  acwrMedio: number
  monotonia: number
  strain: number
}

export function getWellnessLevel(score: number): string {
  if (score <= 0) return 'sin_datos'
  if (score < UMBRALES.WELLNESS.CRITICO) return 'critico'
  if (score < UMBRALES.WELLNESS.BAJO) return 'bajo'
  if (score < UMBRALES.WELLNESS.BUENO) return 'normal'
  return 'bueno'
}

export function obtenerDetallesWellnessBajo(w: Wellness): string[] {
  const detalles: string[] = []
  if (w.calidad_sueno !== null && w.calidad_sueno !== undefined && !isNaN(w.calidad_sueno) && w.calidad_sueno < 6) {
    detalles.push(`sueño malo (${w.calidad_sueno}/10)`)
  }
  if (w.fatiga !== null && w.fatiga !== undefined && !isNaN(w.fatiga) && w.fatiga > 5) {
    detalles.push(`fatiga (${w.fatiga}/10)`)
  }
  if (w.dolor_muscular !== null && w.dolor_muscular !== undefined && !isNaN(w.dolor_muscular) && w.dolor_muscular > 5) {
    detalles.push(`dolor musc. (${w.dolor_muscular}/10)`)
  }
  if (w.estres !== null && w.estres !== undefined && !isNaN(w.estres) && w.estres > 5) {
    detalles.push(`estrés (${w.estres}/10)`)
  }
  if (w.estado_animo !== null && w.estado_animo !== undefined && !isNaN(w.estado_animo) && w.estado_animo < 6) {
    detalles.push(`ánimo bajo (${w.estado_animo}/10)`)
  }
  return detalles;
}

export function getWellnessThreshold(status: string): { color: string; label: string } {
  switch (status) {
    case 'critico': return { color: 'text-red-600 bg-red-50', label: 'Muy bajo' }
    case 'bajo': return { color: 'text-amber-600 bg-amber-50', label: 'Bajo' }
    case 'normal': return { color: 'text-green-600 bg-green-50', label: 'Normal' }
    case 'bueno': return { color: 'text-emerald-600 bg-emerald-50', label: 'Bueno' }
    default: return { color: 'text-surface-500 bg-surface-100', label: 'Sin datos' }
  }
}

export function getLoadStatus(acwr: number): { color: string; label: string } {
  if (acwr >= UMBRALES.ACWR.ALTO) return { color: 'text-red-600 bg-red-50', label: 'Revisión prioritaria' }
  if (acwr >= UMBRALES.ACWR.ELEVADO) return { color: 'text-amber-600 bg-amber-50', label: 'Elevado' }
  if (acwr <= UMBRALES.ACWR.MUY_BAJO) return { color: 'text-blue-600 bg-blue-50', label: 'Muy bajo' }
  if (acwr <= UMBRALES.ACWR.BAJO) return { color: 'text-amber-600 bg-amber-50', label: 'Bajo' }
  return { color: 'text-green-600 bg-green-50', label: 'Óptimo' }
}

export function calcularCargaDiariaUltimosDias(
  rpeEntreno: SesionRPE[],
  rpePartido: RPE_Partido[],
  numDias: number,
  fechaReferencia: string,
  sesiones?: Sesion[]
): { fecha: string; carga: number }[] {
  const fechasInteres = obtenerFechasUltimosDias(fechaReferencia, numDias)
  const map = new Map<string, number>()
  
  for (const f of fechasInteres) {
    map.set(f, 0)
  }
  
  for (const r of rpeEntreno) {
    if (map.has(r.fecha)) {
      const s = sesiones?.find(x => x.id_sesion === r.id_sesion)
      if (s?.estado !== 'cancelada') {
        map.set(r.fecha, (map.get(r.fecha) || 0) + (r.carga_ua || 0))
      }
    }
  }
  for (const r of rpePartido) {
    if (map.has(r.fecha)) {
      map.set(r.fecha, (map.get(r.fecha) || 0) + (r.carga_ua || 0))
    }
  }
  
  return fechasInteres.map(f => ({
    fecha: f.slice(5),
    carga: map.get(f) || 0
  }))
}

export interface FiltrosCarga {
  incluirPartidos?: boolean
  incluirGimnasio?: boolean
  incluirReadaptacion?: boolean
}

export function calcularResumenSemanal(
  jugadoraId: string,
  semana: string,
  sesiones: Sesion[],
  partidos: Partido[],
  sesion_rpe: SesionRPE[],
  rpe_partido: RPE_Partido[],
  wellnessList: Wellness[],
  historicoSemanas: ResumenSemanal[],
  config?: FiltrosCarga
): ResumenSemanal {
  const weekEndStr = format(addDays(parseISO(semana), 6), 'yyyy-MM-dd') // fin de semana (día 7)

  // Usar el módulo puro unificado obtenerCargasDiariasJugadora como Fuente Única de Verdad
  const cargasDiariasMap = obtenerCargasDiariasJugadora({
    jugadoraId,
    fechaDesde: semana,
    fechaHasta: weekEndStr,
    sesiones,
    sesionesRPE: sesion_rpe,
    rpePartidos: rpe_partido,
    partidos,
    config
  })

  let cargaEntreno = 0
  let cargaPartido = 0
  let numSesiones = 0

  for (const entry of cargasDiariasMap.values()) {
    for (const d of entry.detalles) {
      if (d.origen === 'partido' || d.tipoSesion === 'Partido') {
        cargaPartido += d.cargaCalculada
      } else {
        cargaEntreno += d.cargaCalculada
      }
      if (d.origen === 'sesion') {
        numSesiones++
      }
    }
  }

  const cargaTotal = cargaEntreno + cargaPartido

  const wellnessSemana = wellnessList.filter(
    (w) => w.id_jugadora === jugadoraId && w.fecha >= semana && w.fecha <= weekEndStr
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
  if (acwr > UMBRALES.ACWR.ALTO) estado = 'alto'
  else if (acwr > UMBRALES.ACWR.ELEVADO) estado = 'elevado'
  else if (acwr < UMBRALES.ACWR.MUY_BAJO) estado = 'muy_bajo'
  else if (acwr < UMBRALES.ACWR.BAJO) estado = 'bajo'

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

export function calcularReadinessDiaria(input: ReadinessInput & { creada: string }): Readiness {
  const { wellness, acwr, cargaAguda, cargaCronica, diasDesdeWellness, creada } = input
  
  let score = 100
  const factores = { wellness: 0, acwr: 0, carga_aguda: cargaAguda, carga_cronica: cargaCronica, dias_desde_ultimo_wellness: diasDesdeWellness }
  
  if (wellness) {
    const wScore = wellness.score_wellness
    factores.wellness = Math.round(wScore * 10)
    score -= (10 - wScore) * 4
  } else {
    score -= 40
  }
  
  if (acwr > UMBRALES.ACWR.ALTO) score -= 30
  else if (acwr > UMBRALES.ACWR.ELEVADO) score -= 20
  else if (acwr > 1.0) score -= 10
  else if (acwr < UMBRALES.ACWR.BAJO) score -= 15
  factores.acwr = acwr
  
  if (diasDesdeWellness > 3) score -= 20
  else if (diasDesdeWellness > 1) score -= 10
  
  score = Math.max(0, Math.min(100, score))
  
  let nivel: ReadinessNivel = 'verde'
  if (score < 50) nivel = 'rojo'
  else if (score < 75) nivel = 'ambar'
  
  return {
    id_jugadora: input.id_jugadora,
    fecha: input.fecha,
    nivel,
    score: Math.round(score),
    factores,
    creada,
  }
}

export function calcularPrioridadRevision(
  j: Jugadora,
  wellnessList: Wellness[],
  resumenesList: ResumenSemanal[],
  lesionesList: Lesion[],
  hoyStr: string
): PrioridadRevisionResultado {
  const wellnessJug = wellnessList.filter((w) => w.id_jugadora === j.id_jugadora).sort((a, b) => b.fecha.localeCompare(a.fecha))
  const resumenJug = resumenesList.filter((rs) => rs.id_jugadora === j.id_jugadora).sort((a, b) => b.semana.localeCompare(a.semana))
  const lesionActiva = lesionesList.find((l) => l.id_jugadora === j.id_jugadora && !l.disponible) || null

  const ultimoWellness = wellnessJug[0] || null
  const ultimoRS = resumenJug[0] || null
  const rsSemanaActual = resumenJug[0] || null
  const rsSemanaPasada = resumenJug[1] || null

  const wellnessScores = wellnessJug.slice(0, 7).map(w => w.score_wellness)
  
  // Calculate wellness trend
  let tendenciaWellness = wellnessScores[0] || 0
  if (wellnessScores.length > 1) {
    tendenciaWellness = wellnessScores[0]
    const alpha = 0.4
    for (let i = 1; i < wellnessScores.length; i++) {
      tendenciaWellness = alpha * wellnessScores[i] + (1 - alpha) * tendenciaWellness
    }
    tendenciaWellness = Math.round(tendenciaWellness * 10) / 10
  }

  const cargasSemanales = resumenJug.slice(0, 5).map(rs => rs.carga_total)
  
  // Calculate load trend
  let tendenciaACWR = cargasSemanales[0] || 0
  if (cargasSemanales.length > 1) {
    tendenciaACWR = cargasSemanales[0]
    for (let i = 1; i < cargasSemanales.length; i++) {
      const peso = i <= 2 ? 0.5 : Math.max(0.2, 1 - i / 8)
      tendenciaACWR = peso * cargasSemanales[i] + (1 - peso) * tendenciaACWR
    }
    tendenciaACWR = Math.round(tendenciaACWR * 10) / 10
  }

  let prioridad: 'prioritaria' | 'hoy' | 'semana' | 'rutinario' = 'rutinario'
  const factores: string[] = []

  const diasDesdeUltimoWellness = ultimoWellness 
    ? Math.ceil((parseISO(hoyStr).getTime() - parseISO(ultimoWellness.fecha).getTime()) / 86400000) 
    : 99

  if (diasDesdeUltimoWellness > 3) {
    prioridad = 'semana'
    factores.push('Datos insuficientes para interpretar')
  }

  if (ultimoWellness && ultimoWellness.score_wellness < UMBRALES.WELLNESS.CRITICO) {
    prioridad = 'prioritaria'
    const detalles = obtenerDetallesWellnessBajo(ultimoWellness)
    if (detalles.length > 0) {
      factores.push(`Wellness muy bajo (${ultimoWellness.score_wellness}/10): ${detalles.join(', ')}`)
    } else {
      factores.push(`Wellness muy bajo (${ultimoWellness.score_wellness}/10)`)
    }
  } else if (ultimoWellness && ultimoWellness.score_wellness < UMBRALES.WELLNESS.BAJO) {
    if (prioridad === 'rutinario') prioridad = 'semana'
    const detalles = obtenerDetallesWellnessBajo(ultimoWellness)
    if (detalles.length > 0) {
      factores.push(`Wellness bajo (${ultimoWellness.score_wellness}/10): ${detalles.join(', ')}`)
    } else {
      factores.push(`Wellness bajo (${ultimoWellness.score_wellness}/10)`)
    }
  }

  if (resumenJug.length < UMBRALES.ACWR.INSUFICIENTE) {
    factores.push('Historial insuficiente')
  } else {
    const referencia = resumenJug.slice(1, 5).reduce((sum, rs) => sum + rs.carga_total, 0) / Math.min(resumenJug.length - 1, 4)
    if (referencia > 0) {
      if (rsSemanaActual && rsSemanaActual.carga_total > referencia * (1 + UMBRALES.CARGA.VARIABILIDAD_INCREMENTO_PCT)) {
        prioridad = 'hoy'
        factores.push('Por encima de su referencia de carga')
      } else if (rsSemanaActual && rsSemanaActual.carga_total < referencia * (1 - UMBRALES.CARGA.VARIABILIDAD_INCREMENTO_PCT)) {
        if (prioridad === 'rutinario') prioridad = 'semana'
        factores.push('Por debajo de su referencia de carga')
      } else {
        factores.push('Dentro de variabilidad habitual')
      }
    }
  }

  return {
    jugadora: j,
    prioridad,
    factores,
    ultimoWellness,
    ultimoRS,
    lesionActiva,
    tendenciaWellness,
    tendenciaACWR,
    rsSemanaActual,
    rsSemanaPasada,
  }
}

export function calcularResumenEquipoSemanal(resumenSemana: ResumenSemanal[]): EquipoResumen | null {
  if (resumenSemana.length === 0) return null
  const n = resumenSemana.length
  return {
    carga_total: Math.round(resumenSemana.reduce((s, rs) => s + rs.carga_total, 0)),
    carga_media: Math.round(resumenSemana.reduce((s, rs) => s + rs.carga_total, 0) / n * 10) / 10,
    acwr_medio: Math.round(resumenSemana.reduce((s, rs) => s + rs.acwr, 0) / n * 100) / 100,
    wellness_medio: Math.round(resumenSemana.reduce((s, rs) => s + rs.wellness_medio, 0) / n * 10) / 10,
    con_datos: resumenSemana.filter(rs => rs.carga_total > 0).length,
    prioritarias: resumenSemana.filter(rs => rs.acwr >= UMBRALES.ACWR.ALTO).length,
    elevado: resumenSemana.filter(rs => rs.acwr >= UMBRALES.ACWR.ELEVADO && rs.acwr < UMBRALES.ACWR.ALTO).length,
  }
}

export function calcularEdad(fechaNacimiento: string, hoyStr: string): number | null {
  if (!fechaNacimiento) return null
  const birth = parseISO(fechaNacimiento)
  const ref = parseISO(hoyStr)
  const diffTime = ref.getTime() - birth.getTime()
  if (diffTime < 0) return null
  return Math.floor(diffTime / 31557600000)
}

/**
 * Compara dos registros de readiness para la misma jugadora y fecha.
 * Criterio determinista:
 * 1. Prioriza timestamp 'creada' ISO más reciente.
 * 2. Fallback: 'id' numérico más alto.
 */
export function compararReadinessDeterminista(a: Readiness, b: Readiness): number {
  const timeA = a.creada ? new Date(a.creada).getTime() : 0
  const timeB = b.creada ? new Date(b.creada).getTime() : 0

  const validA = !isNaN(timeA) && timeA > 0
  const validB = !isNaN(timeB) && timeB > 0

  if (validA && validB && timeA !== timeB) {
    return timeB - timeA
  }
  if (validA && !validB) return -1
  if (!validA && validB) return 1

  const idA = typeof a.id === 'number' ? a.id : 0
  const idB = typeof b.id === 'number' ? b.id : 0
  return idB - idA
}

/**
 * Selecciona determinísticamente el registro de readiness más reciente para una jugadora y fecha.
 */
export function seleccionarReadinessDeterminista(
  readinessList: Readiness[],
  id_jugadora: string,
  fecha: string
): Readiness | undefined {
  const candidatas = readinessList.filter(r => r.id_jugadora === id_jugadora && r.fecha === fecha)
  if (candidatas.length === 0) return undefined
  if (candidatas.length === 1) return candidatas[0]

  return [...candidatas].sort(compararReadinessDeterminista)[0]
}

/**
 * Retorna una lista deduplicada determinísticamente de readiness.
 */
export function obtenerListaReadinessDeterminista(
  readinessList: Readiness[],
  id_jugadora?: string
): Readiness[] {
  const filtrados = id_jugadora ? readinessList.filter(r => r.id_jugadora === id_jugadora) : readinessList
  const grupos = new Map<string, Readiness[]>()

  for (const r of filtrados) {
    const key = `${r.id_jugadora}_${r.fecha}`
    const list = grupos.get(key) || []
    list.push(r)
    grupos.set(key, list)
  }

  const result: Readiness[] = []
  for (const list of grupos.values()) {
    const best = [...list].sort(compararReadinessDeterminista)[0]
    result.push(best)
  }

  return result
}

export function obtenerJugadoresConReadinessOrdenados(
  jugadoras: Jugadora[],
  readiness: Readiness[],
  hoyStr: string
): { jugadora: Jugadora; readiness: Readiness | undefined }[] {
  return jugadoras
    .filter(j => j.activa !== false)
    .map(j => {
      const r = seleccionarReadinessDeterminista(readiness, j.id_jugadora, hoyStr)
      return { jugadora: j, readiness: r }
    })
    .sort((a, b) => {
      const orden: Record<string, number> = { rojo: 0, ambar: 1, verde: 2, sin_datos: 3 }
      const na = a.readiness?.nivel || 'sin_datos'
      const nb = b.readiness?.nivel || 'sin_datos'
      return orden[na] - orden[nb]
    })
}

export function filtrarYCalcularResumenHoy(
  jugadoras: Jugadora[],
  wellness: Wellness[],
  sesiones: Sesion[],
  partidos: Partido[],
  lesiones: Lesion[],
  hoyStr: string
): ResumenHoy {
  const activas = jugadoras.filter((j) => j.activa !== false)
  const wellnessHoy = wellness.filter((w) => w.fecha === hoyStr)
  const jugadorasConWellness = new Set(wellnessHoy.map((w) => w.id_jugadora))
  const jugadorasSinWellness = activas.filter((j) => !jugadorasConWellness.has(j.id_jugadora))

  const sesionHoy = sesiones.find((s) => s.fecha === hoyStr)
  const partidoHoy = partidos.find((p) => p.fecha === hoyStr)

  const lesionesActivas = lesiones.filter((l) => !l.disponible)
  const enReadaptacion = lesionesActivas.filter((l) => l.fase_rtp !== 'N/A' && l.fase_rtp !== 'Fase_1_Reposo')

  const wellnessScoreMedio = wellnessHoy.length > 0
    ? Math.round(wellnessHoy.reduce((s, w) => s + w.score_wellness, 0) / wellnessHoy.length * 10) / 10
    : 0

  const pctRespuestas = activas.length > 0 ? Math.round(jugadorasConWellness.size / activas.length * 100) : 0

  return {
    pctRespuestas,
    wellnessScoreMedio,
    jugadorasSinWellness,
    jugadorasConWellnessCount: jugadorasConWellness.size,
    sesionHoy,
    partidoHoy,
    lesionesActivasCount: lesionesActivas.length,
    enReadaptacionCount: enReadaptacion.length,
  }
}

export function filtrarYCalcularResumenDashboard(
  jugadoras: Jugadora[],
  wellness: Wellness[],
  resumenSemanal: ResumenSemanal[],
  alertas: Alerta[],
  lesiones: Lesion[],
  sesionRpe: SesionRPE[],
  hoyStr: string
): ResumenDashboard {
  const activas = jugadoras.filter((j) => j.activa !== false)
  const lesionadasActivas = lesiones.filter((l) => !l.disponible)

  const fechasUltimos7Dias = obtenerFechasUltimosDias(hoyStr, 7)
  const wellnessReciente = wellness.filter((w) => fechasUltimos7Dias.includes(w.fecha))

  const wellnessMedio = wellnessReciente.length > 0
    ? Math.round(wellnessReciente.reduce((s, w) => s + w.score_wellness, 0) / wellnessReciente.length * 10) / 10
    : 0

  const jugConAlertasCount = new Set(alertas.filter((a) => !a.leida).map((a) => a.id_jugadora)).size

  const ultimoRS = [...resumenSemanal]
    .filter((rs) => rs.semana)
    .sort((a, b) => b.semana.localeCompare(a.semana))

  const cargaSemanalTotal = ultimoRS.length > 0
    ? ultimoRS.filter((rs) => rs.semana === ultimoRS[0].semana).reduce((s, rs) => s + rs.carga_total, 0)
    : 0

  const acwrMedio = ultimoRS.length > 0
    ? Math.round(ultimoRS.filter((rs) => rs.semana === ultimoRS[0].semana).reduce((s, rs) => s + rs.acwr, 0) / 
        Math.max(1, ultimoRS.filter((rs) => rs.semana === ultimoRS[0].semana).length) * 100) / 100
    : 0

  const map = new Map<string, number>()
  for (const r of sesionRpe) {
    if (fechasUltimos7Dias.includes(r.fecha)) {
      map.set(r.fecha, (map.get(r.fecha) || 0) + (r.carga_ua || 0))
    }
  }
  const cargasDiariasEquipo = Array.from(map.values())
  const { monotonia, strain } = calcularMonotonyStrain(cargasDiariasEquipo)

  return {
    activasCount: activas.length,
    lesionadasActivasCount: lesionadasActivas.length,
    wellnessMedio,
    jugConAlertasCount,
    cargaSemanalTotal,
    acwrMedio,
    monotonia,
    strain,
  }
}

export function esSesionRPECompleta(rpe?: SesionRPE | null): boolean {
  if (!rpe) return false
  
  if (rpe.asistencia !== undefined && rpe.asistencia !== null) {
    if (rpe.asistencia === 'sin_registrar') return false
    if (rpe.asistencia === 'ausente' || rpe.asistencia === 'no_convocada' || rpe.asistencia === 'excusada') {
      return true
    }
    if (rpe.asistencia === 'completa' || rpe.asistencia === 'parcial') {
      const rpeValido = rpe.rpe !== null && rpe.rpe !== undefined && !isNaN(rpe.rpe) && rpe.rpe >= 0
      const duracionValida = rpe.duracion_min !== null && rpe.duracion_min !== undefined && !isNaN(rpe.duracion_min) && rpe.duracion_min > 0
      return rpeValido && duracionValida
    }
  }

  // Legado sin campo 'asistencia'
  const rpeValido = rpe.rpe !== null && rpe.rpe !== undefined && !isNaN(rpe.rpe) && rpe.rpe > 0
  const duracionValida = rpe.duracion_min !== null && rpe.duracion_min !== undefined && !isNaN(rpe.duracion_min) && rpe.duracion_min > 0
  return rpeValido && duracionValida
}

export function calcularCompletitudSesion(
  jugadoras: Jugadora[],
  rpesDeSesion: SesionRPE[]
): number {
  const activas = jugadoras.filter(j => j.activa !== false)
  if (activas.length === 0) return 0
  
  let validCount = 0
  for (const j of activas) {
    const rpe = rpesDeSesion.find(r => r.id_jugadora === j.id_jugadora)
    if (esSesionRPECompleta(rpe)) {
      validCount++
    }
  }
  return Math.round((validCount / activas.length) * 100)
}

export function calcularCompletitudSemana(
  jugadoras: Jugadora[],
  sesionesSemana: Sesion[],
  rpeSesionesSemana: SesionRPE[]
): number {
  const activas = jugadoras.filter(j => j.activa !== false)
  if (activas.length === 0 || sesionesSemana.length === 0) return 0
  
  let totalEsperado = activas.length * sesionesSemana.length
  let totalValido = 0
  
  for (const s of sesionesSemana) {
    const rpesDeSesion = rpeSesionesSemana.filter(r => r.id_sesion === s.id_sesion)
    for (const j of activas) {
      const rpe = rpesDeSesion.find(r => r.id_jugadora === j.id_jugadora)
      if (esSesionRPECompleta(rpe)) {
        totalValido++
      }
    }
  }
  return Math.round((totalValido / totalEsperado) * 100)
}
