/**
 * Test de integración real — Bloque 2F
 *
 * Usa fake-indexeddb para proveer IndexedDB real al entorno jsdom.
 * No mockea db.transaction, tablas Dexie, put, where ni toArray.
 * Prueba persistencia real y rollback completo de addRPE_Partido.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Desmockear db y servicios para usar Dexie real
vi.unmock('@/db/database')
vi.unmock('@/services/resumenSemanal')
vi.unmock('@/services/readiness')

import { db } from '@/db/database'
import { useStore } from './store'
import * as resumenService from '@/services/resumenSemanal'
import * as readinessService from '@/services/readiness'

const J1 = 'JUGADORA-TEST-001'
const PARTIDO_1 = 'PARTIDO-TEST-001'
const PARTIDO_2 = 'PARTIDO-TEST-002'
const PARTIDO_SIN_FECHA = 'PARTIDO-TEST-SIN-FECHA'

const jugadoraBase = { id_jugadora: J1, nombre: 'Jugadora Uno', posicion: 'ala', activa: true, dorsal: 1 }
const partidoBase1 = { id_partido: PARTIDO_1, fecha: '2026-05-10', rival: 'Rival FC', lugar: 'Local' as const, competicion: 'Liga' }
const partidoBase2 = { id_partido: PARTIDO_2, fecha: '2026-05-15', rival: 'Otro FC', lugar: 'Visitante' as const, competicion: 'Copa' }
const partidoBaseSinFecha = { id_partido: PARTIDO_SIN_FECHA, fecha: '', rival: 'Sin Fecha FC', lugar: 'Local' as const, competicion: 'Liga' }

async function limpiarDB() {
  await Promise.all([
    db.rpe_partido.clear(),
    db.resumen_semanal.clear(),
    db.readiness.clear(),
    db.jugadoras.clear(),
    db.partidos.clear(),
    db.sesiones.clear(),
    db.sesion_rpe.clear(),
    db.wellness.clear(),
    db.alertas.clear(),
  ])
}

async function seedBase() {
  await db.jugadoras.put(jugadoraBase as any)
  await db.partidos.put(partidoBase1 as any)
  await db.partidos.put(partidoBase2 as any)
  await db.partidos.put(partidoBaseSinFecha as any)
}

describe('addRPE_Partido - Integración real con IndexedDB (Bloque 2F)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await limpiarDB()
    await seedBase()
  })

  afterEach(async () => {
    await limpiarDB()
  })

  it('1. Caso correcto: RPE de partido válido persiste con resumen semanal y readiness derivados en IndexedDB real', async () => {
    expect(vi.isMockFunction(db.transaction)).toBe(false)

    const rpe = {
      id_partido: PARTIDO_1,
      id_jugadora: J1,
      fecha: '2026-05-10',
      rpe: 8,
      minutos_jugados: 30,
      carga_ua: 240,
    }

    await useStore.getState().addRPE_Partido(rpe as any)

    // 1. RPE_Partido guardado físicamente
    const rpes = await db.rpe_partido.where({ id_partido: PARTIDO_1, id_jugadora: J1 }).toArray()
    expect(rpes).toHaveLength(1)
    expect(rpes[0].rpe).toBe(8)
    expect(rpes[0].carga_ua).toBe(240)

    // 2. Resumen semanal derivado
    const resumenes = await db.resumen_semanal.where({ id_jugadora: J1 }).toArray()
    expect(resumenes.length).toBeGreaterThanOrEqual(1)

    // 3. Readiness derivado
    const readinessList = await db.readiness.where({ id_jugadora: J1 }).toArray()
    expect(readinessList.length).toBeGreaterThanOrEqual(1)
  })

  it('2. Rollback por error en resumen semanal: cero RPE nuevos ni derivados en Dexie', async () => {
    expect(vi.isMockFunction(db.transaction)).toBe(false)

    const spy = vi.spyOn(resumenService, 'recalcularResumenSemanal')
      .mockRejectedValue(new Error('Fallo real simulado en resumen semanal'))

    const rpe = {
      id_partido: PARTIDO_1,
      id_jugadora: J1,
      fecha: '2026-05-10',
      rpe: 8,
      minutos_jugados: 30,
      carga_ua: 240,
    }

    await expect(useStore.getState().addRPE_Partido(rpe as any)).rejects.toThrow(
      'Fallo real simulado en resumen semanal'
    )

    // Ningún RPE de partido debe persistir
    const rpes = await db.rpe_partido.where({ id_partido: PARTIDO_1 }).toArray()
    expect(rpes).toHaveLength(0)

    // Ningún resumen semanal debe persistir
    const resumenes = await db.resumen_semanal.where({ id_jugadora: J1 }).toArray()
    expect(resumenes).toHaveLength(0)

    // Ningún readiness debe persistir
    const readinessList = await db.readiness.where({ id_jugadora: J1 }).toArray()
    expect(readinessList).toHaveLength(0)

    spy.mockRestore()
  })

  it('3. Rollback por error en readiness: cero RPE nuevos ni derivados en Dexie', async () => {
    expect(vi.isMockFunction(db.transaction)).toBe(false)

    const spy = vi.spyOn(readinessService, 'recalcularReadinessJugadora')
      .mockRejectedValue(new Error('Fallo real simulado en readiness'))

    const rpe = {
      id_partido: PARTIDO_1,
      id_jugadora: J1,
      fecha: '2026-05-10',
      rpe: 8,
      minutos_jugados: 30,
      carga_ua: 240,
    }

    await expect(useStore.getState().addRPE_Partido(rpe as any)).rejects.toThrow(
      'Fallo real simulado en readiness'
    )

    const rpes = await db.rpe_partido.where({ id_partido: PARTIDO_1 }).toArray()
    expect(rpes).toHaveLength(0)

    const resumenes = await db.resumen_semanal.where({ id_jugadora: J1 }).toArray()
    expect(resumenes).toHaveLength(0)

    const readinessList = await db.readiness.where({ id_jugadora: J1 }).toArray()
    expect(readinessList).toHaveLength(0)

    spy.mockRestore()
  })

  it('4. Referencia inexistente (jugadora / partido): rechaza y cero escrituras', async () => {
    const rpeJugadoraInvalida = { id_partido: PARTIDO_1, id_jugadora: 'J_INEXISTENTE', fecha: '2026-05-10', rpe: 7, minutos_jugados: 20 }
    await expect(useStore.getState().addRPE_Partido(rpeJugadoraInvalida as any)).rejects.toThrow(
      "La jugadora 'J_INEXISTENTE' no existe en la base de datos"
    )

    const rpePartidoInvalido = { id_partido: 'PARTIDO_INEXISTENTE', id_jugadora: J1, fecha: '2026-05-10', rpe: 7, minutos_jugados: 20 }
    await expect(useStore.getState().addRPE_Partido(rpePartidoInvalido as any)).rejects.toThrow(
      "El partido 'PARTIDO_INEXISTENTE' no existe en la base de datos"
    )

    const rpes = await db.rpe_partido.toArray()
    expect(rpes).toHaveLength(0)
  })

  it('5. Duplicado lógico (id_partido, id_jugadora): rechaza y conserva intacto el registro anterior', async () => {
    const rpeInicial = {
      id_partido: PARTIDO_1,
      id_jugadora: J1,
      fecha: '2026-05-10',
      rpe: 6,
      minutos_jugados: 15,
      carga_ua: 90,
    }

    await useStore.getState().addRPE_Partido(rpeInicial as any)

    const rpeDuplicado = {
      id_partido: PARTIDO_1,
      id_jugadora: J1,
      fecha: '2026-05-10',
      rpe: 10,
      minutos_jugados: 40,
      carga_ua: 400,
    }

    await expect(useStore.getState().addRPE_Partido(rpeDuplicado as any)).rejects.toThrow(
      'Ya existe un registro de RPE de partido para esta jugadora en este partido'
    )

    const rpes = await db.rpe_partido.where({ id_partido: PARTIDO_1, id_jugadora: J1 }).toArray()
    expect(rpes).toHaveLength(1)
    expect(rpes[0].rpe).toBe(6)
    expect(rpes[0].minutos_jugados).toBe(15)
  })

  it('6. Preservación física de datos anteriores: fallo posterior conserva datos existentes intactos', async () => {
    // 1. Crear RPE inicial exitoso para PARTIDO_1
    await useStore.getState().addRPE_Partido({
      id_partido: PARTIDO_1,
      id_jugadora: J1,
      fecha: '2026-05-10',
      rpe: 6,
      minutos_jugados: 15,
      carga_ua: 90,
    } as any)

    // 2. Intentar agregar RPE para PARTIDO_2 pero forzar fallo en readiness
    const spy = vi.spyOn(readinessService, 'recalcularReadinessJugadora')
      .mockRejectedValueOnce(new Error('Fallo simulado en readiness para partido 2'))

    await expect(useStore.getState().addRPE_Partido({
      id_partido: PARTIDO_2,
      id_jugadora: J1,
      fecha: '2026-05-15',
      rpe: 9,
      minutos_jugados: 35,
      carga_ua: 315,
    } as any)).rejects.toThrow('Fallo simulado en readiness para partido 2')

    // 3. Confirmar que PARTIDO_1 se conserva intacto
    const rpesPartido1 = await db.rpe_partido.where({ id_partido: PARTIDO_1 }).toArray()
    expect(rpesPartido1).toHaveLength(1)
    expect(rpesPartido1[0].rpe).toBe(6)

    // 4. Confirmar que PARTIDO_2 no se guardó
    const rpesPartido2 = await db.rpe_partido.where({ id_partido: PARTIDO_2 }).toArray()
    expect(rpesPartido2).toHaveLength(0)

    spy.mockRestore()
  })

  it('7. Fecha propia prioritaria en IndexedDB: r.fecha se guarda y se usa en recálculos', async () => {
    const rpe = {
      id_partido: PARTIDO_1, // match.fecha es '2026-05-10'
      id_jugadora: J1,
      fecha: '2026-05-25', // r.fecha explícita y distinta
      rpe: 7,
      minutos_jugados: 25,
      carga_ua: 175,
    }

    await useStore.getState().addRPE_Partido(rpe as any)

    const rpes = await db.rpe_partido.where({ id_partido: PARTIDO_1 }).toArray()
    expect(rpes).toHaveLength(1)
    expect(rpes[0].fecha).toBe('2026-05-25')
  })

  it('8. Fecha heredada del partido en IndexedDB: con r.fecha vacía, hereda match.fecha', async () => {
    const rpe = {
      id_partido: PARTIDO_1, // match.fecha es '2026-05-10'
      id_jugadora: J1,
      fecha: '', // r.fecha vacía
      rpe: 7,
      minutos_jugados: 20,
      carga_ua: 140,
    }

    await useStore.getState().addRPE_Partido(rpe as any)

    const rpes = await db.rpe_partido.where({ id_partido: PARTIDO_1 }).toArray()
    expect(rpes).toHaveLength(1)
    expect(rpes[0].fecha).toBe('2026-05-10')
  })

  it('9. Ambas fechas vacías en IndexedDB real: rechaza con error y 0 persistencia', async () => {
    const rpe = {
      id_partido: PARTIDO_SIN_FECHA, // match.fecha es ''
      id_jugadora: J1,
      fecha: '', // r.fecha vacía
      rpe: 7,
      minutos_jugados: 20,
      carga_ua: 140,
    }

    await expect(useStore.getState().addRPE_Partido(rpe as any)).rejects.toThrow(
      'No se pudo determinar la fecha del RPE de partido'
    )

    // Verificar físicamente en IndexedDB que nada persistió
    const rpes = await db.rpe_partido.where({ id_partido: PARTIDO_SIN_FECHA }).toArray()
    expect(rpes).toHaveLength(0)

    const resumenes = await db.resumen_semanal.where({ id_jugadora: J1 }).toArray()
    expect(resumenes).toHaveLength(0)

    const readinessList = await db.readiness.where({ id_jugadora: J1 }).toArray()
    expect(readinessList).toHaveLength(0)
  })
})
