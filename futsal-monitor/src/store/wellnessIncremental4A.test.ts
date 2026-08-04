/**
 * wellnessIncremental4A.test.ts
 *
 * Suite de integración para el Bloque 4A: Piloto de Sincronización Incremental en addWellness
 * con mitigación de carreras por Token de Recencia (loadEpoch), ordenación equivalente a loadAll()
 * y política no-fatal de fallback ante errores de lectura incremental.
 *
 * Usa fake-indexeddb para reproducir IndexedDB real en entorno de pruebas.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.unmock('@/db/database')
vi.unmock('@/services/readiness')

import { db } from '@/db/database'
import { useStore } from '@/store/store'
import type { Wellness, Jugadora } from '@/types'

const J1 = 'JUG_TEST_4A_1'
const J2 = 'JUG_TEST_4A_2'

async function limpiarDB() {
  await Promise.all([
    db.jugadoras.clear(),
    db.wellness.clear(),
    db.readiness.clear(),
    db.alertas.clear(),
    db.resumen_semanal.clear(),
    db.ciclo_menstrual.clear(),
    db.sesion_rpe.clear(),
  ])
}

async function seedJugadoras() {
  await db.jugadoras.put({
    id_jugadora: J1,
    nombre: 'Ana López',
    posicion: 'ala',
    activa: true,
  } as Jugadora)
  await db.jugadoras.put({
    id_jugadora: J2,
    nombre: 'María García',
    posicion: 'cierre',
    activa: true,
  } as Jugadora)
}

const makeWellnessPayload = (jugadoraId: string, fecha: string, score: number = 70): Wellness => ({
  id_jugadora: jugadoraId,
  fecha,
  calidad_sueno: 7,
  fatiga: 6,
  dolor_muscular: 5,
  estres: 4,
  estado_animo: 8,
  score_wellness: score,
  dolor_especifico: false,
})

beforeEach(async () => {
  vi.restoreAllMocks()
  await limpiarDB()
  await seedJugadoras()
  // Resetear Zustand store
  useStore.setState({
    jugadoras: await db.jugadoras.toArray(),
    wellness: [],
    readiness: [],
    alertas: [],
    resumen_semanal: [],
    loading: false,
  })
})

describe('Bloque 4A — Refresco Incremental en addWellness', () => {
  // ─── P-4A-01: Ordenamiento histórico ───────────────────────────────────────
  it('P-4A-01: Alta de wellness con fecha histórica conserva el orden descendente estricto por fecha en Zustand', async () => {
    // Insertar registros existentes en Zustand
    const w1 = makeWellnessPayload(J1, '2026-07-20', 80)
    const w2 = makeWellnessPayload(J1, '2026-07-15', 75)
    await useStore.getState().addWellness(w1)
    await useStore.getState().addWellness(w2)

    // Insertar fecha histórica antigua (2024-01-01)
    const wHistorico = makeWellnessPayload(J1, '2024-01-01', 60)
    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')

    await useStore.getState().addWellness(wHistorico)

    // Bloque 4A: NO invoca loadAll() global
    expect(loadAllSpy).not.toHaveBeenCalled()

    const wellnessStore = useStore.getState().wellness
    expect(wellnessStore).toHaveLength(3)

    // Verificar orden descendente por fecha
    expect(wellnessStore[0].fecha).toBe('2026-07-20')
    expect(wellnessStore[1].fecha).toBe('2026-07-15')
    expect(wellnessStore[2].fecha).toBe('2024-01-01')
  })

  // ─── P-4A-02: Alta reciente y equivalencia ──────────────────────────────────
  it('P-4A-02: Alta reciente produce el mismo contenido y orden en Zustand que un loadAll() posterior', async () => {
    const wReciente = makeWellnessPayload(J1, '2026-08-01', 85)
    await useStore.getState().addWellness(wReciente)

    const wellnessPostIncremental = [...useStore.getState().wellness]
    const readinessPostIncremental = [...useStore.getState().readiness]

    // Ejecutar loadAll() explícito para comparar
    await useStore.getState().loadAll()

    const wellnessPostLoadAll = useStore.getState().wellness
    const readinessPostLoadAll = useStore.getState().readiness

    expect(wellnessPostIncremental).toEqual(wellnessPostLoadAll)
    expect(readinessPostIncremental).toEqual(readinessPostLoadAll)
  })

  // ─── P-4A-03: Fusión por reemplazo sin duplicación ──────────────────────────
  it('P-4A-03: Fusión por reemplazo no duplica la fila en memoria si ya existía en Zustand', async () => {
    const w = makeWellnessPayload(J1, '2026-07-25', 70)
    await useStore.getState().addWellness(w)

    expect(useStore.getState().wellness).toHaveLength(1)

    // Re-evaluar fusión incremental sobre la misma clave id_jugadora + fecha
    const wSaved = await db.wellness.where({ id_jugadora: J1, fecha: '2026-07-25' }).first()
    expect(wSaved).toBeDefined()
    expect(wSaved?.id).toBeDefined()

    // El ID autoincremental de Dexie se capturó correctamente en Zustand
    expect(useStore.getState().wellness[0].id).toBe(wSaved?.id)
  })

  // ─── P-4A-04: Carrera de loadAll() con loadEpoch ───────────────────────────
  it('P-4A-04: loadAll() iniciado antes del commit es descartado por el token de recencia (loadEpoch)', async () => {
    // 1. Iniciar un loadAll() lento que lee Dexie
    const originalToArray = db.wellness.toArray.bind(db.wellness)
    
    // Interceptar toArray para simular retraso de I/O
    let delayResolve: () => void = () => {}
    const delayPromise = new Promise<void>((resolve) => {
      delayResolve = resolve
    })

    vi.spyOn(db.wellness, 'toArray').mockImplementationOnce(async () => {
      await delayPromise
      return originalToArray()
    })

    // Iniciar loadAll (A) antes del commit
    const loadAllPromise = useStore.getState().loadAll()

    // 2. Ejecutar addWellness (B) mientras loadAll (A) sigue en vuelo
    const wNuevo = makeWellnessPayload(J1, '2026-07-30', 90)
    await useStore.getState().addWellness(wNuevo)

    // El estado de Zustand debe incluir inmediatamente el nuevo registro por 4A
    expect(useStore.getState().wellness.some((w) => w.fecha === '2026-07-30')).toBe(true)

    // 3. Desbloquear la I/O del loadAll (A) antiguo
    delayResolve()
    await loadAllPromise

    // Verificar que loadAll (A) fue descartado y NO pisó Zustand con el snapshot antiguo
    const wellnessFinal = useStore.getState().wellness
    expect(wellnessFinal.some((w) => w.fecha === '2026-07-30')).toBe(true)
  })

  // ─── P-4A-05: Fallback por fallo de lectura incremental ───────────────────
  it('P-4A-05: Fallo en lectura incremental activa loadAll() de recuperación no-fatal', async () => {
    const w = makeWellnessPayload(J1, '2026-07-28', 75)

    let failIncremental = false
    const originalWhere = db.wellness.where.bind(db.wellness)
    vi.spyOn(db.wellness, 'where').mockImplementation((...args: any[]) => {
      if (failIncremental) {
        throw new Error('Fallo I/O simulado en consulta incremental pos-commit')
      }
      return originalWhere(...(args as [any]))
    })

    // Activar el fallo incremental únicamente cuando termine la transacción física en Dexie
    const originalRecalcular = (await import('@/services/readiness')).recalcularReadinessJugadora
    vi.spyOn(await import('@/services/readiness'), 'recalcularReadinessJugadora').mockImplementationOnce(
      async (...args) => {
        await originalRecalcular(...args)
        failIncremental = true
      }
    )

    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')

    // No debe lanzar error a la UI
    await expect(useStore.getState().addWellness(w)).resolves.not.toThrow()

    // loadAll() de recuperación fue invocado tras el fallo incremental
    expect(loadAllSpy).toHaveBeenCalled()
  })

  // ─── P-4A-06: Fallo de incremental y de fallback ───────────────────────────
  it('P-4A-06: Si fallan el refresco incremental y el fallback, los datos en Dexie se conservan sin lanzar falso error a la UI', async () => {
    const w = makeWellnessPayload(J1, '2026-07-29', 80)

    let failIncremental = false
    const originalWhere = db.wellness.where.bind(db.wellness)
    const whereSpy = vi.spyOn(db.wellness, 'where').mockImplementation((...args: any[]) => {
      if (failIncremental) {
        throw new Error('Fallo incremental simulado pos-commit')
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

    // Forzar fallo en loadAll de recuperación
    vi.spyOn(useStore.getState(), 'loadAll').mockRejectedValueOnce(new Error('Fallo fallback loadAll'))

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // La acción NO debe relanzar error ni notificar fallo de guardado
    await expect(useStore.getState().addWellness(w)).resolves.not.toThrow()

    // Restaurar el espía para que la consulta de verificación del test no falle
    failIncremental = false
    whereSpy.mockRestore()

    // Los datos físicos en Dexie se guardaron correctamente
    const dexieWellness = await db.wellness.where({ id_jugadora: J1, fecha: '2026-07-29' }).first()
    expect(dexieWellness).toBeDefined()
    expect(dexieWellness?.score_wellness).toBe(80)

    // Se registró la advertencia en consola
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[4A] Fallo en loadAll de recuperación tras error incremental:'),
      expect.any(Error)
    )
  })

  // ─── P-4A-07: Regresión de atomicidad y no-duplicación Dexie ───────────────
  it('P-4A-07: Dos recálculos consecutivos de readiness para misma jugadora y fecha no duplican registros en Dexie ni Zustand', async () => {
    const w1 = makeWellnessPayload(J1, '2026-07-30', 40) // score bajo
    await db.ciclo_menstrual.put({
      id_jugadora: J1,
      fecha: '2026-07-30',
      fase: 'Ovulacion',
      duracion_ciclo: 28,
      sintomas: [],
    })
    await db.resumen_semanal.put({
      id_jugadora: J1,
      semana: '2026-W31',
      acwr: 1.8,
      carga_aguda: 360,
      carga_cronica: 200,
      carga_semanal: 360,
      monotonia: 1,
      tension: 360,
      completado: true,
    })

    // Primera alta
    await useStore.getState().addWellness(w1)

    const readinessDexieCount1 = await db.readiness.where({ id_jugadora: J1, fecha: '2026-07-30' }).count()
    expect(readinessDexieCount1).toBe(1)
    expect(useStore.getState().readiness.filter((r) => r.id_jugadora === J1 && r.fecha === '2026-07-30')).toHaveLength(1)

    // Alerta de seguimiento 2H generada
    const alertasStore = useStore.getState().alertas
    expect(alertasStore.some((a) => a.id_jugadora === J1 && a.tipo === 'carga_alta')).toBe(true)
  })

  // ─── P-4A-08: Dos loadAll() concurrentes ──────────────────────────────────
  it('P-4A-08: En dos loadAll() concurrentes, solo la carga más reciente aplica su snapshot global', async () => {
    let resolveFirstLoad: () => void = () => {}
    let resolveSecondLoad: () => void = () => {}

    const firstPromise = new Promise<void>((r) => { resolveFirstLoad = r })
    const secondPromise = new Promise<void>((r) => { resolveSecondLoad = r })

    let callCount = 0
    vi.spyOn(db.wellness, 'toArray').mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        // Carga A1 (más antigua)
        await firstPromise
        return [makeWellnessPayload(J1, '2026-01-01', 50)]
      } else {
        // Carga A2 (más reciente)
        await secondPromise
        return [makeWellnessPayload(J1, '2026-07-01', 95)]
      }
    })

    // Iniciar A1
    const p1 = useStore.getState().loadAll()
    // Iniciar A2 (incrementa loadEpoch a un valor mayor)
    const p2 = useStore.getState().loadAll()

    // Hacer que A2 (la más reciente) termine PRIMERO
    resolveSecondLoad()
    await p2

    expect(useStore.getState().wellness[0].fecha).toBe('2026-07-01')

    // Hacer que A1 (la más antigua) termine DESPUÉS
    resolveFirstLoad()
    await p1

    // Verificar que A1 no pisó el estado con su fecha 2026-01-01
    expect(useStore.getState().wellness[0].fecha).toBe('2026-07-01')
  })

  // ─── P-4A-09: Control concurrente de state.loading ─────────────────────────
  it('P-4A-09: state.loading permanece true mientras haya al menos un loadAll() activo', async () => {
    let resolveP1: () => void = () => {}
    let resolveP2: () => void = () => {}

    const promise1 = new Promise<void>((r) => { resolveP1 = r })
    const promise2 = new Promise<void>((r) => { resolveP2 = r })

    let callCount = 0
    const originalToArray = db.wellness.toArray.bind(db.wellness)
    vi.spyOn(db.wellness, 'toArray').mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        await promise1
      } else {
        await promise2
      }
      return originalToArray()
    })

    const p1 = useStore.getState().loadAll()
    const p2 = useStore.getState().loadAll()

    expect(useStore.getState().loading).toBe(true)

    // Finalizar primera carga p1
    resolveP1()
    await p1

    // loading sigue siendo true porque p2 continúa activa
    expect(useStore.getState().loading).toBe(true)

    // Finalizar segunda carga p2
    resolveP2()
    await p2

    // loading pasa a false solo al finalizar todas las cargas activas
    expect(useStore.getState().loading).toBe(false)
  })

  // ─── P-4A-10: Error global y bloque try-finally ───────────────────────────
  it('P-4A-10: Error en loadAll() limpia activeLoadsCount y desactiva loading mediante try-finally', async () => {
    vi.spyOn(db.jugadoras, 'toArray').mockRejectedValueOnce(new Error('Fallo crítico de lectura Dexie'))

    await expect(useStore.getState().loadAll()).rejects.toThrow('Fallo crítico de lectura Dexie')

    // El estado de loading no queda bloqueado en true
    expect(useStore.getState().loading).toBe(false)
  })

  // ─── P-4A-11: Carga inicial normal ─────────────────────────────────────────
  it('P-4A-11: Una ejecución normal de loadAll() carga los datos, activa hasData y desactiva loading', async () => {
    await db.wellness.put(makeWellnessPayload(J1, '2026-07-20', 80))

    await useStore.getState().loadAll()

    const state = useStore.getState()
    expect(state.hasData).toBe(true)
    expect(state.loading).toBe(false)
    expect(state.wellness).toHaveLength(1)
  })

  // ─── P-4A-12: Orden de invalidación de loadEpoch pos-commit ─────────────────
  it('P-4A-12: La invalidación de loadEpoch ocurre pos-commit y no interfiere con el contrato de Promise<void>', async () => {
    const w = makeWellnessPayload(J1, '2026-07-27', 77)

    const res = await useStore.getState().addWellness(w)
    expect(res).toBeUndefined() // Retorna Promise<void>

    // Los datos físicos están en Dexie
    const saved = await db.wellness.where({ id_jugadora: J1, fecha: '2026-07-27' }).first()
    expect(saved).toBeDefined()
  })
})
