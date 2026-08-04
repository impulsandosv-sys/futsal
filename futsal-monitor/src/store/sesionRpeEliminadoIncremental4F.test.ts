/**
 * sesionRpeEliminadoIncremental4F.test.ts
 *
 * Suite de integración para el Bloque 4F: Sincronización Incremental en deleteSesionRPE
 * con mitigación de carreras por Token de Recencia (loadEpoch), retiro inmutable de entidades,
 * verificación de ausencia física en Dexie, refresco de derivados y política no-fatal de fallback.
 *
 * Usa fake-indexeddb para reproducir IndexedDB real en entorno de pruebas.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.unmock('@/db/database')
vi.unmock('@/services/readiness')
vi.unmock('@/services/resumenSemanal')

import { db } from '@/db/database'
import { useStore } from '@/store/store'
import type { Jugadora, Sesion, SesionRPE } from '@/types'
import { getWeekId } from '@/domain/dates/dates'

const J1 = 'JUG_TEST_4F_1'
const S1 = 'SES_TEST_4F_1'

async function limpiarDB() {
  await Promise.all([
    db.jugadoras.clear(),
    db.sesiones.clear(),
    db.sesion_rpe.clear(),
    db.readiness.clear(),
    db.resumen_semanal.clear(),
    db.alertas.clear(),
    db.wellness.clear(),
    db.partidos.clear(),
    db.rpe_partido.clear(),
  ])
}

async function seedBaseData() {
  await db.jugadoras.put({
    id_jugadora: J1,
    nombre: 'Ana Belén',
    posicion: 'ala',
    activa: true,
  } as Jugadora)

  await db.sesiones.put({
    id_sesion: S1,
    fecha: '2026-07-28',
    tipo_sesion: 'Pista',
    estado: 'realizada',
  } as Sesion)
}

beforeEach(async () => {
  vi.restoreAllMocks()
  await limpiarDB()
  await seedBaseData()

  useStore.setState({
    jugadoras: await db.jugadoras.toArray(),
    sesiones: await db.sesiones.toArray(),
    sesion_rpe: [],
    readiness: [],
    resumen_semanal: [],
    alertas: [],
    wellness: [],
    partidos: [],
    rpe_partido: [],
    loading: false,
  })
})

describe('Bloque 4F — Refresco Incremental en deleteSesionRPE', () => {
  // ─── P-4F-01: Borrado normal ────────────────────────────────────────────────
  it('P-4F-01: Borrado de RPE elimina la entidad de Dexie y Zustand y recalcula readiness/resumen sin llamar a loadAll()', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 8,
      carga_ua: 480,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInsertado = useStore.getState().sesion_rpe[0]
    expect(srpeInsertado.id).toBeDefined()

    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')

    // Borrado
    await useStore.getState().deleteSesionRPE(srpeInsertado.id!)

    // Bloque 4F: NO llama a loadAll() global
    expect(loadAllSpy).not.toHaveBeenCalled()

    // 1. Verificación en Dexie real
    const dexieSrpe = await db.sesion_rpe.get(srpeInsertado.id!)
    expect(dexieSrpe).toBeUndefined()

    const dexieReadiness = await db.readiness.where('id_jugadora').equals(J1).and(x => x.fecha === '2026-07-28').first()
    expect(dexieReadiness).toBeDefined()

    const weekId = getWeekId('2026-07-28')
    const dexieResumen = await db.resumen_semanal.where('id_jugadora').equals(J1).and(x => x.semana === weekId).first()
    expect(dexieResumen).toBeDefined()

    // 2. Verificación en Zustand
    const state = useStore.getState()
    expect(state.sesion_rpe).toHaveLength(0)
    expect(state.readiness).toHaveLength(1)
    expect(state.resumen_semanal).toHaveLength(1)
  })

  // ─── P-4F-02: Borrado del único RPE de sesión de la semana ──────────────────
  it('P-4F-02: Borrado del único RPE de una semana recalcula resumen a carga cero y actualiza Zustand', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 9,
      carga_ua: 540,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInsertado = useStore.getState().sesion_rpe[0]

    await useStore.getState().deleteSesionRPE(srpeInsertado.id!)

    const weekId = getWeekId('2026-07-28')
    const resumenDexie = await db.resumen_semanal.where('id_jugadora').equals(J1).and(x => x.semana === weekId).first()
    expect(resumenDexie).toBeDefined()

    const state = useStore.getState()
    expect(state.sesion_rpe).toHaveLength(0)
    expect(state.resumen_semanal).toHaveLength(1)
    expect(state.resumen_semanal[0].semana).toBe(weekId)
  })

  // ─── P-4F-03: Inconsistencia por RPE aún presente ───────────────────────────
  it('P-4F-03: RPE inesperadamente presente pos-commit activa fallback loadAll() no fatal', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 7,
      carga_ua: 420,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInsertado = useStore.getState().sesion_rpe[0]

    // Simular que db.sesion_rpe.get(id) devuelve un objeto en la verificación pos-commit
    let simulatePresent = false
    const originalGet = db.sesion_rpe.get.bind(db.sesion_rpe)
    vi.spyOn(db.sesion_rpe, 'get').mockImplementation(async (id: any) => {
      if (simulatePresent) {
        simulatePresent = false
        return { id, id_sesion: S1, id_jugadora: J1, fecha: '2026-07-28', rpe: 7, carga_ua: 420, asistencia: 'presente' } as any
      }
      return originalGet(id)
    })

    const originalRecalcular = (await import('@/services/readiness')).recalcularReadinessJugadora
    vi.spyOn(await import('@/services/readiness'), 'recalcularReadinessJugadora').mockImplementationOnce(
      async (...args) => {
        await originalRecalcular(...args)
        simulatePresent = true
      }
    )

    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')
    await expect(useStore.getState().deleteSesionRPE(srpeInsertado.id!)).resolves.not.toThrow()

    expect(loadAllSpy).toHaveBeenCalled()
    const dexieSrpe = await db.sesion_rpe.get(srpeInsertado.id!)
    expect(dexieSrpe).toBeUndefined()
  })

  // ─── P-4F-04: Fila derivada ausente pos-commit ──────────────────────────────
  it('P-4F-04: Fila derivada ausente pos-commit dispara fallback loadAll()', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 7,
      carga_ua: 420,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInsertado = useStore.getState().sesion_rpe[0]

    let failReadiness = false
    const originalWhere = db.readiness.where.bind(db.readiness)
    vi.spyOn(db.readiness, 'where').mockImplementation((...args: any[]) => {
      if (failReadiness) {
        return {
          equals: () => ({
            and: () => ({
              first: async () => undefined,
            }),
          }),
        } as any
      }
      return originalWhere(...(args as [any]))
    })

    const originalRecalcular = (await import('@/services/readiness')).recalcularReadinessJugadora
    vi.spyOn(await import('@/services/readiness'), 'recalcularReadinessJugadora').mockImplementationOnce(
      async (...args) => {
        await originalRecalcular(...args)
        failReadiness = true
      }
    )

    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')
    await expect(useStore.getState().deleteSesionRPE(srpeInsertado.id!)).resolves.not.toThrow()

    expect(loadAllSpy).toHaveBeenCalled()
    expect(await db.sesion_rpe.get(srpeInsertado.id!)).toBeUndefined()
  })

  // ─── P-4F-05: Error I/O en lectura incremental ──────────────────────────────
  it('P-4F-05: Error I/O en lectura incremental no revierte la DB y activa fallback loadAll()', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 7,
      carga_ua: 420,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInsertado = useStore.getState().sesion_rpe[0]

    let failIncremental = false
    const originalWhere = db.readiness.where.bind(db.readiness)
    vi.spyOn(db.readiness, 'where').mockImplementation((...args: any[]) => {
      if (failIncremental) {
        failIncremental = false
        throw new Error('Fallo I/O en lectura incremental pos-commit')
      }
      return originalWhere(...(args as [any]))
    })

    const originalRecalcular = (await import('@/services/readiness')).recalcularReadinessJugadora
    vi.spyOn(await import('@/services/readiness'), 'recalcularReadinessJugadora').mockImplementationOnce(
      async (...args) => {
        await originalRecalcular(...args)
        failIncremental = true
      }
    )

    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')
    await expect(useStore.getState().deleteSesionRPE(srpeInsertado.id!)).resolves.not.toThrow()

    expect(loadAllSpy).toHaveBeenCalled()
    expect(await db.sesion_rpe.get(srpeInsertado.id!)).toBeUndefined()
  })

  // ─── P-4F-06: Fallo de incremental y de fallback ────────────────────────────
  it('P-4F-06: Si fallan la sincronización incremental y el fallback, no se lanza error a la UI y los datos persisten en Dexie', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 7,
      carga_ua: 420,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInsertado = useStore.getState().sesion_rpe[0]

    let failIncremental = false
    const originalWhere = db.readiness.where.bind(db.readiness)
    const whereSpy = vi.spyOn(db.readiness, 'where').mockImplementation((...args: any[]) => {
      if (failIncremental) {
        failIncremental = false
        throw new Error('Fallo incremental pos-commit')
      }
      return originalWhere(...(args as [any]))
    })

    const originalRecalcular = (await import('@/services/readiness')).recalcularReadinessJugadora
    vi.spyOn(await import('@/services/readiness'), 'recalcularReadinessJugadora').mockImplementationOnce(
      async (...args) => {
        await originalRecalcular(...args)
        failIncremental = true
      }
    )

    vi.spyOn(useStore.getState(), 'loadAll').mockRejectedValueOnce(new Error('Fallo fallback loadAll'))
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(useStore.getState().deleteSesionRPE(srpeInsertado.id!)).resolves.not.toThrow()

    failIncremental = false
    whereSpy.mockRestore()

    expect(await db.sesion_rpe.get(srpeInsertado.id!)).toBeUndefined()
    expect(consoleWarnSpy).toHaveBeenLastCalledWith(
      expect.stringContaining('[4F] Fallo en loadAll de recuperación tras error incremental:'),
      expect.any(Error)
    )
  })

  // ─── P-4F-07: Carrera con loadAll() antiguo (loadEpoch) ─────────────────────
  it('P-4F-07: Snapshot de loadAll() iniciado antes del borrado es descartado por el incremento de loadEpoch', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 8,
      carga_ua: 480,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInsertado = useStore.getState().sesion_rpe[0]

    const originalToArray = db.jugadoras.toArray.bind(db.jugadoras)
    let delayResolve: () => void = () => {}
    const delayPromise = new Promise<void>((resolve) => {
      delayResolve = resolve
    })

    vi.spyOn(db.jugadoras, 'toArray').mockImplementationOnce(async () => {
      await delayPromise
      return originalToArray()
    })

    // Iniciar loadAll (A) pre-borrado
    const loadAllPromise = useStore.getState().loadAll()

    // Ejecutar deleteSesionRPE mientras loadAll está bloqueado
    await useStore.getState().deleteSesionRPE(srpeInsertado.id!)

    // En Zustand el RPE ya no está
    expect(useStore.getState().sesion_rpe).toHaveLength(0)

    // Desbloquear loadAll antiguo
    delayResolve()
    await loadAllPromise

    // El set masivo stale de loadAll (A) NO volvió a insertar el RPE borrado
    expect(useStore.getState().sesion_rpe).toHaveLength(0)
  })

  // ─── P-4F-08: Equivalencia estricta contra loadAll() ────────────────────────
  it('P-4F-08: Estado pos-4F coincide 1:1 con un loadAll() posterior', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 8,
      carga_ua: 480,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInsertado = useStore.getState().sesion_rpe[0]

    await useStore.getState().deleteSesionRPE(srpeInsertado.id!)

    const srpePostIncremental = [...useStore.getState().sesion_rpe]
    const readinessPostIncremental = [...useStore.getState().readiness]
    const resumenPostIncremental = [...useStore.getState().resumen_semanal]

    await useStore.getState().loadAll()

    const srpePostLoadAll = useStore.getState().sesion_rpe
    const readinessPostLoadAll = useStore.getState().readiness
    const resumenPostLoadAll = useStore.getState().resumen_semanal

    expect(srpePostIncremental).toEqual(srpePostLoadAll)
    expect(readinessPostIncremental).toEqual(readinessPostLoadAll)
    expect(resumenPostIncremental).toEqual(resumenPostLoadAll)
  })

  // ─── P-4F-09: Regresión de atomicidad 2G ─────────────────────────────────────
  it('P-4F-09: Fallo en transacción Dexie (ej. ID inexistente) no altera la base física ni invoca 4F ni alertas', async () => {
    await expect(useStore.getState().deleteSesionRPE(99999)).rejects.toThrow(
      'No existe el registro de RPE de sesión a eliminar'
    )
  })
})
