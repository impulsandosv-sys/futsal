import { describe, it, expect, beforeEach, vi } from 'vitest'
import { recalcularMetricasJugadora, invalidarMetricasCache } from './precomputationService'
import * as readinessModule from '@/services/readiness'
import * as resumenModule from '@/services/resumenSemanal'

vi.mock('@/services/readiness', () => ({
  recalcularReadinessJugadora: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/services/resumenSemanal', () => ({
  recalcularResumenSemanal: vi.fn().mockResolvedValue(undefined),
}))

describe('Precomputación y Caché de Métricas (src/services/precomputationService.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('recalcula e inserta atómicamente la métrica de readiness y resumen para una jugadora y fechas afectadas', async () => {
    await recalcularMetricasJugadora('J001', ['2026-05-10'])

    expect(readinessModule.recalcularReadinessJugadora).toHaveBeenCalledWith('J001', '2026-05-10')
    expect(resumenModule.recalcularResumenSemanal).toHaveBeenCalledWith('J001', '2026-05-10')
  })

  it('invalida caché sin lanzar excepción', () => {
    expect(() => invalidarMetricasCache('J001')).not.toThrow()
  })
})
