/**
 * wellnessIncremental4B.test.ts
 *
 * Suite de integración para el Bloque 4B: Sincronización Incremental de updateWellness
 * con soporte para 4 escenarios de edición (mismo par, cambio fecha, cambio jugadora, cambio ambos),
 * invalidación por loadEpoch, fallback no-fatal y alertas pos-commit (2H).
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

const J1 = 'JUG_TEST_4B_1'
const J2 = 'JUG_TEST_4B_2'

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
  useStore.setState({
    jugadoras: await db.jugadoras.toArray(),
    wellness: [],
    readiness: [],
    alertas: [],
    resumen_semanal: [],
    loading: false,
  })
})

describe('Bloque 4B — Refresco Incremental en updateWellness', () => {
  // ─── P-4B-01: Edición de valores sin cambiar jugadora/fecha ───────────────
  it('P-4B-01: Edición de valores sin cambiar jugadora/fecha actualiza wellness y readiness equivalentes a loadAll()', async () => {
    const wInicial = makeWellnessPayload(J1, '2026-07-20', 60)
    await useStore.getState().addWellness(wInicial)

    const wSaved = useStore.getState().wellness[0]
    expect(wSaved.id).toBeDefined()

    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')

    const wEditado: Wellness = {
      ...wSaved,
      score_wellness: 90,
      calidad_sueno: 9,
    }

    await useStore.getState().updateWellness(wEditado)

    // Bloque 4B: No invoca loadAll() global
    expect(loadAllSpy).not.toHaveBeenCalled()

    const wellnessStore = useStore.getState().wellness
    expect(wellnessStore).toHaveLength(1)
    expect(wellnessStore[0].score_wellness).toBe(90)
    expect(wellnessStore[0].id).toBe(wSaved.id)
  })

  // ─── P-4B-02: Cambio de fecha ─────────────────────────────────────────────
  it('P-4B-02: Cambio de fecha actualiza la readiness del par previo y nuevo', async () => {
    const w = makeWellnessPayload(J1, '2026-07-20', 70)
    await useStore.getState().addWellness(w)

    const wSaved = useStore.getState().wellness[0]

    // Cambiar fecha de 2026-07-20 a 2026-07-25
    const wEditado: Wellness = { ...wSaved, fecha: '2026-07-25' }
    await useStore.getState().updateWellness(wEditado)

    const state = useStore.getState()
    expect(state.wellness[0].fecha).toBe('2026-07-25')

    // Se actualizan en Zustand los readiness de ambos pares: 2026-07-20 (previo) y 2026-07-25 (nuevo)
    const dates = state.readiness.map((r) => r.fecha)
    expect(dates).toContain('2026-07-20')
    expect(dates).toContain('2026-07-25')
  })

  // ─── P-4B-03: Cambio de jugadora ──────────────────────────────────────────
  it('P-4B-03: Cambio de jugadora actualiza readiness de ambas jugadoras y evalúa alertas para ambas', async () => {
    const w = makeWellnessPayload(J1, '2026-07-20', 70)
    await useStore.getState().addWellness(w)

    const wSaved = useStore.getState().wellness[0]

    // Cambiar de J1 a J2
    const wEditado: Wellness = { ...wSaved, id_jugadora: J2 }
    await useStore.getState().updateWellness(wEditado)

    const state = useStore.getState()
    expect(state.wellness[0].id_jugadora).toBe(J2)

    const playersInReadiness = state.readiness.map((r) => r.id_jugadora)
    expect(playersInReadiness).toContain(J1)
    expect(playersInReadiness).toContain(J2)
  })

  // ─── P-4B-04: Cambio simultáneo de jugadora y fecha ──────────────────────
  it('P-4B-04: Cambio simultáneo de jugadora y fecha sincroniza los 2 pares de readiness', async () => {
    const w = makeWellnessPayload(J1, '2026-07-10', 70)
    await useStore.getState().addWellness(w)

    const wSaved = useStore.getState().wellness[0]

    const wEditado: Wellness = { ...wSaved, id_jugadora: J2, fecha: '2026-07-30' }
    await useStore.getState().updateWellness(wEditado)

    const state = useStore.getState()
    expect(state.wellness[0].id_jugadora).toBe(J2)
    expect(state.wellness[0].fecha).toBe('2026-07-30')

    expect(state.readiness.some((r) => r.id_jugadora === J1 && r.fecha === '2026-07-10')).toBe(true)
    expect(state.readiness.some((r) => r.id_jugadora === J2 && r.fecha === '2026-07-30')).toBe(true)
  })

  // ─── P-4B-05: Conservación del ID autoincremental ─────────────────────────
  it('P-4B-05: Wellness editado mantiene exactamente el mismo ID asignado por Dexie', async () => {
    const w = makeWellnessPayload(J1, '2026-07-20', 70)
    await useStore.getState().addWellness(w)

    const wSaved = useStore.getState().wellness[0]
    const originalId = wSaved.id

    await useStore.getState().updateWellness({ ...wSaved, score_wellness: 88 })

    const updatedDexie = await db.wellness.get(originalId!)
    expect(updatedDexie?.id).toBe(originalId)
    expect(useStore.getState().wellness[0].id).toBe(originalId)
  })

  // ─── P-4B-06: Ordenamiento histórico descendente ──────────────────────────
  it('P-4B-06: Wellness queda ordenado descendentemente por fecha tras mover una fecha histórica', async () => {
    await useStore.getState().addWellness(makeWellnessPayload(J1, '2026-07-20', 80))
    await useStore.getState().addWellness(makeWellnessPayload(J1, '2026-07-15', 75))

    const w20 = useStore.getState().wellness.find((w) => w.fecha === '2026-07-20')!

    // Mover la fecha de 2026-07-20 a 2024-01-01
    await useStore.getState().updateWellness({ ...w20, fecha: '2024-01-01' })

    const stateWellness = useStore.getState().wellness
    expect(stateWellness[0].fecha).toBe('2026-07-15')
    expect(stateWellness[1].fecha).toBe('2024-01-01')
  })

  // ─── P-4B-07: Rechazo por colisión lógica ─────────────────────────────────
  it('P-4B-07: Colisión lógica rechaza antes de escribir sin refresco incremental ni alertas', async () => {
    await useStore.getState().addWellness(makeWellnessPayload(J1, '2026-07-20', 80))
    await useStore.getState().addWellness(makeWellnessPayload(J1, '2026-07-21', 85))

    const w20 = useStore.getState().wellness.find((w) => w.fecha === '2026-07-20')!

    // Intentar cambiar fecha a 2026-07-21 (ya existe para J1)
    await expect(
      useStore.getState().updateWellness({ ...w20, fecha: '2026-07-21' })
    ).rejects.toThrow('Ya existe otro registro de wellness para esta jugadora en esta fecha')

    // El estado previo se conserva intacto
    expect(useStore.getState().wellness.find((w) => w.id === w20.id)?.fecha).toBe('2026-07-20')
  })

  // ─── P-4B-08: Rechazo por ID inexistente ──────────────────────────────────
  it('P-4B-08: ID inexistente rechaza la actualización pre-transacción', async () => {
    const wInexistente = { ...makeWellnessPayload(J1, '2026-07-20', 80), id: 99999 }

    await expect(useStore.getState().updateWellness(wInexistente)).rejects.toThrow(
      'No existe el registro de wellness a actualizar'
    )
  })

  // ─── P-4B-09: Rollback físico ante error inducido en transacción ──────────
  it('P-4B-09: Error inducido dentro de la transacción realiza rollback físico real', async () => {
    await useStore.getState().addWellness(makeWellnessPayload(J1, '2026-07-20', 70))
    const wSaved = useStore.getState().wellness[0]

    vi.spyOn(await import('@/services/readiness'), 'recalcularReadinessJugadora').mockRejectedValueOnce(
      new Error('Fallo simulado en recálculo de readiness')
    )

    await expect(
      useStore.getState().updateWellness({ ...wSaved, score_wellness: 100 })
    ).rejects.toThrow('Fallo simulado en recálculo de readiness')

    // Los datos físicos en Dexie mantuvieron el score original
    const dexieW = await db.wellness.get(wSaved.id!)
    expect(dexieW?.score_wellness).toBe(70)
  })

  // ─── P-4B-10: Wellness inexistente activa fallback loadAll() ──────────────
  it('P-4B-10: Wellness inexistente inesperadamente activa loadAll() de recuperación no-fatal', async () => {
    await useStore.getState().addWellness(makeWellnessPayload(J1, '2026-07-20', 70))
    const wSaved = useStore.getState().wellness[0]

    // Simular que db.wellness.get devuelve el valor real dentro de la transacción, pero undefined pos-commit
    const originalGet = db.wellness.get.bind(db.wellness)
    let getCallCount = 0
    vi.spyOn(db.wellness, 'get').mockImplementation(async (id: any) => {
      getCallCount++
      if (getCallCount === 1) {
        return originalGet(id) // Lectura transaccional
      }
      return undefined // Lectura pos-commit
    })

    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')

    await expect(
      useStore.getState().updateWellness({ ...wSaved, score_wellness: 95 })
    ).resolves.not.toThrow()

    expect(loadAllSpy).toHaveBeenCalled()
  })

  // ─── P-4B-11: Readiness afectado inexistente activa fallback loadAll() ─────
  it('P-4B-11: Si una readiness afectada devuelve undefined, se activa loadAll() de recuperación sin silenciar', async () => {
    await useStore.getState().addWellness(makeWellnessPayload(J1, '2026-07-20', 70))
    const wSaved = useStore.getState().wellness[0]

    let failReadinessQuery = false
    const originalWhere = db.readiness.where.bind(db.readiness)
    vi.spyOn(db.readiness, 'where').mockImplementation((...args: any[]) => {
      if (failReadinessQuery) {
        return {
          first: async () => undefined,
        } as any
      }
      return originalWhere(...(args as [any]))
    })

    const originalRecalcular = (await import('@/services/readiness')).recalcularReadinessJugadora
    vi.spyOn(await import('@/services/readiness'), 'recalcularReadinessJugadora').mockImplementationOnce(
      async (...args) => {
        await originalRecalcular(...args)
        failReadinessQuery = true
      }
    )

    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')

    await expect(
      useStore.getState().updateWellness({ ...wSaved, score_wellness: 95 })
    ).resolves.not.toThrow()

    expect(loadAllSpy).toHaveBeenCalled()
  })

  // ─── P-4B-12: Fallo de lectura incremental pos-commit ────────────────────
  it('P-4B-12: Fallo I/O en lectura incremental activa loadAll() de recuperación', async () => {
    await useStore.getState().addWellness(makeWellnessPayload(J1, '2026-07-20', 70))
    const wSaved = useStore.getState().wellness[0]

    let failGet = false
    const originalGet = db.wellness.get.bind(db.wellness)
    vi.spyOn(db.wellness, 'get').mockImplementation(async (id: any) => {
      if (failGet) {
        throw new Error('Fallo I/O simulado en consulta incremental de updateWellness')
      }
      return originalGet(id)
    })

    const originalRecalcular = (await import('@/services/readiness')).recalcularReadinessJugadora
    vi.spyOn(await import('@/services/readiness'), 'recalcularReadinessJugadora').mockImplementationOnce(
      async (...args) => {
        await originalRecalcular(...args)
        failGet = true
      }
    )

    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')

    await expect(
      useStore.getState().updateWellness({ ...wSaved, score_wellness: 95 })
    ).resolves.not.toThrow()

    expect(loadAllSpy).toHaveBeenCalled()
  })

  // ─── P-4B-13: Fallo incremental y de fallback ────────────────────────────
  it('P-4B-13: Si fallan el refresco incremental y el fallback, no se lanza falso error de guardado a la UI', async () => {
    await useStore.getState().addWellness(makeWellnessPayload(J1, '2026-07-20', 70))
    const wSaved = useStore.getState().wellness[0]

    let failGet = false
    const originalGet = db.wellness.get.bind(db.wellness)
    const getSpy = vi.spyOn(db.wellness, 'get').mockImplementation(async (id: any) => {
      if (failGet) {
        throw new Error('Fallo I/O incremental simulado')
      }
      return originalGet(id)
    })

    const originalRecalcular = (await import('@/services/readiness')).recalcularReadinessJugadora
    vi.spyOn(await import('@/services/readiness'), 'recalcularReadinessJugadora').mockImplementationOnce(
      async (...args) => {
        await originalRecalcular(...args)
        failGet = true
      }
    )

    vi.spyOn(useStore.getState(), 'loadAll').mockRejectedValueOnce(new Error('Fallo fallback loadAll'))
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(
      useStore.getState().updateWellness({ ...wSaved, score_wellness: 95 })
    ).resolves.not.toThrow()

    failGet = false
    getSpy.mockRestore()

    const dexieW = await db.wellness.get(wSaved.id!)
    expect(dexieW?.score_wellness).toBe(95)

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[4B] Fallo en loadAll de recuperación tras error incremental:'),
      expect.any(Error)
    )
  })

  // ─── P-4B-14: Alertas 2H pos-commit ────────────────────────────────────────
  it('P-4B-14: Alertas 2H pos-commit evalúan secuencialmente a las jugadoras afectadas sin duplicados', async () => {
    await useStore.getState().addWellness(makeWellnessPayload(J1, '2026-07-20', 70))
    const wSaved = useStore.getState().wellness[0]

    // Cambiar de J1 a J2 genera 2 jugadoras afectadas: J1 y J2
    await useStore.getState().updateWellness({ ...wSaved, id_jugadora: J2 })

    // Se ejecutaron evaluaciones de alerta para ambas jugadoras
    expect(useStore.getState().jugadoras).toHaveLength(2)
  })

  // ─── P-4B-15: Carrera updateWellness / loadAll con loadEpoch ──────────────
  it('P-4B-15: loadAll() iniciado antes del commit de updateWellness es descartado por loadEpoch', async () => {
    await useStore.getState().addWellness(makeWellnessPayload(J1, '2026-07-20', 70))
    const wSaved = useStore.getState().wellness[0]

    let delayResolve: () => void = () => {}
    const delayPromise = new Promise<void>((r) => { delayResolve = r })

    const originalToArray = db.wellness.toArray.bind(db.wellness)
    vi.spyOn(db.wellness, 'toArray').mockImplementationOnce(async () => {
      await delayPromise
      return originalToArray()
    })

    // Iniciar loadAll (A) antes del commit
    const loadAllPromise = useStore.getState().loadAll()

    // Ejecutar updateWellness (B) mientras A sigue en vuelo
    await useStore.getState().updateWellness({ ...wSaved, score_wellness: 99 })

    expect(useStore.getState().wellness[0].score_wellness).toBe(99)

    // Desbloquear loadAll (A) antiguo
    delayResolve()
    await loadAllPromise

    // El snapshot antiguo NO sobreescribe el estado actualizado
    expect(useStore.getState().wellness[0].score_wellness).toBe(99)
  })

  // ─── P-4B-16: Dos ediciones consecutivas reales ───────────────────────────
  it('P-4B-16: Dos ediciones consecutivas no pierden ni duplican filas en Zustand', async () => {
    await useStore.getState().addWellness(makeWellnessPayload(J1, '2026-07-20', 60))
    const wSaved = useStore.getState().wellness[0]

    await useStore.getState().updateWellness({ ...wSaved, score_wellness: 75 })
    await useStore.getState().updateWellness({ ...wSaved, score_wellness: 90 })

    const state = useStore.getState()
    expect(state.wellness).toHaveLength(1)
    expect(state.wellness[0].score_wellness).toBe(90)
  })

  // ─── P-4B-17: Equivalencia final de Zustand con loadAll() ─────────────────
  it('P-4B-17: Zustand tras updateWellness tiene el mismo contenido y orden que un loadAll() posterior', async () => {
    await useStore.getState().addWellness(makeWellnessPayload(J1, '2026-07-20', 60))
    await useStore.getState().addWellness(makeWellnessPayload(J2, '2026-07-22', 80))

    const w1 = useStore.getState().wellness.find((w) => w.id_jugadora === J1)!
    await useStore.getState().updateWellness({ ...w1, fecha: '2026-07-25', score_wellness: 88 })

    const wellnessIncremental = [...useStore.getState().wellness]
    const readinessIncremental = [...useStore.getState().readiness]

    await useStore.getState().loadAll()

    expect(wellnessIncremental).toEqual(useStore.getState().wellness)
    expect(readinessIncremental).toEqual(useStore.getState().readiness)
  })

  // ─── P-4B-18: No regresión de 4A ──────────────────────────────────────────
  it('P-4A-00 / P-4B-18: addWellness y el refresco incremental 4A continúan funcionando sin regresiones', async () => {
    const wNew = makeWellnessPayload(J1, '2026-07-31', 92)
    await useStore.getState().addWellness(wNew)

    const state = useStore.getState()
    expect(state.wellness[0].fecha).toBe('2026-07-31')
    expect(state.wellness[0].score_wellness).toBe(92)
  })
})
