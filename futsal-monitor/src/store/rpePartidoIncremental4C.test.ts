/**
 * rpePartidoIncremental4C.test.ts
 *
 * Suite de integración para el Bloque 4C: Sincronización Incremental en addRPE_Partido
 * con mitigación de carreras por Token de Recencia (loadEpoch), ordenación equivalente a loadAll(),
 * soporte para fecha explícita/heredada del partido, actualización de resumen semanal y política no-fatal de fallback.
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
import type { Jugadora, Partido, RPE_Partido } from '@/types'
import { getWeekId } from '@/domain/dates/dates'

const J1 = 'JUG_TEST_4C_1'
const J2 = 'JUG_TEST_4C_2'
const P1 = 'PAR_TEST_4C_1'
const P2 = 'PAR_TEST_4C_2'

async function limpiarDB() {
  await Promise.all([
    db.jugadoras.clear(),
    db.partidos.clear(),
    db.rpe_partido.clear(),
    db.readiness.clear(),
    db.resumen_semanal.clear(),
    db.alertas.clear(),
    db.wellness.clear(),
    db.sesion_rpe.clear(),
    db.sesiones.clear(),
  ])
}

async function seedBaseData() {
  await db.jugadoras.put({
    id_jugadora: J1,
    nombre: 'Laura Pérez',
    posicion: 'pívot',
    activa: true,
  } as Jugadora)

  await db.jugadoras.put({
    id_jugadora: J2,
    nombre: 'Carmen Ruíz',
    posicion: 'cierre',
    activa: true,
  } as Jugadora)

  await db.partidos.put({
    id_partido: P1,
    fecha: '2026-07-28',
    rival: 'Rival A',
    lugar: 'Local',
    goles_favor: 3,
    goles_contra: 1,
  } as Partido)

  await db.partidos.put({
    id_partido: P2,
    fecha: '2026-08-02',
    rival: 'Rival B',
    lugar: 'Visitante',
    goles_favor: 2,
    goles_contra: 2,
  } as Partido)
}

const makeRPEPayload = (idPartido: string, jugadoraId: string, fecha?: string, rpe: number = 7, min: number = 30): RPE_Partido => ({
  id_partido: idPartido,
  id_jugadora: jugadoraId,
  fecha: fecha || '',
  rpe_subjetivo: rpe,
  minutos_jugados: min,
  carga_total: rpe * min,
})

beforeEach(async () => {
  vi.restoreAllMocks()
  await limpiarDB()
  await seedBaseData()

  useStore.setState({
    jugadoras: await db.jugadoras.toArray(),
    partidos: await db.partidos.toArray(),
    rpe_partido: [],
    readiness: [],
    resumen_semanal: [],
    alertas: [],
    wellness: [],
    sesion_rpe: [],
    sesiones: [],
    loading: false,
  })
})

describe('Bloque 4C — Refresco Incremental en addRPE_Partido', () => {
  // ─── P-4C-01: Alta correcta con fecha explícita ──────────────────────────────
  it('P-4C-01: Alta de RPE de partido con fecha explícita actualiza rpe_partido, readiness y resumen_semanal en Dexie y Zustand con orden correcto', async () => {
    const payload = makeRPEPayload(P1, J1, '2026-07-28', 8, 35)
    const weekId = getWeekId('2026-07-28')
    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')

    await useStore.getState().addRPE_Partido(payload)

    // Bloque 4C: NO llama a loadAll() global
    expect(loadAllSpy).not.toHaveBeenCalled()

    // 1. Verificación en Dexie real
    const dexieRpe = await db.rpe_partido.where('id_partido').equals(P1).and(x => x.id_jugadora === J1).first()
    expect(dexieRpe).toBeDefined()
    expect(dexieRpe?.fecha).toBe('2026-07-28')

    const dexieReadiness = await db.readiness.where('id_jugadora').equals(J1).and(x => x.fecha === '2026-07-28').first()
    expect(dexieReadiness).toBeDefined()

    const dexieResumen = await db.resumen_semanal.where('id_jugadora').equals(J1).and(x => x.semana === weekId).first()
    expect(dexieResumen).toBeDefined()

    // 2. Verificación en Zustand
    const state = useStore.getState()
    expect(state.rpe_partido).toHaveLength(1)
    expect(state.readiness).toHaveLength(1)
    expect(state.resumen_semanal).toHaveLength(1)

    expect(state.rpe_partido[0].id_partido).toBe(P1)
    expect(state.rpe_partido[0].id_jugadora).toBe(J1)
    expect(state.readiness[0].id_jugadora).toBe(J1)
    expect(state.resumen_semanal[0].semana).toBe(weekId)
  })

  // ─── P-4C-02: Alta heredando fecha del partido ───────────────────────────────
  it('P-4C-02: Alta omitiendo r.fecha hereda match.fecha y sincroniza correctamente readiness y resumen semanal', async () => {
    const payload = makeRPEPayload(P1, J1, '', 6, 20)
    const weekId = getWeekId('2026-07-28')

    await useStore.getState().addRPE_Partido(payload)

    const dexieRpe = await db.rpe_partido.where('id_partido').equals(P1).and(x => x.id_jugadora === J1).first()
    expect(dexieRpe?.fecha).toBe('2026-07-28')

    const state = useStore.getState()
    expect(state.rpe_partido[0].fecha).toBe('2026-07-28')
    expect(state.readiness[0].fecha).toBe('2026-07-28')
    expect(state.resumen_semanal[0].semana).toBe(weekId)
  })

  // ─── P-4C-03: Resumen semanal preexistente ───────────────────────────────────
  it('P-4C-03: Alta en semana con resumen preexistente actualiza el resumen en Zustand sin duplicar la fila', async () => {
    const weekId = getWeekId('2026-07-28')
    // Seed resumen inicial
    await db.resumen_semanal.put({
      id_jugadora: J1,
      semana: weekId,
      acwr: 1.0,
      carga_aguda: 100,
      carga_cronica: 100,
      carga_semanal: 100,
      monotonia: 1,
      tension: 100,
      completado: true,
    })
    useStore.setState({ resumen_semanal: await db.resumen_semanal.toArray() })

    const payload = makeRPEPayload(P1, J1, '2026-07-28', 9, 40)
    await useStore.getState().addRPE_Partido(payload)

    const resumenesDexie = await db.resumen_semanal.where('id_jugadora').equals(J1).and(x => x.semana === weekId).toArray()
    expect(resumenesDexie).toHaveLength(1)

    const resumenesStore = useStore.getState().resumen_semanal
    expect(resumenesStore).toHaveLength(1)
    expect(resumenesStore[0].semana).toBe(weekId)
  })

  // ─── P-4C-04: Fila esperada ausente tras commit ──────────────────────────────
  it('P-4C-04: Fila esperada ausente pos-commit dispara fallback loadAll() de recuperación no fatal', async () => {
    const payload = makeRPEPayload(P1, J1, '2026-07-28', 7, 30)

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
    await expect(useStore.getState().addRPE_Partido(payload)).resolves.not.toThrow()

    expect(loadAllSpy).toHaveBeenCalled()

    const dexieRpe = await db.rpe_partido.where('id_partido').equals(P1).and(x => x.id_jugadora === J1).first()
    expect(dexieRpe).toBeDefined()
  })

  // ─── P-4C-05: Fallo de lectura incremental ──────────────────────────────────
  it('P-4C-05: Error I/O en lectura incremental no revierte la DB y activa fallback loadAll()', async () => {
    const payload = makeRPEPayload(P1, J1, '2026-07-28', 7, 30)

    let failIncremental = false
    const originalWhere = db.rpe_partido.where.bind(db.rpe_partido)
    vi.spyOn(db.rpe_partido, 'where').mockImplementation((...args: any[]) => {
      if (failIncremental) {
        failIncremental = false
        throw new Error('Fallo I/O en consulta incremental pos-commit')
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
    await expect(useStore.getState().addRPE_Partido(payload)).resolves.not.toThrow()

    expect(loadAllSpy).toHaveBeenCalled()
    const dexieRpe = await db.rpe_partido.where('id_partido').equals(P1).and(x => x.id_jugadora === J1).first()
    expect(dexieRpe).toBeDefined()
  })

  // ─── P-4C-06: Fallo de incremental y de fallback ────────────────────────────
  it('P-4C-06: Si fallan la sincronización incremental y el fallback, no se lanza error a la UI y los datos persisten en Dexie', async () => {
    const payload = makeRPEPayload(P1, J1, '2026-07-28', 7, 30)

    let failIncremental = false
    const originalWhere = db.rpe_partido.where.bind(db.rpe_partido)
    const whereSpy = vi.spyOn(db.rpe_partido, 'where').mockImplementation((...args: any[]) => {
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

    await expect(useStore.getState().addRPE_Partido(payload)).resolves.not.toThrow()

    failIncremental = false
    whereSpy.mockRestore()

    const dexieRpe = await db.rpe_partido.where('id_partido').equals(P1).and(x => x.id_jugadora === J1).first()
    expect(dexieRpe).toBeDefined()
    expect(consoleWarnSpy).toHaveBeenLastCalledWith(
      expect.stringContaining('[4C] Fallo en loadAll de recuperación tras error incremental:'),
      expect.any(Error)
    )
  })

  // ─── P-4C-07: Carrera con loadAll() antiguo (loadEpoch) ─────────────────────
  it('P-4C-07: Snapshot de loadAll() iniciado antes del commit es descartado por el incremento de loadEpoch', async () => {
    const originalToArray = db.jugadoras.toArray.bind(db.jugadoras)

    let delayResolve: () => void = () => {}
    const delayPromise = new Promise<void>((resolve) => {
      delayResolve = resolve
    })

    vi.spyOn(db.jugadoras, 'toArray').mockImplementationOnce(async () => {
      await delayPromise
      return originalToArray()
    })

    // Iniciar loadAll (A) antes del commit
    const loadAllPromise = useStore.getState().loadAll()

    // Ejecutar addRPE_Partido (B) mientras loadAll (A) está en curso
    const payload = makeRPEPayload(P1, J1, '2026-07-28', 8, 30)
    await useStore.getState().addRPE_Partido(payload)

    // El estado de Zustand ya debe tener el registro por 4C
    expect(useStore.getState().rpe_partido).toHaveLength(1)

    // Desbloquear loadAll (A)
    delayResolve()
    await loadAllPromise

    // Verificar que el loadAll (A) antiguo NO pisó Zustand
    expect(useStore.getState().rpe_partido).toHaveLength(1)
  })

  // ─── P-4C-08: Equivalencia estricta contra loadAll() ────────────────────────
  it('P-4C-08: Estado pos-4C produce coincidencia estricta 1:1 con un loadAll() posterior', async () => {
    const payload = makeRPEPayload(P1, J1, '2026-07-28', 8, 35)
    await useStore.getState().addRPE_Partido(payload)

    const rpePostIncremental = [...useStore.getState().rpe_partido]
    const readinessPostIncremental = [...useStore.getState().readiness]
    const resumenPostIncremental = [...useStore.getState().resumen_semanal]

    await useStore.getState().loadAll()

    const rpePostLoadAll = useStore.getState().rpe_partido
    const readinessPostLoadAll = useStore.getState().readiness
    const resumenPostLoadAll = useStore.getState().resumen_semanal

    expect(rpePostIncremental).toEqual(rpePostLoadAll)
    expect(readinessPostIncremental).toEqual(readinessPostLoadAll)
    expect(resumenPostIncremental).toEqual(resumenPostLoadAll)
  })

  // ─── P-4C-09: Regresión de atomicidad 2F ─────────────────────────────────────
  it('P-4C-09: Fallo en transacción Dexie (ej. duplicado) mantiene rollback físico y no ejecuta 4C ni alertas', async () => {
    const payload = makeRPEPayload(P1, J1, '2026-07-28', 7, 30)
    await useStore.getState().addRPE_Partido(payload)

    // Intentar alta duplicada del mismo RPE (mismo partido y jugadora)
    const duplicatePayload = makeRPEPayload(P1, J1, '2026-07-28', 9, 40)
    await expect(useStore.getState().addRPE_Partido(duplicatePayload)).rejects.toThrow(
      'Ya existe un registro de RPE de partido para esta jugadora en este partido'
    )

    const count = await db.rpe_partido.where('id_partido').equals(P1).and(x => x.id_jugadora === J1).count()
    expect(count).toBe(1)
  })
})
