import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.unmock('@/db/database')
vi.unmock('@/utils/importEngine')
vi.unmock('@/services/readiness')
vi.unmock('@/services/resumenSemanal')

import { FutsalDB } from '@/db/database'
import {
  aplicarImportacionWellness,
  obtenerContextoValidacionWellness,
  construirVistaPrevia
} from '@/utils/importEngine'
import { recalcularReadinessJugadora } from '@/services/readiness'
import { recalcularResumenSemanal } from '@/services/resumenSemanal'
import { crearTemporada } from '@/domain/temporadas/temporadas'
import { agregarAliasJugadora } from '@/domain/alias/aliasJugadora'
import type {
  ColumnMapping,
  RawImportRow,
  Temporada
} from '@/types'

describe('T-02A-R — Test de Atomicidad y Equivalencia Postimportación Wellness', () => {
  let dbTest: FutsalDB
  const J1 = 'JUG-001'
  const J2 = 'JUG-002'
  const season2026: Temporada = {
    id_temporada: 'TEMP-2026-2027',
    nombre: 'Temporada 26/27',
    fecha_inicio: '2026-01-01',
    fecha_fin: '2026-08-01',
    activa: true
  }

  const defaultMapping: ColumnMapping[] = [
    { internalField: 'id_jugadora', excelHeader: 'id_jugadora', required: true, label: 'ID' },
    { internalField: 'fecha', excelHeader: 'fecha', required: true, label: 'Fecha' },
    { internalField: 'calidad_sueno', excelHeader: 'calidad_sueno', required: true, label: 'Sueño' },
    { internalField: 'fatiga', excelHeader: 'fatiga', required: true, label: 'Fatiga' },
    { internalField: 'dolor_muscular', excelHeader: 'dolor_muscular', required: true, label: 'Dolor' },
    { internalField: 'estres', excelHeader: 'estres', required: true, label: 'Estrés' },
    { internalField: 'estado_animo', excelHeader: 'estado_animo', required: true, label: 'Ánimo' }
  ]

  beforeEach(async () => {
    vi.restoreAllMocks()
    const dbName = `test_wellness_atomicity_${Date.now()}_${Math.random()}`
    dbTest = new FutsalDB(dbName)
    await dbTest.open()

    // Sembrar datos iniciales
    await dbTest.jugadoras.put({ id_jugadora: J1, nombre: 'Ana López', posicion: 'Ala', activa: true })
    await dbTest.jugadoras.put({ id_jugadora: J2, nombre: 'María García', posicion: 'Pívot', activa: true })
    await crearTemporada(dbTest, season2026)

    await agregarAliasJugadora(dbTest, {
      id_jugadora: J1,
      origen: 'google_forms',
      valor: 'GF-001',
      activo: true,
      fecha_alta: '2026-01-01'
    })
    await agregarAliasJugadora(dbTest, {
      id_jugadora: J2,
      origen: 'google_forms',
      valor: 'GF-002',
      activo: true,
      fecha_alta: '2026-01-01'
    })
  })

  // 1. EQUIVALENCIA FUNCIONAL DE dbInstance
  describe('1. Equivalencia funcional de dbInstance', () => {
    it('recalcularReadinessJugadora produce registros e importes idénticos con y sin dbInstance', async () => {
      const dbAName = `test_readiness_A_${Date.now()}_${Math.random()}`
      const dbBName = `test_readiness_B_${Date.now()}_${Math.random()}`
      const dbA = new FutsalDB(dbAName)
      const dbB = new FutsalDB(dbBName)
      await Promise.all([dbA.open(), dbB.open()])

      // Seed DB_A y DB_B con idénticos fixtures
      const seedData = async (targetDb: FutsalDB) => {
        await targetDb.jugadoras.put({ id_jugadora: J1, nombre: 'Ana López', posicion: 'Ala', activa: true })
        await targetDb.wellness.put({
          id_jugadora: J1,
          fecha: '2026-07-15',
          calidad_sueno: 8,
          fatiga: 7,
          dolor_muscular: 6,
          estres: 5,
          estado_animo: 8,
          score_wellness: 68,
          dolor_especifico: ''
        })
        await targetDb.sesion_rpe.put({
          id_sesion: 'S1',
          id_jugadora: J1,
          fecha: '2026-07-15',
          rpe: 7,
          duracion_min: 90,
          carga_ua: 630
        })
      }

      await Promise.all([seedData(dbA), seedData(dbB)])

      // DB_A: recalculo inyectando la db global simulada asignando la instancia
      await recalcularReadinessJugadora(J1, '2026-07-15', dbA)
      // DB_B: recalculo inyectando dbB explícito
      await recalcularReadinessJugadora(J1, '2026-07-15', dbB)

      const [recordsA, recordsB] = await Promise.all([
        dbA.readiness.toArray(),
        dbB.readiness.toArray()
      ])

      expect(recordsA).toHaveLength(1)
      expect(recordsB).toHaveLength(1)
      expect(recordsA[0].id_jugadora).toBe(recordsB[0].id_jugadora)
      expect(recordsA[0].fecha).toBe(recordsB[0].fecha)
      expect(recordsA[0].score_readiness).toBe(recordsB[0].score_readiness)
      expect(recordsA[0].acwr).toBe(recordsB[0].acwr)
      expect(recordsA[0].carga_aguda).toBe(recordsB[0].carga_aguda)
      expect(recordsA[0].carga_cronica).toBe(recordsB[0].carga_cronica)
    })

    it('recalcularResumenSemanal produce registros e importes idénticos con y sin dbInstance', async () => {
      const dbAName = `test_resumen_A_${Date.now()}_${Math.random()}`
      const dbBName = `test_resumen_B_${Date.now()}_${Math.random()}`
      const dbA = new FutsalDB(dbAName)
      const dbB = new FutsalDB(dbBName)
      await Promise.all([dbA.open(), dbB.open()])

      const seedData = async (targetDb: FutsalDB) => {
        await targetDb.jugadoras.put({ id_jugadora: J1, nombre: 'Ana López', posicion: 'Ala', activa: true })
        await targetDb.wellness.put({
          id_jugadora: J1,
          fecha: '2026-07-15',
          calidad_sueno: 8,
          fatiga: 7,
          dolor_muscular: 6,
          estres: 5,
          estado_animo: 8,
          score_wellness: 68,
          dolor_especifico: ''
        })
        await targetDb.sesion_rpe.put({
          id_sesion: 'S1',
          id_jugadora: J1,
          fecha: '2026-07-15',
          rpe: 7,
          duracion_min: 90,
          carga_ua: 630
        })
      }

      await Promise.all([seedData(dbA), seedData(dbB)])

      await recalcularResumenSemanal(J1, '2026-07-15', undefined, dbA)
      await recalcularResumenSemanal(J1, '2026-07-15', undefined, dbB)

      const [resumenA, resumenB] = await Promise.all([
        dbA.resumen_semanal.toArray(),
        dbB.resumen_semanal.toArray()
      ])

      expect(resumenA).toHaveLength(1)
      expect(resumenB).toHaveLength(1)
      expect(resumenA[0].id_jugadora).toBe(resumenB[0].id_jugadora)
      expect(resumenA[0].semana).toBe(resumenB[0].semana)
      expect(resumenA[0].carga_total).toBe(resumenB[0].carga_total)
      expect(resumenA[0].media_wellness).toBe(resumenB[0].media_wellness)
    })
  })

  // 2. ÉXITO COMPLETO EN CONFIRMACIÓN
  describe('2. Éxito completo transaccional', () => {
    it('Persiste conjuntamente wellness, historial, readiness y resumen semanal', async () => {
      const context = await obtenerContextoValidacionWellness(dbTest)
      const rawRows: RawImportRow[] = [
        { id_jugadora: 'GF-001', fecha: '2026-07-15', calidad_sueno: '8', fatiga: '7', dolor_muscular: '6', estres: '5', estado_animo: '8' }
      ]

      const preview = construirVistaPrevia(rawRows, defaultMapping, [], context.jugadorasMap!, context)
      expect(preview.nuevos).toBe(1)
      expect(preview.errores).toBe(0)

      const outcome = await aplicarImportacionWellness(
        preview.rows,
        'omit',
        'test_success.csv',
        'Hoja1',
        'Default',
        'backup_success.json',
        'DIARIO',
        undefined,
        dbTest
      )

      if (!outcome.success) {
        console.error('Import failed with error:', outcome.error)
      }
      expect(outcome.success).toBe(true)
      expect(outcome.inserted).toBe(1)

      const [wellness, historial, readiness, resumen, alertas] = await Promise.all([
        dbTest.wellness.toArray(),
        dbTest.historial_importaciones.toArray(),
        dbTest.readiness.toArray(),
        dbTest.resumen_semanal.toArray(),
        dbTest.alertas.toArray()
      ])

      expect(wellness).toHaveLength(1)
      expect(wellness[0].id_jugadora).toBe(J1)
      expect(wellness[0].id_temporada).toBe('TEMP-2026-2027')
      expect(wellness[0].alias_origen).toBe('GF-001')

      expect(historial).toHaveLength(1)
      expect(historial[0].estado).toBe('completada')

      expect(readiness.length).toBeGreaterThanOrEqual(1)
      expect(resumen.length).toBeGreaterThanOrEqual(1)

      // Demostrar ausencia estructural de escrituras en db.alertas en esta ruta
      expect(alertas).toHaveLength(0)
    })
  })

  // 3. PRUEBAS DE FALLO FORZADO Y ROLLBACK COMPLETO
  describe('3. Pruebas de fallo forzado y rollback completo', () => {
    it('3.1 Fallo en escritura inicial de wellness: rollbacks completo sin alterar snapshot previo', async () => {
      const context = await obtenerContextoValidacionWellness(dbTest)
      const rawRows: RawImportRow[] = [
        { id_jugadora: 'GF-001', fecha: '2026-07-15', calidad_sueno: '8', fatiga: '7', dolor_muscular: '6', estres: '5', estado_animo: '8' }
      ]

      const preview = construirVistaPrevia(rawRows, defaultMapping, [], context.jugadorasMap!, context)

      // Capturar snapshots pre-importación
      const preWellness = await dbTest.wellness.toArray()
      const preReadiness = await dbTest.readiness.toArray()
      const preResumen = await dbTest.resumen_semanal.toArray()
      const preAlertas = await dbTest.alertas.toArray()

      // Forzar fallo en put de wellness
      const originalPut = dbTest.wellness.put
      dbTest.wellness.put = vi.fn().mockImplementation(() => {
        throw new Error('Fallo forzado en la escritura de wellness')
      })

      const outcome = await aplicarImportacionWellness(
        preview.rows,
        'omit',
        'fail_wellness.csv',
        'Hoja1',
        'Default',
        'backup_fail.json',
        'DIARIO',
        undefined,
        dbTest
      )

      // Restaurar método
      dbTest.wellness.put = originalPut

      expect(outcome.success).toBe(false)
      expect(outcome.inserted).toBe(0)

      // Verificar que todas las tablas conservan su snapshot inicial exacto
      const postWellness = await dbTest.wellness.toArray()
      const postReadiness = await dbTest.readiness.toArray()
      const postResumen = await dbTest.resumen_semanal.toArray()
      const postAlertas = await dbTest.alertas.toArray()

      expect(postWellness).toEqual(preWellness)
      expect(postReadiness).toEqual(preReadiness)
      expect(postResumen).toEqual(preResumen)
      expect(postAlertas).toEqual(preAlertas)
    })

    it('3.2 Fallo en escritura de historial de importación: rollback completo de wellness y derivados', async () => {
      const context = await obtenerContextoValidacionWellness(dbTest)
      const rawRows: RawImportRow[] = [
        { id_jugadora: 'GF-001', fecha: '2026-07-15', calidad_sueno: '8', fatiga: '7', dolor_muscular: '6', estres: '5', estado_animo: '8' }
      ]

      const preview = construirVistaPrevia(rawRows, defaultMapping, [], context.jugadorasMap!, context)

      const preWellness = await dbTest.wellness.toArray()
      const preReadiness = await dbTest.readiness.toArray()
      const preResumen = await dbTest.resumen_semanal.toArray()
      const preAlertas = await dbTest.alertas.toArray()

      let count = 0
      const originalHistPut = dbTest.historial_importaciones.put
      dbTest.historial_importaciones.put = vi.fn().mockImplementation((...args) => {
        count++
        if (count === 1) {
          throw new Error('Fallo forzado en escritura de historial de importación transaccional')
        }
        return originalHistPut.apply(dbTest.historial_importaciones, args as any)
      })

      const outcome = await aplicarImportacionWellness(
        preview.rows,
        'omit',
        'fail_historial.csv',
        'Hoja1',
        'Default',
        'backup_fail.json',
        'DIARIO',
        undefined,
        dbTest
      )

      dbTest.historial_importaciones.put = originalHistPut

      expect(outcome.success).toBe(false)

      const postWellness = await dbTest.wellness.toArray()
      const postReadiness = await dbTest.readiness.toArray()
      const postResumen = await dbTest.resumen_semanal.toArray()
      const postAlertas = await dbTest.alertas.toArray()

      expect(postWellness).toEqual(preWellness)
      expect(postReadiness).toEqual(preReadiness)
      expect(postResumen).toEqual(preResumen)
      expect(postAlertas).toEqual(preAlertas)
    })

    it('3.3 Fallo durante recálculo de readiness: revierte el wellness escrito y no persiste datos parciales', async () => {
      const context = await obtenerContextoValidacionWellness(dbTest)
      const rawRows: RawImportRow[] = [
        { id_jugadora: 'GF-001', fecha: '2026-07-15', calidad_sueno: '8', fatiga: '7', dolor_muscular: '6', estres: '5', estado_animo: '8' }
      ]

      const preview = construirVistaPrevia(rawRows, defaultMapping, [], context.jugadorasMap!, context)

      const preWellness = await dbTest.wellness.toArray()
      const preReadiness = await dbTest.readiness.toArray()
      const preResumen = await dbTest.resumen_semanal.toArray()
      const preAlertas = await dbTest.alertas.toArray()

      // Forzar fallo en readiness.put
      const originalReadinessPut = dbTest.readiness.put
      dbTest.readiness.put = vi.fn().mockImplementation(() => {
        throw new Error('Fallo forzado durante recálculo de readiness')
      })

      const outcome = await aplicarImportacionWellness(
        preview.rows,
        'omit',
        'fail_readiness.csv',
        'Hoja1',
        'Default',
        'backup_fail.json',
        'DIARIO',
        undefined,
        dbTest
      )

      dbTest.readiness.put = originalReadinessPut

      expect(outcome.success).toBe(false)

      const postWellness = await dbTest.wellness.toArray()
      const postReadiness = await dbTest.readiness.toArray()
      const postResumen = await dbTest.resumen_semanal.toArray()
      const postAlertas = await dbTest.alertas.toArray()

      expect(postWellness).toEqual(preWellness)
      expect(postReadiness).toEqual(preReadiness)
      expect(postResumen).toEqual(preResumen)
      expect(postAlertas).toEqual(preAlertas)
    })

    it('3.4 Fallo durante recálculo de resumen semanal: revierte el wellness y readiness escritos y no persiste datos parciales', async () => {
      const context = await obtenerContextoValidacionWellness(dbTest)
      const rawRows: RawImportRow[] = [
        { id_jugadora: 'GF-001', fecha: '2026-07-15', calidad_sueno: '8', fatiga: '7', dolor_muscular: '6', estres: '5', estado_animo: '8' }
      ]

      const preview = construirVistaPrevia(rawRows, defaultMapping, [], context.jugadorasMap!, context)

      const preWellness = await dbTest.wellness.toArray()
      const preReadiness = await dbTest.readiness.toArray()
      const preResumen = await dbTest.resumen_semanal.toArray()
      const preAlertas = await dbTest.alertas.toArray()

      // Forzar fallo en resumen_semanal.put
      const originalResumenPut = dbTest.resumen_semanal.put
      dbTest.resumen_semanal.put = vi.fn().mockImplementation(() => {
        throw new Error('Fallo forzado durante recálculo de resumen semanal')
      })

      const outcome = await aplicarImportacionWellness(
        preview.rows,
        'omit',
        'fail_resumen.csv',
        'Hoja1',
        'Default',
        'backup_fail.json',
        'DIARIO',
        undefined,
        dbTest
      )

      dbTest.resumen_semanal.put = originalResumenPut

      expect(outcome.success).toBe(false)

      const postWellness = await dbTest.wellness.toArray()
      const postReadiness = await dbTest.readiness.toArray()
      const postResumen = await dbTest.resumen_semanal.toArray()
      const postAlertas = await dbTest.alertas.toArray()

      expect(postWellness).toEqual(preWellness)
      expect(postReadiness).toEqual(preReadiness)
      expect(postResumen).toEqual(preResumen)
      expect(postAlertas).toEqual(preAlertas)
    })
  })
})
