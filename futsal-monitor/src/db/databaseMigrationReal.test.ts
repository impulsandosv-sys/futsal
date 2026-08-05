import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'

vi.unmock('@/db/database')

describe('Bloque A — Pruebas de migración real e historia de Dexie con fake-indexeddb', () => {
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

  it('2. Migración realista desde v14 a v15 conserva datos de readiness y rpe_partido', async () => {
    const v14Db = new Dexie(DB_NAME)
    v14Db.version(14).stores({
      jugadoras: 'id_jugadora, nombre, posicion, activa',
      wellness: '++id, [id_jugadora+fecha], id_jugadora, fecha',
      readiness: '++id, [id_jugadora+fecha], id_jugadora, fecha',
      rpe_partido: '++id, [id_partido+id_jugadora], id_jugadora, id_partido, fecha'
    })

    await v14Db.open()

    await v14Db.table('readiness').add({
      id_jugadora: 'J001',
      fecha: '2026-02-01',
      score: 85,
      nivel: 'optimo'
    })

    await v14Db.table('rpe_partido').add({
      id_jugadora: 'J001',
      id_partido: 'P001',
      fecha: '2026-02-01',
      rpe: 8,
      minutos: 40
    })

    v14Db.close()

    const upgradedDb = new FutsalDB(DB_NAME)
    await upgradedDb.open()

    const readinessRecords = await upgradedDb.readiness.where('[id_jugadora+fecha]').equals(['J001', '2026-02-01']).toArray()
    expect(readinessRecords.length).toBe(1)
    expect(readinessRecords[0].score).toBe(85)

    const rpePartidoRecords = await upgradedDb.rpe_partido.where('[id_partido+id_jugadora]').equals(['P001', 'J001']).toArray()
    expect(rpePartidoRecords.length).toBe(1)
    expect(rpePartidoRecords[0].minutos).toBe(40)

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
