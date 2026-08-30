import { isWithinInterval, parseISO, subDays } from 'date-fns'
import type { Jugadora, Partido, RPE_Partido } from '@/types'

export interface JugadoraCompetitiveLoad {
  jugadora: Jugadora
  partidosJugados: number
  partidosConRegistro: number
  minutosTotales: number
  minutosMedios: number
  rpeMedio: number
  sRpeTotal: number
  sRpeUltimo: number
  datosPendientes: number
  registros: {
    partido: Partido
    rpePartido: RPE_Partido
  }[]
}

export interface CompetitiveLoadFiltros {
  rangoDias?: number | 'temporada' | 'ultimo_partido'
  fechaReferencia: string
  temporadaActiva?: { fecha_inicio: string; fecha_fin?: string }
}

/**
 * Calcula métricas competitivas puras, respetando la regla:
 * minutos = 0 significa participación de 0 minutos.
 * minutos = null/undefined significa pendiente.
 */
export function calcularCargaCompetitivaJugadora(
  jugadora: Jugadora,
  partidos: Partido[],
  rpes: RPE_Partido[],
  filtros: CompetitiveLoadFiltros
): JugadoraCompetitiveLoad {
  let rpesFiltrados = rpes.filter(r => r.id_jugadora === jugadora.id_jugadora)
  let partidosFiltrados = partidos

  if (filtros.rangoDias === 'ultimo_partido') {
    // Buscar el partido más reciente de la lista disponible, hasta la fechaReferencia
    const partidosPasados = partidos.filter(p => p.fecha <= filtros.fechaReferencia)
    partidosPasados.sort((a, b) => b.fecha.localeCompare(a.fecha))
    const ultimo = partidosPasados.length > 0 ? partidosPasados[0] : null
    if (ultimo) {
      partidosFiltrados = [ultimo]
      rpesFiltrados = rpesFiltrados.filter(r => r.id_partido === ultimo.id_partido)
    } else {
      partidosFiltrados = []
      rpesFiltrados = []
    }
  } else if (filtros.rangoDias === 'temporada') {
    if (filtros.temporadaActiva) {
      const { fecha_inicio, fecha_fin } = filtros.temporadaActiva
      partidosFiltrados = partidos.filter(p => {
        const pDate = p.fecha
        return pDate >= fecha_inicio && (!fecha_fin || pDate <= fecha_fin)
      })
      rpesFiltrados = rpesFiltrados.filter(r => {
        const rDate = r.fecha || ''
        return rDate >= fecha_inicio && (!fecha_fin || rDate <= fecha_fin)
      })
    } else {
      // Si no hay temporada activa, devolver vacío como se solicitó
      partidosFiltrados = []
      rpesFiltrados = []
    }
  } else if (typeof filtros.rangoDias === 'number') {
    const end = parseISO(filtros.fechaReferencia)
    const start = subDays(end, filtros.rangoDias)

    partidosFiltrados = partidos.filter(p => {
      const pDate = parseISO(p.fecha)
      return isWithinInterval(pDate, { start, end })
    })

    rpesFiltrados = rpesFiltrados.filter(r => {
      const pDate = r.fecha ? parseISO(r.fecha) : null
      if (!pDate) return false
      return isWithinInterval(pDate, { start, end })
    })
  }

  // Ordenar por fecha descendente
  rpesFiltrados.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))

  let partidosConRegistro = 0
  let partidosJugados = 0
  let minutosTotales = 0
  let sumaRpe = 0
  let countRpe = 0
  let sRpeTotal = 0
  let datosPendientes = 0

  const registros: JugadoraCompetitiveLoad['registros'] = []

  // Iterate over all matches in the period to find missing data
  for (const partido of partidosFiltrados) {
    const rpe = rpesFiltrados.find(r => r.id_partido === partido.id_partido)

    if (!rpe) {
      datosPendientes++
      continue
    }

    partidosConRegistro++
    registros.push({ partido, rpePartido: rpe })

    const isZero = rpe.participacion === 'no_convocada' || rpe.participacion === 'convocada_sin_minutos' || rpe.minutos_jugados === 0
    const isMissing = rpe.minutos_jugados === null || rpe.minutos_jugados === undefined

    if (isMissing && !isZero) {
      datosPendientes++
    } else {
      if (!isZero) {
        partidosJugados++
        const m = rpe.minutos_jugados || 0
        minutosTotales += m

        if (rpe.rpe !== null && rpe.rpe !== undefined) {
          sumaRpe += rpe.rpe
          countRpe++
        }
      }

      if (rpe.carga_ua !== null && rpe.carga_ua !== undefined) {
        sRpeTotal += rpe.carga_ua
      }
    }
  }

  // Sort registros to ensure descending date
  registros.sort((a, b) => b.partido.fecha.localeCompare(a.partido.fecha))

  const sRpeUltimo = registros.length > 0 ? (registros[0].rpePartido.carga_ua || 0) : 0

  return {
    jugadora,
    partidosJugados,
    partidosConRegistro,
    minutosTotales,
    minutosMedios: partidosJugados > 0 ? Math.round(minutosTotales / partidosJugados) : 0,
    rpeMedio: countRpe > 0 ? Math.round((sumaRpe / countRpe) * 10) / 10 : 0,
    sRpeTotal,
    sRpeUltimo,
    datosPendientes,
    registros
  }
}

export function calcularCargaCompetitivaPlantilla(
  jugadoras: Jugadora[],
  partidos: Partido[],
  rpes: RPE_Partido[],
  filtros: CompetitiveLoadFiltros
): JugadoraCompetitiveLoad[] {
  return jugadoras
    .filter(j => j.activa !== false)
    .map(j => calcularCargaCompetitivaJugadora(j, partidos, rpes, filtros))
}
