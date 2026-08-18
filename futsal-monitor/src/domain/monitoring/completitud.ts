import type { Jugadora, Wellness, RPE_Partido, SesionRPE } from '@/types'

export interface JugadoraCompletitud {
  jugadora: Jugadora
  wellnessUltimos7Dias: number // 0-7
  rpePartidosFaltantes: number
  rpeSesionesFaltantes: number
}

/**
 * Calcula el estado de completitud de datos para una lista de jugadoras.
 * Sirve para poblar el Panel de Calidad de Datos de forma accionable.
 */
export function evaluarCompletitudDatos(
  jugadoras: Jugadora[],
  wellness: Wellness[],
  rpePartidos: RPE_Partido[],
  rpeSesiones: SesionRPE[]
): JugadoraCompletitud[] {
  const activas = jugadoras.filter(j => j.activa)
  const hoy = new Date()
  
  // Limites para 7 dias
  const hace7Dias = new Date(hoy)
  hace7Dias.setDate(hoy.getDate() - 7)
  const hace7DiasStr = hace7Dias.toISOString().split('T')[0]

  return activas.map(j => {
    // Wellness ultimos 7 dias
    const w = wellness.filter(
      x => x.id_jugadora === j.id_jugadora && x.fecha >= hace7DiasStr
    )
    
    // Asumimos que rpe_partido sin rpe ni carga es faltante, si participó y tiene minutos.
    // O de manera mas simple, un RPE sin rpe/carga y que si jugó (minutos > 0)
    // Para simplificar, buscamos registros donde no haya RPE pero que la jugadora haya sido convocada y jugado
    const rpeP_faltantes = rpePartidos.filter(
      r => r.id_jugadora === j.id_jugadora &&
           r.minutos_jugados !== undefined && r.minutos_jugados !== null && r.minutos_jugados > 0 &&
           (r.rpe === undefined || r.rpe === null)
    ).length

    // Para sesiones grupales, RPE pendiente
    const rpeS_faltantes = rpeSesiones.filter(
      r => r.id_jugadora === j.id_jugadora &&
           (r.rpe === undefined || r.rpe === null) &&
           // si la asistencia no es ausente/baja/no_convocada
           (r.asistencia === 'completa' || r.asistencia === 'parcial' || r.asistencia === 'sin_registrar')
    ).length

    return {
      jugadora: j,
      wellnessUltimos7Dias: w.length,
      rpePartidosFaltantes: rpeP_faltantes,
      rpeSesionesFaltantes: rpeS_faltantes
    }
  }).sort((a, b) => {
    // Ordenar primero las que tienen más faltas
    const faltasA = (7 - a.wellnessUltimos7Dias) + a.rpePartidosFaltantes + a.rpeSesionesFaltantes
    const faltasB = (7 - b.wellnessUltimos7Dias) + b.rpePartidosFaltantes + b.rpeSesionesFaltantes
    return faltasB - faltasA
  })
}
