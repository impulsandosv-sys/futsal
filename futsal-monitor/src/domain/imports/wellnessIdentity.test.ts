import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.unmock('@/db/database')
import { FutsalDB } from '@/db/database'
import {
  resolverIdentidadFilaWellness,
  validarRangoTemporadaWellness
} from './wellnessIdentity'
import type { Temporada } from '@/types'

describe('Dominio T-02A — Identity & Season Validation for Wellness Import', () => {
  let db: FutsalDB

  beforeEach(async () => {
    db = new FutsalDB(`test_wellness_identity_${Date.now()}_${Math.random()}`)
    await db.open()

    // Configurar jugadoras
    await db.jugadoras.put({ id_jugadora: 'J1', nombre: 'Ana López', posicion: 'Ala', activa: true })
    await db.jugadoras.put({ id_jugadora: 'J2', nombre: 'María García', posicion: 'Pívot', activa: true })

    // Configurar alias
    await db.alias_jugadora.put({
      id_jugadora: 'J1',
      origen: 'google_forms',
      valor: 'GF-001',
      activo: true,
      fecha_alta: '2026-08-01'
    })
    await db.alias_jugadora.put({
      id_jugadora: 'J2',
      origen: 'google_forms',
      valor: 'GF-002',
      activo: true,
      fecha_alta: '2026-08-01'
    })
    await db.alias_jugadora.put({
      id_jugadora: 'J1',
      origen: 'google_forms',
      valor: 'GF-INACTIVO',
      activo: false,
      fecha_alta: '2026-08-01',
      fecha_baja: '2026-08-02'
    })
  })

  describe('resolverIdentidadFilaWellness', () => {
    it('1. Resolver alias activo google_forms asigna a id_jugadora interno', async () => {
      const res1 = await resolverIdentidadFilaWellness(db, 'GF-001')
      expect(res1.exito).toBe(true)
      expect(res1.id_jugadora).toBe('J1')
      expect(res1.alias_origen).toBe('GF-001')

      const res2 = await resolverIdentidadFilaWellness(db, 'GF-002')
      expect(res2.exito).toBe(true)
      expect(res2.id_jugadora).toBe('J2')
      expect(res2.alias_origen).toBe('GF-002')
    })

    it('2. Alias con espacios se limpia automáticamente', async () => {
      const res = await resolverIdentidadFilaWellness(db, '  GF-001  ')
      expect(res.exito).toBe(true)
      expect(res.id_jugadora).toBe('J1')
    })

    it('3. Alias inexistente retorna error de ID no reconocido', async () => {
      const res = await resolverIdentidadFilaWellness(db, 'GF-DESCONOCIDO')
      expect(res.exito).toBe(false)
      expect(res.mensajeError).toContain('Jugadora no registrada')
    })

    it('4. Alias inactivo retorna error específico', async () => {
      const res = await resolverIdentidadFilaWellness(db, 'GF-INACTIVO')
      expect(res.exito).toBe(false)
      expect(res.mensajeError).toContain('Alias \'GF-INACTIVO\' inactivo')
    })

    it('5. ID ausente o vacío retorna error de ID vacío', async () => {
      const resNull = await resolverIdentidadFilaWellness(db, null)
      expect(resNull.exito).toBe(false)
      expect(resNull.mensajeError).toContain('ID_Jugadora ausente')

      const resEmpty = await resolverIdentidadFilaWellness(db, '   ')
      expect(resEmpty.exito).toBe(false)
      expect(resEmpty.mensajeError).toContain('ID_Jugadora vacío')
    })

    it('6. Alias asignado a una jugadora borrada retorna error de existencia', async () => {
      await db.alias_jugadora.put({
        id_jugadora: 'J99',
        origen: 'google_forms',
        valor: 'GF-FANTASMA',
        activo: true,
        fecha_alta: '2026-08-01'
      })

      const res = await resolverIdentidadFilaWellness(db, 'GF-FANTASMA')
      expect(res.exito).toBe(false)
      expect(res.mensajeError).toContain('La jugadora \'J99\' no existe')
    })

    it('7. Resuelve por nombre normalizado (igualdad estricta)', async () => {
      const res = await resolverIdentidadFilaWellness(db, ' ANA LOPEZ ')
      expect(res.exito).toBe(true)
      expect(res.id_jugadora).toBe('J1')
      expect(res.alias_origen).toBe('ANA LOPEZ')
    })

    it('8. No resuelve coincidencias parciales de nombre', async () => {
      const res = await resolverIdentidadFilaWellness(db, 'Ana')
      expect(res.exito).toBe(false)
      expect(res.mensajeError).toContain('Jugadora no registrada')
    })

    it('9. Bloquea ambigüedad si múltiples jugadoras coinciden exactamente con el nombre normalizado', async () => {
      await db.jugadoras.put({ id_jugadora: 'J3', nombre: 'ana lopez', posicion: 'Cierre', activa: true })

      const res = await resolverIdentidadFilaWellness(db, 'ANA LOPEZ')
      expect(res.exito).toBe(false)
      expect(res.mensajeError).toContain('Ambigüedad')
    })

    it('10. Ignora jugadoras inactivas al resolver por nombre', async () => {
      await db.jugadoras.put({ id_jugadora: 'J4', nombre: 'Carmen', posicion: 'Cierre', activa: false })

      const res = await resolverIdentidadFilaWellness(db, 'Carmen')
      expect(res.exito).toBe(false)
      expect(res.mensajeError).toContain('Jugadora no registrada')
    })
  })

  describe('validarRangoTemporadaWellness', () => {
    const tempActiva: Temporada = {
      id_temporada: 'TEMP-2026-2027',
      nombre: 'Temporada 2026/2027',
      fecha_inicio: '2026-08-01',
      fecha_fin: '2027-06-30',
      activa: true
    }

    it('7. Fecha dentro del rango inclusivo es válida', () => {
      const resMid = validarRangoTemporadaWellness('2026-10-15', tempActiva)
      expect(resMid.exito).toBe(true)
      expect(resMid.id_temporada).toBe('TEMP-2026-2027')

      const resStart = validarRangoTemporadaWellness('2026-08-01', tempActiva)
      expect(resStart.exito).toBe(true)

      const resEnd = validarRangoTemporadaWellness('2027-06-30', tempActiva)
      expect(resEnd.exito).toBe(true)
    })

    it('8. Fecha fuera del rango inclusivo es rechazada', () => {
      const resBefore = validarRangoTemporadaWellness('2026-07-31', tempActiva)
      expect(resBefore.exito).toBe(false)
      expect(resBefore.mensajeError).toContain('fuera del rango de la temporada activa')

      const resAfter = validarRangoTemporadaWellness('2027-07-01', tempActiva)
      expect(resAfter.exito).toBe(false)
      expect(resAfter.mensajeError).toContain('fuera del rango de la temporada activa')
    })

    it('9. Ausencia de temporada activa es rechazada', () => {
      const res = validarRangoTemporadaWellness('2026-08-05', null)
      expect(res.exito).toBe(false)
      expect(res.mensajeError).toContain('No existe una temporada activa')
    })

    it('10. Formato de fecha erróneo es rechazado', () => {
      const res = validarRangoTemporadaWellness('05/08/2026', tempActiva)
      expect(res.exito).toBe(false)
      expect(res.mensajeError).toContain('YYYY-MM-DD')
    })
  })
})
