import { recalcularReadinessJugadora } from '@/services/readiness'
import { recalcularResumenSemanal } from '@/services/resumenSemanal'
import { invalidarQueryCache } from '@/services/queryCacheService'
import { logInfo, logError } from '@/utils/logger'

export async function recalcularMetricasJugadora(idJugadora: string, fechasAfectadas: string[]): Promise<void> {
  try {
    if (!idJugadora || fechasAfectadas.length === 0) return

    // 1. Recalcular Readiness para fechas afectadas
    for (const f of fechasAfectadas) {
      await recalcularReadinessJugadora(idJugadora, f)
    }

    // 2. Recalcular Resumen Semanal para las semanas afectadas
    for (const f of fechasAfectadas) {
      await recalcularResumenSemanal(idJugadora, f)
    }

    // 3. Invalidar caché en memoria
    invalidarMetricasCache(idJugadora)
    logInfo('PRECOMPUTATION', `Métricas precomputadas correctamente para jugadora ${idJugadora}`, { fechas: fechasAfectadas })
  } catch (err) {
    logError('PRECOMPUTATION', err, { idJugadora, fechasAfectadas })
    throw err
  }
}

export function invalidarMetricasCache(idJugadora?: string): void {
  if (idJugadora) {
    invalidarQueryCache(idJugadora)
  } else {
    invalidarQueryCache()
  }
}
