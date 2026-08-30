import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/database'
import { useStore } from '@/store/store'
import { calcularDeficitCompensacion, inferirEstadoCompensacion } from './compensacion'

describe('Compensacion Postpartido Domain', () => {
  describe('Cálculos', () => {
    it('debe devolver null si no hay objetivo definido', () => {
      expect(calcularDeficitCompensacion(20, null)).toBeNull()
      expect(calcularDeficitCompensacion(20, undefined)).toBeNull()
    })

    it('debería calcular déficit correctamente con minutos 0 explícitos', () => {
    expect(calcularDeficitCompensacion(0, 20)).toBe(20)
  })

  it('debería devolver null si los minutos están pendientes (null o undefined)', () => {
    expect(calcularDeficitCompensacion(null, 20)).toBeNull()
    expect(calcularDeficitCompensacion(undefined, 20)).toBeNull()
  })

  it('debería devolver 0 si los minutos jugados superan o igualan el objetivo (nunca negativo)', () => {
    expect(calcularDeficitCompensacion(25, 20)).toBe(0)
    expect(calcularDeficitCompensacion(20, 20)).toBe(0)
  })

  it('debería devolver null si no hay objetivo definido, independientemente de los minutos', () => {
    expect(calcularDeficitCompensacion(15, null)).toBeNull()
    expect(calcularDeficitCompensacion(15, undefined)).toBeNull()
    expect(calcularDeficitCompensacion(null, null)).toBeNull()
  })  })

  describe('Inferencia de Estado', () => {
    it('debe mantener el estado terminal definido', () => {
      expect(inferirEstadoCompensacion(10, 'realizada')).toBe('realizada')
      expect(inferirEstadoCompensacion(0, 'omitida')).toBe('omitida')
      expect(inferirEstadoCompensacion(5, 'planificada')).toBe('planificada')
    })

    it('debe devolver omitida si el déficit es 0 y el estado actual es pendiente', () => {
      expect(inferirEstadoCompensacion(0, 'pendiente')).toBe('omitida')
    })

    it('debe devolver pendiente si no hay déficit y el estado es pendiente', () => {
      expect(inferirEstadoCompensacion(null, 'pendiente')).toBe('pendiente')
    })
  })

  describe('Upsert en Store (No duplicados)', () => {
    beforeEach(async () => {
      // Si la base de datos de test no ha inicializado la tabla v17, usamos fallback local
      if (db.compensacion_postpartido) {
        await db.compensacion_postpartido.clear()
      }
      const state = useStore.getState()
      state.compensacion_postpartido = []
    })

    it('debe crear un nuevo registro si no existe, y actualizarlo sin duplicar si ya existe', async () => {
      const store = useStore.getState()
      const mockDB: any[] = []

      db.compensacion_postpartido.put = vi.fn(async (item) => {
        const index = mockDB.findIndex(x => x.id_partido === item.id_partido && x.id_jugadora === item.id_jugadora)
        if (index >= 0) mockDB[index] = item
        else mockDB.push(item)
      })

      db.compensacion_postpartido.toArray = vi.fn(async () => mockDB)

      db.compensacion_postpartido.where = vi.fn(() => ({
        first: vi.fn(async () => null) // simplification for first insert
      }))

      const comp1 = {
        id_partido: 'p1',
        id_jugadora: 'j1',
        minutos_objetivo: 20,
        deficit_minutos: 20,
        estado: 'pendiente' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      await store.upsertCompensacionPostPartido(comp1)

      let all = useStore.getState().compensacion_postpartido
      expect(all.length).toBe(1)
      expect(all[0].minutos_objetivo).toBe(20)

      const comp2 = {
        id_partido: 'p1',
        id_jugadora: 'j1',
        minutos_objetivo: 30,
        deficit_minutos: 30,
        estado: 'planificada' as const,
        created_at: comp1.created_at,
        updated_at: new Date().toISOString()
      }

      db.compensacion_postpartido.where = vi.fn(() => ({
        first: vi.fn(async () => mockDB[0]) // mock finding the existing
      }))

      await store.upsertCompensacionPostPartido(comp2)

      all = useStore.getState().compensacion_postpartido
      expect(all.length).toBe(1)
      expect(all[0].minutos_objetivo).toBe(30)
      expect(all[0].estado).toBe('planificada')
    })
  })
})
