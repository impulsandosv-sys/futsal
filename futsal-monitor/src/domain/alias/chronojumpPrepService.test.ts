import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.unmock('@/db/database')

import { FutsalDB } from '@/db/database'
import { obtenerPreparacionChronojump } from './chronojumpPrepService'
import { agregarAliasJugadora } from './aliasJugadora'
import type { Jugadora, AliasJugadora } from '@/types'

describe('Chronojump Preparation Service (T-04B-PRE-CHECK)', () => {
  let testDb: FutsalDB

  beforeEach(async () => {
    const dbName = `test_prep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    testDb = new FutsalDB(dbName)
    await testDb.open()
  })

  afterEach(async () => {
    if (testDb) {
      await testDb.close()
    }
  })

  it('1. Una jugadora con un único alias activo de origen "chronojump" queda "lista"', async () => {
    const j1: Jugadora = {
      id_jugadora: 'J1',
      nombre: 'Ana Lopez',
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
    await testDb.jugadoras.put(j1)

    const alias: AliasJugadora = {
      id_jugadora: 'J1',
      origen: 'chronojump',
      valor: 'CJ-01',
      activo: true,
      fecha_alta: '2026-08-01',
    }
    await agregarAliasJugadora(testDb, alias)

    const prep = await obtenerPreparacionChronojump(testDb)

    expect(prep.totalActivas).toBe(1)
    expect(prep.totalListas).toBe(1)
    expect(prep.totalRequierenCorreccion).toBe(0)
    expect(prep.jugadoras[0].estado).toBe('lista')
    expect(prep.jugadoras[0].aliasOperativo).toBe('CJ-01')
  })

  it('2. Una jugadora sin aliases "chronojump" queda "sin_alias"', async () => {
    const j1: Jugadora = {
      id_jugadora: 'J1',
      nombre: 'Ana Lopez',
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
    await testDb.jugadoras.put(j1)

    const prep = await obtenerPreparacionChronojump(testDb)

    expect(prep.totalActivas).toBe(1)
    expect(prep.totalListas).toBe(0)
    expect(prep.totalRequierenCorreccion).toBe(1)
    expect(prep.jugadoras[0].estado).toBe('sin_alias')
    expect(prep.jugadoras[0].aliasOperativo).toBeUndefined()
  })

  it('3. Una jugadora con alias "chronojump" inactivo y ninguno activo queda "alias_inactivo"', async () => {
    const j1: Jugadora = {
      id_jugadora: 'J1',
      nombre: 'Ana Lopez',
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
    await testDb.jugadoras.put(j1)

    const aliasInactivo: AliasJugadora = {
      id_jugadora: 'J1',
      origen: 'chronojump',
      valor: 'CJ-01',
      activo: false,
      fecha_alta: '2026-08-01',
    }
    await testDb.alias_jugadora.put(aliasInactivo)

    const prep = await obtenerPreparacionChronojump(testDb)

    expect(prep.totalListas).toBe(0)
    expect(prep.totalRequierenCorreccion).toBe(1)
    expect(prep.jugadoras[0].estado).toBe('alias_inactivo')
    expect(prep.jugadoras[0].aliasOperativo).toBeUndefined()
  })

  it('4. Una jugadora con dos aliases "chronojump" activos queda "alias_duplicado"', async () => {
    const j1: Jugadora = {
      id_jugadora: 'J1',
      nombre: 'Ana Lopez',
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
    await testDb.jugadoras.put(j1)

    // Forzar en DB 2 aliases activos de chronojump para J1
    const a1: AliasJugadora = {
      id_jugadora: 'J1',
      origen: 'chronojump',
      valor: 'CJ-01',
      activo: true,
      fecha_alta: '2026-08-01',
    }
    const a2: AliasJugadora = {
      id_jugadora: 'J1',
      origen: 'chronojump',
      valor: 'CJ-99',
      activo: true,
      fecha_alta: '2026-08-01',
    }
    await testDb.alias_jugadora.bulkPut([a1, a2])

    const prep = await obtenerPreparacionChronojump(testDb)

    expect(prep.totalListas).toBe(0)
    expect(prep.totalRequierenCorreccion).toBe(1)
    expect(prep.jugadoras[0].estado).toBe('alias_duplicado')
  })

  it('5. Un alias de otro origen (ej. "google_forms") no cuenta como alias Chronojump', async () => {
    const j1: Jugadora = {
      id_jugadora: 'J1',
      nombre: 'Ana Lopez',
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
    await testDb.jugadoras.put(j1)

    const aliasGForms: AliasJugadora = {
      id_jugadora: 'J1',
      origen: 'google_forms',
      valor: 'Ana L.',
      activo: true,
      fecha_alta: '2026-08-01',
    }
    await agregarAliasJugadora(testDb, aliasGForms)

    const prep = await obtenerPreparacionChronojump(testDb)

    expect(prep.jugadoras[0].estado).toBe('sin_alias')
  })

  it('6. Una jugadora inactiva no aparece en el listado operativo de preparación', async () => {
    const jInactiva: Jugadora = {
      id_jugadora: 'J_INACTIVA',
      nombre: 'Maria Inactiva',
      fecha_nacimiento: '2000-01-01',
      posicion: 'Ala',
      altura_cm: 165,
      peso_kg: 58,
      imc: 21.3,
      grasa: 18,
      anos_experiencia_futsal: 5,
      historial_lesional: '',
      notas: '',
      activa: false,
    }
    await testDb.jugadoras.put(jInactiva)

    const prep = await obtenerPreparacionChronojump(testDb)

    expect(prep.totalActivas).toBe(0)
    expect(prep.jugadoras.length).toBe(0)
  })

  it('7. Jugadora con un alias Chronojump activo y otro inactivo queda "lista" con el activo', async () => {
    const j1: Jugadora = {
      id_jugadora: 'J1',
      nombre: 'Ana Lopez',
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
    await testDb.jugadoras.put(j1)

    const aActivo: AliasJugadora = {
      id_jugadora: 'J1',
      origen: 'chronojump',
      valor: 'CJ-01',
      activo: true,
      fecha_alta: '2026-08-01',
    }
    const aInactivo: AliasJugadora = {
      id_jugadora: 'J1',
      origen: 'chronojump',
      valor: 'OLD-CJ',
      activo: false,
      fecha_alta: '2026-01-01',
    }
    await testDb.alias_jugadora.bulkPut([aActivo, aInactivo])

    const prep = await obtenerPreparacionChronojump(testDb)

    expect(prep.totalListas).toBe(1)
    expect(prep.jugadoras[0].estado).toBe('lista')
    expect(prep.jugadoras[0].aliasOperativo).toBe('CJ-01')
  })

  it('8. Consulta pura: invocar el servicio no crea ni altera registros en Dexie', async () => {
    const j1: Jugadora = {
      id_jugadora: 'J1',
      nombre: 'Ana Lopez',
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
    await testDb.jugadoras.put(j1)

    const countJugBefore = await testDb.jugadoras.count()
    const countAliasBefore = await testDb.alias_jugadora.count()

    await obtenerPreparacionChronojump(testDb)

    const countJugAfter = await testDb.jugadoras.count()
    const countAliasAfter = await testDb.alias_jugadora.count()

    expect(countJugAfter).toBe(countJugBefore)
    expect(countAliasAfter).toBe(countAliasBefore)
  })
})
