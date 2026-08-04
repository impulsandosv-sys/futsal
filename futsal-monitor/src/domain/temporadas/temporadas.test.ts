import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.unmock('@/db/database')

import { FutsalDB } from '@/db/database'
import {
  validarTemporada,
  crearTemporada,
  activarTemporada,
  archivarTemporada,
  obtenerTemporadaActiva,
} from './temporadas'
import type { Temporada } from '@/types'

describe('Dominio Temporada (T-02-DOM-GOV)', () => {
  let testDb: FutsalDB

  beforeEach(async () => {
    // Generar un nombre único de base de datos para cada test para aislamiento estricto
    const dbName = `test_temporadas_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    testDb = new FutsalDB(dbName)
    await testDb.open()
  })

  afterEach(async () => {
    if (testDb) {
      await testDb.close()
      await testDb.delete()
    }
  })

  it('1. validarTemporada aprueba una temporada bien formada', () => {
    const t: Temporada = {
      id_temporada: 'TEMP-2026-2027',
      nombre: 'Temporada 2026-2027',
      fecha_inicio: '2026-08-01',
      fecha_fin: '2027-06-30',
      activa: true,
    }
    expect(validarTemporada(t)).toEqual([])
  })

  it('2. validarTemporada rechaza si fecha_inicio > fecha_fin', () => {
    const t: Temporada = {
      id_temporada: 'TEMP-ERR',
      nombre: 'Temporada Invalida',
      fecha_inicio: '2027-07-01',
      fecha_fin: '2026-06-30',
      activa: false,
    }
    const errs = validarTemporada(t)
    expect(errs).toContain('La fecha de inicio no puede ser posterior a la fecha de fin')
  })

  it('3. validarTemporada rechaza fechas en formato erróneo', () => {
    const t: Temporada = {
      id_temporada: 'TEMP-ERR',
      nombre: 'Temporada Bad Date',
      fecha_inicio: '2026-02-30',
      fecha_fin: '2027-06-30',
      activa: false,
    }
    const errs = validarTemporada(t)
    expect(errs.some((e) => e.includes('calendario'))).toBe(true)
  })

  it('4. crearTemporada desactiva de forma atómica la temporada activa anterior', async () => {
    const t1: Temporada = {
      id_temporada: 'T1_4',
      nombre: '2025-2026',
      fecha_inicio: '2025-08-01',
      fecha_fin: '2026-06-30',
      activa: true,
    }
    await crearTemporada(testDb, t1)

    let activa = await obtenerTemporadaActiva(testDb)
    expect(activa?.id_temporada).toBe('T1_4')

    const t2: Temporada = {
      id_temporada: 'T2_4',
      nombre: '2026-2027',
      fecha_inicio: '2026-08-01',
      fecha_fin: '2027-06-30',
      activa: true,
    }
    await crearTemporada(testDb, t2)

    activa = await obtenerTemporadaActiva(testDb)
    expect(activa?.id_temporada).toBe('T2_4')

    const t1Reloaded = await testDb.temporadas.get('T1_4')
    expect(t1Reloaded?.activa).toBe(false)
  })

  it('5. Garantiza que solo existe una única temporada activa a la vez', async () => {
    await crearTemporada(testDb, {
      id_temporada: 'T1_5',
      nombre: '2024-2025',
      fecha_inicio: '2024-08-01',
      fecha_fin: '2025-06-30',
      activa: true,
    })
    await crearTemporada(testDb, {
      id_temporada: 'T2_5',
      nombre: '2025-2026',
      fecha_inicio: '2025-08-01',
      fecha_fin: '2026-06-30',
      activa: false,
    })

    await activarTemporada(testDb, 'T2_5')

    const todas = await testDb.temporadas.toArray()
    const activas = todas.filter((t) => t.activa === true)
    expect(activas).toHaveLength(1)
    expect(activas[0].id_temporada).toBe('T2_5')
  })

  it('6. archivarTemporada conserva el registro y sus datos marcando activa = false', async () => {
    const t1: Temporada = {
      id_temporada: 'T1_6',
      nombre: '2025-2026',
      fecha_inicio: '2025-08-01',
      fecha_fin: '2026-06-30',
      activa: true,
      notas: 'Notas importantes de la temporada',
    }
    await crearTemporada(testDb, t1)

    await archivarTemporada(testDb, 'T1_6')

    const t1Archivada = await testDb.temporadas.get('T1_6')
    expect(t1Archivada).toBeDefined()
    expect(t1Archivada?.activa).toBe(false)
    expect(t1Archivada?.notas).toBe('Notas importantes de la temporada')

    const activa = await obtenerTemporadaActiva(testDb)
    expect(activa).toBeNull()
  })

  it('7. Una temporada inactiva puede coexistir con una temporada activa', async () => {
    await crearTemporada(testDb, {
      id_temporada: 'T1_7',
      nombre: 'Inactiva',
      fecha_inicio: '2024-08-01',
      fecha_fin: '2025-06-30',
      activa: false,
    })
    await crearTemporada(testDb, {
      id_temporada: 'T2_7',
      nombre: 'Activa',
      fecha_inicio: '2025-08-01',
      fecha_fin: '2026-06-30',
      activa: true,
    })

    const todas = await testDb.temporadas.toArray()
    expect(todas).toHaveLength(2)
    const activa = await obtenerTemporadaActiva(testDb)
    expect(activa?.id_temporada).toBe('T2_7')
  })

  it('8. Rechaza crear una temporada con ID duplicado', async () => {
    const t1: Temporada = {
      id_temporada: 'T1_8',
      nombre: '2025-2026',
      fecha_inicio: '2025-08-01',
      fecha_fin: '2026-06-30',
      activa: true,
    }
    await crearTemporada(testDb, t1)

    await expect(crearTemporada(testDb, t1)).rejects.toThrow(
      "Ya existe una temporada con el ID 'T1_8'",
    )
  })
})
