/**
 * sesionRpeIncremental4D.test.ts
 *
 * Suite de integración para el Bloque 4D: Sincronización Incremental en addSesionRPE
 * con mitigación de carreras por Token de Recencia (loadEpoch), ordenación equivalente a loadAll(),
 * soporte para fecha explícita/heredada de la sesión, actualización de resumen semanal y política no-fatal de fallback.
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

const J1 = 'JUG_TEST_4D_1'
const J2 = 'JUG_TEST_4D_2'
const S1 = 'SES_TEST_4D_1'
const S2 = 'SES_TEST_4D_2'

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

  await db.jugadoras.put({
    id_jugadora: J2,
    nombre: 'Clara Ríos',
    posicion: 'cierre',
    activa: true,
  } as Jugadora)

  await db.sesiones.put({
    id_sesion: S1,
    fecha: '2026-07-28',
    tipo_sesion: 'Pista',
    estado: 'realizada',
  } as Sesion)

  await db.sesiones.put({
    id_sesion: S2,
    fecha: '2026-08-02',
    tipo_sesion: 'Gimnasio',
    estado: 'realizada',
  } as Sesion)
}

const makeSesionRPEPayload = (idSesion: string, jugadoraId: string, fecha?: string, rpe: number = 7, duracion: number = 60): SesionRPE => ({
  id_sesion: idSesion,
  id_jugadora: jugadoraId,
  fecha: fecha || '',
  rpe: rpe,
  carga_ua: rpe * duracion,
  asistencia: 'presente',
})

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

describe('Bloque 4D — Refresco Incremental en addSesionRPE', () => {
  // ─── P-4D-01: Alta correcta con fecha explícita ──────────────────────────────
  it('P-4D-01: Alta de RPE de sesión con fecha explícita actualiza sesion_rpe, readiness y resumen_semanal en Dexie y Zustand con orden correcto', async () => {
    const payload = makeSesionRPEPayload(S1, J1, '2026-07-28', 8, 45)
    const weekId = getWeekId('2026-07-28')
    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')

    await useStore.getState().addSesionRPE(payload)

    // Bloque 4D: NO llama a loadAll() global
    expect(loadAllSpy).not.toHaveBeenCalled()

    // 1. Verificación en Dexie real
    const dexieSrpe = await db.sesion_rpe.where('id_sesion').equals(S1).and(x => x.id_jugadora === J1).first()
    expect(dexieSrpe).toBeDefined()
    expect(dexieSrpe?.fecha).toBe('2026-07-28')

    const dexieReadiness = await db.readiness.where('id_jugadora').equals(J1).and(x => x.fecha === '2026-07-28').first()
    expect(dexieReadiness).toBeDefined()

    const dexieResumen = await db.resumen_semanal.where('id_jugadora').equals(J1).and(x => x.semana === weekId).first()
    expect(dexieResumen).toBeDefined()

    // 2. Verificación en Zustand
    const state = useStore.getState()
    expect(state.sesion_rpe).toHaveLength(1)
    expect(state.readiness).toHaveLength(1)
    expect(state.resumen_semanal).toHaveLength(1)

    expect(state.sesion_rpe[0].id_sesion).toBe(S1)
    expect(state.sesion_rpe[0].id_jugadora).toBe(J1)
    expect(state.readiness[0].id_jugadora).toBe(J1)
    expect(state.resumen_semanal[0].semana).toBe(weekId)
  })

  // ─── P-4D-02: Alta heredando fecha de sesión ─────────────────────────────────
  it('P-4D-02: Alta omitiendo srpe.fecha hereda sesion.fecha y sincroniza correctamente readiness y resumen semanal', async () => {
    const payload = makeSesionRPEPayload(S1, J1, '', 6, 30)
    const weekId = getWeekId('2026-07-28')

    await useStore.getState().addSesionRPE(payload)

    const dexieSrpe = await db.sesion_rpe.where('id_sesion').equals(S1).and(x => x.id_jugadora === J1).first()
    expect(dexieSrpe?.fecha).toBe('2026-07-28')

    const state = useStore.getState()
    expect(state.sesion_rpe[0].fecha).toBe('2026-07-28')
    expect(state.readiness[0].fecha).toBe('2026-07-28')
    expect(state.resumen_semanal[0].semana).toBe(weekId)
  })

  // ─── P-4D-03: Resumen semanal preexistente ───────────────────────────────────
  it('P-4D-03: Alta en semana con resumen preexistente actualiza el resumen en Zustand sin duplicar la fila', async () => {
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

    const payload = makeSesionRPEPayload(S1, J1, '2026-07-28', 9, 60)
    await useStore.getState().addSesionRPE(payload)

    const resumenesDexie = await db.resumen_semanal.where('id_jugadora').equals(J1).and(x => x.semana === weekId).toArray()
    expect(resumenesDexie).toHaveLength(1)

    const resumenesStore = useStore.getState().resumen_semanal
    expect(resumenesStore).toHaveLength(1)
    expect(resumenesStore[0].semana).toBe(weekId)
  })

  // ─── P-4D-04: Fila esperada ausente tras commit ──────────────────────────────
  it('P-4D-04: Fila esperada ausente pos-commit dispara fallback loadAll() de recuperación no fatal', async () => {
    const payload = makeSesionRPEPayload(S1, J1, '2026-07-28', 7, 30)

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
    await expect(useStore.getState().addSesionRPE(payload)).resolves.not.toThrow()

    expect(loadAllSpy).toHaveBeenCalled()

    const dexieSrpe = await db.sesion_rpe.where('id_sesion').equals(S1).and(x => x.id_jugadora === J1).first()
    expect(dexieSrpe).toBeDefined()
  })

  // ─── P-4D-05: Fallo de lectura incremental ──────────────────────────────────
  it('P-4D-05: Error I/O en lectura incremental no revierte la DB y activa fallback loadAll()', async () => {
    const payload = makeSesionRPEPayload(S1, J1, '2026-07-28', 7, 30)

    let failIncremental = false
    const originalWhere = db.sesion_rpe.where.bind(db.sesion_rpe)
    vi.spyOn(db.sesion_rpe, 'where').mockImplementation((...args: any[]) => {
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
    await expect(useStore.getState().addSesionRPE(payload)).resolves.not.toThrow()

    expect(loadAllSpy).toHaveBeenCalled()
    const dexieSrpe = await db.sesion_rpe.where('id_sesion').equals(S1).and(x => x.id_jugadora === J1).first()
    expect(dexieSrpe).toBeDefined()
  })

  // ─── P-4D-06: Fallo de incremental y de fallback ────────────────────────────
  it('P-4D-06: Si fallan la sincronización incremental y el fallback, no se lanza error a la UI y los datos persisten en Dexie', async () => {
    const payload = makeSesionRPEPayload(S1, J1, '2026-07-28', 7, 30)

    let failIncremental = false
    const originalWhere = db.sesion_rpe.where.bind(db.sesion_rpe)
    const whereSpy = vi.spyOn(db.sesion_rpe, 'where').mockImplementation((...args: any[]) => {
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

    await expect(useStore.getState().addSesionRPE(payload)).resolves.not.toThrow()

    failIncremental = false
    whereSpy.mockRestore()

    const dexieSrpe = await db.sesion_rpe.where('id_sesion').equals(S1).and(x => x.id_jugadora === J1).first()
    expect(dexieSrpe).toBeDefined()
    expect(consoleWarnSpy).toHaveBeenLastCalledWith(
      expect.stringContaining('[4D] Fallo en loadAll de recuperación tras error incremental:'),
      expect.any(Error)
    )
  })

  // ─── P-4D-07: Carrera con loadAll() antiguo (loadEpoch) ─────────────────────
  it('P-4D-07: Snapshot de loadAll() iniciado antes del commit es descartado por el incremento de loadEpoch', async () => {
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

    // Ejecutar addSesionRPE (B) mientras loadAll (A) está en curso
    const payload = makeSesionRPEPayload(S1, J1, '2026-07-28', 8, 30)
    await useStore.getState().addSesionRPE(payload)

    // El estado de Zustand ya debe tener el registro por 4D
    expect(useStore.getState().sesion_rpe).toHaveLength(1)

    // Desbloquear loadAll (A)
    delayResolve()
    await loadAllPromise

    // Verificar que el loadAll (A) antiguo NO pisó Zustand
    expect(useStore.getState().sesion_rpe).toHaveLength(1)
  })

  // ─── P-4D-08: Equivalencia estricta contra loadAll() ────────────────────────
  it('P-4D-08: Estado pos-4D produce coincidencia estricta 1:1 con un loadAll() posterior', async () => {
    const payload = makeSesionRPEPayload(S1, J1, '2026-07-28', 8, 45)
    await useStore.getState().addSesionRPE(payload)

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

  // ─── P-4D-09: Regresión de atomicidad 2G ─────────────────────────────────────
  it('P-4D-09: Fallo en transacción Dexie (ej. duplicado) mantiene rollback físico y no ejecuta 4D ni alertas', async () => {
    const payload = makeSesionRPEPayload(S1, J1, '2026-07-28', 7, 30)
    await useStore.getState().addSesionRPE(payload)

    // Intentar alta duplicada del mismo RPE de sesión (misma sesión y jugadora)
    const duplicatePayload = makeSesionRPEPayload(S1, J1, '2026-07-28', 9, 60)
    await expect(useStore.getState().addSesionRPE(duplicatePayload)).rejects.toThrow(
      'Ya existe un registro de RPE para esta jugadora en esta sesión'
    )

    const count = await db.sesion_rpe.where('id_sesion').equals(S1).and(x => x.id_jugadora === J1).count()
    expect(count).toBe(1)
  })
})
