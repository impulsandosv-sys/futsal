import { describe, it, expect } from 'vitest'
import Dexie from 'dexie'
import { indexedDB, IDBKeyRange } from 'fake-indexeddb'

Dexie.dependencies.indexedDB = indexedDB
Dexie.dependencies.IDBKeyRange = IDBKeyRange

describe('Database Migration v17', () => {
  it('debe mantener los datos de versiones anteriores y configurar la nueva tabla de compensación', async () => {
    const dbName = 'test-migration-db'
    await Dexie.delete(dbName)

    // 1. Crear y poblar BD en versión 16 (simulando estado anterior)
    const db16 = new Dexie(dbName)
    db16.version(16).stores({
      partidos: 'id_partido, fecha',
      rpe_partido: '++id, [id_partido+id_jugadora], id_jugadora, id_partido, fecha'
    })
    await db16.open()

    // 2. Insertar datos previos
    await (db16 as any).table('partidos').put({ id_partido: 'p1', fecha: '2026-08-10', rival: 'Equipo A' })
    await (db16 as any).table('rpe_partido').put({ id_partido: 'p1', id_jugadora: 'j1', minutos_jugados: 20 })
    db16.close()

    // 3. Abrir la BD con esquema v17
    const db17 = new Dexie(dbName)
    db17.version(16).stores({
      partidos: 'id_partido, fecha',
      rpe_partido: '++id, [id_partido+id_jugadora], id_jugadora, id_partido, fecha'
    })
    db17.version(17).stores({
      partidos: 'id_partido, fecha',
      rpe_partido: '++id, [id_partido+id_jugadora], id_jugadora, id_partido, fecha',
      compensacion_postpartido: '++id, [id_partido+id_jugadora], id_partido, id_jugadora, estado'
    })
    await db17.open()

    // 4. Comprobar que los datos previos siguen ahí
    const partidosPrevios = await (db17 as any).table('partidos').toArray()
    expect(partidosPrevios.length).toBe(1)
    expect(partidosPrevios[0].rival).toBe('Equipo A')

    const rpePrevios = await (db17 as any).table('rpe_partido').toArray()
    expect(rpePrevios.length).toBe(1)

    // 5. Comprobar que la nueva tabla existe y acepta upsert
    await (db17 as any).table('compensacion_postpartido').put({
      id_partido: 'p1',
      id_jugadora: 'j1',
      estado: 'pendiente',
      minutos_objetivo: 20,
      deficit_minutos: 0
    })

    const compensaciones = await (db17 as any).table('compensacion_postpartido').toArray()
    expect(compensaciones.length).toBe(1)

    // 6. Verificar el índice funcional [id_partido+id_jugadora] usado para el upsert
    const existing = await (db17 as any).table('compensacion_postpartido')
      .where({ id_partido: 'p1', id_jugadora: 'j1' })
      .first()

    expect(existing).toBeDefined()
    expect(existing.estado).toBe('pendiente')

    db17.close()
  })
})
