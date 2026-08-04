import { db } from '@/db/database'
import { calcularResumenSemanal } from '@/domain/monitoring/monitoring'
import type { FiltrosCarga } from '@/domain/monitoring/monitoring'
import { getWeekId, getTodayLocalISO } from '@/domain/dates/dates'
import type { ResumenSemanal } from '@/types'

// Service to recalculate and persist weekly summaries
import type { FutsalDB } from '@/db/database'

export async function recalcularResumenSemanal(
  jugadoraId: string,
  fechaOSemana?: string,
  config?: FiltrosCarga,
  dbInstance: FutsalDB = db
): Promise<ResumenSemanal | null> {
  try {
    const jugadora = await dbInstance.jugadoras.get(jugadoraId as any)
    if (!jugadora) return null

    const targetWeek = fechaOSemana
      ? (fechaOSemana.includes('-') && fechaOSemana.length === 10 ? getWeekId(fechaOSemana) : fechaOSemana)
      : getWeekId(getTodayLocalISO())

    const [sesiones, partidos, rpeEntreno, rpePartido, wellness, historicos] = await Promise.all([
      dbInstance.sesiones.toArray(),
      dbInstance.partidos.toArray(),
      dbInstance.sesion_rpe.toArray(),
      dbInstance.rpe_partido.toArray(),
      dbInstance.wellness.toArray(),
      dbInstance.resumen_semanal.where({ id_jugadora: jugadoraId }).toArray()
    ])

    const resumen = calcularResumenSemanal(
      jugadoraId,
      targetWeek,
      sesiones,
      partidos,
      rpeEntreno,
      rpePartido,
      wellness,
      historicos,
      config
    )

    const existing = historicos.find(h => h.semana === targetWeek)
    if (existing) {
      await dbInstance.resumen_semanal.put({ ...resumen, id: existing.id })
    } else {
      await dbInstance.resumen_semanal.put(resumen)
    }
    return resumen
  } catch (error) {
    console.error('Error recalculating weekly summary:', error)
    throw error
  }
}

export async function recalcularTodosLosResumenes(): Promise<void> {
  try {
    const jugadoras = await db.jugadoras.toArray()
    await Promise.all(
      jugadoras.map(async (jugadora) => {
        await recalcularResumenSemanal(jugadora.id_jugadora)
      })
    )
  } catch (error) {
    console.error('Error recalculating all summaries:', error)
    throw error
  }
}

export async function limpiarResumenesAnteriores(jugadoraId: string): Promise<void> {
  await db.resumen_semanal.where({ id_jugadora: jugadoraId }).delete()
}