import { parseISO, subDays, isBefore, isAfter, isSameDay, format } from 'date-fns'
import { obtenerCargasDiariasJugadora } from '../calculations/dailyLoad'
import type {
  Jugadora,
  Wellness,
  Lesion,
  Alerta,
  MedicionCMJ,
  SesionRPE,
  RPE_Partido
} from '@/types'

export interface DecisionDiariaJugadora {
  id_jugadora: string
  nombre: string
  posicion: string
  disponibilidad: 'Disponible' | 'Lesionada' | 'Readaptacion'
  detalleLesion?: string
  wellnessDia: {
    score_wellness: number
    calidad_sueno: number
    fatiga: number
    dolor_muscular: number
    estres: number
    estado_animo: number
  } | null
  alertasActivasCount: number
  alertasActivas: {
    id?: number
    tipo: string
    prioridad: string
    mensaje: string
  }[]
  cmjReciente: {
    fecha: string
    altura_cm: number
  } | null
  carga7d: {
    cargaAcumulada7d: number
    numSesiones: number
    ultimaSesionFecha?: string
    ultimaSesionCarga?: number
  } | null
  requiereRevision: boolean
  motivoPrioridad: string
}

export interface ResumenDecisionDiaria {
  fechaSeleccionada: string
  totalActivas: number
  totalAlertasActivas: number
  totalPendientesWellness: number
  totalLesionadasOReadaptacion: number
  jugadoras: DecisionDiariaJugadora[]
}

/**
 * Calcula la disponibilidad de una jugadora a la fecha seleccionada.
 */
function obtenerDisponibilidadJugadora(
  idJugadora: string,
  lesionesList: Lesion[],
  fechaSeleccionada: string
): { disponibilidad: 'Disponible' | 'Lesionada' | 'Readaptacion'; detalleLesion?: string } {
  const fechaTarget = parseISO(fechaSeleccionada)
  const safeLesiones = lesionesList || []

  const lesionActiva = safeLesiones.find((l) => {
    if (l.id_jugadora !== idJugadora) return false

    const fInicio = parseISO(l.fecha_inicio)
    const fAlta = l.fecha_fin ? parseISO(l.fecha_fin) : null

    // Si la fecha de inicio es posterior a la fecha seleccionada, la lesión aún no existía
    if (isAfter(fInicio, fechaTarget) && !isSameDay(fInicio, fechaTarget)) return false

    // Si tiene fecha de alta y es anterior o igual a la fecha seleccionada, ya está dada de alta
    if (fAlta && (isBefore(fAlta, fechaTarget) || isSameDay(fAlta, fechaTarget))) return false

    return l.disponibilidad === 'Lesionada' || l.disponibilidad === 'Readaptacion' || l.disponible === false
  })

  if (!lesionActiva) {
    return { disponibilidad: 'Disponible' }
  }

  const estadoStr = lesionActiva.disponibilidad === 'Readaptacion' ? 'Readaptacion' : 'Lesionada'
  return {
    disponibilidad: estadoStr,
    detalleLesion: lesionActiva.tipo || lesionActiva.localizacion || undefined
  }
}

/**
 * Motor puro de cálculo y agregado para la vista de decisión diaria.
 * No realiza escrituras ni altera estado.
 */
export function construirDecisionDiaria(
  jugadorasList: Jugadora[],
  wellnessList: Wellness[],
  lesionesList: Lesion[],
  alertasList: Alerta[],
  pruebasCMJList: MedicionCMJ[],
  sesionRPEList: SesionRPE[],
  rpePartidoList: RPE_Partido[],
  fechaSeleccionada: string
): ResumenDecisionDiaria {
  const safeJugadoras = jugadorasList || []
  const safeWellness = wellnessList || []
  const safeLesiones = lesionesList || []
  const safeAlertas = alertasList || []
  const safePruebasCMJ = pruebasCMJList || []
  const safeSesionRPE = sesionRPEList || []
  const safeRpePartido = rpePartidoList || []

  const activas = safeJugadoras.filter((j) => j.activa !== false)
  const fechaTarget = parseISO(fechaSeleccionada)
  const fechaInicio7d = subDays(fechaTarget, 6) // Ventana de 7 días (fechaTarget - 6 días a fechaTarget)

  let totalAlertasActivas = 0
  let totalPendientesWellness = 0
  let totalLesionadasOReadaptacion = 0

  const jugadorasResult: DecisionDiariaJugadora[] = activas.map((j) => {
    // 1. Disponibilidad
    const { disponibilidad, detalleLesion } = obtenerDisponibilidadJugadora(
      j.id_jugadora,
      safeLesiones,
      fechaSeleccionada
    )
    if (disponibilidad !== 'Disponible') {
      totalLesionadasOReadaptacion++
    }

    // 2. Wellness de la fecha seleccionada
    const w = safeWellness.find((wItem) => wItem.id_jugadora === j.id_jugadora && wItem.fecha === fechaSeleccionada)
    const wellnessDia = w
      ? {
          score_wellness: w.score_wellness,
          calidad_sueno: w.calidad_sueno,
          fatiga: w.fatiga,
          dolor_muscular: w.dolor_muscular,
          estres: w.estres,
          estado_animo: w.estado_animo
        }
      : null

    if (!wellnessDia) {
      totalPendientesWellness++
    }

    // 3. Alertas activas (no resueltas y fecha <= fechaSeleccionada)
    const alertasJ = safeAlertas.filter((a) => {
      if (a.id_jugadora !== j.id_jugadora) return false
      const aEstado = a.estado || (a.leida ? 'resuelta' : 'abierta')
      if (aEstado === 'resuelta' || aEstado === 'descartada') return false
      if (a.fecha) {
        const fA = parseISO(a.fecha)
        if (isAfter(fA, fechaTarget) && !isSameDay(fA, fechaTarget)) return false
      }
      return true
    })

    totalAlertasActivas += alertasJ.length

    // 4. CMJ reciente (último CMJ válido <= fechaSeleccionada)
    const cmjValidosPrevios = safePruebasCMJ.filter((m) => {
      if (m.id_jugadora !== j.id_jugadora) return false
      if (!m.fecha) return false
      const fM = parseISO(m.fecha)
      if (isAfter(fM, fechaTarget) && !isSameDay(fM, fechaTarget)) return false
      return typeof m.altura_mejor_cm === 'number' && m.altura_mejor_cm > 0
    })

    cmjValidosPrevios.sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : 0))
    const ultimoCMJ = cmjValidosPrevios[0] || null

    const cmjReciente = ultimoCMJ
      ? {
          fecha: ultimoCMJ.fecha,
          altura_cm: ultimoCMJ.altura_mejor_cm!
        }
      : null

    // 5. sRPE / Carga en los últimos 7 días (fechaInicio7d <= fecha <= fechaTarget)
    const fechaInicio7dStr = format(fechaInicio7d, 'yyyy-MM-dd')
    const cargas7dMap = obtenerCargasDiariasJugadora({
      jugadoraId: j.id_jugadora,
      fechaDesde: fechaInicio7dStr,
      fechaHasta: fechaSeleccionada,
      sesiones: [],
      sesionesRPE: safeSesionRPE,
      rpePartidos: safeRpePartido,
    })

    let cargaSum = 0
    let totalSesiones = 0
    let ultimaSesionFecha: string | undefined = undefined
    let ultimaSesionCarga: number | undefined = undefined

    for (const entry of cargas7dMap.values()) {
      if (entry.tieneDato && entry.carga !== null) {
        cargaSum += entry.carga
        totalSesiones += entry.numActividades
        if (!ultimaSesionFecha || entry.fecha > ultimaSesionFecha) {
          ultimaSesionFecha = entry.fecha
          ultimaSesionCarga = entry.carga
        }
      }
    }

    const carga7d =
      totalSesiones > 0 || ultimaSesionCarga !== undefined
        ? {
            cargaAcumulada7d: Math.round(cargaSum),
            numSesiones: totalSesiones,
            ultimaSesionFecha,
            ultimaSesionCarga: ultimaSesionCarga !== undefined ? Math.round(ultimaSesionCarga) : undefined
          }
        : null

    // 6. Criterio de revisión y motivo
    let requiereRevision = false
    let motivoPrioridad = ''

    if (alertasJ.length > 0) {
      requiereRevision = true
      motivoPrioridad = `${alertasJ.length} alerta(s) activa(s)`
    } else if (disponibilidad !== 'Disponible') {
      requiereRevision = true
      motivoPrioridad = `Estado: ${disponibilidad}`
    } else if (!wellnessDia) {
      requiereRevision = true
      motivoPrioridad = 'Sin wellness del día'
    }

    return {
      id_jugadora: j.id_jugadora,
      nombre: j.nombre,
      posicion: j.posicion,
      disponibilidad,
      detalleLesion,
      wellnessDia,
      alertasActivasCount: alertasJ.length,
      alertasActivas: alertasJ.map((a) => ({
        id: a.id,
        tipo: a.tipo,
        prioridad: a.prioridad || 'media',
        mensaje: a.mensaje
      })),
      cmjReciente,
      carga7d,
      requiereRevision,
      motivoPrioridad
    }
  })

  // Ordenación transparente según especificación:
  // 1. Con alertas activas
  // 2. Disponibilidad restringida (Lesionada / Readaptacion)
  // 3. Sin wellness en la fecha seleccionada
  // 4. Resto por orden alfabético
  jugadorasResult.sort((a, b) => {
    const getRank = (item: DecisionDiariaJugadora): number => {
      if (item.alertasActivasCount > 0) return 1
      if (item.disponibilidad !== 'Disponible') return 2
      if (!item.wellnessDia) return 3
      return 4
    }

    const rankA = getRank(a)
    const rankB = getRank(b)

    if (rankA !== rankB) {
      return rankA - rankB
    }

    return a.nombre.localeCompare(b.nombre)
  })

  return {
    fechaSeleccionada,
    totalActivas: activas.length,
    totalAlertasActivas,
    totalPendientesWellness,
    totalLesionadasOReadaptacion,
    jugadoras: jugadorasResult
  }
}
