import { db } from '@/db/database'
import { calcularACWREWMA } from '@/domain/calculations/loadCalculations'
import { calcularReadinessDiaria } from '@/domain/monitoring/monitoring'
import { obtenerArrayCargaDiaria } from '@/domain/calculations/dailyLoad'
import { getTodayLocalISO } from '@/domain/dates/dates'
import type { Wellness } from '@/types'
import { parseISO, subDays, format, differenceInCalendarDays } from 'date-fns'

import type { FutsalDB } from '@/db/database'

export async function recalcularReadinessJugadora(jugadoraId: string, fechaObjetivo?: string, dbInstance: FutsalDB = db): Promise<void> {
  const [sesionesRPE, wellnessList, rpePartidos, sesiones] = await Promise.all([
    dbInstance.sesion_rpe.where({ id_jugadora: jugadoraId }).toArray(),
    dbInstance.wellness.where({ id_jugadora: jugadoraId }).toArray(),
    dbInstance.rpe_partido.where({ id_jugadora: jugadoraId }).toArray(),
    dbInstance.sesiones.toArray(),
  ])

  const fechaHoyStr = getTodayLocalISO()
  const fechaTargetStr = fechaObjetivo || fechaHoyStr
  const hoy = parseISO(fechaTargetStr)
  const hace28 = subDays(hoy, 27)
  const hace28Str = format(hace28, 'yyyy-MM-dd')

  const cargaDiaria = obtenerArrayCargaDiaria({
    jugadoraId,
    fechaDesde: hace28Str,
    fechaHasta: fechaTargetStr,
    sesiones,
    sesionesRPE,
    rpePartidos,
  })

  const acwr = calcularACWREWMA(cargaDiaria)
  const cargaAguda = cargaDiaria[cargaDiaria.length - 1] || 0
  
  // Calcular carga crónica usando EWMA (lambda = 2 / 29)
  let EWMA_cronica = cargaDiaria[0] || 0
  const lambda = 2 / 29
  for (let i = 1; i < cargaDiaria.length; i++) {
    EWMA_cronica = lambda * cargaDiaria[i] + (1 - lambda) * EWMA_cronica
  }
  const cargaCronica = Math.round(EWMA_cronica * 10) / 10

  const todasFechas = new Set<string>()
  sesionesRPE.forEach(r => { if (r.fecha) todasFechas.add(r.fecha) })
  rpePartidos.forEach(p => { if (p.fecha) todasFechas.add(p.fecha) })
  
  const fechas = fechaObjetivo
    ? [fechaObjetivo]
    : Array.from(todasFechas).sort().slice(-7)
  if (!fechaObjetivo && !fechas.includes(fechaTargetStr)) {
    fechas.push(fechaTargetStr)
  }
  const ahoraISO = new Date().toISOString()

  for (const fecha of fechas) {
    const w: Wellness | null = wellnessList.find(w => w.fecha === fecha) || null
    
    const wellnessPrevios = wellnessList
      .filter(x => x.fecha <= fecha)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
    
    const ultimoW = wellnessPrevios[0] || null
    const diasDesdeWellness = w ? 0 : ultimoW
      ? differenceInCalendarDays(parseISO(fecha), parseISO(ultimoW.fecha))
      : 99

    const existing = await dbInstance.readiness.where({ id_jugadora: jugadoraId, fecha }).first()

    const readiness = calcularReadinessDiaria({
      id_jugadora: jugadoraId,
      fecha,
      wellness: w,
      acwr,
      cargaAguda,
      cargaCronica,
      diasDesdeWellness,
      creada: ahoraISO,
    })

    if (existing?.id) {
      readiness.id = existing.id
    }

    await dbInstance.readiness.put(readiness)
  }
}
