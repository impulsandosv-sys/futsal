import type { Jugadora, Wellness, RPE_Partido, SesionRPE, Partido } from '@/types'
import { obtenerFechasUltimosDias, compareDateStrings } from '../dates/dates'

export type TipoCompletitud = 'wellness' | 'rpe_partido' | 'minutos_partido' | 'rpe_sesion'

export interface ActionableItem {
  id_jugadora: string
  id_partido?: string
  id_sesion?: string
  tipo: TipoCompletitud
  estado: 'pendiente' | 'error' | 'no_aplicable' | 'completo'
  titulo: string
  detalle: string
  destino: string // Route or hint for where to resolve this
}

export interface WellnessSummary {
  id_jugadora: string
  registros_ultimos_7_dias: number
}

export interface QualityReport {
  alertas: ActionableItem[]
  wellness: WellnessSummary[]
}

/**
 * Calcula el estado de completitud de datos para una lista de jugadoras.
 * Sirve para poblar el Panel de Calidad de Datos de forma accionable.
 */
export function evaluarCompletitudDatos(
  jugadoras: Jugadora[],
  wellness: Wellness[],
  partidos: Partido[],
  rpePartidos: RPE_Partido[],
  rpeSesiones: SesionRPE[],
  fechaReferencia: string
): QualityReport {
  const activas = jugadoras.filter(j => j.activa)

  // Limites para 7 dias locales
  const fechasUltimos7 = obtenerFechasUltimosDias(fechaReferencia, 7)
  const limiteInferior = fechasUltimos7[0]

  const alertas: ActionableItem[] = []
  const wellnessResumen: WellnessSummary[] = []

  // Filtramos los partidos que ya ocurrieron (hasta la fecha de referencia)
  const partidosPasados = partidos.filter(p => compareDateStrings(p.fecha, fechaReferencia) <= 0)

  activas.forEach(j => {
    // 1. Wellness (solo informativo)
    const w = wellness.filter(
      x => x.id_jugadora === j.id_jugadora &&
           compareDateStrings(x.fecha, limiteInferior) >= 0 &&
           compareDateStrings(x.fecha, fechaReferencia) <= 0
    )
    wellnessResumen.push({
      id_jugadora: j.id_jugadora,
      registros_ultimos_7_dias: w.length
    })

    // 2. Partidos Pasados
    partidosPasados.forEach(p => {
      const rpeP = rpePartidos.find(r => r.id_partido === p.id_partido && r.id_jugadora === j.id_jugadora)

      if (!rpeP) {
        // No hay fila
        alertas.push({
          id_jugadora: j.id_jugadora,
          id_partido: p.id_partido,
          tipo: 'minutos_partido',
          estado: 'pendiente',
          titulo: 'Participación/minutos de partido pendientes de registrar',
          detalle: `Falta registrar participación para el partido contra ${p.rival} (${p.fecha})`,
          destino: 'partidos'
        })
      } else {
        const isCero = rpeP.participacion === 'no_convocada' || rpeP.participacion === 'convocada_sin_minutos' || rpeP.minutos_jugados === 0

        if (isCero) {
          // No aplicable
          alertas.push({
            id_jugadora: j.id_jugadora,
            id_partido: p.id_partido,
            tipo: 'minutos_partido',
            estado: 'no_aplicable',
            titulo: 'No aplicable',
            detalle: `No convocada o cero minutos explícitos en el partido contra ${p.rival} (${p.fecha})`,
            destino: 'partidos'
          })
        } else if (rpeP.minutos_jugados === null || rpeP.minutos_jugados === undefined) {
          // Pendiente de minutos
          alertas.push({
            id_jugadora: j.id_jugadora,
            id_partido: p.id_partido,
            tipo: 'minutos_partido',
            estado: 'pendiente',
            titulo: 'Participación/minutos de partido pendientes de registrar',
            detalle: `Faltan los minutos jugados para el partido contra ${p.rival} (${p.fecha})`,
            destino: 'partidos'
          })
        } else if (rpeP.minutos_jugados > 0 && (rpeP.rpe === null || rpeP.rpe === undefined)) {
          // Jugó pero no hay RPE
          alertas.push({
            id_jugadora: j.id_jugadora,
            id_partido: p.id_partido,
            tipo: 'rpe_partido',
            estado: 'pendiente',
            titulo: 'RPE competitivo pendiente',
            detalle: `RPE faltante para los ${rpeP.minutos_jugados} min. jugados contra ${p.rival} (${p.fecha})`,
            destino: 'partidos'
          })
        }
      }
    })

    // 3. Sesiones de entrenamiento (simplificado, asumiendo sesiones ya registradas sin importar fecha exacta si están en la DB sin RPE)
    const sesionesConFalta = rpeSesiones.filter(
      r => r.id_jugadora === j.id_jugadora &&
           (r.rpe === undefined || r.rpe === null) &&
           (r.asistencia === 'completa' || r.asistencia === 'parcial' || r.asistencia === 'sin_registrar')
    )

    sesionesConFalta.forEach(r => {
      // Excluir sesiones futuras (asumiendo que tienen su fecha guardada)
      if (r.fecha && compareDateStrings(r.fecha, fechaReferencia) <= 0) {
        alertas.push({
          id_jugadora: j.id_jugadora,
          id_sesion: r.id_sesion,
          tipo: 'rpe_sesion',
          estado: 'pendiente',
          titulo: 'RPE de sesión pendiente',
          detalle: `Falta RPE para la sesión del ${r.fecha}`,
          destino: 'sesiones'
        })
      }
    })
  })

  // Ordenar alertas pendientes primero
  alertas.sort((a, b) => {
    if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1
    if (a.estado !== 'pendiente' && b.estado === 'pendiente') return 1
    return 0
  })

  return { alertas, wellness: wellnessResumen }
}
