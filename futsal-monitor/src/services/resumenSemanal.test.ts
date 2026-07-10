import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recalcularResumenSemanal } from './resumenSemanal'

vi.mock('@/db/database', () => ({
  db: {
    jugadoras: { get: vi.fn(), toArray: vi.fn(() => Promise.resolve([])) },
    sesiones: { toArray: vi.fn(() => Promise.resolve([])) },
    partidos: { toArray: vi.fn(() => Promise.resolve([])) },
    rpe_entreno: { toArray: vi.fn(() => Promise.resolve([])) },
    rpe_partido: { toArray: vi.fn(() => Promise.resolve([])) },
    wellness: { toArray: vi.fn(() => Promise.resolve([])) },
    resumen_semanal: { put: vi.fn(), where: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })) },
  },
}))

vi.mock('@/utils/calculations', () => ({
  calcularResumenSemanal: vi.fn(() => ({
    id: 1,
    id_jugadora: 'J001',
    semana: '2026-W27',
    carga_entreno: 0,
    carga_partido: 0,
    carga_total: 0,
    carga_cronica: 0,
    acwr: 0,
    num_sesiones: 0,
    wellness_medio: 0,
    estado: 'Optimo',
  })),
  getWeekId: vi.fn(() => '2026-W27'),
}))

describe('recalcularResumenSemanal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null if jugadora does not exist', async () => {
    const { db } = await import('@/db/database')
    ;(db.jugadoras.get as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const result = await recalcularResumenSemanal('NOEXISTE')
    expect(result).toBeNull()
  })

  it('should recalculate and persist summary', async () => {
    const { db } = await import('@/db/database')
    ;(db.jugadoras.get as ReturnType<typeof vi.fn>).mockResolvedValue({ id_jugadora: 'J001', nombre: 'Test' })
    const result = await recalcularResumenSemanal('J001')
    expect(result).not.toBeNull()
    expect(result?.id_jugadora).toBe('J001')
  })
})
