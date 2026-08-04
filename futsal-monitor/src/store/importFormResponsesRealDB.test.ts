/**
 * Test de integración real — Bloque 2C
 *
 * Usa fake-indexeddb para proveer IndexedDB real al entorno jsdom.
 * No mockea db.transaction, tablas Dexie, put, where ni toArray.
 * Prueba persistencia real y rollback completo de importFormResponses.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Desmockear db y servicios para usar Dexie real
vi.unmock('@/db/database')
vi.unmock('@/services/readiness')

import { db } from '@/db/database'
import { useStore } from './store'
import * as readinessService from '@/services/readiness'

const J1 = 'JUGADORA-TEST-001'
const J2 = 'JUGADORA-TEST-002'

const jugadorasBase = [
  { id_jugadora: J1, nombre: 'Jugadora Uno', posicion: 'ala', activa: true, dorsal: 1 },
  { id_jugadora: J2, nombre: 'Jugadora Dos', posicion: 'cierre', activa: true, dorsal: 2 },
]

async function limpiarDB() {
  await Promise.all([
    db.wellness.clear(),
    db.readiness.clear(),
    db.sesion_rpe.clear(),
    db.jugadoras.clear(),
    db.alertas.clear(),
  ])
}

async function seedJugadoras() {
  await db.jugadoras.bulkPut(jugadorasBase as any)
}

describe('importFormResponses - Integración real con IndexedDB (Bloque 2C)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await limpiarDB()
    await seedJugadoras()
  })

  afterEach(async () => {
    await limpiarDB()
  })

  it('B. Integración real éxito: persiste wellness y readiness para pares nuevos y respeta duplicados preexistentes', async () => {
    expect(vi.isMockFunction(db.transaction)).toBe(false)

    // 1. Preinsertar un wellness y readiness preexistente para J1 en 2026-05-01
    await db.wellness.put({
      id_jugadora: J1,
      fecha: '2026-05-01',
      calidad_sueno: 5,
      fatiga: 5,
      dolor_muscular: 5,
      estres: 5,
      estado_animo: 5,
      dolor_especifico: 'preexistente',
      score_wellness: 50,
    } as any)

    await db.readiness.put({
      id_jugadora: J1,
      fecha: '2026-05-01',
      score: 50,
      categoria: 'MODERADO',
      componentes: { zScoreWellness: 0, acwr: 1, fatiga: 5, dolor: 5 },
      recomendacion: 'Normal',
      creada: new Date().toISOString(),
    } as any)

    // 2. Respuestas a importar: 
    // - J1 en 2026-05-01 (Duplicado preexistente en BD)
    // - J1 en 2026-05-02 (Nuevo)
    // - J2 en 2026-05-02 (Nuevo)
    const responses = [
      { id_jugadora: J1, fecha: '2026-05-01', calidad_sueno: 10, fatiga: 10, dolor_muscular: 10, estres: 10, estado_animo: 10 },
      { id_jugadora: J1, fecha: '2026-05-02', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 9 },
      { id_jugadora: J2, fecha: '2026-05-02', calidad_sueno: 9, fatiga: 8, dolor_muscular: 7, estres: 6, estado_animo: 8 },
    ]

    await useStore.getState().importFormResponses(responses as any)

    // 3. Comprobar que el duplicado preexistente no se alteró
    const wPre = await db.wellness.where({ id_jugadora: J1, fecha: '2026-05-01' }).first()
    expect(wPre?.dolor_especifico).toBe('preexistente')
    expect(wPre?.score_wellness).toBe(50)

    // 4. Comprobar que los nuevos wellness persistieron
    const wJ1Nuevo = await db.wellness.where({ id_jugadora: J1, fecha: '2026-05-02' }).first()
    expect(wJ1Nuevo).toBeTruthy()

    const wJ2Nuevo = await db.wellness.where({ id_jugadora: J2, fecha: '2026-05-02' }).first()
    expect(wJ2Nuevo).toBeTruthy()

    // 5. Comprobar que solo los pares nuevos generaron readiness
    const readinessJ1_02 = await db.readiness.where({ id_jugadora: J1, fecha: '2026-05-02' }).first()
    expect(readinessJ1_02).toBeTruthy()

    const readinessJ2_02 = await db.readiness.where({ id_jugadora: J2, fecha: '2026-05-02' }).first()
    expect(readinessJ2_02).toBeTruthy()
  })

  it('C. Integración real rollback: error en recalcularReadinessJugadora revierte todos los wellness y readiness nuevos del lote', async () => {
    expect(vi.isMockFunction(db.transaction)).toBe(false)

    // 1. Wellness y readiness preexistentes ajenos al lote
    await db.wellness.put({
      id_jugadora: J1,
      fecha: '2026-04-01',
      calidad_sueno: 5,
      fatiga: 5,
      dolor_muscular: 5,
      estres: 5,
      estado_animo: 5,
      dolor_especifico: 'preexistente-ajeno',
      score_wellness: 50,
    } as any)

    await db.readiness.put({
      id_jugadora: J1,
      fecha: '2026-04-01',
      score: 77,
      categoria: 'OPTIMO',
      componentes: { zScoreWellness: 0, acwr: 1, fatiga: 5, dolor: 5 },
      recomendacion: 'Normal',
      creada: '2026-04-01T10:00:00.000Z',
    } as any)

    // 2. Espiar recalcularReadinessJugadora para forzar un error en la 2ª llamada
    let callCount = 0
    const spy = vi.spyOn(readinessService, 'recalcularReadinessJugadora')
      .mockImplementation(async (_jId, _fecha) => {
        callCount++
        if (callCount === 2) {
          throw new Error('Fallo simulado en el recálculo de readiness')
        }
      })

    // 3. Dos respuestas nuevas válidas en el lote
    const responses = [
      { id_jugadora: J1, fecha: '2026-05-10', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 9 },
      { id_jugadora: J2, fecha: '2026-05-10', calidad_sueno: 9, fatiga: 8, dolor_muscular: 7, estres: 6, estado_animo: 8 },
    ]

    const loadAllSpy = vi.spyOn(useStore.getState(), 'loadAll')

    // 4. importFormResponses debe rechazar
    await expect(
      useStore.getState().importFormResponses(responses as any)
    ).rejects.toThrow('Fallo simulado en el recálculo de readiness')

    // 5. Comprobar rollback en IndexedDB real:
    // Ningún wellness del lote debe persistir
    const wJ1 = await db.wellness.where({ id_jugadora: J1, fecha: '2026-05-10' }).first()
    expect(wJ1).toBeFalsy()

    const wJ2 = await db.wellness.where({ id_jugadora: J2, fecha: '2026-05-10' }).first()
    expect(wJ2).toBeFalsy()

    // Ningún readiness del lote debe persistir
    const rJ1 = await db.readiness.where({ id_jugadora: J1, fecha: '2026-05-10' }).first()
    expect(rJ1).toBeFalsy()

    const rJ2 = await db.readiness.where({ id_jugadora: J2, fecha: '2026-05-10' }).first()
    expect(rJ2).toBeFalsy()

    // Wellness y readiness preexistentes se conservan exactos
    const wAjeno = await db.wellness.where({ id_jugadora: J1, fecha: '2026-04-01' }).first()
    expect(wAjeno?.dolor_especifico).toBe('preexistente-ajeno')

    const rAjeno = await db.readiness.where({ id_jugadora: J1, fecha: '2026-04-01' }).first()
    expect(rAjeno?.score).toBe(77)

    // loadAll no debe haberse llamado
    expect(loadAllSpy).not.toHaveBeenCalled()

    spy.mockRestore()
  })
})
