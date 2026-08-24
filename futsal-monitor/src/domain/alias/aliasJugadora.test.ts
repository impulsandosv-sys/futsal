import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.unmock('@/db/database')

import { FutsalDB } from '@/db/database'
import {
  validarAliasJugadora,
  agregarAliasJugadora,
  resolverAliasActivo,
  desactivarAliasJugadora,
} from './aliasJugadora'
import type { AliasJugadora, Jugadora } from '@/types'

describe('Dominio AliasJugadora (T-02-DOM-GOV)', () => {
  let testDb: FutsalDB

  beforeEach(async () => {
    const dbName = `test_alias_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    testDb = new FutsalDB(dbName)
    await testDb.open()

    // Sembrar jugadoras de prueba
    const j1: Jugadora = {
      id_jugadora: 'J1',
      nombre: 'Jugadora Uno',
      fecha_nacimiento: '2000-01-01',
      posicion: 'Ala',
      altura_cm: 165,
      peso_kg: 58,
      imc: 21.3,
      grasa: 18,
      anos_experiencia_futsal: 5,
      historial_lesional: '',
      notas: '',
      activa: true,
    }
    const j2: Jugadora = {
      id_jugadora: 'J2',
      nombre: 'Jugadora Dos',
      fecha_nacimiento: '2001-02-02',
      posicion: 'Pivot',
      altura_cm: 170,
      peso_kg: 62,
      imc: 21.5,
      grasa: 17,
      anos_experiencia_futsal: 6,
      historial_lesional: '',
      notas: '',
      activa: true,
    }
    await testDb.jugadoras.bulkPut([j1, j2])
  })

  afterEach(async () => {
    if (testDb) {
      await testDb.close()
    }
  })

  it('1. Registrar y resolver un alias activo por (origen, valor)', async () => {
    const alias: AliasJugadora = {
      id_jugadora: 'J1',
      origen: 'google_forms',
      valor: 'J1-GF',
      activo: true,
      fecha_alta: '2026-08-01',
    }
    await agregarAliasJugadora(testDb, alias)

    const resolved = await resolverAliasActivo(testDb, 'google_forms', 'J1-GF')
    expect(resolved).toBe('J1')
  })

  it('2. Una misma jugadora puede tener múltiples alias en el mismo u otro origen', async () => {
    await agregarAliasJugadora(testDb, {
      id_jugadora: 'J1',
      origen: 'google_forms',
      valor: 'J1-GF',
      activo: true,
      fecha_alta: '2026-08-01',
    })
    await agregarAliasJugadora(testDb, {
      id_jugadora: 'J1',
      origen: 'chronojump',
      valor: 'J1-CJ',
      activo: true,
      fecha_alta: '2026-08-01',
    })

    expect(await resolverAliasActivo(testDb, 'google_forms', 'J1-GF')).toBe('J1')
    expect(await resolverAliasActivo(testDb, 'chronojump', 'J1-CJ')).toBe('J1')
  })

  it('3. Rechaza registrar el mismo (origen, valor) para otra jugadora (colisión)', async () => {
    await agregarAliasJugadora(testDb, {
      id_jugadora: 'J1',
      origen: 'google_forms',
      valor: 'ALIAS-COMPARTIDO',
      activo: true,
      fecha_alta: '2026-08-01',
    })

    await expect(
      agregarAliasJugadora(testDb, {
        id_jugadora: 'J2',
        origen: 'google_forms',
        valor: 'ALIAS-COMPARTIDO',
        activo: true,
        fecha_alta: '2026-08-01',
      }),
    ).rejects.toThrow('ya está registrado para otra jugadora')
  })

  it('4. Permite el mismo valor si los orígenes son diferentes', async () => {
    await agregarAliasJugadora(testDb, {
      id_jugadora: 'J1',
      origen: 'google_forms',
      valor: '10',
      activo: true,
      fecha_alta: '2026-08-01',
    })
    await agregarAliasJugadora(testDb, {
      id_jugadora: 'J2',
      origen: 'chronojump',
      valor: '10',
      activo: true,
      fecha_alta: '2026-08-01',
    })

    expect(await resolverAliasActivo(testDb, 'google_forms', '10')).toBe('J1')
    expect(await resolverAliasActivo(testDb, 'chronojump', '10')).toBe('J2')
  })

  it('5. Un alias inactivo no resuelve por defecto', async () => {
    const res = await agregarAliasJugadora(testDb, {
      id_jugadora: 'J1',
      origen: 'google_forms',
      valor: 'J1-TEMPORAL',
      activo: true,
      fecha_alta: '2026-08-01',
    })
    const idAlias = res.id_alias

    expect(await resolverAliasActivo(testDb, 'google_forms', 'J1-TEMPORAL')).toBe('J1')

    await desactivarAliasJugadora(testDb, idAlias, '2026-08-02')

    expect(await resolverAliasActivo(testDb, 'google_forms', 'J1-TEMPORAL')).toBeNull()
  })

  it('6. Renombrar una jugadora no invalida su alias ni altera el id_jugadora', async () => {
    await agregarAliasJugadora(testDb, {
      id_jugadora: 'J1',
      origen: 'google_forms',
      valor: 'ALIAS-ESTABLE',
      activo: true,
      fecha_alta: '2026-08-01',
    })

    // Renombrar jugadora J1 en tabla jugadoras
    await testDb.jugadoras.put({
      id_jugadora: 'J1',
      nombre: 'Nuevo Nombre Jugadora Uno',
      fecha_nacimiento: '2000-01-01',
      posicion: 'Ala',
      altura_cm: 165,
      peso_kg: 58,
      imc: 21.3,
      grasa: 18,
      anos_experiencia_futsal: 5,
      historial_lesional: '',
      notas: '',
      activa: true,
    })

    expect(await resolverAliasActivo(testDb, 'google_forms', 'ALIAS-ESTABLE')).toBe('J1')
  })

  it('7. Rechaza valores vacíos o solo espacios', async () => {
    const errs1 = validarAliasJugadora({
      id_jugadora: 'J1',
      origen: 'google_forms',
      valor: '   ',
      fecha_alta: '2026-08-01',
    })
    expect(errs1).toContain('El valor del alias es obligatorio')

    await expect(
      agregarAliasJugadora(testDb, {
        id_jugadora: 'J1',
        origen: 'google_forms',
        valor: '  ',
        activo: true,
        fecha_alta: '2026-08-01',
      }),
    ).rejects.toThrow('El valor del alias es obligatorio')
  })

  it('8. Rechaza asociar alias a una jugadora inexistente', async () => {
    await expect(
      agregarAliasJugadora(testDb, {
        id_jugadora: 'J_INEXISTENTE',
        origen: 'google_forms',
        valor: 'TEST-ALIAS',
        activo: true,
        fecha_alta: '2026-08-01',
      }),
    ).rejects.toThrow("La jugadora 'J_INEXISTENTE' no existe")
  })

  it('9. Alias chronojump activo resuelve id_jugadora correctamente', async () => {
    await agregarAliasJugadora(testDb, {
      id_jugadora: 'J1',
      origen: 'chronojump',
      valor: 'CJ-01',
      activo: true,
      fecha_alta: '2026-08-01',
    })

    const res = await resolverAliasActivo(testDb, 'chronojump', 'CJ-01')
    expect(res).toBe('J1')
  })

  it('10. Alias chronojump inexistente o inactivo retorna null sin realizar fallback por nombre de jugadora', async () => {
    await agregarAliasJugadora(testDb, {
      id_jugadora: 'J1',
      origen: 'chronojump',
      valor: 'CJ-INACTIVO',
      activo: true,
      fecha_alta: '2026-08-01',
    })
    const idAlias = (await testDb.alias_jugadora.where('[origen+valor]').equals(['chronojump', 'CJ-INACTIVO']).first())?.id_alias
    if (idAlias) await desactivarAliasJugadora(testDb, idAlias, '2026-08-02')

    // Alias inactivo
    expect(await resolverAliasActivo(testDb, 'chronojump', 'CJ-INACTIVO')).toBeNull()

    // Alias inexistente con el nombre exacto de la jugadora "Jugadora Uno"
    expect(await resolverAliasActivo(testDb, 'chronojump', 'Jugadora Uno')).toBeNull()
  })

  it('11. Alias activo de J2 + alias inactivo de J1 impide reactivacion', async () => {
    // 1. Alias inactivo J1
    await testDb.alias_jugadora.add({
      id_jugadora: 'J1',
      origen: 'wellness',
      valor: 'ani',
      activo: false,
      fecha_alta: '2026-08-01',
    })

    // 2. Alias activo J2
    await testDb.alias_jugadora.add({
      id_jugadora: 'J2',
      origen: 'wellness',
      valor: 'ani',
      activo: true,
      fecha_alta: '2026-08-01',
    })

    // 3. Reactivar J1 falla
    await expect(
      agregarAliasJugadora(testDb, {
        id_jugadora: 'J1',
        origen: 'wellness',
        valor: 'ani',
        activo: true,
        fecha_alta: '2026-08-01',
      })
    ).rejects.toThrow(/ya est.* registrado para otra jugadora.*J2/)

    // Check states: J2 active, J1 inactive
    const aliases = await testDb.alias_jugadora.where('origen').equals('wellness').toArray()
    const j1Alias = aliases.find(a => a.id_jugadora === 'J1')
    const j2Alias = aliases.find(a => a.id_jugadora === 'J2')
    expect(j1Alias?.activo).toBe(false)
    expect(j2Alias?.activo).toBe(true)
  })

  it('12. resolverAliasActivo lanza AmbiguousAliasError si hay 2 activos', async () => {
    await testDb.alias_jugadora.add({
      id_jugadora: 'J1',
      origen: 'wellness',
      valor: 'ani',
      activo: true,
      fecha_alta: '2026-08-01',
    })
    await testDb.alias_jugadora.add({
      id_jugadora: 'J2',
      origen: 'google_forms', // compatible origin
      valor: 'ani',
      activo: true,
      fecha_alta: '2026-08-01',
    })

    await expect(resolverAliasActivo(testDb, 'wellness', 'ani')).rejects.toThrow(/Resolución ambigua/)
  })

  it('13. Alta idempotente misma jugadora', async () => {
    await agregarAliasJugadora(testDb, {
      id_jugadora: 'J1',
      origen: 'wellness',
      valor: 'idempotente',
      activo: true,
      fecha_alta: '2026-08-01',
    })
    const id2 = await agregarAliasJugadora(testDb, {
      id_jugadora: 'J1',
      origen: 'wellness',
      valor: 'idempotente',
      activo: true,
      fecha_alta: '2026-08-01',
    })
    expect(id2).toBeDefined()
    
    // Count should be 1
    const count = await testDb.alias_jugadora.where('valor').equals('idempotente').count()
    expect(count).toBe(1)
  })

  it('14. Reactivación misma jugadora sin conflicto', async () => {
    await testDb.alias_jugadora.add({
      id_jugadora: 'J1',
      origen: 'wellness',
      valor: 'inactivo',
      activo: false,
      fecha_alta: '2026-08-01',
    })

    await agregarAliasJugadora(testDb, {
      id_jugadora: 'J1',
      origen: 'wellness',
      valor: 'inactivo',
      activo: true,
      fecha_alta: '2026-08-02',
    })

    const resolved = await resolverAliasActivo(testDb, 'wellness', 'inactivo')
    expect(resolved).toBe('J1')
  })
})

