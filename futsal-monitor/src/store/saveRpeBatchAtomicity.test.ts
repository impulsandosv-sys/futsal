import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from './store'
import { db } from '@/db/database'
import * as resumenService from '@/services/resumenSemanal'
import * as readinessService from '@/services/readiness'

vi.mock('@/db/database', () => ({
  FutsalDB: class MockFutsalDB {
    version(_v: number) {
      return { stores: vi.fn() }
    }
  },
  db: {
    jugadoras: { toArray: vi.fn(() => Promise.resolve([])) },
    wellness: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(() => ({ equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })), first: vi.fn(() => Promise.resolve(null)) })) },
    sesiones: { toArray: vi.fn(() => Promise.resolve([])) },
    partidos: { toArray: vi.fn(() => Promise.resolve([])) },
    lesiones: { toArray: vi.fn(() => Promise.resolve([])) },
    tests_fisicos: { toArray: vi.fn(() => Promise.resolve([])) },
    rpe_partido: { toArray: vi.fn(() => Promise.resolve([])) },
    resumen_semanal: { put: vi.fn(), toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(() => ({ equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })), toArray: vi.fn(() => Promise.resolve([])) })) },
    alertas: { put: vi.fn(), toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(() => ({ equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })), toArray: vi.fn(() => Promise.resolve([])) })) },
    sesion_rpe: { put: vi.fn(), bulkPut: vi.fn(() => Promise.resolve()), toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(() => ({ equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })), toArray: vi.fn(() => Promise.resolve([])) })) },
    readiness: { put: vi.fn(), toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(() => ({ equals: vi.fn(() => ({ first: vi.fn(() => Promise.resolve(null)), toArray: vi.fn(() => Promise.resolve([])) })), first: vi.fn(() => Promise.resolve(null)), toArray: vi.fn(() => Promise.resolve([])) })) },
    historial_importaciones: { toArray: vi.fn(() => Promise.resolve([])) },
    historial_copias: { toArray: vi.fn(() => Promise.resolve([])) },
    ciclo_menstrual: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(() => ({ equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })), toArray: vi.fn(() => Promise.resolve([])) })) },
    carga_gps: { toArray: vi.fn(() => Promise.resolve([])) },
    fuerza_vbt: { toArray: vi.fn(() => Promise.resolve([])) },
    hidratacion: { toArray: vi.fn(() => Promise.resolve([])) },
    rtp_checklist: { toArray: vi.fn(() => Promise.resolve([])) },
    test_psicologico: { toArray: vi.fn(() => Promise.resolve([])) },
    formulario_respuestas: { toArray: vi.fn(() => Promise.resolve([])) },
    plantillas_importacion: { put: vi.fn(), toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(() => ({ count: vi.fn(() => Promise.resolve(0)) })) },
    protocolos_cmj: { toArray: vi.fn(() => Promise.resolve([])) },
    pruebas_cmj: { toArray: vi.fn(() => Promise.resolve([])) },
    ejercicios_fuerza: { toArray: vi.fn(() => Promise.resolve([])) },
    trabajos_fuerza: { toArray: vi.fn(() => Promise.resolve([])) },
    plantillas_fuerza: { toArray: vi.fn(() => Promise.resolve([])) },
    sesiones_fuerza_individual: { toArray: vi.fn(() => Promise.resolve([])) },
    compensacion_postpartido: { toArray: vi.fn(() => Promise.resolve([])) },
    transaction: vi.fn((_mode, _tables, cb) => {
      const fn = typeof _tables === 'function' ? _tables : cb
      return typeof fn === 'function' ? fn() : Promise.resolve()
    }),
  }
}))

vi.mock('@/services/resumenSemanal', () => ({
  recalcularResumenSemanal: vi.fn(() => Promise.resolve(null)),
  recalcularTodosLosResumenes: vi.fn(() => Promise.resolve()),
  limpiarResumenesAnteriores: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/services/readiness', () => ({
  recalcularReadinessJugadora: vi.fn(() => Promise.resolve()),
}))

describe('saveRpeBatch - Atomicidad y Modos de Fallo (Bloque 2A)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('A. Éxito: Guarda dos RPE válidos de jugadoras distintas, calcula derivados y ejecuta loadAll()', async () => {
    const validRpes = [
      { id_sesion: 'ses1', id_jugadora: 'J1', fecha: '2026-05-10', rpe: 7, duracion_min: 60, carga_ua: 420 },
      { id_sesion: 'ses1', id_jugadora: 'J2', fecha: '2026-05-10', rpe: 8, duracion_min: 60, carga_ua: 480 },
    ]

    await useStore.getState().saveRpeBatch(validRpes)

    // 1. Transaction llamada con las tablas especificadas
    expect(db.transaction).toHaveBeenCalledWith(
      'rw',
      [
        db.sesion_rpe,
        db.resumen_semanal,
        db.readiness,
        db.jugadoras,
        db.sesiones,
        db.partidos,
        db.rpe_partido,
        db.wellness,
      ],
      expect.any(Function)
    )

    // 2. bulkPut invocado con ambos RPEs
    expect(db.sesion_rpe.bulkPut).toHaveBeenCalledWith(validRpes)

    // 3. Recalculo derivado invocado por cada jugadora única (J1 y J2)
    expect(resumenService.recalcularResumenSemanal).toHaveBeenCalledWith('J1', '2026-05-10', expect.any(Object))
    expect(resumenService.recalcularResumenSemanal).toHaveBeenCalledWith('J2', '2026-05-10', expect.any(Object))
    expect(readinessService.recalcularReadinessJugadora).toHaveBeenCalledWith('J1', '2026-05-10')
    expect(readinessService.recalcularReadinessJugadora).toHaveBeenCalledWith('J2', '2026-05-10')

    // 4. loadAll() invocado tras la transacción
    expect(db.sesiones.toArray).toHaveBeenCalled()
  })

  it('B. Rollback: Si falla la escritura de readiness o resumen, el error se propaga para cancelar la transacción Dexie', async () => {
    vi.mocked(readinessService.recalcularReadinessJugadora).mockRejectedValueOnce(new Error('Fallo simulado en readiness'))

    const validRpes = [
      { id_sesion: 'ses1', id_jugadora: 'J1', fecha: '2026-05-10', rpe: 7, duracion_min: 60, carga_ua: 420 },
    ]

    await expect(useStore.getState().saveRpeBatch(validRpes)).rejects.toThrow('Fallo simulado en readiness')
  })

  it('C. Validación previa: Si el lote incluye un RPE inválido, rechaza antes de abrir la transacción Dexie', async () => {
    const invalidRpes: any[] = [
      { id_sesion: 'ses1', id_jugadora: 'J1', fecha: '2026-05-10', rpe: 15, duracion_min: 60, carga_ua: 900 }, // RPE > 10 inválido
    ]

    await expect(useStore.getState().saveRpeBatch(invalidRpes)).rejects.toThrow()

    // Comprobar que no se inició la transacción ni se llamó a bulkPut
    expect(db.transaction).not.toHaveBeenCalled()
    expect(db.sesion_rpe.bulkPut).not.toHaveBeenCalled()
  })
})
