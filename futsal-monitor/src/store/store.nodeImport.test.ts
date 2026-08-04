import { describe, it, expect, vi } from 'vitest'

vi.unmock('@/utils/auth')

vi.mock('@/db/database', () => ({
  FutsalDB: class MockFutsalDB {
    version(_v: number) {
      return { stores: vi.fn() }
    }
  },
  db: {
    jugadoras: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    wellness: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    sesiones: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    partidos: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    lesiones: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    tests_fisicos: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    rpe_partido: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    resumen_semanal: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    alertas: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    sesion_rpe: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    readiness: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    historial_importaciones: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    historial_copias: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    ciclo_menstrual: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    carga_gps: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    fuerza_vbt: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    hidratacion: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    rtp_checklist: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    test_psicologico: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    plantillas_importacion: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    protocolos_cmj: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    pruebas_cmj: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    ejercicios_fuerza: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    trabajos_fuerza: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    plantillas_fuerza: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
    sesiones_fuerza_individual: { toArray: vi.fn().mockResolvedValue([]), put: vi.fn() },
  }
}))

import { useStore } from '@/store/store'

describe('src/store/store.ts - Importación defensiva del store con auth real', () => {
  it('inicializa useStore correctamente con unmock de auth', () => {
    expect(useStore).toBeDefined()
    expect(typeof useStore.getState).toBe('function')
  })
})
