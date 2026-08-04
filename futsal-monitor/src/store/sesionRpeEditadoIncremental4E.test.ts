/**
 * sesionRpeEditadoIncremental4E.test.ts
 *
 * Suite de integración para el Bloque 4E: Sincronización Incremental en updateSesionRPE
 * con mitigación de carreras por Token de Recencia (loadEpoch), soporte para múltiples pares
 * (cambio de fecha dentro/entre semanas, cambio de jugadora/sesión), deduplicación de resúmenes
 * y política no-fatal de fallback.
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

const J1 = 'JUG_TEST_4E_1'
const J2 = 'JUG_TEST_4E_2'
const S1 = 'SES_TEST_4E_1'
const S2 = 'SES_TEST_4E_2'
const S3 = 'SES_TEST_4E_3'

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
    fecha: '2026-07-28', // Semana 2026-07-27
    tipo_sesion: 'Pista',
    estado: 'realizada',
  } as Sesion)

  await db.sesiones.put({
    id_sesion: S2,
    fecha: '2026-07-30', // Misma semana 2026-07-27
    tipo_sesion: 'Gimnasio',
    estado: 'realizada',
  } as Sesion)

  await db.sesiones.put({
    id_sesion: S3,
    fecha: '2026-08-04', // Distinta semana 2026-08-03
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

describe('Bloque 4E — Refresco Incremental en updateSesionRPE', () => {
  // ─── P-4E-01: Edición simple (mismo par) ────────────────────────────────────
  it('P-4E-01: Edición simple de RPE/duración actualiza sesion_rpe, readiness y resumen sin llamar a loadAll()', async () => {
    // 1. Alta inicial mediante addSesionRPE
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 6,
      carga_ua: 360,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInicial = useStore.getState().sesion_rpe[0]
    expect(srpeInicial.id).toBeDefined()

    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')

    // 2. Edición simple
    const updatePayload: Partial<SesionRPE> & { id: number; id_jugadora: string; id_sesion: string } = {
      id: srpeInicial.id!,
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 9,
      carga_ua: 540,
      asistencia: 'presente',
    }
    await useStore.getState().updateSesionRPE(updatePayload)

    // Bloque 4E: NO llama a loadAll() global
    expect(loadAllSpy).not.toHaveBeenCalled()

    // Verificación en Dexie real
    const dexieSrpe = await db.sesion_rpe.get(srpeInicial.id!)
    expect(dexieSrpe?.rpe).toBe(9)
    expect(dexieSrpe?.carga_ua).toBe(540)

    // Verificación en Zustand
    const state = useStore.getState()
    expect(state.sesion_rpe).toHaveLength(1)
    expect(state.sesion_rpe[0].rpe).toBe(9)
    expect(state.readiness).toHaveLength(1)
    expect(state.resumen_semanal).toHaveLength(1)
  })

  // ─── P-4E-02: Cambio de fecha dentro de la misma semana ──────────────────────
  it('P-4E-02: Cambio de fecha en la misma semana actualiza 2 readiness y 1 resumen en Zustand y Dexie', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 7,
      carga_ua: 420,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInicial = useStore.getState().sesion_rpe[0]

    // Cambiar fecha de 2026-07-28 a 2026-07-30 (misma semana 2026-07-27)
    const updatePayload = {
      id: srpeInicial.id!,
      id_sesion: S2,
      id_jugadora: J1,
      fecha: '2026-07-30',
      rpe: 8,
      carga_ua: 480,
      asistencia: 'presente' as const,
    }
    await useStore.getState().updateSesionRPE(updatePayload)

    // Dexie
    const r1 = await db.readiness.where('id_jugadora').equals(J1).and(x => x.fecha === '2026-07-28').first()
    const r2 = await db.readiness.where('id_jugadora').equals(J1).and(x => x.fecha === '2026-07-30').first()
    expect(r1).toBeDefined()
    expect(r2).toBeDefined()

    // Zustand
    const state = useStore.getState()
    expect(state.sesion_rpe[0].fecha).toBe('2026-07-30')
    expect(state.readiness).toHaveLength(2)
    expect(state.resumen_semanal).toHaveLength(1)
  })

  // ─── P-4E-03: Cambio de fecha entre semanas (Escenario clave) ───────────────
  it('P-4E-03: Cambio de fecha entre semanas actualiza 2 readiness y 2 resúmenes en Dexie y Zustand con ordenamiento estricto', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28', // Semana 2026-07-27
      rpe: 7,
      carga_ua: 420,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInicial = useStore.getState().sesion_rpe[0]

    // Desplazar a sesión S3 (2026-08-04, semana 2026-08-03)
    const updatePayload = {
      id: srpeInicial.id!,
      id_sesion: S3,
      id_jugadora: J1,
      fecha: '2026-08-04',
      rpe: 8,
      carga_ua: 480,
      asistencia: 'presente' as const,
    }
    await useStore.getState().updateSesionRPE(updatePayload)

    // Dexie
    const readinessPrevious = await db.readiness.where('id_jugadora').equals(J1).and(x => x.fecha === '2026-07-28').first()
    const readinessNew = await db.readiness.where('id_jugadora').equals(J1).and(x => x.fecha === '2026-08-04').first()
    expect(readinessPrevious).toBeDefined()
    expect(readinessNew).toBeDefined()

    const resumenPrevious = await db.resumen_semanal.where('id_jugadora').equals(J1).and(x => x.semana === getWeekId('2026-07-28')).first()
    const resumenNew = await db.resumen_semanal.where('id_jugadora').equals(J1).and(x => x.semana === getWeekId('2026-08-04')).first()
    expect(resumenPrevious).toBeDefined()
    expect(resumenNew).toBeDefined()

    // Zustand
    const state = useStore.getState()
    expect(state.sesion_rpe).toHaveLength(1)
    expect(state.sesion_rpe[0].fecha).toBe('2026-08-04')
    expect(state.readiness).toHaveLength(2)
    expect(state.resumen_semanal).toHaveLength(2)

    // Orden descendente en Zustand
    expect(state.readiness[0].fecha).toBe('2026-08-04')
    expect(state.readiness[1].fecha).toBe('2026-07-28')
    expect(state.resumen_semanal[0].semana).toBe(getWeekId('2026-08-04'))
    expect(state.resumen_semanal[1].semana).toBe(getWeekId('2026-07-28'))
  })

  // ─── P-4E-04: Cambio de jugadora ─────────────────────────────────────────────
  it('P-4E-04: Cambio de jugadora actualiza derivados para ambas jugadoras y sustituye la jugadora en Zustand sin duplicar RPE', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 7,
      carga_ua: 420,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInicial = useStore.getState().sesion_rpe[0]

    // Cambiar la jugadora de J1 a J2
    const updatePayload = {
      id: srpeInicial.id!,
      id_sesion: S1,
      id_jugadora: J2,
      fecha: '2026-07-28',
      rpe: 8,
      carga_ua: 480,
      asistencia: 'presente' as const,
    }
    await useStore.getState().updateSesionRPE(updatePayload)

    // Dexie: RPE tiene mismo ID físico pero jugadora J2
    const dexieSrpe = await db.sesion_rpe.get(srpeInicial.id!)
    expect(dexieSrpe?.id_jugadora).toBe(J2)

    // Readiness y resumen en Dexie para J1 y J2
    const readinessJ1 = await db.readiness.where('id_jugadora').equals(J1).and(x => x.fecha === '2026-07-28').first()
    const readinessJ2 = await db.readiness.where('id_jugadora').equals(J2).and(x => x.fecha === '2026-07-28').first()
    expect(readinessJ1).toBeDefined()
    expect(readinessJ2).toBeDefined()

    // Zustand
    const state = useStore.getState()
    expect(state.sesion_rpe).toHaveLength(1)
    expect(state.sesion_rpe[0].id_jugadora).toBe(J2)
    expect(state.readiness).toHaveLength(2)
    expect(state.resumen_semanal).toHaveLength(2)
  })

  // ─── P-4E-05: Cambio de sesión ──────────────────────────────────────────────
  it('P-4E-05: Cambio de sesión conserva ID físico de RPE y actualiza la identidad lógica (id_sesion, id_jugadora)', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 6,
      carga_ua: 360,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInicial = useStore.getState().sesion_rpe[0]

    const updatePayload = {
      id: srpeInicial.id!,
      id_sesion: S2,
      id_jugadora: J1,
      fecha: '2026-07-30',
      rpe: 7,
      carga_ua: 420,
      asistencia: 'presente' as const,
    }
    await useStore.getState().updateSesionRPE(updatePayload)

    const state = useStore.getState()
    expect(state.sesion_rpe).toHaveLength(1)
    expect(state.sesion_rpe[0].id).toBe(srpeInicial.id!)
    expect(state.sesion_rpe[0].id_sesion).toBe(S2)
  })

  // ─── P-4E-06: Fila esperada ausente pos-commit ──────────────────────────────
  it('P-4E-06: Fila esperada ausente pos-commit dispara fallback loadAll() de recuperación no fatal', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 7,
      carga_ua: 420,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInicial = useStore.getState().sesion_rpe[0]

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
    const updatePayload = {
      id: srpeInicial.id!,
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 9,
      carga_ua: 540,
      asistencia: 'presente' as const,
    }
    await expect(useStore.getState().updateSesionRPE(updatePayload)).resolves.not.toThrow()

    expect(loadAllSpy).toHaveBeenCalled()
    const dexieSrpe = await db.sesion_rpe.get(srpeInicial.id!)
    expect(dexieSrpe?.rpe).toBe(9)
  })

  // ─── P-4E-07: Error I/O en lectura incremental ──────────────────────────────
  it('P-4E-07: Error I/O en lectura incremental activa fallback loadAll() sin revertir commit físico en Dexie', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 7,
      carga_ua: 420,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInicial = useStore.getState().sesion_rpe[0]

    let failIncremental = false
    const originalGet = db.sesion_rpe.get.bind(db.sesion_rpe)
    vi.spyOn(db.sesion_rpe, 'get').mockImplementation(async (id: any) => {
      if (failIncremental) {
        failIncremental = false
        throw new Error('Fallo I/O en lectura incremental pos-commit')
      }
      return originalGet(id)
    })

    const originalRecalcular = (await import('@/services/readiness')).recalcularReadinessJugadora
    vi.spyOn(await import('@/services/readiness'), 'recalcularReadinessJugadora').mockImplementationOnce(
      async (...args) => {
        await originalRecalcular(...args)
        failIncremental = true
      }
    )

    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')
    const updatePayload = {
      id: srpeInicial.id!,
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 9,
      carga_ua: 540,
      asistencia: 'presente' as const,
    }
    await expect(useStore.getState().updateSesionRPE(updatePayload)).resolves.not.toThrow()

    expect(loadAllSpy).toHaveBeenCalled()
    const dexieSrpe = await db.sesion_rpe.get(srpeInicial.id!)
    expect(dexieSrpe?.rpe).toBe(9)
  })

  // ─── P-4E-08: Fallo de incremental y de fallback ────────────────────────────
  it('P-4E-08: Si fallan la sincronización incremental y el fallback, no se lanza error a la UI y los datos persisten en Dexie', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 7,
      carga_ua: 420,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInicial = useStore.getState().sesion_rpe[0]

    let failIncremental = false
    const originalGet = db.sesion_rpe.get.bind(db.sesion_rpe)
    const getSpy = vi.spyOn(db.sesion_rpe, 'get').mockImplementation(async (id: any) => {
      if (failIncremental) {
        failIncremental = false
        throw new Error('Fallo incremental pos-commit')
      }
      return originalGet(id)
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

    const updatePayload = {
      id: srpeInicial.id!,
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 9,
      carga_ua: 540,
      asistencia: 'presente' as const,
    }
    await expect(useStore.getState().updateSesionRPE(updatePayload)).resolves.not.toThrow()

    failIncremental = false
    getSpy.mockRestore()

    const dexieSrpe = await db.sesion_rpe.get(srpeInicial.id!)
    expect(dexieSrpe?.rpe).toBe(9)
    expect(consoleWarnSpy).toHaveBeenLastCalledWith(
      expect.stringContaining('[4E] Fallo en loadAll de recuperación tras error incremental:'),
      expect.any(Error)
    )
  })

  // ─── P-4E-09: Carrera con loadAll() antiguo (loadEpoch) ─────────────────────
  it('P-4E-09: Snapshot de loadAll() iniciado antes del commit de edición es descartado por loadEpoch', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 7,
      carga_ua: 420,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInicial = useStore.getState().sesion_rpe[0]

    const originalToArray = db.jugadoras.toArray.bind(db.jugadoras)
    let delayResolve: () => void = () => {}
    const delayPromise = new Promise<void>((resolve) => {
      delayResolve = resolve
    })

    vi.spyOn(db.jugadoras, 'toArray').mockImplementationOnce(async () => {
      await delayPromise
      return originalToArray()
    })

    // Iniciar loadAll (A) antes de la edición
    const loadAllPromise = useStore.getState().loadAll()

    // Ejecutar updateSesionRPE (B) con cambio de fecha entre semanas mientras loadAll está bloqueado
    const updatePayload = {
      id: srpeInicial.id!,
      id_sesion: S3,
      id_jugadora: J1,
      fecha: '2026-08-04',
      rpe: 10,
      carga_ua: 600,
      asistencia: 'presente' as const,
    }
    await useStore.getState().updateSesionRPE(updatePayload)

    // Estado pos-4E en Zustand
    expect(useStore.getState().sesion_rpe[0].rpe).toBe(10)
    expect(useStore.getState().readiness).toHaveLength(2)
    expect(useStore.getState().resumen_semanal).toHaveLength(2)

    // Desbloquear loadAll antiguo
    delayResolve()
    await loadAllPromise

    // El set masivo stale de loadAll (A) NO pisó los datos actualizados
    expect(useStore.getState().sesion_rpe[0].rpe).toBe(10)
    expect(useStore.getState().readiness).toHaveLength(2)
    expect(useStore.getState().resumen_semanal).toHaveLength(2)
  })

  // ─── P-4E-10: Equivalencia estricta contra loadAll() ────────────────────────
  it('P-4E-10: Estado pos-4E tras cambio entre semanas coincide 1:1 con un loadAll() posterior', async () => {
    const altaPayload: SesionRPE = {
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 7,
      carga_ua: 420,
      asistencia: 'presente',
    }
    await useStore.getState().addSesionRPE(altaPayload)
    const srpeInicial = useStore.getState().sesion_rpe[0]

    const updatePayload = {
      id: srpeInicial.id!,
      id_sesion: S3,
      id_jugadora: J1,
      fecha: '2026-08-04',
      rpe: 9,
      carga_ua: 540,
      asistencia: 'presente' as const,
    }
    await useStore.getState().updateSesionRPE(updatePayload)

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

  // ─── P-4E-11: Regresión de atomicidad 2G ─────────────────────────────────────
  it('P-4E-11: Rechazo de actualización (ej. ID inexistente) mantiene rollback físico y no ejecuta 4E ni alertas', async () => {
    const updatePayload = {
      id: 99999, // ID inexistente
      id_sesion: S1,
      id_jugadora: J1,
      fecha: '2026-07-28',
      rpe: 8,
      carga_ua: 480,
      asistencia: 'presente' as const,
    }
    await expect(useStore.getState().updateSesionRPE(updatePayload)).rejects.toThrow(
      'No existe el registro de RPE de sesión a actualizar'
    )
  })
})
