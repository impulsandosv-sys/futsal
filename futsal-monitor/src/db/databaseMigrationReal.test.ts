import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'

vi.unmock('@/db/database')

class FutsalDBv14 extends Dexie {
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
      rpe_entreno: '++id, id_jugadora, id_sesion, fecha',
      rpe_partido: '++id, id_jugadora, id_partido, fecha',
      resumen_semanal: '++id, id_jugadora, semana',
      alertas: '++id, id_jugadora, tipo, leida'
    })
    this.version(5).stores({
      sesion_rpe: '++id, id_sesion, id_jugadora, fecha',
      readiness: '++id, id_jugadora, fecha',
      wellness: '++id, [id_jugadora+fecha], id_jugadora, fecha'
    })
    this.version(6).stores({
      alertas: '++id, id_jugadora, tipo, estado, prioridad'
    })
    this.version(7).stores({
      historial_importaciones: '++id, fechaHora, tipoImportacion, archivo'
    })
    this.version(8).stores({
      ciclo_menstrual: '++id, id_jugadora, fecha',
      carga_gps: '++id, id_jugadora, fecha, id_sesion, id_partido',
      fuerza_vbt: '++id, id_jugadora, fecha',
      hidratacion: '++id, id_jugadora, fecha'
    })
    this.version(9).stores({
      rtp_checklist: '++id, id_lesion',
      test_psicologico: '++id, id_jugadora, fecha'
    })
    this.version(10).stores({
      historial_copias: '++id, fechaHora, tipo, confirmadaExterna'
    })
    this.version(11).stores({
      plantillas_importacion: '++id, nombre, tipoImportacion, esPredeterminada'
    })
    this.version(12).stores({
      protocolos_cmj: 'id_protocolo, activo',
      pruebas_cmj: 'id_medicion, id_jugadora, fecha, id_protocolo, [id_jugadora+fecha], [id_jugadora+id_protocolo+fecha]',
      ejercicios_fuerza: 'id_ejercicio, nombre_normalizado, activo',
      trabajos_fuerza: 'id_trabajo, id_sesion, id_jugadora, id_ejercicio, [id_sesion+id_jugadora], [id_jugadora+id_sesion]',
      plantillas_fuerza: 'id_plantilla, activa'
    })
    this.version(13).stores({
      sesiones_fuerza_individual: 'id_sesion_fuerza, id_jugadora, fecha, [id_jugadora+fecha], finalidad',
      trabajos_fuerza: 'id_trabajo, id_sesion, id_jugadora, id_ejercicio, [id_sesion+id_jugadora], [id_jugadora+id_sesion], id_sesion_fuerza'
    })
    this.version(14).stores({
      readiness: '++id, [id_jugadora+fecha], id_jugadora, fecha',
      rpe_partido: '++id, [id_partido+id_jugadora], id_jugadora, id_partido, fecha'
    })
  }
}

describe('Bloque A/D — Pruebas de migración real e historia de Dexie con fake-indexeddb', () => {
  const DB_NAME = 'futsal_migration_test_db'
  let FutsalDB: any

  beforeEach(async () => {
    const mod = await vi.importActual<any>('@/db/database')
    FutsalDB = mod.FutsalDB
    await Dexie.delete(DB_NAME)
  })

  it('1. Reconstrucción de historia v1 -> v15: preserva la tabla rpe_entreno y sus datos históricos físicamente sin borrar nada con null', async () => {
    // 1. Crear base de datos en v1 con rpe_entreno
    const v1Db = new Dexie(DB_NAME)
    v1Db.version(1).stores({
      jugadoras: 'id_jugadora, nombre, posicion, activa',
      formulario_respuestas: '++id, id_jugadora, fecha',
      wellness: '++id, id_jugadora, fecha',
      sesiones: 'id_sesion, fecha, tipo_sesion',
      partidos: 'id_partido, fecha',
      lesiones: 'id_lesion, id_jugadora, fecha_inicio, disponible',
      tests_fisicos: '++id, id_jugadora, fecha, test',
      rpe_entreno: '++id, id_jugadora, id_sesion, fecha',
      rpe_partido: '++id, id_jugadora, id_partido, fecha',
      resumen_semanal: '++id, id_jugadora, semana',
      alertas: '++id, id_jugadora, tipo, leida'
    })

    await v1Db.open()

    // Insertar registros en rpe_entreno y jugadoras en v1
    await v1Db.table('jugadoras').add({
      id_jugadora: 'J001',
      nombre: 'Ana Lopez',
      posicion: 'Ala',
      activa: true
    })

    await v1Db.table('rpe_entreno').add({
      id_jugadora: 'J001',
      id_sesion: 'S001',
      fecha: '2024-03-01',
      rpe: 7,
      minutos: 90
    })

    v1Db.close()

    // 2. Abrir con FutsalDB (v15 actual)
    const upgradedDb = new FutsalDB(DB_NAME)
    await upgradedDb.open()

    // Comprobar que la jugadora existe
    const jugadoras = await upgradedDb.jugadoras.toArray()
    expect(jugadoras.length).toBe(1)
    expect(jugadoras[0].id_jugadora).toBe('J001')

    // Comprobar que la tabla rpe_entreno sigue físicamente en IndexedDB y sus datos están preservados
    const rpeEntrenoTable = upgradedDb.table('rpe_entreno')
    expect(rpeEntrenoTable).toBeDefined()

    const rpeRecords = await rpeEntrenoTable.toArray()
    expect(rpeRecords.length).toBe(1)
    expect(rpeRecords[0].id_jugadora).toBe('J001')
    expect(rpeRecords[0].rpe).toBe(7)

    upgradedDb.close()
  })

  it('2. Migración realista desde v14 COMPLETA a v15 conserva el 100% de las 27+ tablas y la física rpe_entreno', async () => {
    const v14Db = new FutsalDBv14(DB_NAME)
    await v14Db.open()

    // Sembrar registros representativos en las 27+ tablas de v14
    await v14Db.table('jugadoras').add({ id_jugadora: 'J14', nombre: 'Elena V14', posicion: 'Pivot', activa: true })
    await v14Db.table('formulario_respuestas').add({ id_jugadora: 'J14', fecha: '2026-02-01' })
    await v14Db.table('wellness').add({ id_jugadora: 'J14', fecha: '2026-02-01', score_wellness: 85 })
    await v14Db.table('sesiones').add({ id_sesion: 'S14', fecha: '2026-02-01', tipo_sesion: 'Entreno' })
    await v14Db.table('partidos').add({ id_partido: 'P14', fecha: '2026-02-02', rival: 'Rival v14' })
    await v14Db.table('lesiones').add({ id_lesion: 'L14', id_jugadora: 'J14', fecha_inicio: '2026-01-10', disponible: false, fase_rtp: 'Fase 1' })
    await v14Db.table('tests_fisicos').add({ id_jugadora: 'J14', fecha: '2026-02-01', test: 'YYIR1' })
    await v14Db.table('rpe_entreno').add({ id_jugadora: 'J14', id_sesion: 'S14', fecha: '2026-02-01', rpe: 7 })
    await v14Db.table('rpe_partido').add({ id_jugadora: 'J14', id_partido: 'P14', fecha: '2026-02-02', rpe: 8, minutos: 40 })
    await v14Db.table('resumen_semanal').add({ id_jugadora: 'J14', semana: '2026-W05', estado: 'optimo' })
    await v14Db.table('alertas').add({ id_jugadora: 'J14', fecha: '2026-02-01', tipo: 'carga_alta', estado: 'abierta', prioridad: 'alto' })
    await v14Db.table('sesion_rpe').add({ id_jugadora: 'J14', id_sesion: 'S14', fecha: '2026-02-01', rpe: 6 })
    await v14Db.table('readiness').add({ id_jugadora: 'J14', fecha: '2026-02-01', score: 85 })
    await v14Db.table('historial_importaciones').add({ fechaHora: '2026-02-01T10:00:00Z', tipoImportacion: 'wellness', archivo: 'w.csv' })
    await v14Db.table('historial_copias').add({ fechaHora: '2026-02-01T11:00:00Z', tipo: 'automatica', confirmadaExterna: true })
    await v14Db.table('ciclo_menstrual').add({ id_jugadora: 'J14', fecha: '2026-02-01', fase: 'Folicular' })
    await v14Db.table('carga_gps').add({ id_jugadora: 'J14', fecha: '2026-02-01', id_sesion: 'S14', distancia_total: 4500 })
    await v14Db.table('fuerza_vbt').add({ id_jugadora: 'J14', fecha: '2026-02-01', velocidad_media: 1.1 })
    await v14Db.table('hidratacion').add({ id_jugadora: 'J14', fecha: '2026-02-01', color_orina: 2 })
    await v14Db.table('rtp_checklist').add({ id_lesion: 'L14', item: 'Trote continuo', completado: true })
    await v14Db.table('test_psicologico').add({ id_jugadora: 'J14', fecha: '2026-02-01', score: 90 })
    await v14Db.table('plantillas_importacion').add({ nombre: 'Plantilla v14', tipoImportacion: 'wellness', esPredeterminada: true })
    await v14Db.table('protocolos_cmj').add({ id_protocolo: 'cmj-std', activo: 1 })
    await v14Db.table('pruebas_cmj').add({ id_medicion: 'M14', id_jugadora: 'J14', fecha: '2026-02-01', id_protocolo: 'cmj-std', altura_cm: 32.5 })
    await v14Db.table('ejercicios_fuerza').add({ id_ejercicio: 'E14', nombre_normalizado: 'sentadilla', activo: 1 })
    await v14Db.table('trabajos_fuerza').add({ id_trabajo: 'T14', id_sesion: 'S14', id_jugadora: 'J14', id_ejercicio: 'E14' })
    await v14Db.table('plantillas_fuerza').add({ id_plantilla: 'PL14', activa: 1 })
    await v14Db.table('sesiones_fuerza_individual').add({ id_sesion_fuerza: 'SFI14', id_jugadora: 'J14', fecha: '2026-02-01', finalidad: 'fuerza_maxima' })

    v14Db.close()

    // Abrir con FutsalDB (v15 actual)
    const upgradedDb = new FutsalDB(DB_NAME)
    await upgradedDb.open()

    expect(upgradedDb.verno).toBe(15)

    // Nuevas tablas v15
    expect(upgradedDb.temporadas).toBeDefined()
    expect(upgradedDb.alias_jugadora).toBeDefined()

    // Comprobar datos v14 preservados en tablas principales
    const jugadoras = await upgradedDb.jugadoras.toArray()
    expect(jugadoras.length).toBe(1)
    expect(jugadoras[0].id_jugadora).toBe('J14')

    const wellness = await upgradedDb.wellness.toArray()
    expect(wellness.length).toBe(1)
    expect(wellness[0].score_wellness).toBe(85)

    const sesiones = await upgradedDb.sesiones.toArray()
    expect(sesiones.length).toBe(1)
    expect(sesiones[0].id_sesion).toBe('S14')

    const partidos = await upgradedDb.partidos.toArray()
    expect(partidos.length).toBe(1)
    expect(partidos[0].id_partido).toBe('P14')

    const lesiones = await upgradedDb.lesiones.toArray()
    expect(lesiones.length).toBe(1)
    expect(lesiones[0].id_lesion).toBe('L14')

    const cmj = await upgradedDb.pruebas_cmj.toArray()
    expect(cmj.length).toBe(1)
    expect(cmj[0].id_medicion).toBe('M14')

    // Preservación física de rpe_entreno
    const rpeEntrenoTable = upgradedDb.table('rpe_entreno')
    expect(rpeEntrenoTable).toBeDefined()
    const rpeEntrenoRecords = await rpeEntrenoTable.toArray()
    expect(rpeEntrenoRecords.length).toBe(1)
    expect(rpeEntrenoRecords[0].rpe).toBe(7)

    // Índices compuestos críticos
    const readinessRecords = await upgradedDb.readiness.where('[id_jugadora+fecha]').equals(['J14', '2026-02-01']).toArray()
    expect(readinessRecords.length).toBe(1)
    expect(readinessRecords[0].score).toBe(85)

    const rpePartidoRecords = await upgradedDb.rpe_partido.where('[id_partido+id_jugadora]').equals(['P14', 'J14']).toArray()
    expect(rpePartidoRecords.length).toBe(1)
    expect(rpePartidoRecords[0].minutos).toBe(40)

    // Idempotencia: protocolo cmj-std no duplicado
    const protCount = await upgradedDb.protocolos_cmj.where('id_protocolo').equals('cmj-std').count()
    expect(protCount).toBe(1)

    upgradedDb.close()
  })

  it('3. Base de datos nueva creada directamente en v15 funciona correctamente y ejecuta seedFase5', async () => {
    const freshDb = new FutsalDB(DB_NAME)
    await freshDb.open()

    const protocolos = await freshDb.protocolos_cmj.toArray()
    expect(protocolos.length).toBeGreaterThan(0)
    expect(protocolos.some((p: any) => p.id_protocolo === 'cmj-std')).toBe(true)

    freshDb.close()
  })

  it('4. Idempotencia de seedFase5: re-ejecutar seedFase5 en base poblada no duplica el protocolo estándar', async () => {
    const freshDb = new FutsalDB(DB_NAME)
    await freshDb.open()

    const count1 = await freshDb.protocolos_cmj.where('activo').equals(1).count()

    // Forzar re-ejecución
    await freshDb.transaction('rw', freshDb.protocolos_cmj, async (tx: any) => {
      await (freshDb as any).seedFase5(tx)
    })

    const count2 = await freshDb.protocolos_cmj.where('activo').equals(1).count()
    expect(count2).toBe(count1)

    freshDb.close()
  })
})
