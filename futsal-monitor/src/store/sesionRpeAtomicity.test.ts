import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock de db y servicios
vi.mock('@/db/database', () => {
  const mockTable = () => ({
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([]))
      })),
      toArray: vi.fn(() => Promise.resolve([]))
    })),
    toArray: vi.fn(() => Promise.resolve([]))
  })

  return {
    db: {
      transaction: vi.fn((_mode, _tables, cb) => cb()),
      sesion_rpe: mockTable(),
      resumen_semanal: mockTable(),
      readiness: mockTable(),
      jugadoras: mockTable(),
      sesiones: mockTable(),
      partidos: mockTable(),
      rpe_partido: mockTable(),
      wellness: mockTable(),
      alertas: mockTable(),
      historial_importaciones: mockTable(),
      historial_copias: mockTable(),
      ciclo_menstrual: mockTable(),
      carga_gps: mockTable(),
      fuerza_vbt: mockTable(),
      hidratacion: mockTable(),
      rtp_checklist: mockTable(),
      test_psicologico: mockTable(),
      plantillas_importacion: mockTable(),
      protocolos_cmj: mockTable(),
      pruebas_cmj: mockTable(),
      ejercicios_fuerza: mockTable(),
      trabajos_fuerza: mockTable(),
      plantillas_fuerza: mockTable(),
      sesiones_fuerza_individual: mockTable(),
    }
  }
})

import { useStore } from './store'
import { db } from '@/db/database'

describe('addSesionRPE / updateSesionRPE / deleteSesionRPE - Tests Unitarios y de Estructura (Bloque 2G)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Alta (addSesionRPE)', () => {
    it('Rechaza datos con validacion síncrona invalida antes de abrir transacción', async () => {
      const invalidRpe = {
        id_sesion: '',
        id_jugadora: 'JUG1',
        fecha: '2026-05-10',
        rpe: 5
      }

      await expect(useStore.getState().addSesionRPE(invalidRpe as any)).rejects.toThrow('ID de sesión requerido')
      expect(db.transaction).not.toHaveBeenCalled()
    })

    it('Rechaza si RPE fuera de rango antes de abrir transacción', async () => {
      const invalidRpe = {
        id_sesion: 'SES1',
        id_jugadora: 'JUG1',
        fecha: '2026-05-10',
        rpe: 15
      }

      await expect(useStore.getState().addSesionRPE(invalidRpe as any)).rejects.toThrow('RPE debe ser 1-10')
      expect(db.transaction).not.toHaveBeenCalled()
    })
  })

  describe('Edición (updateSesionRPE)', () => {
    it('Rechaza datos con formato invalido antes de abrir transacción', async () => {
      const invalidRpe = {
        id: 1,
        id_sesion: '',
        id_jugadora: 'JUG1',
        fecha: '2026-05-10'
      }

      await expect(useStore.getState().updateSesionRPE(invalidRpe as any)).rejects.toThrow('ID de sesión requerido')
      expect(db.transaction).not.toHaveBeenCalled()
    })

    it('Rechaza si id no es un numero entero positivo antes de abrir transacción', async () => {
      const invalidRpe = {
        id: 0,
        id_sesion: 'SES1',
        id_jugadora: 'JUG1',
        fecha: '2026-05-10',
        rpe: 5
      }

      await expect(useStore.getState().updateSesionRPE(invalidRpe as any)).rejects.toThrow('No se puede actualizar RPE de sesión sin un ID válido')
      expect(db.transaction).not.toHaveBeenCalled()
    })

    it('Rechaza si id es undefined antes de abrir transacción', async () => {
      const invalidRpe = {
        id_sesion: 'SES1',
        id_jugadora: 'JUG1',
        fecha: '2026-05-10',
        rpe: 5
      }

      await expect(useStore.getState().updateSesionRPE(invalidRpe as any)).rejects.toThrow('No se puede actualizar RPE de sesión sin un ID válido')
      expect(db.transaction).not.toHaveBeenCalled()
    })
  })

  describe('Borrado (deleteSesionRPE)', () => {
    it('Rechaza si id no es un numero positivo valido antes de abrir transacción', async () => {
      await expect(useStore.getState().deleteSesionRPE(0)).rejects.toThrow('No se puede eliminar RPE de sesión sin un ID válido')
      await expect(useStore.getState().deleteSesionRPE(-5)).rejects.toThrow('No se puede eliminar RPE de sesión sin un ID válido')
      await expect(useStore.getState().deleteSesionRPE('abc' as any)).rejects.toThrow('No se puede eliminar RPE de sesión sin un ID válido')
      expect(db.transaction).not.toHaveBeenCalled()
    })
  })
})
