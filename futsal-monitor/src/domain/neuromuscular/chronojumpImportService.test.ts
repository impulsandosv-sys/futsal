import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.unmock('@/db/database')

import { FutsalDB } from '@/db/database'
import {
  analizarImportacionChronojumpCMJ,
  ejecutarImportacionChronojumpCMJAtomica,
} from './chronojumpImportService'
import { agregarAliasJugadora } from '@/domain/alias/aliasJugadora'
import type { Jugadora, AliasJugadora } from '@/types'
import fs from 'fs'
import path from 'path'

describe('Chronojump Import Service Integration (T-04B & T-04B-R)', () => {
  let testDb: FutsalDB

  const structuralFixturePath = path.resolve(__dirname, '../../test/fixtures/SIMULATED_jumps_2023-2-27.csv')
  const structuralFixtureContent = fs.readFileSync(structuralFixturePath, 'utf-8')

  const controlledFixturePath = path.resolve(__dirname, '../../test/fixtures/chronojump_cmj_aliases_controlados.csv')
  const controlledFixtureContent = fs.readFileSync(controlledFixturePath, 'utf-8')

  beforeEach(async () => {
    const dbName = `test_chrono_import_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    testDb = new FutsalDB(dbName)
    await testDb.open()

    // Sembrar jugadoras J1 y J2
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

    // Registrar alias chronojump para fixture original
    const aOrig1: AliasJugadora = {
      id_jugadora: 'J1',
      origen: 'chronojump',
      valor: 'bdfbd bdbd',
      activo: true,
      fecha_alta: '2026-08-01',
    }
    const aOrig2: AliasJugadora = {
      id_jugadora: 'J2',
      origen: 'chronojump',
      valor: 'fdbfdvs vasvsava',
      activo: true,
      fecha_alta: '2026-08-01',
    }

    // Registrar alias chronojump controlados CJ-01 -> J1 y CJ-02 -> J2
    const aCtrl1: AliasJugadora = {
      id_jugadora: 'J1',
      origen: 'chronojump',
      valor: 'CJ-01',
      activo: true,
      fecha_alta: '2026-08-01',
    }
    const aCtrl2: AliasJugadora = {
      id_jugadora: 'J2',
      origen: 'chronojump',
      valor: 'CJ-02',
      activo: true,
      fecha_alta: '2026-08-01',
    }

    await agregarAliasJugadora(testDb, aOrig1)
    await agregarAliasJugadora(testDb, aOrig2)
    await agregarAliasJugadora(testDb, aCtrl1)
    await agregarAliasJugadora(testDb, aCtrl2)
  })

  afterEach(async () => {
    if (testDb) {
      await testDb.close()
    }
  })

  it('1. Analiza correctamente el fixture real original con sus strings reales', async () => {
    const resumen = await analizarImportacionChronojumpCMJ(testDb, structuralFixtureContent, 'SIMULATED_jumps_2023-2-27.csv')

    expect(resumen.exito).toBe(true)
    expect(resumen.totalFilasSaltosSimples).toBe(6)
    expect(resumen.totalCMJ).toBe(6)
    expect(resumen.nuevosValidos).toBe(6)
    expect(resumen.errores).toBe(0)
    expect(resumen.puedeConfirmar).toBe(true)
  })

  it('2. Resolución positiva de identidad con fixture complementario de aliases controlados CJ-01 y CJ-02', async () => {
    const resumen = await analizarImportacionChronojumpCMJ(
      testDb,
      controlledFixtureContent,
      'chronojump_cmj_aliases_controlados.csv'
    )

    expect(resumen.exito).toBe(true)
    expect(resumen.nuevosValidos).toBe(6)
    expect(resumen.errores).toBe(0)
    expect(resumen.conflictos).toBe(0)
    expect(resumen.puedeConfirmar).toBe(true)

    // Verificar vinculación con J1 y J2
    const j1Filas = resumen.filas.filter((f) => f.idJugadora === 'J1')
    const j2Filas = resumen.filas.filter((f) => f.idJugadora === 'J2')
    expect(j1Filas.length).toBe(3)
    expect(j2Filas.length).toBe(3)

    // Verificar selección de mejor intento (J1: 55.103 cm, J2: 56.913 cm)
    expect(j1Filas.find((f) => f.seleccionadoComoMejor)?.alturaSaltoCm).toBe(55.103)
    expect(j2Filas.find((f) => f.seleccionadoComoMejor)?.alturaSaltoCm).toBe(56.913)

    // Inserción exitosa en Dexie
    const resImp = await ejecutarImportacionChronojumpCMJAtomica(testDb, resumen)
    expect(resImp.exito).toBe(true)
    expect(resImp.totalInsertados).toBe(6)

    const pruebas = await testDb.pruebas_cmj.toArray()
    expect(pruebas.length).toBe(2)
  })

  it('3. Alias inexistente (CJ-99) produce error de identidad y bloquea la confirmación', async () => {
    const csvInexistente = controlledFixtureContent.replaceAll('CJ-01', 'CJ-99')

    const resumen = await analizarImportacionChronojumpCMJ(testDb, csvInexistente, 'inexistente.csv')

    expect(resumen.exito).toBe(true)
    expect(resumen.errores).toBeGreaterThan(0)
    expect(resumen.puedeConfirmar).toBe(false)

    const filaError = resumen.filas.find((f) => f.aliasOrigen === 'CJ-99')
    expect(filaError).toBeDefined()
    expect(filaError?.estado).toBe('error')
    expect(filaError?.motivoEstado).toContain("Alias 'chronojump' \"CJ-99\" no está registrado o no está activo")

    // Confirmación bloqueada
    await expect(ejecutarImportacionChronojumpCMJAtomica(testDb, resumen)).rejects.toThrow()
  })

  it('4. Alias inactivo (CJ-03) produce error de identidad y no reactiva ni inserta nada', async () => {
    // Registrar alias inactivo CJ-03 para J1
    const aInactivo: AliasJugadora = {
      id_jugadora: 'J1',
      origen: 'chronojump',
      valor: 'CJ-03',
      activo: false,
      fecha_alta: '2026-08-01',
    }
    await testDb.alias_jugadora.put(aInactivo)

    const csvInactivo = controlledFixtureContent.replaceAll('CJ-01', 'CJ-03')

    const resumen = await analizarImportacionChronojumpCMJ(testDb, csvInactivo, 'inactivo.csv')

    expect(resumen.errores).toBeGreaterThan(0)
    expect(resumen.puedeConfirmar).toBe(false)

    const filaError = resumen.filas.find((f) => f.aliasOrigen === 'CJ-03')
    expect(filaError?.estado).toBe('error')
    expect(filaError?.motivoEstado).toContain('no está activo')
  })

  it('5. Prohibición estricta de fallback por nombre real o apellidos', async () => {
    // Crear jugadora J3 cuyo nombre visible es "CJ-01", pero SIN alias registado
    const j3: Jugadora = {
      id_jugadora: 'J3',
      nombre: 'CJ-01',
      fecha_nacimiento: '2002-03-03',
      posicion: 'Cierre',
      altura_cm: 168,
      peso_kg: 60,
      imc: 21.2,
      grasa: 19,
      anos_experiencia_futsal: 4,
      historial_lesional: '',
      notas: '',
      activa: true,
    }
    await testDb.jugadoras.put(j3)

    // Eliminar alias registrado de CJ-01
    await testDb.alias_jugadora.where('valor').equals('CJ-01').delete()

    const resumen = await analizarImportacionChronojumpCMJ(testDb, controlledFixtureContent, 'no_fallback.csv')

    // El alias CJ-01 no debe resolver contra J3 por coincidencia de nombre
    const filasCJ01 = resumen.filas.filter((f) => f.aliasOrigen === 'CJ-01')
    filasCJ01.forEach((f) => {
      expect(f.estado).toBe('error')
      expect(f.idJugadora).toBeNull()
    })
    expect(resumen.puedeConfirmar).toBe(false)
  })

  it('6. Reimportación exacta del mismo archivo clasifica como duplicados y deshabilita la confirmación', async () => {
    const resumen1 = await analizarImportacionChronojumpCMJ(testDb, controlledFixtureContent, 'controlled.csv')
    await ejecutarImportacionChronojumpCMJAtomica(testDb, resumen1)

    const resumen2 = await analizarImportacionChronojumpCMJ(testDb, controlledFixtureContent, 'controlled.csv')
    expect(resumen2.duplicados).toBe(6)
    expect(resumen2.nuevosValidos).toBe(0)
    expect(resumen2.puedeConfirmar).toBe(false)
  })

  it('7. Conflicto con misma clave lógica y distinta altura bloquea confirmación e impide sobrescribir', async () => {
    const resumen1 = await analizarImportacionChronojumpCMJ(testDb, controlledFixtureContent, 'controlled.csv')
    await ejecutarImportacionChronojumpCMJAtomica(testDb, resumen1)

    // Modificar altura del primer salto de CJ-01
    const csvConflicto = controlledFixtureContent.replace('40,068', '50,000')

    const resumenConflicto = await analizarImportacionChronojumpCMJ(testDb, csvConflicto, 'conflicto.csv')
    expect(resumenConflicto.conflictos).toBeGreaterThan(0)
    expect(resumenConflicto.puedeConfirmar).toBe(false)

    // Confirmación rechazada
    await expect(ejecutarImportacionChronojumpCMJAtomica(testDb, resumenConflicto)).rejects.toThrow()

    // Los datos preexistentes quedan intactos
    const pruebas = await testDb.pruebas_cmj.toArray()
    const pJ1 = pruebas.find((p) => p.id_jugadora === 'J1')
    expect(pJ1?.intentos.find((i) => i.orden === 1)?.altura_cm).toBe(40.068)
  })

  it('8. Rollback atómico completo ante fallo inducido en la transacción Dexie', async () => {
    const resumen = await analizarImportacionChronojumpCMJ(testDb, controlledFixtureContent, 'controlled.csv')

    // Forzar fallo simulando error en historial_importaciones.put
    const origHistPut = testDb.historial_importaciones.put
    testDb.historial_importaciones.put = vi.fn(() => Promise.reject(new Error('Error inducido en historial'))) as typeof testDb.historial_importaciones.put

    await expect(ejecutarImportacionChronojumpCMJAtomica(testDb, resumen)).rejects.toThrow('Error inducido en historial')

    testDb.historial_importaciones.put = origHistPut

    // Ninguna medición ni entrada en historial debe permanecer escrita en Dexie
    const pruebas = await testDb.pruebas_cmj.toArray()
    const historial = await testDb.historial_importaciones.toArray()
    expect(pruebas.length).toBe(0)
    expect(historial.length).toBe(0)
  })
})
