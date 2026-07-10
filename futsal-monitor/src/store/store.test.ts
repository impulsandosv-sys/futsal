import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from './store'
import { mockJugadora, mockWellness } from '@/test/mocks'

vi.mock('@/db/database', () => ({
  db: {
    jugadoras: { put: vi.fn(), toArray: vi.fn(() => Promise.resolve([])), delete: vi.fn() },
    wellness: { put: vi.fn(), toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(() => ({ first: vi.fn(() => Promise.resolve(null)) })) },
    sesiones: { put: vi.fn(), toArray: vi.fn(() => Promise.resolve([])) },
    partidos: { put: vi.fn(), toArray: vi.fn(() => Promise.resolve([])) },
    lesiones: { put: vi.fn(), toArray: vi.fn(() => Promise.resolve([])) },
    tests_fisicos: { put: vi.fn(), toArray: vi.fn(() => Promise.resolve([])) },
    rpe_entreno: { put: vi.fn(), toArray: vi.fn(() => Promise.resolve([])) },
    rpe_partido: { put: vi.fn(), toArray: vi.fn(() => Promise.resolve([])) },
    resumen_semanal: { put: vi.fn(), toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })) },
    alertas: { put: vi.fn(), toArray: vi.fn(() => Promise.resolve([])), update: vi.fn(), clear: vi.fn() },
  },
}))

vi.mock('@/utils/auth', () => ({
  initializeAuth: vi.fn(),
  verifyPassword: vi.fn(() => Promise.resolve(true)),
  createSession: vi.fn(),
  clearSession: vi.fn(),
  startSessionMonitor: vi.fn(),
  stopSessionMonitor: vi.fn(),
}))

vi.mock('@/utils/backup', () => ({
  createBackup: vi.fn(),
  startAutoBackup: vi.fn(),
  stopAutoBackup: vi.fn(),
}))

describe('useStore', () => {
  beforeEach(() => {
    useStore.setState({
      jugadoras: [],
      wellness: [],
      sesiones: [],
      partidos: [],
      lesiones: [],
      tests: [],
      rpe_entreno: [],
      rpe_partido: [],
      resumen_semanal: [],
      alertas: [],
      filters: { id_jugadora: '', fecha_desde: '', fecha_hasta: '', semana: '', tipo_sesion: '', estado: '' },
      loading: false,
      isAuthenticated: false,
      hasData: false,
    })
  })

  it('should have initial empty state', () => {
    const state = useStore.getState()
    expect(state.jugadoras).toEqual([])
    expect(state.wellness).toEqual([])
    expect(state.loading).toBe(false)
  })

  it('setFilter should update filter', () => {
    useStore.getState().setFilter('id_jugadora', 'J001')
    expect(useStore.getState().filters.id_jugadora).toBe('J001')
  })

  it('resetFilters should restore defaults', () => {
    useStore.getState().setFilter('id_jugadora', 'J001')
    useStore.getState().resetFilters()
    expect(useStore.getState().filters.id_jugadora).toBe('')
  })

  it('addJugadora should validate and add', async () => {
    const j = mockJugadora()
    await useStore.getState().addJugadora(j)
    expect(useStore.getState().jugadoras).toHaveLength(1)
    expect(useStore.getState().jugadoras[0].id_jugadora).toBe('J001')
  })

  it('addJugadora should reject invalid', async () => {
    await expect(useStore.getState().addJugadora({} as any)).rejects.toThrow()
    expect(useStore.getState().jugadoras).toHaveLength(0)
  })

  it('addWellness should validate and add', async () => {
    useStore.setState({ jugadoras: [mockJugadora()] })
    const w = mockWellness()
    await useStore.getState().addWellness(w)
    expect(useStore.getState().wellness).toHaveLength(1)
  })
})
