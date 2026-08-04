import type { Sesion, SesionRPE, RPE_Partido, Partido } from '@/types'
import type { FiltrosCarga } from '../monitoring/monitoring'
import { parseISO, addDays, format, isBefore, isSameDay } from 'date-fns'

export interface DailyLoadEntry {
  fecha: string // YYYY-MM-DD
  carga: number | null // null = sin registrar; 0 = carga real 0 (ej: descanso, ausente, 0 min)
  tieneDato: boolean
  fuentes: ('sesion' | 'partido')[]
  numActividades: number
}

export interface DailyLoadCalculationInput {
  jugadoraId: string
  fechaDesde: string // YYYY-MM-DD (inclusivo)
  fechaHasta: string // YYYY-MM-DD (inclusivo)
  sesiones: Sesion[]
  sesionesRPE: SesionRPE[]
  rpePartidos: RPE_Partido[]
  partidos?: Partido[]
  config?: FiltrosCarga
}

/**
 * Módulo puro reutilizable para obtener la carga diaria individual de una jugadora.
 * 
 * Regla de deduplicación Sesión-Partido (No doble conteo):
 * Cuando una sesión de entreno está vinculada a un partido (s.tipo_sesion === 'Partido' o s.id_partido),
 * y existe un RPE_Partido para el mismo id_partido y la misma jugadora,
 * RPE_Partido tiene PRIORIDAD sobre SesionRPE.
 * Razón: RPE_Partido incluye los minutos jugados reales en competición y el RPE específico de partido.
 * Por tanto, la SesionRPE asociada a esa sesión de partido se descarta para evitar duplicidad de carga.
 */
export function obtenerCargasDiariasJugadora(
  input: DailyLoadCalculationInput
): Map<string, DailyLoadEntry> {
  const {
    jugadoraId,
    fechaDesde,
    fechaHasta,
    sesiones,
    sesionesRPE,
    rpePartidos,
    config,
  } = input

  const { incluirPartidos = true, incluirGimnasio = true, incluirReadaptacion = true } = config || {}

  const result = new Map<string, DailyLoadEntry>()

  const fDesde = parseISO(fechaDesde)
  const fHasta = parseISO(fechaHasta)

  // Inicializar rango de fechas
  let curr = fDesde
  while (isBefore(curr, fHasta) || isSameDay(curr, fHasta)) {
    const key = format(curr, 'yyyy-MM-dd')
    result.set(key, {
      fecha: key,
      carga: null,
      tieneDato: false,
      fuentes: [],
      numActividades: 0,
    })
    curr = addDays(curr, 1)
  }

  // 1. Filtrar sesiones de entreno válidas e incluidas según config
  const sesionesRPEJugadora = sesionesRPE.filter((r) => {
    if (r.id_jugadora !== jugadoraId) return false
    if (!r.fecha || r.fecha < fechaDesde || r.fecha > fechaHasta) return false
    const s = sesiones.find((x) => x.id_sesion === r.id_sesion)
    if (s?.estado === 'cancelada') return false
    
    const tipo = s?.tipo_sesion
    if (tipo === 'Gimnasio' && incluirGimnasio === false) return false
    if ((tipo === 'Recuperacion' || tipo === 'Preventivo' || tipo === 'Readaptacion') && incluirReadaptacion === false) return false
    if (tipo === 'Partido' && incluirPartidos === false) return false
    return true
  })

  // 2. Filtrar RPE de partidos válidos
  const rpePartidosJugadora = incluirPartidos === false
    ? []
    : rpePartidos.filter((p) => {
        if (p.id_jugadora !== jugadoraId) return false
        return p.fecha && p.fecha >= fechaDesde && p.fecha <= fechaHasta
      })

  // Set de id_partido atendidos vía rpe_partido
  const partidosAtendidosPorRPEPartido = new Set<string>()
  for (const p of rpePartidosJugadora) {
    if (p.id_partido) {
      partidosAtendidosPorRPEPartido.add(p.id_partido)
    }
  }

  // 3. Procesar SesionRPE evitando doble conteo si ya se registró el partido en rpe_partido
  for (const r of sesionesRPEJugadora) {
    const s = sesiones.find((x) => x.id_sesion === r.id_sesion)
    
    // Si la sesión está vinculada a un partido y existe RPE_Partido para ese partido, omitir SesionRPE
    if (s?.id_partido && partidosAtendidosPorRPEPartido.has(s.id_partido)) {
      continue
    }

    const entry = result.get(r.fecha)
    if (!entry) continue

    let cargaSesion = 0
    let tieneRPEValido = false

    if (r.carga_ua !== null && r.carga_ua !== undefined && !isNaN(r.carga_ua)) {
      cargaSesion = r.carga_ua
      tieneRPEValido = true
    } else if (
      r.rpe !== null && r.rpe !== undefined && !isNaN(r.rpe) &&
      r.duracion_min !== null && r.duracion_min !== undefined && !isNaN(r.duracion_min)
    ) {
      cargaSesion = r.rpe * r.duracion_min
      tieneRPEValido = true
    } else if (r.asistencia === 'ausente' || r.asistencia === 'no_convocada' || r.asistencia === 'excusada') {
      cargaSesion = 0
      tieneRPEValido = true
    }

    if (tieneRPEValido) {
      entry.carga = (entry.carga ?? 0) + cargaSesion
      entry.tieneDato = true
      if (!entry.fuentes.includes('sesion')) entry.fuentes.push('sesion')
      entry.numActividades += 1
    }
  }

  // 4. Procesar RPE_Partido
  for (const p of rpePartidosJugadora) {
    const entry = result.get(p.fecha)
    if (!entry) continue

    let cargaPartido = 0
    let tieneRPEValido = false

    if (p.carga_ua !== null && p.carga_ua !== undefined && !isNaN(p.carga_ua)) {
      cargaPartido = p.carga_ua
      tieneRPEValido = true
    } else if (
      p.rpe !== null && p.rpe !== undefined && !isNaN(p.rpe) &&
      p.minutos_jugados !== null && p.minutos_jugados !== undefined && !isNaN(p.minutos_jugados)
    ) {
      cargaPartido = p.rpe * p.minutos_jugados
      tieneRPEValido = true
    } else if (p.participacion === 'no_participa') {
      cargaPartido = 0
      tieneRPEValido = true
    }

    if (tieneRPEValido) {
      entry.carga = (entry.carga ?? 0) + cargaPartido
      entry.tieneDato = true
      if (!entry.fuentes.includes('partido')) entry.fuentes.push('partido')
      entry.numActividades += 1
    }
  }

  return result
}

/**
 * Devuelve un array continuo de números de carga para el rango de días especificado.
 * Los días sin registros se sustituyen por 0 (para cálculos de EWMA/ACWR).
 */
export function obtenerArrayCargaDiaria(
  input: DailyLoadCalculationInput
): number[] {
  const map = obtenerCargasDiariasJugadora(input)
  const array: number[] = []
  for (const entry of map.values()) {
    array.push(entry.carga ?? 0)
  }
  return array
}
