import type {
  Jugadora,
  Sesion,
  Partido,
  Wellness,
  SesionRPE,
  RPE_Partido,
  Alerta,
  Lesion
} from '@/types'
import {
  getWeekStartDateISO,
  getWeekEndDateISO,
  compareDateStrings,
  getTodayLocalISO,
  isFechaLocalISO
} from '../dates/dates'
import {
  calcularExposicionCompetitiva,
  ExposicionCompetitiva
} from '../exposure/matchExposure'
import { evaluarCompletitudDatos } from '../monitoring/completitud'

export interface MicrocycleCollectiveSummary {
  activePlayers: number
  scheduledSessions: number
  completedSessions: number
  matches: number
  playersWithWellness: number
  playersWithoutWellness: number
  wellnessAdherencePercent: number | null
  openNonMenstrualAlerts: number
  pendingQualityIssues: number
}

export interface PlayerMicrocycleRow {
  jugadora: Jugadora
  wellnessRegistrosValidos: number
  ultimaFechaWellness: string | null
  sRPETraining: number
  sRPEMatch: number | null
  scheduledSessions: number
  exposicion: ExposicionCompetitiva
  qualityIssues: number
  qualityIssuesLabels: string[]
  prioridadRazon: string | null
}

export interface MicrocycleDashboardData {
  startDate: string
  endDate: string
  resumenColectivo: MicrocycleCollectiveSummary
  filasJugadoras: PlayerMicrocycleRow[]
}

function isWithinWeek(fecha: string, start: string, end: string): boolean {
  if (!fecha) return false
  return compareDateStrings(fecha, start) >= 0 && compareDateStrings(fecha, end) <= 0
}

export function obtenerFechaOperativaAlerta(alerta: Alerta): string | null {
  if (alerta.fecha && isFechaLocalISO(alerta.fecha)) {
    return alerta.fecha
  }

  if (alerta.fecha_creacion) {
    const candidate = alerta.fecha_creacion.slice(0, 10)
    if (isFechaLocalISO(candidate)) {
      return candidate
    }
  }

  return null
}

export function buildMicrocycleDashboardData(
  weekStartISO: string, // Assumed valid Monday ISO string
  jugadoras: Jugadora[],
  sesiones: Sesion[],
  partidos: Partido[],
  wellness: Wellness[],
  rpeSesion: SesionRPE[],
  rpePartido: RPE_Partido[],
  alertas: Alerta[],
  lesiones: Lesion[]
): MicrocycleDashboardData {
  const startDate = weekStartISO
  const endDate = getWeekEndDateISO(weekStartISO)

  const activas = jugadoras.filter((j) => j.activa)

  // Filter global week data
  const weekSessions = sesiones.filter((s) => isWithinWeek(s.fecha, startDate, endDate))
  const weekMatches = partidos.filter((p) => isWithinWeek(p.fecha, startDate, endDate))

  const scheduledSessionsCount = weekSessions.length
  const completedSessionsCount = weekSessions.filter((s) => s.estado === 'realizada').length

  const weekWellness = wellness.filter((w) => isWithinWeek(w.fecha, startDate, endDate))

  const activePlayersIds = new Set(activas.map((j) => j.id_jugadora))
  const playersWithWellnessCount = new Set(weekWellness.filter(w => activePlayersIds.has(w.id_jugadora)).map(w => w.id_jugadora)).size
  const playersWithoutWellnessCount = activas.length - playersWithWellnessCount

  const wellnessAdherencePercent =
    activas.length > 0 ? (playersWithWellnessCount / activas.length) * 100 : null

  const todayISO = getTodayLocalISO()
  const refDate = compareDateStrings(endDate, todayISO) < 0 ? endDate : todayISO

  const filteredAlertas = alertas.filter(
    (a) =>
      (a.estado === 'abierta' || a.estado === 'en_revision') &&
      a.tipo !== 'MENSTRUACION_PROXIMA_ESTIMADA' &&
      activePlayersIds.has(a.id_jugadora)
  )

  const openNonMenstrualAlerts = filteredAlertas.filter((a) => {
    const fechaOperativa = obtenerFechaOperativaAlerta(a)
    if (!fechaOperativa) return false
    return isWithinWeek(fechaOperativa, startDate, refDate)
  })

  // Global pending quality issues for active players

  // Prepare input restricted to microcycle to avoid historical pollution
  const filteredMatches = partidos.filter((p) => isWithinWeek(p.fecha, startDate, endDate) && compareDateStrings(p.fecha, refDate) <= 0)
  const filteredSessions = sesiones.filter((s) => isWithinWeek(s.fecha, startDate, endDate) && compareDateStrings(s.fecha, refDate) <= 0)

  const filteredRpePartido = rpePartido.filter(rp => filteredMatches.some(m => m.id_partido === rp.id_partido))
  const filteredRpeSesion = rpeSesion.filter(rs => filteredSessions.some(s => s.id_sesion === rs.id_sesion))

  const allQualityIssues = evaluarCompletitudDatos(
    activas,
    weekWellness, // only this week's wellness
    filteredMatches, // only this week's matches up to refDate
    filteredRpePartido,
    filteredRpeSesion,
    refDate // This ensures we evaluate using today or the week's end
  ).alertas.filter(a => a.estado === 'pendiente')

  const collectiveSummary: MicrocycleCollectiveSummary = {
    activePlayers: activas.length,
    scheduledSessions: scheduledSessionsCount,
    completedSessions: completedSessionsCount,
    matches: weekMatches.length,
    playersWithWellness: playersWithWellnessCount,
    playersWithoutWellness: playersWithoutWellnessCount,
    wellnessAdherencePercent,
    openNonMenstrualAlerts: openNonMenstrualAlerts.length,
    pendingQualityIssues: allQualityIssues.length
  }

  const filasJugadoras = activas.map((jugadora) => {
    // 1. Wellness
    const playerWellness = weekWellness.filter((w) => w.id_jugadora === jugadora.id_jugadora)
    const sortedWellness = [...playerWellness].sort((a, b) => compareDateStrings(a.fecha, b.fecha))
    const lastWellnessDate =
      sortedWellness.length > 0 ? sortedWellness[sortedWellness.length - 1].fecha : null

    // 2. Carga Entrenamiento
    let sRPETraining = 0
    const pSessions = rpeSesion.filter((rs) => rs.id_jugadora === jugadora.id_jugadora)
    for (const rs of pSessions) {
      const s = weekSessions.find((ws) => ws.id_sesion === rs.id_sesion)
      if (s && rs.carga_ua != null && !isNaN(rs.carga_ua)) {
        sRPETraining += rs.carga_ua
      }
    }

    // 3. Carga Competitiva
    let sRPEMatch = 0
    let matchHasData = false
    const pMatches = rpePartido.filter((rp) => rp.id_jugadora === jugadora.id_jugadora)
    for (const rp of pMatches) {
      const m = weekMatches.find((wm) => wm.id_partido === rp.id_partido)
      if (m && rp.carga_ua != null && !isNaN(rp.carga_ua)) {
        sRPEMatch += rp.carga_ua
        matchHasData = true
      }
    }
    const finalSRPEMatch = matchHasData ? sRPEMatch : null

    // 4. Planificación (sesiones grupales programadas en la semana)

    // 5. Exposición competitiva (reusing calculation up to endDate)
    const playerAllMatchesRpe = rpePartido.filter(r => r.id_jugadora === jugadora.id_jugadora)
    const exposicion = calcularExposicionCompetitiva(playerAllMatchesRpe, endDate)

    // 6. Quality issues
    const issues = allQualityIssues.filter(a => a.id_jugadora === jugadora.id_jugadora)

    // 7. Prioritization
    const jugadoraAlertas = openNonMenstrualAlerts.filter(a => a.id_jugadora === jugadora.id_jugadora)
    const tieneAlertaAbierta = jugadoraAlertas.length > 0

    const prioridadRazon = priorizarFilasMicrociclo(
      jugadora,
      lesiones,
      endDate,
      issues.length > 0,
      tieneAlertaAbierta,
      playerWellness.length === 0,
      exposicion.calidadDato === 'insuficiente' || exposicion.calidadDato === 'sin_registros_competitivos'
    )

    return {
      jugadora,
      wellnessRegistrosValidos: playerWellness.length,
      ultimaFechaWellness: lastWellnessDate,
      sRPETraining,
      sRPEMatch: finalSRPEMatch,
      scheduledSessions: scheduledSessionsCount,
      exposicion,
      qualityIssues: issues.length,
      qualityIssuesLabels: issues.map(i => i.tipo),
      prioridadRazon
    }
  })

  // Sort by priority and then alphabetically
  const priorityOrder = [
    'Disponibilidad modificada',
    'Alerta abierta no menstrual',
    'Datos pendientes',
    'Sin wellness esta semana',
    'Datos competitivos incompletos',
    null
  ]

  filasJugadoras.sort((a, b) => {
    const idxA = priorityOrder.indexOf(a.prioridadRazon)
    const idxB = priorityOrder.indexOf(b.prioridadRazon)

    const rankA = idxA === -1 ? 99 : idxA
    const rankB = idxB === -1 ? 99 : idxB

    if (rankA !== rankB) {
      return rankA - rankB
    }

    return a.jugadora.nombre.localeCompare(b.jugadora.nombre)
  })

  return {
    startDate,
    endDate,
    resumenColectivo: collectiveSummary,
    filasJugadoras
  }
}

function priorizarFilasMicrociclo(
  jugadora: Jugadora,
  lesiones: Lesion[],
  endDate: string,
  tieneDatosPendientes: boolean,
  tieneAlertaAbierta: boolean,
  sinWellness: boolean,
  competitivoIncompleto: boolean
): string | null {
  // Disponibilidad modificada checks if there's an active lesion that overlaps with our window.
  // Actually, just check if she has an active lesion right now (or up to endDate)
  const isModified = lesiones.some(l =>
    l.id_jugadora === jugadora.id_jugadora &&
    l.disponibilidad !== 'Disponible' &&
    compareDateStrings(l.fecha_inicio, endDate) <= 0 &&
    (!l.fecha_fin || compareDateStrings(l.fecha_fin, endDate) >= 0)
  )

  if (isModified) return 'Disponibilidad modificada'
  if (tieneAlertaAbierta) return 'Alerta abierta no menstrual'
  if (tieneDatosPendientes) return 'Datos pendientes'
  if (sinWellness) return 'Sin wellness esta semana'
  if (competitivoIncompleto) return 'Datos competitivos incompletos'

  return null
}
