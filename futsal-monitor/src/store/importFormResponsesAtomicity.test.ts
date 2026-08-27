import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from './store'
import { db } from '@/db/database'
import * as readinessService from '@/services/readiness'

vi.mock('@/db/database', () => ({
  FutsalDB: class MockFutsalDB {
    version(_v: number) {
      return { stores: vi.fn() }
    }
  },
  db: {
    jugadoras: {
      toArray: vi.fn(() => Promise.resolve([
        { id_jugadora: 'J1', nombre: 'Jugadora 1' },
        { id_jugadora: 'J2', nombre: 'Jugadora 2' },
      ])),
    },
    wellness: {
      toArray: vi.fn(() => Promise.resolve([])),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
        first: vi.fn(() => Promise.resolve(null)),
      })),
      put: vi.fn(() => Promise.resolve(1)),
    },
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
  },
}))

vi.mock('@/services/readiness', () => ({
  recalcularReadinessJugadora: vi.fn(() => Promise.resolve()),
}))

describe('importFormResponses - Tests Estructurales/Unitarios (Bloque 2C)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. Una importación vacía tras normalizar no abre transacción ni recarga', async () => {
    const responses = [
      { id_jugadora: 'INEXISTENTE', fecha: '2026-05-10', calidad_sueno: 7, fatiga: 5, dolor_muscular: 3, estres: 4, estado_animo: 8 },
    ]

    await useStore.getState().importFormResponses(responses as any)

    expect(db.transaction).not.toHaveBeenCalled()
    expect(db.jugadoras.toArray).toHaveBeenCalledTimes(1)
    expect(db.sesiones.toArray).not.toHaveBeenCalled()
  })

  it('2. Las filas existentes en wellness se omiten, sin put ni recálculo', async () => {
    vi.mocked(db.wellness.where).mockReturnValue({
      first: vi.fn(() => Promise.resolve({ id: 1, id_jugadora: 'J1', fecha: '2026-05-10', score_wellness: 7 } as any)),
      equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
    } as any)

    const responses = [
      { id_jugadora: 'J1', fecha: '2026-05-10', calidad_sueno: 7, fatiga: 5, dolor_muscular: 3, estres: 4, estado_animo: 8 },
    ]

    await useStore.getState().importFormResponses(responses as any)

    expect(db.transaction).toHaveBeenCalled()
    expect(db.wellness.put).not.toHaveBeenCalled()
    expect(readinessService.recalcularReadinessJugadora).not.toHaveBeenCalled()
    expect(db.sesiones.toArray).not.toHaveBeenCalled()
  })

  it('3. La transacción declara exactamente las cuatro tablas requeridas', async () => {
    vi.mocked(db.wellness.where).mockReturnValue({
      first: vi.fn(() => Promise.resolve(null)),
      equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
    } as any)

    const responses = [
      { id_jugadora: 'J1', fecha: '2026-05-10', calidad_sueno: 7, fatiga: 5, dolor_muscular: 3, estres: 4, estado_animo: 8 },
    ]

    await useStore.getState().importFormResponses(responses as any)

    expect(db.transaction).toHaveBeenCalledWith(
      'rw',
      [db.wellness, db.readiness, db.sesion_rpe, db.rpe_partido, db.sesiones, db.jugadoras],
      expect.any(Function)
    )
  })

  it('4 & 5. loadAll() se invoca una vez tras inserción exitosa (Bloque 2H) y pos-commit ejecuta seguimiento selectivo', async () => {
    vi.mocked(db.wellness.where).mockReturnValue({
      first: vi.fn(() => Promise.resolve(null)),
      equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
    } as any)

    const responses = [
      { id_jugadora: 'J1', fecha: '2026-05-10', calidad_sueno: 7, fatiga: 5, dolor_muscular: 3, estres: 4, estado_animo: 8 },
    ]

    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')

    await useStore.getState().importFormResponses(responses as any)

    // Bloque 2H: el segundo loadAll global fue eliminado.
    // Solo se llama una vez (post-commit); alertas se sincronizan selectivamente.
    expect(loadAllSpy).toHaveBeenCalledTimes(1)
  })

  it('6. No se evalúan alertas ni se recarga si la transacción rechaza', async () => {
    vi.mocked(db.wellness.where).mockReturnValue({
      first: vi.fn(() => Promise.resolve(null)),
      equals: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
    } as any)
    vi.mocked(readinessService.recalcularReadinessJugadora).mockRejectedValueOnce(new Error('Transaction abort'))

    const responses = [
      { id_jugadora: 'J1', fecha: '2026-05-10', calidad_sueno: 7, fatiga: 5, dolor_muscular: 3, estres: 4, estado_animo: 8 },
    ]

    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')

    await expect(useStore.getState().importFormResponses(responses as any)).rejects.toThrow('Transaction abort')

    expect(loadAllSpy).not.toHaveBeenCalled()
  })
})
