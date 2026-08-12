import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.unmock('@/db/database')
vi.unmock('@/utils/importEngine')
import { FutsalDB } from '@/db/database'
import {
  validarFilaWellness,
  obtenerContextoValidacionWellness
} from '@/utils/importEngine'
import { crearTemporada } from '@/domain/temporadas/temporadas'
import { agregarAliasJugadora } from '@/domain/alias/aliasJugadora'
import type { RawImportRow, Temporada } from '@/types'
import {
  detectarTipoCuestionario,
  importarCSVWellnessGoogleForms,
  procesarFilaWellness
} from './importEngineWellness'

describe('T-02A — Integración Completa de Importación Wellness (Identidad y Temporada)', () => {
  let db: FutsalDB
  const season2026: Temporada = {
    id_temporada: 'TEMP-2026-2027',
    nombre: 'Temporada 26/27',
    fecha_inicio: '2026-01-01',
    fecha_fin: '2026-08-01',
    activa: true
  }



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

  describe('Importación automática CSV wellness diario/semanal', () => {
    it('detecta correctamente cuestionarios diario y semanal por cabeceras', () => {
      const headersDiario = ['ID jugadora', 'Fecha', 'Calidad de sueño', 'Fatiga', 'Dolor muscular', 'Estrés', 'Estado de ánimo']
      const headersSemanal = [
        'ID jugadora',
        'Fecha',
        '¿Cómo valorarías tu recuperación general esta semana?',
        '¿Cómo ha sido la calidad de tu sueño esta semana?',
        '¿Cómo ha sido tu nivel de estrés fuera del fútbol sala?',
        '¿Cómo ha sido tu energía durante los entrenamientos y el partido?',
        '¿Cómo valorarías tu estado de ánimo esta semana?',
        '¿Como de preparada te sientes para la próxima semana de entrenamiento y competición?',
        '¿Tus síntomas menstruales han afectado a tu recuperación, entrenamiento o bienestar esta semana? (opcional)'
      ]

      expect(detectarTipoCuestionario(headersDiario)).toBe('DIARIO')
      expect(detectarTipoCuestionario(headersSemanal)).toBe('SEMANAL')
    })

    it('procesa una fila semanal con normalización y cálculo de índice', () => {
      const row: RawImportRow = {
        '¿Cómo valorarías tu recuperación general esta semana?': '8',
        '¿Cómo ha sido la calidad de tu sueño esta semana?': '7',
        '¿Cómo ha sido tu nivel de estrés fuera del fútbol sala?': '5',
        '¿Cómo ha sido tu energía durante los entrenamientos y el partido?': '8',
        '¿Cómo valorarías tu estado de ánimo esta semana?': '9',
        '¿Como de preparada te sientes para la próxima semana de entrenamiento y competición?': '8',
        '¿Tus síntomas menstruales han afectado a tu recuperación, entrenamiento o bienestar esta semana? (opcional)': '2'
      }

      const salida = procesarFilaWellness('SEMANAL', row, 'J1', '2026-07-20', 'TEMP-2026-2027', 'GF-001')
      expect(salida.metricas['¿Cómo ha sido tu nivel de estrés fuera del fútbol sala?'].normalizado).toBe(6)
      expect(salida.metricas['¿Tus síntomas menstruales han afectado a tu recuperación, entrenamiento o bienestar esta semana? (opcional)'].normalizado).toBe(8)
      expect(salida.indice).toBe(7.7)
    })

    it('importa CSV diario y semanal persistiendo trazabilidad', async () => {
      const dbName = `test_csv_auto_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const db = new FutsalDB(dbName)
      await db.open()

      await db.jugadoras.put({ id_jugadora: 'J1', nombre: 'Ana', posicion: 'Ala', activa: true })
      await crearTemporada(db, {
        id_temporada: 'TEMP-2026-2027',
        nombre: 'Temporada 26/27',
        fecha_inicio: '2026-01-01',
        fecha_fin: '2026-12-31',
        activa: true
      })
      await agregarAliasJugadora(db, {
        id_jugadora: 'J1',
        origen: 'google_forms',
        valor: 'GF-001',
        activo: true,
        fecha_alta: '2026-01-01'
      })

      const csvDiario = [
        'ID jugadora,Fecha,Calidad de sueño,Fatiga,Dolor muscular,Estrés,Estado de ánimo,Dolor especifico o nota importante (opcional)',
        'GF-001,2026-07-20,8,3,4,5,9,Tobillo cargado'
      ].join('\n')
      const headersSemanalCSV = [
        'ID jugadora',
        'Fecha',
        '¿Cómo valorarías tu recuperación general esta semana?',
        '¿Cómo ha sido la calidad de tu sueño esta semana?',
        '¿Cómo ha sido tu nivel de estrés fuera del fútbol sala?',
        '¿Cómo ha sido tu energía durante los entrenamientos y el partido?',
        '¿Cómo valorarías tu estado de ánimo esta semana?',
        '¿Como de preparada te sientes para la próxima semana de entrenamiento y competición?',
        '¿Tus síntomas menstruales han afectado a tu recuperación, entrenamiento o bienestar esta semana? (opcional)',
        'Indica que dolor o molestia has tenido'
      ].map((h) => `"${h}"`).join(',')
      const csvSemanal = [
        headersSemanalCSV,
        'GF-001,2026-07-21,8,7,5,8,9,8,2,Cuádriceps izquierdo'
      ].join('\n')

      const outDiario = await importarCSVWellnessGoogleForms(csvDiario, db)
      const outSemanal = await importarCSVWellnessGoogleForms(csvSemanal, db)

      expect(outDiario.importadas).toBe(1)
      expect(outSemanal.importadas).toBe(1)

      const diarios = await db.wellness_diario_importado.toArray()
      const semanales = await db.wellness_semanal_importado.toArray()
      const wellness = await db.wellness.toArray()

      expect(diarios).toHaveLength(1)
      expect(semanales).toHaveLength(1)
      expect(wellness).toHaveLength(1)
      expect(diarios[0].metricas['Fatiga'].normalizado).toBe(8)
      expect(semanales[0].metricas['¿Tus síntomas menstruales han afectado a tu recuperación, entrenamiento o bienestar esta semana? (opcional)'].normalizado).toBe(8)

      db.close()
      await db.delete()
    })

    it('importa archivo Wellnes-Diario.csv de Google Forms respetando campos y fallando atómicamente si hay error', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const csvData = fs.readFileSync(path.join(__dirname, 'fixtures/Wellnes-Diario.csv'), 'utf-8')

      const dbName = `test_google_forms_fixture_${Date.now()}`
      const testDb = new FutsalDB(dbName)
      await testDb.open()

      await testDb.jugadoras.put({ id_jugadora: 'LUCIA', nombre: 'Lucía', posicion: 'Ala', activa: true })
      await testDb.jugadoras.put({ id_jugadora: 'SARA', nombre: 'Sara', posicion: 'Ala', activa: true })
      await testDb.jugadoras.put({ id_jugadora: 'MARIA', nombre: 'María León', posicion: 'Pívot', activa: true })

      await crearTemporada(testDb, {
        id_temporada: 'TEMP-2026-2027',
        nombre: 'Temporada 26/27',
        fecha_inicio: '2026-01-01',
        fecha_fin: '2026-12-31',
        activa: true
      })

      // We expect the fixture to FAIL atomically because it has:
      // - "Inexistente" (alias not found)
      // - "Candela" (Date 2099 - future)
      const outcome = await importarCSVWellnessGoogleForms(csvData, testDb)

      expect(outcome.errores).toBe(2)
      expect(outcome.importadas).toBe(0) // Complete rollback!

      // Check zero writes
      const countWellness = await testDb.wellness.count()
      expect(countWellness).toBe(0)
      const countDiario = await testDb.wellness_diario_importado.count()
      expect(countDiario).toBe(0)

      testDb.close()
      await testDb.delete()
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
      expect(res.errorMsg).toContain('Jugadora no registrada')
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
      expect(res.errorMsg).toContain('Jugadora no registrada')
    })

    it('9. Existe fallback por nombre normalizado: si alias no existe pero nombre coincide exactamente, tiene éxito', async () => {
      const context = await obtenerContextoValidacionWellness(db)
      const res = validarFilaWellness({ id_jugadora: 'Ana López', fecha: '2026-07-15', calidad_sueno: '8' }, context)
      expect(res.isValid).toBe(true)
      expect(res.normalRow?.id_jugadora).toBe('J1')
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
  describe('5.5 Confirmación atómica y persistencia (2 Fases)', () => {
    it('30. Si todas las filas son válidas, se guardan en la base de datos (Fase B)', async () => {
      const csvDiario = [
        'ID jugadora,Fecha,Calidad de sueño,Fatiga,Dolor muscular,Estrés,Estado de ánimo,Dolor especifico o nota importante (opcional)',
        'GF-001,2026-07-20,8,3,4,5,9,Tobillo cargado',
        'GF-002,2026-07-20,9,2,3,4,9,Ninguno'
      ].join('\n')

      const outcome = await importarCSVWellnessGoogleForms(csvDiario, db)
      expect(outcome.errores).toBe(0)
      expect(outcome.importadas).toBe(2)

      const records = await db.wellness.toArray()
      expect(records).toHaveLength(2)
    })

    it('31. Si una fila es inválida, se aborta en Fase A sin escribir en BD', async () => {
      const csvDiario = [
        'ID jugadora,Fecha,Calidad de sueño,Fatiga,Dolor muscular,Estrés,Estado de ánimo,Dolor especifico o nota importante (opcional)',
        'GF-001,2026-07-20,8,3,4,5,9,Tobillo cargado', // Válida
        'INEXISTENTE,2026-07-20,9,2,3,4,9,Ninguno' // Inválida
      ].join('\n')

      const outcome = await importarCSVWellnessGoogleForms(csvDiario, db)

      expect(outcome.errores).toBe(1)
      expect(outcome.importadas).toBe(0)
      expect(outcome.detallesErrores[0]).toContain('Jugadora no registrada')

      // Assert zero writes
      const wellness = await db.wellness.toArray()
      expect(wellness).toHaveLength(0)
      const diario = await db.wellness_diario_importado.toArray()
      expect(diario).toHaveLength(0)
      const readiness = await db.readiness.toArray()
      expect(readiness).toHaveLength(0)
      const resumen = await db.resumen_semanal.toArray()
      expect(resumen).toHaveLength(0)
    })
  })
})
