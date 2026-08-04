/**
 * Test de integración real — Bloque 2A.1
 *
 * Usa fake-indexeddb para proveer IndexedDB real al entorno jsdom.
 * No mockea db.transaction, tablas Dexie, bulkPut, put, where ni toArray.
 * Solo espía recalcularReadinessJugadora para forzar errores en el test B.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Desmockear db y servicios para usar Dexie real
vi.unmock('@/db/database')
vi.unmock('@/services/resumenSemanal')
vi.unmock('@/services/readiness')

// Importar después de unmock
import { db } from '@/db/database'
import { useStore } from './store'
import * as readinessService from '@/services/readiness'

// Datos mínimos
const JUGADORA_ID = 'test-jugadora-integ-001'
const SESION_ID = 'test-sesion-integ-001'
const FECHA = '2026-05-10'

const jugadoraMinima = {
  id_jugadora: JUGADORA_ID,
  nombre: 'Test Jugadora',
  posicion: 'ala',
  activa: true,
  dorsal: 7,
}

const sesionMinima = {
  id_sesion: SESION_ID,
  fecha: FECHA,
  tipo_sesion: 'entrenamiento',
  duracion_min: 60,
  estado: 'realizada' as const,
  participantes: [JUGADORA_ID],
  contenido: 'Test',
}

const rpeValido = {
  id_sesion: SESION_ID,
  id_jugadora: JUGADORA_ID,
  fecha: FECHA,
  rpe: 7,
  duracion_min: 60,
  carga_ua: 420,
}

async function limpiarDB() {
  // Limpiar todas las tablas relevantes
  await Promise.all([
    db.sesion_rpe.clear(),
    db.resumen_semanal.clear(),
    db.readiness.clear(),
    db.jugadoras.clear(),
    db.sesiones.clear(),
    db.partidos.clear(),
    db.rpe_partido.clear(),
    db.wellness.clear(),
    db.alertas.clear(),
  ])
}

async function seedDatosMinimos() {
  await db.jugadoras.put(jugadoraMinima as any)
  await db.sesiones.put(sesionMinima as any)
}

describe('saveRpeBatch - Integración real con IndexedDB (Bloque 2A.1)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await limpiarDB()
    await seedDatosMinimos()
  })

  afterEach(async () => {
    await limpiarDB()
  })

  it('A. Control positivo: RPE válido persiste con resumen y readiness en Dexie real', async () => {
    // Confirmar que db.transaction NO está mockeada
    expect(vi.isMockFunction(db.transaction)).toBe(false)

    await useStore.getState().saveRpeBatch([rpeValido])

    // 1. RPE persistido en IndexedDB real
    const rpes = await db.sesion_rpe.where({ id_jugadora: JUGADORA_ID }).toArray()
    expect(rpes.length).toBeGreaterThanOrEqual(1)
    expect(rpes.some(r => r.id_sesion === SESION_ID && r.rpe === 7)).toBe(true)

    // 2. Resumen semanal generado
    const resumenes = await db.resumen_semanal.where({ id_jugadora: JUGADORA_ID }).toArray()
    expect(resumenes.length).toBeGreaterThanOrEqual(1)

    // 3. Readiness generado
    const readinessList = await db.readiness.where({ id_jugadora: JUGADORA_ID }).toArray()
    expect(readinessList.length).toBeGreaterThanOrEqual(1)
  })

  it('B. Rollback real: error en readiness revierte RPE y resumen en IndexedDB', async () => {
    // Confirmar que db.transaction NO está mockeada
    expect(vi.isMockFunction(db.transaction)).toBe(false)

    // Espiar el helper real para forzar un error DENTRO de la transacción
    const spy = vi.spyOn(readinessService, 'recalcularReadinessJugadora')
      .mockRejectedValue(new Error('Fallo real en readiness'))

    // saveRpeBatch debe rechazar
    await expect(
      useStore.getState().saveRpeBatch([rpeValido])
    ).rejects.toThrow('Fallo real en readiness')

    // Verificar que el spy fue invocado (error ocurrió dentro de transaction)
    expect(spy).toHaveBeenCalledWith(JUGADORA_ID, FECHA)

    // === VERIFICACIÓN FÍSICA DE ROLLBACK ===

    // 1. Ningún RPE del lote debe existir
    const rpes = await db.sesion_rpe.where({ id_jugadora: JUGADORA_ID }).toArray()
    expect(rpes.filter(r => r.id_sesion === SESION_ID)).toHaveLength(0)

    // 2. Ningún resumen semanal del lote debe existir
    const resumenes = await db.resumen_semanal.where({ id_jugadora: JUGADORA_ID }).toArray()
    expect(resumenes).toHaveLength(0)

    // 3. Ningún readiness del lote debe existir
    const readinessList = await db.readiness.where({ id_jugadora: JUGADORA_ID }).toArray()
    expect(readinessList).toHaveLength(0)

    spy.mockRestore()
  })
})
