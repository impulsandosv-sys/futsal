import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.unmock('@/db/database')
import { FutsalDB } from '@/db/database'
import { resolverIdentidadFilaWellness } from './wellnessIdentity'
import { agregarAliasJugadora, resolverAliasActivo } from '../alias/aliasJugadora'
import { aplicarImportacionWellness } from '@/utils/importEngine'
import { getLocalDateString } from '@/domain/dates/dates'
import type { Temporada } from '@/types'

describe('PR-1: Alias persistentes de Wellness', () => {
  let db: FutsalDB

  beforeEach(async () => {
    db = new FutsalDB(`test_alias_${Date.now()}_${Math.random()}`)
    await db.open()
    await db.jugadoras.bulkAdd([
      { id_jugadora: 'J-1', nombre: 'Ana G', activa: true, posicion: 'Ala' },
      { id_jugadora: 'J-2', nombre: 'Bea H', activa: true, posicion: 'Cierre' }
    ])
    await db.temporadas.add({
      id_temporada: 'T1',
      nombre: 'T1',
      fecha_inicio: '2026-01-01',
      fecha_fin: '2026-12-31',
      activa: true
    })
  })

  it('1) auto-resuelve por nombre exacto normalizado', async () => {
    const res = await resolverIdentidadFilaWellness(db, '   AnA   G   ')
    expect(res.exito).toBe(true)
    expect(res.id_jugadora).toBe('J-1')
    expect(res.metodo_resolucion).toBe('Coincidencia nombre')
  })

  it('2) resolucion por ID exacto', async () => {
    const res = await resolverIdentidadFilaWellness(db, 'J-2')
    expect(res.exito).toBe(true)
    expect(res.id_jugadora).toBe('J-2')
  })

  it('3) resolucion por alias guardado', async () => {
    await agregarAliasJugadora(db, { id_jugadora: 'J-1', origen: 'wellness', valor: 'Anita', activo: true, fecha_alta: getLocalDateString() })
    const res = await resolverIdentidadFilaWellness(db, 'Anita')
    expect(res.exito).toBe(true)
    expect(res.id_jugadora).toBe('J-1')
    expect(res.metodo_resolucion).toBe('Alias activo')
  })

  it('4) ambito exclusivo de fuente (un alias google_forms no afecta manual)', async () => {
    await agregarAliasJugadora(db, { id_jugadora: 'J-1', origen: 'manual', valor: 'AliasManual', activo: true, fecha_alta: getLocalDateString() })
    const res = await resolverIdentidadFilaWellness(db, 'AliasManual')
    expect(res.exito).toBe(false)
  })

  it('5) no se auto-resuelve con alias inactivo', async () => {
    await agregarAliasJugadora(db, { id_jugadora: 'J-1', origen: 'wellness', valor: 'AnitaOld', activo: false, fecha_alta: getLocalDateString() })
    const res = await resolverIdentidadFilaWellness(db, 'AnitaOld')
    expect(res.exito).toBe(false)
  })

  it('6) reasignar UI con el checkbox crear alias persistido (aplicarImportacionWellness)', async () => {
    const rows = [{
       filaOriginal: 2,
       estado: 'NUEVO' as const,
       id_jugadora: 'J-1',
       alias_origen: 'La Ani',
       fecha: '2026-05-01',
       normalRow: {
         id_jugadora: 'J-1',
         alias_origen: 'La Ani',
         fecha: '2026-05-01',
         calidad_sueno: 5,
         id_temporada: 'T1'
       } as any,
       rowOriginal: {} as any
    }]
    const outcome = await aplicarImportacionWellness(
      rows, 'update', 'test.csv', 'Hoja', 'Map', 'backup.json', 'DIARIO', undefined, db,
      [{ alias_origen: 'La Ani', id_jugadora: 'J-1' }]
    )
    expect(outcome.nuevos_aliases).toBe(1)
    
    const res = await resolverIdentidadFilaWellness(db, 'La Ani')
    expect(res.exito).toBe(true)
  })

  it('7) conflicto misma jugadora (idempotente)', async () => {
    await agregarAliasJugadora(db, { id_jugadora: 'J-1', origen: 'wellness', valor: 'Doble', activo: true, fecha_alta: getLocalDateString() })
    const id = await agregarAliasJugadora(db, { id_jugadora: 'J-1', origen: 'wellness', valor: 'Doble', activo: true, fecha_alta: getLocalDateString() })
    expect(id).toBeDefined()
  })

  it('8) conflicto distinta jugadora (lanza error)', async () => {
    await agregarAliasJugadora(db, { id_jugadora: 'J-1', origen: 'wellness', valor: 'Conflictiva', activo: true, fecha_alta: getLocalDateString() })
    await expect(agregarAliasJugadora(db, { id_jugadora: 'J-2', origen: 'wellness', valor: 'Conflictiva', activo: true, fecha_alta: getLocalDateString() })).rejects.toThrow(/registrado para otra jugadora/)
  })

  it('9) transaccion es atomica y no se crea si el proceso global falla', async () => {
    const rows = [{
       filaOriginal: 2,
       estado: 'NUEVO' as const,
       id_jugadora: 'INEXISTENTE', 
       alias_origen: 'Inva',
       fecha: '2026-05-01', 
       normalRow: { id_jugadora: 'INEXISTENTE', fecha: '2026-05-01', id_temporada: 'T1', calidad_sueno: 5 } as any, 
       rowOriginal: {} as any
    }]
    try {
      await aplicarImportacionWellness(
        rows, 'update', 'test.csv', 'Hoja', 'Map', 'backup.json', 'DIARIO', undefined, db,
        [{ alias_origen: 'FailsSafe', id_jugadora: 'J-1' }]
      )
    } catch(e) {}
    
    const res = await resolverIdentidadFilaWellness(db, 'FailsSafe')
    expect(res.exito).toBe(false)
  })

  it('10) retrocompatibilidad: esquema Dexie soporta importaciones viejas', async () => {
    expect(db.verno).toBeGreaterThanOrEqual(17)
    const count = await db.alias_jugadora.count()
    expect(count).toBe(0)
  })
})