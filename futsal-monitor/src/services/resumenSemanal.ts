import { db } from '@/db/database'
import { calcularResumenSemanal, getWeekId } from '@/utils/calculations'
import type { ResumenSemanal } from '@/types'

// Service to recalculate and persist weekly summaries
export async function recalcularResumenSemanal(jugadoraId: string): Promise<ResumenSemanal | null> {
  try {
    const jugadora = await db.jugadoras.get(jugadoraId as any)
    if (!jugadora) return null

    const currentWeek = getWeekId(new Date().toISOString().split('T')[0])
    const [sesiones, partidos, rpeEntreno, rpePartido, wellness, historicos] = await Promise.all([
      db.sesiones.toArray(),
      db.partidos.toArray(),
      db.rpe_entreno.toArray(),
      db.rpe_partido.toArray(),
      db.wellness.toArray(),
      db.resumen_semanal.where({ id_jugadora: jugadoraId }).toArray()
    ])

    const resumen = calcularResumenSemanal(
      jugadoraId,
      currentWeek,
      sesiones,
      partidos,
      rpeEntreno,
      rpePartido,
      wellness,
      historicos
    )

    await db.resumen_semanal.put(resumen)
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