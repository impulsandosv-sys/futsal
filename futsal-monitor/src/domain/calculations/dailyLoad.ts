import type { Sesion, SesionRPE, RPE_Partido, Partido } from '@/types'
import type { FiltrosCarga } from '../monitoring/monitoring'
import { parseISO, addDays, format, isBefore, isSameDay } from 'date-fns'

export interface DailyLoadDetail {
  origen: 'sesion' | 'partido'
  idOrigen?: number
  idSesion?: string
  idPartido?: string
  rpe?: number | null
  duracionMinutos?: number | null
  cargaCalculada: number
  esCargaExplicita: boolean
  tipoSesion?: string
}

export interface DailyLoadEntry {
  fecha: string // YYYY-MM-DD
  carga: number | null // null = sin registrar; 0 = carga real 0 (ej: descanso, ausente, 0 min)
  tieneDato: boolean
  fuentes: ('sesion' | 'partido')[]
  numActividades: number
  detalles: DailyLoadDetail[]
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
 * Módulo puro reutilizable y Fuente Única de Verdad para obtener la carga diaria individual de una jugadora.
 * 
 * Regla Estricta de Deduplicación Sesión-Partido:
 * La deduplicación solo se produce si existe una relación comprobable de enlace explícito:
 * 1. La sesión tiene `id_partido` (s.id_partido no nulo ni vacío).
 * 2. Existe un `rpe_partido` registrado para la misma jugadora y con ese mismo `id_partido`.
 * 
 * NOTA: NO se deduplica una sesión únicamente porque s.tipo_sesion === 'Partido' si no tiene id_partido.
 * Sin un enlace explícito id_partido, no se puede asumir qué partido corresponde a esa sesión.
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
      detalles: [],
    })
    curr = addDays(curr, 1)
  }

  // Indexar sesiones por id_sesion usando la clave primaria real (Sesion.id_sesion)
  const sesionesMap = new Map<string, Sesion>()
  for (const s of sesiones) {
    if (s.id_sesion) {
      sesionesMap.set(s.id_sesion, s)
    }
  }

  // 1. Filtrar RPE de partidos válidos e incluirlos según config (deduplicando por id_partido)
  const rpePartidosJugadora: RPE_Partido[] = []
  const seenPartidoIds = new Set<string>()

  if (incluirPartidos !== false) {
    for (const p of rpePartidos) {
      if (p.id_jugadora !== jugadoraId) continue
      if (!p.fecha || p.fecha < fechaDesde || p.fecha > fechaHasta) continue
      if (p.id_partido) {
        if (seenPartidoIds.has(p.id_partido)) continue
        seenPartidoIds.add(p.id_partido)
      }
      rpePartidosJugadora.push(p)
    }
  }

  // Set de id_partido de partidos con RPE de esta jugadora
  const partidosAtendidosPorRPEPartido = new Set<string>()
  for (const p of rpePartidosJugadora) {
    if (p.id_partido) {
      partidosAtendidosPorRPEPartido.add(p.id_partido)
    }
  }

  // 2. Filtrar y procesar SesionRPE (deduplicando por id_sesion)
  const sesionesRPEJugadora: SesionRPE[] = []
  const seenSesionIds = new Set<string>()

  for (const r of sesionesRPE) {
    if (r.id_jugadora !== jugadoraId) continue
    if (!r.fecha || r.fecha < fechaDesde || r.fecha > fechaHasta) continue
    const s = sesionesMap.get(r.id_sesion)
    if (s?.estado === 'cancelada') continue
    
    const tipo = s?.tipo_sesion
    if (tipo === 'Gimnasio' && incluirGimnasio === false) continue
    if ((tipo === 'Recuperacion' || tipo === 'Preventivo' || tipo === 'Readaptacion') && incluirReadaptacion === false) continue
    if (tipo === 'Partido' && incluirPartidos === false) continue

    if (r.id_sesion) {
      if (seenSesionIds.has(r.id_sesion)) continue
      seenSesionIds.add(r.id_sesion)
    }

    sesionesRPEJugadora.push(r)
  }

  for (const r of sesionesRPEJugadora) {
    const s = sesionesMap.get(r.id_sesion)
    
    // Regla 2: Deduplicar únicamente si la sesión tiene id_partido y existe RPE_Partido para ese id_partido
    if (s?.id_partido && partidosAtendidosPorRPEPartido.has(s.id_partido)) {
      continue
    }

    const entry = result.get(r.fecha)
    if (!entry) continue

    let cargaSesion: number | null = null
    let esExplicita = false
    let tieneRPEValido = false

    // Regla 3: Preservar carga explícita (carga_ua) si es un número finito
    if (typeof r.carga_ua === 'number' && Number.isFinite(r.carga_ua)) {
      cargaSesion = r.carga_ua
      esExplicita = true
      tieneRPEValido = true
    } else if (
      typeof r.rpe === 'number' && Number.isFinite(r.rpe) &&
      typeof r.duracion_min === 'number' && Number.isFinite(r.duracion_min)
    ) {
      cargaSesion = r.rpe * r.duracion_min
      tieneRPEValido = true
    } else if (r.asistencia === 'ausente' || r.asistencia === 'no_convocada' || r.asistencia === 'excusada') {
      cargaSesion = 0
      tieneRPEValido = true
    }

    if (tieneRPEValido && cargaSesion !== null) {
      entry.carga = (entry.carga ?? 0) + cargaSesion
      entry.tieneDato = true
      if (!entry.fuentes.includes('sesion')) entry.fuentes.push('sesion')
      entry.numActividades += 1
      entry.detalles.push({
        origen: 'sesion',
        idOrigen: r.id,
        idSesion: r.id_sesion,
        idPartido: s?.id_partido,
        rpe: r.rpe,
        duracionMinutos: r.duracion_min,
        cargaCalculada: cargaSesion,
        esCargaExplicita: esExplicita,
        tipoSesion: s?.tipo_sesion
      })
    }
  }

  // 3. Procesar RPE_Partido
  for (const p of rpePartidosJugadora) {
    const entry = result.get(p.fecha)
    if (!entry) continue

    let cargaPartido: number | null = null
    let esExplicita = false
    let tieneRPEValido = false

    // Regla 3: Preservar carga explícita (carga_ua) si es un número finito
    if (typeof p.carga_ua === 'number' && Number.isFinite(p.carga_ua)) {
      cargaPartido = p.carga_ua
      esExplicita = true
      tieneRPEValido = true
    } else if (
      typeof p.rpe === 'number' && Number.isFinite(p.rpe) &&
      typeof p.minutos_jugados === 'number' && Number.isFinite(p.minutos_jugados)
    ) {
      cargaPartido = p.rpe * p.minutos_jugados
      tieneRPEValido = true
    } else if (p.minutos_jugados === 0 || p.participacion === 'no_convocada' || p.participacion === 'convocada_sin_minutos') {
      // 0 minutos jugados implica carga 0 explícita.
      cargaPartido = 0
      tieneRPEValido = true
    }

    if (tieneRPEValido && cargaPartido !== null) {
      entry.carga = (entry.carga ?? 0) + cargaPartido
      entry.tieneDato = true
      if (!entry.fuentes.includes('partido')) entry.fuentes.push('partido')
      entry.numActividades += 1
      entry.detalles.push({
        origen: 'partido',
        idOrigen: p.id,
        idPartido: p.id_partido,
        rpe: p.rpe,
        duracionMinutos: p.minutos_jugados,
        cargaCalculada: cargaPartido,
        esCargaExplicita: esExplicita
      })
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
