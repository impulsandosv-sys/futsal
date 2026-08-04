/**
 * Test de integración real — Bloque 2E
 *
 * Usa fake-indexeddb para proveer IndexedDB real al entorno jsdom.
 * No mockea db.transaction, tablas Dexie, put, where ni toArray.
 * Prueba persistencia real y rollback completo de addWellness y updateWellness.
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

describe('wellness - Integración real con IndexedDB (Bloque 2E)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await limpiarDB()
    await seedJugadoras()
  })

  afterEach(async () => {
    await limpiarDB()
  })

  // --- ALTA (addWellness) ---

  it('A1. Alta correcta: wellness y readiness persisten en IndexedDB real', async () => {
    expect(vi.isMockFunction(db.transaction)).toBe(false)

    const w = {
      id_jugadora: J1,
      fecha: '2026-05-10',
      calidad_sueno: 8,
      fatiga: 7,
      dolor_muscular: 6,
      estres: 5,
      estado_animo: 9,
      dolor_especifico: 'Sin dolor',
      score_wellness: 70,
    }

    await useStore.getState().addWellness(w as any)

    const wPersistido = await db.wellness.where({ id_jugadora: J1, fecha: '2026-05-10' }).first()
    expect(wPersistido).toBeTruthy()
    expect(wPersistido?.calidad_sueno).toBe(8)

    const rPersistido = await db.readiness.where({ id_jugadora: J1, fecha: '2026-05-10' }).first()
    expect(rPersistido).toBeTruthy()
  })

  it('A2. Fallo de readiness en alta: cero wellness/readiness nuevos (rollback real)', async () => {
    expect(vi.isMockFunction(db.transaction)).toBe(false)

    const spy = vi.spyOn(readinessService, 'recalcularReadinessJugadora')
      .mockRejectedValue(new Error('Fallo simulado en readiness'))

    const w = {
      id_jugadora: J1,
      fecha: '2026-05-10',
      calidad_sueno: 8,
      fatiga: 7,
      dolor_muscular: 6,
      estres: 5,
      estado_animo: 9,
      dolor_especifico: 'Sin dolor',
      score_wellness: 70,
    }

    await expect(useStore.getState().addWellness(w as any)).rejects.toThrow('Fallo simulado en readiness')

    const wPersistido = await db.wellness.where({ id_jugadora: J1, fecha: '2026-05-10' }).first()
    expect(wPersistido).toBeFalsy()

    const rPersistido = await db.readiness.where({ id_jugadora: J1, fecha: '2026-05-10' }).first()
    expect(rPersistido).toBeFalsy()

    spy.mockRestore()
  })

  it('A3. Duplicado en alta: conserva el wellness previo exactamente sin modificar', async () => {
    await db.wellness.put({
      id_jugadora: J1,
      fecha: '2026-05-10',
      calidad_sueno: 5,
      fatiga: 5,
      dolor_muscular: 5,
      estres: 5,
      estado_animo: 5,
      dolor_especifico: 'preexistente',
      score_wellness: 50,
    } as any)

    const w = {
      id_jugadora: J1,
      fecha: '2026-05-10',
      calidad_sueno: 10,
      fatiga: 10,
      dolor_muscular: 10,
      estres: 10,
      estado_animo: 10,
    }

    await expect(useStore.getState().addWellness(w as any)).rejects.toThrow(
      'Ya existe un registro de wellness para esta jugadora en esta fecha'
    )

    const wPrev = await db.wellness.where({ id_jugadora: J1, fecha: '2026-05-10' }).first()
    expect(wPrev?.dolor_especifico).toBe('preexistente')
    expect(wPrev?.calidad_sueno).toBe(5)
  })

  it('A4. Jugadora inexistente en alta: rechaza y cero registros creados', async () => {
    const w = {
      id_jugadora: 'J_INEXISTENTE',
      fecha: '2026-05-10',
      calidad_sueno: 8,
      fatiga: 7,
      dolor_muscular: 6,
      estres: 5,
      estado_animo: 9,
    }

    await expect(useStore.getState().addWellness(w as any)).rejects.toThrow(
      "La jugadora 'J_INEXISTENTE' no existe en la base de datos"
    )

    const todos = await db.wellness.toArray()
    expect(todos).toHaveLength(0)
  })

  // --- EDICIÓN (updateWellness) ---

  it('E1. Cambio de escalas: wellness y readiness del par actual se actualizan físicamente', async () => {
    const id = await db.wellness.put({
      id_jugadora: J1,
      fecha: '2026-05-10',
      calidad_sueno: 3,
      fatiga: 3,
      dolor_muscular: 3,
      estres: 3,
      estado_animo: 3,
      score_wellness: 30,
    } as any)

    const wEditado = {
      id,
      id_jugadora: J1,
      fecha: '2026-05-10',
      calidad_sueno: 9,
      fatiga: 9,
      dolor_muscular: 9,
      estres: 9,
      estado_animo: 9,
      score_wellness: 90,
    }

    await useStore.getState().updateWellness(wEditado as any)

    const wBD = await db.wellness.get(id)
    expect(wBD?.calidad_sueno).toBe(9)
    expect(wBD?.score_wellness).toBe(90)

    const rBD = await db.readiness.where({ id_jugadora: J1, fecha: '2026-05-10' }).first()
    expect(rBD).toBeTruthy()
  })

  it('E2. Fallo de readiness en edición: wellness y readiness originales se conservan exactamente', async () => {
    const id = await db.wellness.put({
      id_jugadora: J1,
      fecha: '2026-05-10',
      calidad_sueno: 3,
      fatiga: 3,
      dolor_muscular: 3,
      estres: 3,
      estado_animo: 3,
      score_wellness: 30,
    } as any)

    await db.readiness.put({
      id_jugadora: J1,
      fecha: '2026-05-10',
      score: 30,
      categoria: 'CRITICO',
      componentes: { zScoreWellness: -2, acwr: 1, fatiga: 3, dolor: 3 },
      recomendacion: 'Descanso',
      creada: '2026-05-10T10:00:00.000Z',
    } as any)

    const spy = vi.spyOn(readinessService, 'recalcularReadinessJugadora')
      .mockRejectedValue(new Error('Fallo simulado en readiness edición'))

    const wEditado = {
      id,
      id_jugadora: J1,
      fecha: '2026-05-10',
      calidad_sueno: 10,
      fatiga: 10,
      dolor_muscular: 10,
      estres: 10,
      estado_animo: 10,
      score_wellness: 100,
    }

    await expect(useStore.getState().updateWellness(wEditado as any)).rejects.toThrow(
      'Fallo simulado en readiness edición'
    )

    const wBD = await db.wellness.get(id)
    expect(wBD?.calidad_sueno).toBe(3)
    expect(wBD?.score_wellness).toBe(30)

    const rBD = await db.readiness.where({ id_jugadora: J1, fecha: '2026-05-10' }).first()
    expect(rBD?.score).toBe(30)

    spy.mockRestore()
  })

  it('E3. Cambio de fecha: recalculó ambos pares y actualizó físicamente IndexedDB', async () => {
    const id = await db.wellness.put({
      id_jugadora: J1,
      fecha: '2026-05-10',
      calidad_sueno: 5,
      fatiga: 5,
      dolor_muscular: 5,
      estres: 5,
      estado_animo: 5,
      score_wellness: 50,
    } as any)

    // Crear readiness inicial para 2026-05-10
    await useStore.getState().recalculateReadiness(J1, '2026-05-10')

    // Editar cambiando fecha a 2026-05-12
    const wEditado = {
      id,
      id_jugadora: J1,
      fecha: '2026-05-12',
      calidad_sueno: 8,
      fatiga: 8,
      dolor_muscular: 8,
      estres: 8,
      estado_animo: 8,
      score_wellness: 80,
    }

    await useStore.getState().updateWellness(wEditado as any)

    // 1. Wellness de la fecha vieja ya no existe con ese ID, ahora está en la fecha nueva
    const wViejo = await db.wellness.where({ id_jugadora: J1, fecha: '2026-05-10' }).first()
    expect(wViejo).toBeFalsy()

    const wNuevo = await db.wellness.where({ id_jugadora: J1, fecha: '2026-05-12' }).first()
    expect(wNuevo?.id).toBe(id)

    // 2. Readiness de ambos pares existe (el par viejo 2026-05-10 se recalculó sin wellness; el par nuevo 2026-05-12 se calculó con wellness)
    const rViejo = await db.readiness.where({ id_jugadora: J1, fecha: '2026-05-10' }).first()
    expect(rViejo).toBeTruthy()

    const rNuevo = await db.readiness.where({ id_jugadora: J1, fecha: '2026-05-12' }).first()
    expect(rNuevo).toBeTruthy()
  })

  it('E4. Cambio de jugadora: recalculó ambos pares y actualizó físicamente IndexedDB', async () => {
    const id = await db.wellness.put({
      id_jugadora: J1,
      fecha: '2026-05-10',
      calidad_sueno: 5,
      fatiga: 5,
      dolor_muscular: 5,
      estres: 5,
      estado_animo: 5,
      score_wellness: 50,
    } as any)

    const wEditado = {
      id,
      id_jugadora: J2,
      fecha: '2026-05-10',
      calidad_sueno: 8,
      fatiga: 8,
      dolor_muscular: 8,
      estres: 8,
      estado_animo: 8,
      score_wellness: 80,
    }

    await useStore.getState().updateWellness(wEditado as any)

    // J1 ya no tiene wellness en esa fecha
    const wJ1 = await db.wellness.where({ id_jugadora: J1, fecha: '2026-05-10' }).first()
    expect(wJ1).toBeFalsy()

    // J2 tiene el wellness ahora
    const wJ2 = await db.wellness.where({ id_jugadora: J2, fecha: '2026-05-10' }).first()
    expect(wJ2?.id).toBe(id)

    // Ambos readiness procesados
    const rJ1 = await db.readiness.where({ id_jugadora: J1, fecha: '2026-05-10' }).first()
    expect(rJ1).toBeTruthy()

    const rJ2 = await db.readiness.where({ id_jugadora: J2, fecha: '2026-05-10' }).first()
    expect(rJ2).toBeTruthy()
  })

  it('E5. Colisión de clave lógica: rechazo y preserva ambos wellness existentes', async () => {
    const id1 = await db.wellness.put({
      id_jugadora: J1,
      fecha: '2026-05-10',
      calidad_sueno: 5,
      score_wellness: 50,
    } as any)

    const id2 = await db.wellness.put({
      id_jugadora: J1,
      fecha: '2026-05-11',
      calidad_sueno: 7,
      score_wellness: 70,
    } as any)

    // Intentar cambiar id2 para usar la fecha 2026-05-10 (donde id1 ya existe)
    const wConflictivo = {
      id: id2,
      id_jugadora: J1,
      fecha: '2026-05-10',
      calidad_sueno: 9,
      score_wellness: 90,
    }

    await expect(useStore.getState().updateWellness(wConflictivo as any)).rejects.toThrow(
      'Ya existe otro registro de wellness para esta jugadora en esta fecha'
    )

    const w1 = await db.wellness.get(id1)
    expect(w1?.fecha).toBe('2026-05-10')
    expect(w1?.calidad_sueno).toBe(5)

    const w2 = await db.wellness.get(id2)
    expect(w2?.fecha).toBe('2026-05-11')
    expect(w2?.calidad_sueno).toBe(7)
  })

  it('E6. ID inexistente en edición: rechazo y cero inserciones', async () => {
    const wInexistente = {
      id: 99999,
      id_jugadora: J1,
      fecha: '2026-05-10',
      calidad_sueno: 8,
    }

    await expect(useStore.getState().updateWellness(wInexistente as any)).rejects.toThrow(
      'No existe el registro de wellness a actualizar'
    )

    const todos = await db.wellness.toArray()
    expect(todos).toHaveLength(0)
  })
})
