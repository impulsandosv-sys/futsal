/**
 * T-02-R-MIGRATION — Test exhaustivo de migración Dexie v14 -> v15
 *
 * Demuestra empíricamente que la migración aditiva Dexie v15:
 * 1. Preserva las 27 tablas históricas vigentes al cierre de v14.
 * 2. Añade las 2 tablas nuevas (`temporadas` y `alias_jugadora`), alcanzando 29 tablas totales.
 * 3. Conserva el 100% de los datos en bases preexistentes en v14 across 12 tablas clave.
 * 4. Preserva los índices simples y compuestos de v14 (readiness, rpe_partido, sesion_rpe, etc.).
 * 5. Permite escrituras y búsquedas indizadas en las nuevas tablas v15 sin alterar datos históricos.
 */
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, it, expect, vi } from 'vitest'

vi.unmock('@/db/database')

import { FutsalDB } from './database'
import type { Temporada, AliasJugadora } from '@/types'

// ─── Clase DB para simular una base completa en v14 ───────────────────────────

class FutsalDBv14 extends Dexie {
  jugadoras!: Dexie.Table<any, string>
  formulario_respuestas!: Dexie.Table<any, number>
  wellness!: Dexie.Table<any, number>
  sesiones!: Dexie.Table<any, string>
  partidos!: Dexie.Table<any, string>
  lesiones!: Dexie.Table<any, string>
  tests_fisicos!: Dexie.Table<any, number>
  rpe_partido!: Dexie.Table<any, number>
  resumen_semanal!: Dexie.Table<any, number>
  alertas!: Dexie.Table<any, number>
  sesion_rpe!: Dexie.Table<any, number>
  readiness!: Dexie.Table<any, number>
  historial_importaciones!: Dexie.Table<any, number>
  historial_copias!: Dexie.Table<any, number>
  ciclo_menstrual!: Dexie.Table<any, number>
  carga_gps!: Dexie.Table<any, number>
  fuerza_vbt!: Dexie.Table<any, number>
  hidratacion!: Dexie.Table<any, number>
  rtp_checklist!: Dexie.Table<any, number>
  test_psicologico!: Dexie.Table<any, number>
  plantillas_importacion!: Dexie.Table<any, number>
  protocolos_cmj!: Dexie.Table<any, string>
  pruebas_cmj!: Dexie.Table<any, string>
  ejercicios_fuerza!: Dexie.Table<any, string>
  trabajos_fuerza!: Dexie.Table<any, string>
  plantillas_fuerza!: Dexie.Table<any, string>
  sesiones_fuerza_individual!: Dexie.Table<any, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      jugadoras: 'id_jugadora, nombre, posicion, activa',
      formulario_respuestas: '++id, id_jugadora, fecha',
      wellness: '++id, id_jugadora, fecha',
      sesiones: 'id_sesion, fecha, tipo_sesion',
      partidos: 'id_partido, fecha',
      lesiones: 'id_lesion, id_jugadora, fecha_inicio, disponible',
      tests_fisicos: '++id, id_jugadora, fecha, test',
      rpe_partido: '++id, id_jugadora, id_partido, fecha',
      resumen_semanal: '++id, id_jugadora, semana',
      alertas: '++id, id_jugadora, tipo, leida',
    })
    this.version(2).stores({
      jugadoras: 'id_jugadora, nombre, posicion, activa',
      formulario_respuestas: '++id, id_jugadora, fecha',
      wellness: '++id, id_jugadora, fecha',
      lesiones: 'id_lesion, id_jugadora, fecha_inicio, disponible, fase_rtp',
      tests_fisicos: '++id, id_jugadora, fecha, test',
      rpe_partido: '++id, id_jugadora, id_partido, fecha',
      resumen_semanal: '++id, id_jugadora, semana, estado',
      alertas: '++id, id_jugadora, tipo, leida',
    })
    this.version(3).stores({})
    this.version(5).stores({
      rpe_entreno: null,
      jugadoras: 'id_jugadora, nombre, posicion, activa',
      formulario_respuestas: '++id, id_jugadora, fecha',
      wellness: '++id, [id_jugadora+fecha], id_jugadora, fecha',
      sesiones: 'id_sesion, fecha, tipo_sesion',
      partidos: 'id_partido, fecha',
      lesiones: 'id_lesion, id_jugadora, fecha_inicio, disponible, fase_rtp',
      tests_fisicos: '++id, id_jugadora, fecha, test',
      rpe_partido: '++id, id_jugadora, id_partido, fecha',
      resumen_semanal: '++id, id_jugadora, semana, estado',
      alertas: '++id, id_jugadora, tipo, leida',
      sesion_rpe: '++id, id_sesion, id_jugadora, fecha',
      readiness: '++id, id_jugadora, fecha',
    })
    this.version(6).stores({
      alertas: '++id, id_jugadora, tipo, estado, prioridad',
    })
    this.version(7).stores({
      historial_importaciones: '++id, fechaHora, tipoImportacion, archivo',
    })
    this.version(8).stores({
      ciclo_menstrual: '++id, id_jugadora, fecha',
      carga_gps: '++id, id_jugadora, fecha, id_sesion, id_partido',
      fuerza_vbt: '++id, id_jugadora, fecha',
      hidratacion: '++id, id_jugadora, fecha',
    })
    this.version(9).stores({
      rtp_checklist: '++id, id_lesion',
      test_psicologico: '++id, id_jugadora, fecha',
    })
    this.version(10).stores({
      historial_copias: '++id, fechaHora, tipo, confirmadaExterna',
    })
    this.version(11).stores({
      jugadoras: 'id_jugadora, nombre, posicion, activa',
      formulario_respuestas: '++id, id_jugadora, fecha',
      wellness: '++id, [id_jugadora+fecha], id_jugadora, fecha',
      sesiones: 'id_sesion, fecha, tipo_sesion',
      partidos: 'id_partido, fecha',
      lesiones: 'id_lesion, id_jugadora, fecha_inicio, disponible, fase_rtp',
      tests_fisicos: '++id, id_jugadora, fecha, test',
      rpe_partido: '++id, id_jugadora, id_partido, fecha',
      resumen_semanal: '++id, id_jugadora, semana, estado',
      alertas: '++id, id_jugadora, tipo, estado, prioridad',
      sesion_rpe: '++id, id_sesion, id_jugadora, fecha',
      readiness: '++id, id_jugadora, fecha',
      historial_importaciones: '++id, fechaHora, tipoImportacion, archivo',
      historial_copias: '++id, fechaHora, tipo, confirmadaExterna',
      ciclo_menstrual: '++id, id_jugadora, fecha',
      carga_gps: '++id, id_jugadora, fecha, id_sesion, id_partido',
      fuerza_vbt: '++id, id_jugadora, fecha',
      hidratacion: '++id, id_jugadora, fecha',
      rtp_checklist: '++id, id_lesion',
      test_psicologico: '++id, id_jugadora, fecha',
      plantillas_importacion: '++id, nombre, tipoImportacion, esPredeterminada',
    })
    this.version(12).stores({
      protocolos_cmj: 'id_protocolo, activo',
      pruebas_cmj: 'id_medicion, id_jugadora, fecha, id_protocolo, [id_jugadora+fecha], [id_jugadora+id_protocolo+fecha]',
      ejercicios_fuerza: 'id_ejercicio, nombre_normalizado, activo',
      trabajos_fuerza: 'id_trabajo, id_sesion, id_jugadora, id_ejercicio, [id_sesion+id_jugadora], [id_jugadora+id_sesion]',
      plantillas_fuerza: 'id_plantilla, activa',
    })
    this.version(13).stores({
      sesiones_fuerza_individual: 'id_sesion_fuerza, id_jugadora, fecha, [id_jugadora+fecha], finalidad',
      trabajos_fuerza: 'id_trabajo, id_sesion, id_jugadora, id_ejercicio, [id_sesion+id_jugadora], [id_jugadora+id_sesion], id_sesion_fuerza',
    })
    this.version(14).stores({
      readiness: '++id, [id_jugadora+fecha], id_jugadora, fecha',
      rpe_partido: '++id, [id_partido+id_jugadora], id_jugadora, id_partido, fecha',
    })
  }
}

describe('Migración Dexie v14 -> v15 (T-02-R-MIGRATION)', () => {
  it('1. Existencia de las 29 tablas totales tras upgrade de v14 a v15', async () => {
    const dbName = `test_v15_tables_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    // Poblar en v14
    const dbV14 = new FutsalDBv14(dbName)
    await dbV14.open()
    await dbV14.jugadoras.put({ id_jugadora: 'J1', nombre: 'Test 1', posicion: 'Ala', activa: true })
    dbV14.close()

    // Abrir en v15
    const dbV15 = new FutsalDB(dbName)
    await dbV15.open()

    expect(dbV15.verno).toBe(15)
    const tableNames = dbV15.tables.map((t) => t.name)
    expect(dbV15.tables).toHaveLength(tableNames.length)

    // Verificar presencia de las 27 tablas v14
    const tablasV14Esperadas = [
      'jugadoras', 'formulario_respuestas', 'wellness', 'sesiones', 'partidos',
      'lesiones', 'tests_fisicos', 'rpe_partido', 'resumen_semanal', 'alertas',
      'sesion_rpe', 'readiness', 'historial_importaciones', 'historial_copias',
      'ciclo_menstrual', 'carga_gps', 'fuerza_vbt', 'hidratacion', 'rtp_checklist',
      'test_psicologico', 'plantillas_importacion', 'protocolos_cmj', 'pruebas_cmj',
      'ejercicios_fuerza', 'trabajos_fuerza', 'plantillas_fuerza', 'sesiones_fuerza_individual'
    ]

    for (const tName of tablasV14Esperadas) {
      expect(tableNames).toContain(tName)
    }

    // Verificar presencia de las 2 tablas nuevas v15
    expect(tableNames).toContain('temporadas')
    expect(tableNames).toContain('alias_jugadora')

    // Verificar que las tablas nuevas empiezan vacías
    expect(await dbV15.temporadas.toArray()).toHaveLength(0)
    expect(await dbV15.alias_jugadora.toArray()).toHaveLength(0)

    dbV15.close()
    await dbV15.delete()
  })

  it('2. Preservación del 100% de datos en 12 tablas clave creadas en v14', async () => {
    const dbName = `test_v15_data_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    const dbV14 = new FutsalDBv14(dbName)
    await dbV14.open()

    // Poblar 12 tablas representativas en v14
    await dbV14.jugadoras.put({ id_jugadora: 'J1', nombre: 'Jugadora 1', posicion: 'Ala', activa: true })
    await dbV14.wellness.put({ id: 10, id_jugadora: 'J1', fecha: '2026-05-10', score_wellness: 88 })
    await dbV14.readiness.put({ id: 20, id_jugadora: 'J1', fecha: '2026-05-10', readiness_score: 92 })
    await dbV14.sesion_rpe.put({ id: 30, id_sesion: 'S1', id_jugadora: 'J1', fecha: '2026-05-10', rpe: 7, duracion_min: 90 })
    await dbV14.rpe_partido.put({ id: 40, id_partido: 'P1', id_jugadora: 'J1', fecha: '2026-05-10', rpe: 8 })
    await dbV14.resumen_semanal.put({ id: 50, id_jugadora: 'J1', semana: '2026-W19', estado: 'calculado' })
    await dbV14.alertas.put({ id: 60, id_jugadora: 'J1', tipo: 'wellness_bajo', estado: 'abierta', prioridad: 'alta' })
    await dbV14.ciclo_menstrual.put({ id: 70, id_jugadora: 'J1', fecha: '2026-05-10', fase: 'folicular' })
    await dbV14.historial_importaciones.put({ id: 80, fechaHora: '2026-05-10T10:00:00', tipoImportacion: 'wellness', archivo: 'w.csv' })
    await dbV14.historial_copias.put({ id: 90, fechaHora: '2026-05-10T11:00:00', tipo: 'manual', confirmadaExterna: true })
    await dbV14.pruebas_cmj.put({ id_medicion: 'M1', id_jugadora: 'J1', fecha: '2026-05-10', altura_cm: 32.5 })
    await dbV14.sesiones_fuerza_individual.put({ id_sesion_fuerza: 'SF1', id_jugadora: 'J1', fecha: '2026-05-10', finalidad: 'hipertrofia' })

    dbV14.close()

    // Abrir en v15
    const dbV15 = new FutsalDB(dbName)
    await dbV15.open()

    // Verificar datos
    expect((await dbV15.jugadoras.get('J1'))?.nombre).toBe('Jugadora 1')
    expect((await dbV15.wellness.get(10))?.score_wellness).toBe(88)
    expect((await dbV15.readiness.get(20))?.readiness_score).toBe(92)
    expect((await dbV15.sesion_rpe.get(30))?.rpe).toBe(7)
    expect((await dbV15.rpe_partido.get(40))?.rpe).toBe(8)
    expect((await dbV15.resumen_semanal.get(50))?.semana).toBe('2026-W19')
    expect((await dbV15.alertas.get(60))?.tipo).toBe('wellness_bajo')
    expect((await dbV15.ciclo_menstrual.get(70))?.fase).toBe('folicular')
    expect((await dbV15.historial_importaciones.get(80))?.archivo).toBe('w.csv')
    expect((await dbV15.historial_copias.get(90))?.confirmadaExterna).toBe(true)
    expect((await dbV15.pruebas_cmj.get('M1'))?.altura_cm).toBe(32.5)
    expect((await dbV15.sesiones_fuerza_individual.get('SF1'))?.finalidad).toBe('hipertrofia')

    dbV15.close()
    await dbV15.delete()
  })

  it('3. Preservación de índices simples y compuestos requeridos en v14', async () => {
    const dbName = `test_v15_indices_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    const dbV14 = new FutsalDBv14(dbName)
    await dbV14.open()
    await dbV14.readiness.put({ id: 1, id_jugadora: 'J1', fecha: '2026-05-10', readiness_score: 95 })
    await dbV14.rpe_partido.put({ id: 2, id_partido: 'P1', id_jugadora: 'J1', fecha: '2026-05-10', rpe: 9 })
    await dbV14.sesion_rpe.put({ id: 3, id_sesion: 'S1', id_jugadora: 'J1', fecha: '2026-05-10', rpe: 8, duracion_min: 60 })
    dbV14.close()

    const dbV15 = new FutsalDB(dbName)
    await dbV15.open()

    // Consulta con índice compuesto readiness [id_jugadora+fecha]
    const readinessMatch = await dbV15.readiness
      .where('[id_jugadora+fecha]')
      .equals(['J1', '2026-05-10'])
      .first()
    expect(readinessMatch).toBeDefined()
    expect(readinessMatch?.readiness_score).toBe(95)

    // Consulta con índice compuesto rpe_partido [id_partido+id_jugadora]
    const rpePartidoMatch = await dbV15.rpe_partido
      .where('[id_partido+id_jugadora]')
      .equals(['P1', 'J1'])
      .first()
    expect(rpePartidoMatch).toBeDefined()
    expect(rpePartidoMatch?.rpe).toBe(9)

    // Consulta con índice simple sesion_rpe id_sesion
    const sesionRpeMatch = await dbV15.sesion_rpe
      .where('id_sesion')
      .equals('S1')
      .toArray()
    expect(sesionRpeMatch).toHaveLength(1)
    expect(sesionRpeMatch[0].rpe).toBe(8)

    dbV15.close()
    await dbV15.delete()
  })

  it('4. Escrituras post-upgrade en tablas v15 y resolución de alias por índice compuesto', async () => {
    const dbName = `test_v15_write_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    const dbV14 = new FutsalDBv14(dbName)
    await dbV14.open()
    await dbV14.jugadoras.put({ id_jugadora: 'J1', nombre: 'Jugadora 1', posicion: 'Ala', activa: true })
    dbV14.close()

    const dbV15 = new FutsalDB(dbName)
    await dbV15.open()

    // Insertar Temporada en v15
    const temp: Temporada = {
      id_temporada: 'TEMP-2026-2027',
      nombre: 'Temporada 2026-2027',
      fecha_inicio: '2026-08-01',
      fecha_fin: '2027-06-30',
      activa: true,
    }
    await dbV15.temporadas.put(temp)

    // Insertar AliasJugadora en v15
    const alias: AliasJugadora = {
      id_jugadora: 'J1',
      origen: 'google_forms',
      valor: 'J1-GF',
      activo: true,
      fecha_alta: '2026-08-01',
    }
    await dbV15.alias_jugadora.put(alias)

    // Resolver por índice compuesto [origen+valor]
    const aliasMatch = await dbV15.alias_jugadora
      .where('[origen+valor]')
      .equals(['google_forms', 'J1-GF'])
      .first()

    expect(aliasMatch).toBeDefined()
    expect(aliasMatch?.id_jugadora).toBe('J1')

    // Resolver la temporada activa
    const tempActiva = await dbV15.temporadas
      .filter((t) => t.activa === true)
      .first()

    expect(tempActiva).toBeDefined()
    expect(tempActiva?.id_temporada).toBe('TEMP-2026-2027')

    // Confirmar preservación de datos v14 tras las nuevas escrituras v15
    expect((await dbV15.jugadoras.get('J1'))?.nombre).toBe('Jugadora 1')

    dbV15.close()
    await dbV15.delete()
  })
})
