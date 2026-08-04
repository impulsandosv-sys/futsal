import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from './store'
import { db } from '@/db/database'
import * as readinessService from '@/services/readiness'

// Helper de tabla Dexie semántica con filtrado real por campo/valor u objeto
function createMockTable<T extends Record<string, any>>(initialRows: T[] = []) {
  let rows: T[] = []

  const reset = () => {
    rows = initialRows.map((r) => ({ ...r }))
  }
  reset()

  const matches = (item: T, criteria: Record<string, any>) =>
    Object.entries(criteria).every(([key, val]) => item[key] === val)

  const createCollection = (filtered: T[]) => ({
    toArray: vi.fn(() => Promise.resolve(filtered.map((r) => ({ ...r })))),
    first: vi.fn(() => Promise.resolve(filtered[0] ? { ...filtered[0] } : null)),
    count: vi.fn(() => Promise.resolve(filtered.length)),
  })

  return {
    get rows() {
      return rows
    },
    reset,
    get: vi.fn((id: any) => {
      const found = rows.find((r) => r.id === id || r.id_jugadora === id)
      return Promise.resolve(found ? { ...found } : null)
    }),
    put: vi.fn((item: T) => {
      const idx = rows.findIndex(
        (r) =>
          (item.id !== undefined && r.id === item.id) ||
          (item.id_jugadora !== undefined &&
            item.fecha !== undefined &&
            r.id_jugadora === item.id_jugadora &&
            r.fecha === item.fecha),
      )
      if (idx >= 0) {
        rows[idx] = { ...item }
      } else {
        rows.push({ ...item })
      }
      return Promise.resolve(item.id !== undefined ? item.id : 1)
    }),
    bulkPut: vi.fn((items: T[]) => {
      items.forEach((item) => {
        const idx = rows.findIndex((r) => item.id !== undefined && r.id === item.id)
        if (idx >= 0) rows[idx] = { ...item }
        else rows.push({ ...item })
      })
      return Promise.resolve()
    }),
    toArray: vi.fn(() => Promise.resolve(rows.map((r) => ({ ...r })))),
    where: vi.fn((arg: string | Record<string, any>) => {
      if (typeof arg === 'string') {
        return {
          equals: vi.fn((val: any) => {
            const filtered = rows.filter((item) => item[arg] === val)
            return createCollection(filtered)
          }),
        }
      } else if (typeof arg === 'object' && arg !== null) {
        const filtered = rows.filter((item) => matches(item, arg))
        return createCollection(filtered)
      }
      return createCollection([])
    }),
  }
}

const mocks = vi.hoisted(() => {
  return {
    jugadoras: createMockTable([
      { id_jugadora: 'J1', nombre: 'Jugadora 1' },
      { id_jugadora: 'J2', nombre: 'Jugadora 2' },
    ]),
    wellness: createMockTable([
      { id: 10, id_jugadora: 'J1', fecha: '2026-05-10', score_wellness: 80, calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 9 },
      { id: 20, id_jugadora: 'J2', fecha: '2026-05-10', score_wellness: 90, calidad_sueno: 9, fatiga: 9, dolor_muscular: 8, estres: 8, estado_animo: 9 },
    ]),
    readiness: createMockTable([
      { id_jugadora: 'J1', fecha: '2026-05-10', readiness_score: 85 },
      { id_jugadora: 'J2', fecha: '2026-05-10', readiness_score: 92 },
    ]),
    resumen_semanal: createMockTable([
      { id_jugadora: 'J1', semana: '2026-W19', acwr: 1.2 },
      { id_jugadora: 'J2', semana: '2026-W19', acwr: 1.0 },
    ]),
    ciclo_menstrual: createMockTable([
      { id_jugadora: 'J1', fecha: '2026-05-10', fase: 'Folicular' },
      { id_jugadora: 'J2', fecha: '2026-05-10', fase: 'Folicular' },
    ]),
    alertas: createMockTable([]),
    sesion_rpe: createMockTable([]),
    sesiones: createMockTable([]),
    partidos: createMockTable([]),
    lesiones: createMockTable([]),
    tests_fisicos: createMockTable([]),
    rpe_partido: createMockTable([]),
    historial_importaciones: createMockTable([]),
    historial_copias: createMockTable([]),
    carga_gps: createMockTable([]),
    fuerza_vbt: createMockTable([]),
    hidratacion: createMockTable([]),
    rtp_checklist: createMockTable([]),
    test_psicologico: createMockTable([]),
    formulario_respuestas: createMockTable([]),
    protocolos_cmj: createMockTable([]),
    pruebas_cmj: createMockTable([]),
    ejercicios_fuerza: createMockTable([]),
    trabajos_fuerza: createMockTable([]),
    plantillas_fuerza: createMockTable([]),
    sesiones_fuerza_individual: createMockTable([]),
    plantillas_importacion: {
      put: vi.fn(),
      toArray: vi.fn(() => Promise.resolve([])),
      where: vi.fn(() => ({ count: vi.fn(() => Promise.resolve(0)) })),
    },
  }
})

vi.mock('@/db/database', () => ({
  FutsalDB: class MockFutsalDB {
    version(_v: number) {
      return { stores: vi.fn() }
    }
  },
  db: {
    ...mocks,
    transaction: vi.fn((_mode, _tables, cb) => {
      const fn = typeof _tables === 'function' ? _tables : cb
      return typeof fn === 'function' ? fn() : Promise.resolve()
    }),
  },
}))

vi.mock('@/services/readiness', () => ({
  recalcularReadinessJugadora: vi.fn(() => Promise.resolve()),
}))

describe('wellnessAtomicity - Tests Estructurales/Unitarios (Bloque 2E)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.jugadoras.reset()
    mocks.wellness.reset()
    mocks.readiness.reset()
    mocks.resumen_semanal.reset()
    mocks.ciclo_menstrual.reset()
    mocks.alertas.reset()
    mocks.sesion_rpe.reset()
  })

  it('1. addWellness declara las 6 tablas requeridas', async () => {
    const w = { id_jugadora: 'J1', fecha: '2026-05-12', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 9 }

    await useStore.getState().addWellness(w as any)

    expect(db.transaction).toHaveBeenCalledWith(
      'rw',
      [db.wellness, db.readiness, db.sesion_rpe, db.rpe_partido, db.sesiones, db.jugadoras],
      expect.any(Function),
    )
  })

  it('2. updateWellness declara las 6 tablas requeridas y ejecuta refresco sin warning [4B]', async () => {
    const warnSpy = vi.spyOn(console, 'warn')
    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')

    const w = { id: 10, id_jugadora: 'J1', fecha: '2026-05-10', calidad_sueno: 9, fatiga: 8, dolor_muscular: 7, estres: 6, estado_animo: 8 }

    await useStore.getState().updateWellness(w as any)

    expect(db.transaction).toHaveBeenCalledWith(
      'rw',
      [db.wellness, db.readiness, db.sesion_rpe, db.rpe_partido, db.sesiones, db.jugadoras],
      expect.any(Function),
    )

    const b4Warnings = warnSpy.mock.calls.filter((args) =>
      typeof args[0] === 'string' && args[0].includes('[4B]'),
    )
    warnSpy.mockRestore()

    expect(b4Warnings, 'Inconsistencia [4B] no debe emitirse en el flujo exitoso con readiness existente').toHaveLength(0)
    expect(loadAllSpy, 'loadAll no debe ser invocado cuando el refresco incremental tiene éxito').not.toHaveBeenCalled()
  })

  it('3. loadAll no se invoca tras addWellness y tampoco si la transacción rechaza', async () => {
    const w = { id_jugadora: 'J1', fecha: '2026-05-12', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 9 }
    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')

    await useStore.getState().addWellness(w as any)
    expect(loadAllSpy).not.toHaveBeenCalled()

    loadAllSpy.mockClear()

    vi.mocked(readinessService.recalcularReadinessJugadora).mockRejectedValueOnce(new Error('Fallo en readiness'))
    const w2 = { id_jugadora: 'J1', fecha: '2026-05-13', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 9 }

    await expect(useStore.getState().addWellness(w2 as any)).rejects.toThrow('Fallo en readiness')
    expect(loadAllSpy).not.toHaveBeenCalled()
  })

  it('4. updateWellness sin id rechaza antes de escribir', async () => {
    const w = { id_jugadora: 'J1', fecha: '2026-05-10', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 9 }

    await expect(useStore.getState().updateWellness(w as any)).rejects.toThrow(
      'No se puede actualizar wellness sin identificador',
    )
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('5. updateWellness con id inexistente rechaza sin insertar', async () => {
    const w = { id: 999, id_jugadora: 'J1', fecha: '2026-05-10', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 9 }

    await expect(useStore.getState().updateWellness(w as any)).rejects.toThrow(
      'No existe el registro de wellness a actualizar',
    )
    expect(db.wellness.put).not.toHaveBeenCalled()
  })

  it('6. addWellness con jugadora inexistente rechaza sin insertar', async () => {
    const w = { id_jugadora: 'J_INEXISTENTE', fecha: '2026-05-10', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 9 }

    await expect(useStore.getState().addWellness(w as any)).rejects.toThrow(
      "La jugadora 'J_INEXISTENTE' no existe en la base de datos",
    )
    expect(db.wellness.put).not.toHaveBeenCalled()
  })

  it('7. updateWellness con jugadora destino inexistente rechaza sin modificar', async () => {
    const w = { id: 10, id_jugadora: 'J_INEXISTENTE', fecha: '2026-05-10', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 9 }

    await expect(useStore.getState().updateWellness(w as any)).rejects.toThrow(
      "La jugadora 'J_INEXISTENTE' no existe en la base de datos",
    )
    expect(db.wellness.put).not.toHaveBeenCalled()
  })

  it('8. El flujo pos-commit [2H] no emite error silencioso — el mock cumple el contrato .where().equals().toArray()', async () => {
    const warnSpy = vi.spyOn(console, 'warn')

    const w = { id_jugadora: 'J1', fecha: '2026-05-12', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 9 }
    await useStore.getState().addWellness(w as any)

    const h2Calls = warnSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('[2H]'),
    )
    const equalsErrors = warnSpy.mock.calls.filter((args) =>
      args.some((a) => a instanceof TypeError && String(a).includes('.equals is not a function')),
    )

    warnSpy.mockRestore()

    expect(h2Calls, '[2H] fallo detectado — el mock no cumple el contrato Dexie .where().equals()').toHaveLength(0)
    expect(equalsErrors, 'TypeError de .equals en flujo pos-commit').toHaveLength(0)
  })

  it('9. Demostración de filtrado semántico y aislamiento entre jugadoras (.where().equals())', async () => {
    const j1Wellness = await db.wellness.where('id_jugadora').equals('J1').toArray()
    const j2WellnessFirst = await db.wellness.where('id_jugadora').equals('J2').first()

    expect(j1Wellness).toHaveLength(1)
    expect(j1Wellness[0].id_jugadora).toBe('J1')
    expect(j1Wellness[0].id).toBe(10)

    expect(j2WellnessFirst).toBeDefined()
    expect(j2WellnessFirst?.id_jugadora).toBe('J2')
    expect(j2WellnessFirst?.id).toBe(20)

    const j1Readiness = await db.readiness.where('id_jugadora').equals('J1').toArray()
    expect(j1Readiness).toHaveLength(1)
    expect(j1Readiness[0].id_jugadora).toBe('J1')
    expect(j1Readiness[0].readiness_score).toBe(85)
  })

  it('10. Demostración de consulta por objeto semántica (.where({ id_jugadora, fecha }))', async () => {
    const j1Readiness = await db.readiness.where({ id_jugadora: 'J1', fecha: '2026-05-10' }).first()
    const j2Readiness = await db.readiness.where({ id_jugadora: 'J2', fecha: '2026-05-10' }).first()
    const nonExistent = await db.readiness.where({ id_jugadora: 'J1', fecha: '2099-01-01' }).first()

    expect(j1Readiness).toBeDefined()
    expect(j1Readiness?.readiness_score).toBe(85)

    expect(j2Readiness).toBeDefined()
    expect(j2Readiness?.readiness_score).toBe(92)

    expect(nonExistent).toBeNull()
  })
})
