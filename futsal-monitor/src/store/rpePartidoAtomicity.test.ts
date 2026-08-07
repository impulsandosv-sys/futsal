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
    jugadoras: {
      get: vi.fn((id: string) => {
        if (id === 'J1' || id === 'J2' || id === 'J_DUPLICADA') {
          return Promise.resolve({ id_jugadora: id, nombre: 'Jugadora Test' })
        }
        return Promise.resolve(null)
      }),
      toArray: vi.fn(() => Promise.resolve([
        { id_jugadora: 'J1', nombre: 'Jugadora 1' },
        { id_jugadora: 'J2', nombre: 'Jugadora 2' },
      ])),
    },
    partidos: {
      get: vi.fn((id: string) => {
        if (id === 'P1' || id === 'P2') {
          return Promise.resolve({ id_partido: id, fecha: '2026-05-10', rival: 'Rival FC' })
        }
        if (id === 'P_SIN_FECHA') {
          return Promise.resolve({ id_partido: id, fecha: '', rival: 'Sin Fecha FC' })
        }
        return Promise.resolve(null)
      }),
      toArray: vi.fn(() => Promise.resolve([])),
    },
    rpe_partido: {
      put: vi.fn(() => Promise.resolve(1)),
      toArray: vi.fn(() => Promise.resolve([])),
      where: vi.fn((q: any) => {
        const res = {
          equals: vi.fn(() => res),
          and: vi.fn(() => res),
          first: vi.fn(() => {
            if (q && q.id_partido === 'P1' && q.id_jugadora === 'J_DUPLICADA') {
              return Promise.resolve({ id: 99, id_partido: 'P1', id_jugadora: 'J_DUPLICADA', rpe: 7 })
            }
            return Promise.resolve(null)
          }),
          toArray: vi.fn(() => Promise.resolve([])),
        }
        return res
      }),
    },
    wellness: {
      toArray: vi.fn(() => Promise.resolve([])),
      where: vi.fn(() => {
        const res = {
          equals: vi.fn(() => res),
          toArray: vi.fn(() => Promise.resolve([])),
        }
        return res
      }),
    },
    sesiones: { toArray: vi.fn(() => Promise.resolve([])) },
    lesiones: { toArray: vi.fn(() => Promise.resolve([])) },
    tests_fisicos: { toArray: vi.fn(() => Promise.resolve([])) },
    resumen_semanal: {
      put: vi.fn(),
      toArray: vi.fn(() => Promise.resolve([])),
      where: vi.fn(() => {
        const res = {
          equals: vi.fn(() => res),
          and: vi.fn(() => res),
          first: vi.fn(() => Promise.resolve(null)),
          toArray: vi.fn(() => Promise.resolve([])),
        }
        return res
      }),
    },
    alertas: { put: vi.fn(), toArray: vi.fn(() => Promise.resolve([])) },
    sesion_rpe: {
      put: vi.fn(),
      bulkPut: vi.fn(() => Promise.resolve()),
      toArray: vi.fn(() => Promise.resolve([])),
      where: vi.fn(() => {
        const res = {
          equals: vi.fn(() => res),
          and: vi.fn(() => res),
          toArray: vi.fn(() => Promise.resolve([])),
        }
        return res
      }),
    },
    readiness: {
      put: vi.fn(),
      toArray: vi.fn(() => Promise.resolve([])),
      where: vi.fn(() => {
        const res = {
          equals: vi.fn(() => res),
          and: vi.fn(() => res),
          first: vi.fn(() => Promise.resolve(null)),
          toArray: vi.fn(() => Promise.resolve([])),
        }
        return res
      }),
    },
    historial_importaciones: { toArray: vi.fn(() => Promise.resolve([])) },
    historial_copias: { toArray: vi.fn(() => Promise.resolve([])) },
    ciclo_menstrual: {
      toArray: vi.fn(() => Promise.resolve([])),
      where: vi.fn(() => {
        const res = {
          equals: vi.fn(() => res),
          toArray: vi.fn(() => Promise.resolve([])),
        }
        return res
      }),
    },
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
    transaction: vi.fn((_mode, _tables, cb) => {
      const fn = typeof _tables === 'function' ? _tables : cb
      return typeof fn === 'function' ? fn() : Promise.resolve()
    }),
  },
}))

vi.mock('@/services/resumenSemanal', () => ({
  recalcularResumenSemanal: vi.fn(() => Promise.resolve(null)),
  recalcularTodosLosResumenes: vi.fn(() => Promise.resolve()),
  limpiarResumenesAnteriores: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/services/readiness', () => ({
  recalcularReadinessJugadora: vi.fn(() => Promise.resolve()),
}))

describe('addRPE_Partido - Tests Estructurales/Unitarios (Bloque 2F)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. Datos inválidos rechazan antes de abrir transacción y sin escrituras', async () => {
    const invalidRpe = { id_partido: '', id_jugadora: 'J1', rpe: 15, minutos_jugados: 60 } // RPE fuera de rango

    await expect(useStore.getState().addRPE_Partido(invalidRpe as any)).rejects.toThrow()
    expect(db.transaction).not.toHaveBeenCalled()
    expect(db.rpe_partido.put).not.toHaveBeenCalled()
  })

  it('2. Jugadora inexistente rechaza sin abrir escritura ni derivados', async () => {
    const rpe = { id_partido: 'P1', id_jugadora: 'INEXISTENTE', fecha: '2026-05-10', rpe: 7, minutos_jugados: 20 }

    await expect(useStore.getState().addRPE_Partido(rpe as any)).rejects.toThrow(
      "La jugadora 'INEXISTENTE' no existe en la base de datos"
    )
    expect(db.rpe_partido.put).not.toHaveBeenCalled()
  })

  it('3. Partido inexistente rechaza sin abrir escritura ni derivados', async () => {
    const rpe = { id_partido: 'P_INEXISTENTE', id_jugadora: 'J1', fecha: '2026-05-10', rpe: 7, minutos_jugados: 20 }

    await expect(useStore.getState().addRPE_Partido(rpe as any)).rejects.toThrow(
      "El partido 'P_INEXISTENTE' no existe en la base de datos"
    )
    expect(db.rpe_partido.put).not.toHaveBeenCalled()
  })

  it('4. Duplicado lógico (id_partido, id_jugadora) rechaza sin escribir', async () => {
    const rpe = { id_partido: 'P1', id_jugadora: 'J_DUPLICADA', fecha: '2026-05-10', rpe: 7, minutos_jugados: 20 }

    await expect(useStore.getState().addRPE_Partido(rpe as any)).rejects.toThrow(
      'Ya existe un registro de RPE de partido para esta jugadora en este partido'
    )
    expect(db.rpe_partido.put).not.toHaveBeenCalled()
  })

  it('5. Éxito: declara exactamente las 8 tablas requeridas en la transacción Dexie', async () => {
    const rpe = { id_partido: 'P1', id_jugadora: 'J1', fecha: '2026-05-10', rpe: 7, minutos_jugados: 20,
      participacion: 'parcial',
      participacion_inferida: true, carga_ua: 140 }

    await useStore.getState().addRPE_Partido(rpe as any)

    expect(db.transaction).toHaveBeenCalledWith(
      'rw',
      [
        db.rpe_partido,
        db.resumen_semanal,
        db.readiness,
        db.sesiones,
        db.partidos,
        db.sesion_rpe,
        db.wellness,
        db.jugadoras,
      ],
      expect.any(Function)
    )

    expect(db.rpe_partido.put).toHaveBeenCalledWith({
      id_partido: 'P1',
      id_jugadora: 'J1',
      fecha: '2026-05-10',
      rpe: 7,
      minutos_jugados: 20,
      participacion: 'parcial',
      participacion_inferida: true,
      carga_ua: 140,
    })
    expect(resumenService.recalcularResumenSemanal).toHaveBeenCalledWith('J1', '2026-05-10', expect.any(Object))
    expect(readinessService.recalcularReadinessJugadora).toHaveBeenCalledWith('J1', '2026-05-10')
  })

  it('6 & 7. loadAll se invoca una vez pos-commit (Bloque 2H) y no se llama si la transacción rechaza', async () => {
    const rpe = { id_partido: 'P1', id_jugadora: 'J1', fecha: '2026-05-10', rpe: 7, minutos_jugados: 20 }
    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')

    await useStore.getState().addRPE_Partido(rpe as any)
    // Bloque 2H: el segundo loadAll global fue eliminado.
    // Solo se llama una vez (post-commit); alertas se sincronizan selectivamente.
    expect(loadAllSpy).toHaveBeenCalledTimes(1)

    loadAllSpy.mockClear()

    vi.mocked(readinessService.recalcularReadinessJugadora).mockRejectedValueOnce(new Error('Fallo simulado en readiness'))
    const rpeFallo = { id_partido: 'P2', id_jugadora: 'J2', fecha: '2026-05-10', rpe: 8, minutos_jugados: 30 }

    await expect(useStore.getState().addRPE_Partido(rpeFallo as any)).rejects.toThrow('Fallo simulado en readiness')
    expect(loadAllSpy).not.toHaveBeenCalled()
  })

  it('8. Fecha propia prioritaria: con r.fecha informada y distinta de match.fecha, se usa r.fecha', async () => {
    const rpe = { id_partido: 'P1', id_jugadora: 'J1', fecha: '2026-05-20', rpe: 7, minutos_jugados: 20 }

    await useStore.getState().addRPE_Partido(rpe as any)

    expect(db.rpe_partido.put).toHaveBeenCalledWith(expect.objectContaining({ fecha: '2026-05-20' }))
    expect(resumenService.recalcularResumenSemanal).toHaveBeenCalledWith('J1', '2026-05-20', expect.any(Object))
    expect(readinessService.recalcularReadinessJugadora).toHaveBeenCalledWith('J1', '2026-05-20')
  })

  it('9. Fecha heredada del partido: con r.fecha vacía y match.fecha válida, se usa match.fecha', async () => {
    const rpe = { id_partido: 'P1', id_jugadora: 'J1', fecha: '', rpe: 7, minutos_jugados: 20 }

    await useStore.getState().addRPE_Partido(rpe as any)

    expect(db.rpe_partido.put).toHaveBeenCalledWith(expect.objectContaining({ fecha: '2026-05-10' }))
    expect(resumenService.recalcularResumenSemanal).toHaveBeenCalledWith('J1', '2026-05-10', expect.any(Object))
    expect(readinessService.recalcularReadinessJugadora).toHaveBeenCalledWith('J1', '2026-05-10')
  })

  it('10. Ambas fechas vacías: con r.fecha vacía y match.fecha vacía, rechaza antes de escribir', async () => {
    const rpe = { id_partido: 'P_SIN_FECHA', id_jugadora: 'J1', fecha: '', rpe: 7, minutos_jugados: 20 }

    await expect(useStore.getState().addRPE_Partido(rpe as any)).rejects.toThrow(
      'No se pudo determinar la fecha del RPE de partido'
    )
    expect(db.rpe_partido.put).not.toHaveBeenCalled()
    expect(resumenService.recalcularResumenSemanal).not.toHaveBeenCalled()
    expect(readinessService.recalcularReadinessJugadora).not.toHaveBeenCalled()
  })
})
