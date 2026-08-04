import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.unmock('@/db/database')
vi.unmock('@/utils/importEngine')
import { FutsalDB } from '@/db/database'
import {
  validarFilaWellness,
  construirVistaPrevia,
  aplicarImportacionWellness,
  obtenerContextoValidacionWellness
} from '@/utils/importEngine'
import { crearTemporada } from '@/domain/temporadas/temporadas'
import { agregarAliasJugadora } from '@/domain/alias/aliasJugadora'
import type { ColumnMapping, RawImportRow, Temporada } from '@/types'

describe('T-02A — Integración Completa de Importación Wellness (Identidad y Temporada)', () => {
  let db: FutsalDB
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
    const dbName = `test_wellness_import_${Date.now()}_${Math.random()}`
    db = new FutsalDB(dbName)
    await db.open()

    // Sembrar jugadoras internas J1 y J2
    await db.jugadoras.put({ id_jugadora: 'J1', nombre: 'Ana López', posicion: 'Ala', activa: true })
    await db.jugadoras.put({ id_jugadora: 'J2', nombre: 'María García', posicion: 'Pívot', activa: true })

    // Sembrar temporada activa
    await crearTemporada(db, season2026)

    // Sembrar alias activos
    await agregarAliasJugadora(db, {
      id_jugadora: 'J1',
      origen: 'google_forms',
      valor: 'GF-001',
      activo: true,
      fecha_alta: '2026-01-01'
    })
    await agregarAliasJugadora(db, {
      id_jugadora: 'J2',
      origen: 'google_forms',
      valor: 'GF-002',
      activo: true,
      fecha_alta: '2026-01-01'
    })
  })

  // 5.1 Resolución de alias
  describe('5.1 Resolución de alias', () => {
    it('1. Una fila con GF-001 se asigna a J1 y GF-002 a J2', async () => {
      const context = await obtenerContextoValidacionWellness(db)
      const res1 = validarFilaWellness({ id_jugadora: 'GF-001', fecha: '2026-07-15', calidad_sueno: '8', fatiga: '7', dolor_muscular: '5', estres: '4', estado_animo: '8' }, context)
      expect(res1.isValid).toBe(true)
      expect(res1.normalRow?.id_jugadora).toBe('J1')

      const res2 = validarFilaWellness({ id_jugadora: 'GF-002', fecha: '2026-07-15', calidad_sueno: '8', fatiga: '7', dolor_muscular: '5', estres: '4', estado_animo: '8' }, context)
      expect(res2.isValid).toBe(true)
      expect(res2.normalRow?.id_jugadora).toBe('J2')
    })

    it('3. El nombre visible de la fila no altera la resolución por alias', async () => {
      const context = await obtenerContextoValidacionWellness(db)
      // Fila incluye alias GF-001 y un nombre ficticio 'Nombre Distinto'
      const res = validarFilaWellness({ id_jugadora: 'GF-001', nombre: 'Nombre Distinto', fecha: '2026-07-15', calidad_sueno: '8', fatiga: '7', dolor_muscular: '5', estres: '4', estado_animo: '8' }, context)
      expect(res.isValid).toBe(true)
      expect(res.normalRow?.id_jugadora).toBe('J1')
    })

    it('4. Renombrar la jugadora J1 no altera la resolución por alias', async () => {
      await db.jugadoras.put({ id_jugadora: 'J1', nombre: 'Ana López Renombrada', posicion: 'Ala', activa: true })
      const context = await obtenerContextoValidacionWellness(db)
      const res = validarFilaWellness({ id_jugadora: 'GF-001', fecha: '2026-07-15', calidad_sueno: '8', fatiga: '7', dolor_muscular: '5', estres: '4', estado_animo: '8' }, context)
      expect(res.isValid).toBe(true)
      expect(res.normalRow?.id_jugadora).toBe('J1')
    })

    it('5. Alias inexistente genera error ID externo no reconocido y no crea jugadora', async () => {
      const context = await obtenerContextoValidacionWellness(db)
      const res = validarFilaWellness({ id_jugadora: 'GF-999', fecha: '2026-07-15', calidad_sueno: '8' }, context)
      expect(res.isValid).toBe(false)
      expect(res.errorMsg).toContain('ID externo \'GF-999\' no reconocido')
    })

    it('6. Alias inactivo genera error específico y no se resuelve', async () => {
      await db.alias_jugadora.put({
        id_jugadora: 'J1',
        origen: 'google_forms',
        valor: 'GF-DESACTIVADO',
        activo: false,
        fecha_alta: '2026-01-01'
      })
      const context = await obtenerContextoValidacionWellness(db)
      const res = validarFilaWellness({ id_jugadora: 'GF-DESACTIVADO', fecha: '2026-07-15', calidad_sueno: '8' }, context)
      expect(res.isValid).toBe(false)
      expect(res.errorMsg).toContain('Alias \'GF-DESACTIVADO\' inactivo')
    })

    it('7. Alias vacío o solo espacios genera error', async () => {
      const context = await obtenerContextoValidacionWellness(db)
      const res = validarFilaWellness({ id_jugadora: '   ', fecha: '2026-07-15', calidad_sueno: '8' }, context)
      expect(res.isValid).toBe(false)
      expect(res.errorMsg).toContain('ID_Jugadora vacío')
    })

    it('8. Alias bajo otro origen no resuelve en importación wellness (google_forms)', async () => {
      await db.alias_jugadora.put({
        id_jugadora: 'J1',
        origen: 'chronojump',
        valor: 'CJ-001',
        activo: true,
        fecha_alta: '2026-01-01'
      })
      const context = await obtenerContextoValidacionWellness(db)
      const res = validarFilaWellness({ id_jugadora: 'CJ-001', fecha: '2026-07-15', calidad_sueno: '8' }, context)
      expect(res.isValid).toBe(false)
      expect(res.errorMsg).toContain('ID externo \'CJ-001\' no reconocido')
    })

    it('9. No existe fallback por nombre: si alias no existe pero nombre coincide, falla', async () => {
      const context = await obtenerContextoValidacionWellness(db)
      const res = validarFilaWellness({ id_jugadora: 'Ana López', fecha: '2026-07-15', calidad_sueno: '8' }, context)
      expect(res.isValid).toBe(false)
      expect(res.errorMsg).toContain('ID externo \'Ana López\' no reconocido')
    })
  })

  // 5.2 Temporada activa y rango
  describe('5.2 Temporada activa y rango', () => {
    it('10. Sin temporada activa, la validación se bloquea', async () => {
      await db.temporadas.clear()
      const context = await obtenerContextoValidacionWellness(db)
      expect(context.temporadaActiva).toBeNull()

      const res = validarFilaWellness({ id_jugadora: 'GF-001', fecha: '2026-07-15', calidad_sueno: '8', fatiga: '7', dolor_muscular: '5', estres: '4', estado_animo: '8' }, context)
      expect(res.isValid).toBe(false)
      expect(res.errorMsg).toContain('No existe una temporada activa')
    })

    it('11 & 12. Fechas en límites inclusivos de inicio y fin son válidas', async () => {
      const context = await obtenerContextoValidacionWellness(db)
      const resInicio = validarFilaWellness({ id_jugadora: 'GF-001', fecha: '2026-01-01', calidad_sueno: '8', fatiga: '7', dolor_muscular: '5', estres: '4', estado_animo: '8' }, context)
      expect(resInicio.isValid).toBe(true)

      const resFin = validarFilaWellness({ id_jugadora: 'GF-001', fecha: '2026-08-01', calidad_sueno: '8', fatiga: '7', dolor_muscular: '5', estres: '4', estado_animo: '8' }, context)
      expect(resFin.isValid).toBe(true)
    })

    it('13 & 14. Fechas fuera del rango inclusivo fallan', async () => {
      const context = await obtenerContextoValidacionWellness(db)
      const resAntes = validarFilaWellness({ id_jugadora: 'GF-001', fecha: '2025-12-31', calidad_sueno: '8' }, context)
      expect(resAntes.isValid).toBe(false)
      expect(resAntes.errorMsg).toContain('fuera del rango de la temporada activa')

      const resDespues = validarFilaWellness({ id_jugadora: 'GF-001', fecha: '2026-08-02', calidad_sueno: '8' }, context)
      expect(resDespues.isValid).toBe(false)
    })
  })

  // 5.3 Fecha local
  describe('5.3 Fecha local', () => {
    it('18. 2026-07-15 es válida', async () => {
      const context = await obtenerContextoValidacionWellness(db)
      const res = validarFilaWellness({ id_jugadora: 'GF-001', fecha: '2026-07-15', calidad_sueno: '8', fatiga: '7', dolor_muscular: '5', estres: '4', estado_animo: '8' }, context)
      expect(res.isValid).toBe(true)
      expect(res.normalRow?.fecha).toBe('2026-07-15')
    })

    it('19. 2026-02-30 es rechazada por fecha no existente', async () => {
      const context = await obtenerContextoValidacionWellness(db)
      const res = validarFilaWellness({ id_jugadora: 'GF-001', fecha: '2026-02-30', calidad_sueno: '8' }, context)
      expect(res.isValid).toBe(false)
      expect(res.errorMsg).toContain('no existe en el calendario')
    })

    it('20. Timestamp UTC ISO se rechaza como fecha de dominio', async () => {
      const context = await obtenerContextoValidacionWellness(db)
      const res = validarFilaWellness({ id_jugadora: 'GF-001', fecha: '2026-07-15T00:00:00.000Z', calidad_sueno: '8' }, context)
      expect(res.isValid).toBe(false)
      expect(res.errorMsg).toContain('inválida')
    })
  })

  // 5.5 Confirmación atómica
  describe('5.5 Confirmación atómica y persistencia', () => {
    it('30. Filas válidas se insertan con id_jugadora interno, id_temporada y alias_origen', async () => {
      const context = await obtenerContextoValidacionWellness(db)
      const rawRows: RawImportRow[] = [
        { id_jugadora: 'GF-001', fecha: '2026-07-15', calidad_sueno: '8', fatiga: '7', dolor_muscular: '6', estres: '5', estado_animo: '8' },
        { id_jugadora: 'GF-002', fecha: '2026-07-15', calidad_sueno: '9', fatiga: '8', dolor_muscular: '7', estres: '6', estado_animo: '9' }
      ]

      const preview = construirVistaPrevia(rawRows, defaultMapping, [], context.jugadorasMap!, context)
      expect(preview.nuevos).toBe(2)
      expect(preview.errores).toBe(0)

      const outcome = await aplicarImportacionWellness(
        preview.rows,
        'omit',
        'wellness_test.csv',
        'Sheet1',
        'Default',
        'backup_test.json',
        undefined,
        db
      )

      expect(outcome.success).toBe(true)
      expect(outcome.inserted).toBe(2)

      const records = await db.wellness.toArray()
      expect(records).toHaveLength(2)

      const w1 = records.find(r => r.id_jugadora === 'J1')
      expect(w1).toBeDefined()
      expect(w1?.id_temporada).toBe('TEMP-2026-2027')
      expect(w1?.alias_origen).toBe('GF-001')
      expect(w1?.origen_alias).toBe('google_forms')

      const w2 = records.find(r => r.id_jugadora === 'J2')
      expect(w2).toBeDefined()
      expect(w2?.id_temporada).toBe('TEMP-2026-2027')
      expect(w2?.alias_origen).toBe('GF-002')
    })

    it('31. Si una fila de confirmación incumple las reglas en revalidación transaccional, toda la transacción aborta', async () => {
      const context = await obtenerContextoValidacionWellness(db)
      const rawRows: RawImportRow[] = [
        { id_jugadora: 'GF-001', fecha: '2026-07-15', calidad_sueno: '8', fatiga: '7', dolor_muscular: '6', estres: '5', estado_animo: '8' }
      ]

      const preview = construirVistaPrevia(rawRows, defaultMapping, [], context.jugadorasMap!, context)

      // Simular que el alias se desactiva justo antes de la confirmación
      await db.alias_jugadora.where({ origen: 'google_forms', valor: 'GF-001' }).modify({ activo: false })

      const outcome = await aplicarImportacionWellness(
        preview.rows,
        'omit',
        'wellness_test.csv',
        'Sheet1',
        'Default',
        'backup_test.json',
        undefined,
        db
      )

      expect(outcome.success).toBe(false)
      expect(outcome.inserted).toBe(0)

      const records = await db.wellness.toArray()
      expect(records).toHaveLength(0)
    })
  })
})
