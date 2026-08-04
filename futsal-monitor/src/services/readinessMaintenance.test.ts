// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  diagnosticarDuplicadosReadiness,
  repararDuplicadosReadiness
} from './readinessMaintenance'

let readinessStore: any[] = []
let jugadorasStore: any[] = []
let wellnessStore: any[] = []
let sesionRpeStore: any[] = []

vi.mock('@/db/database', () => ({
  db: {
    readiness: {
      toArray: vi.fn(() => Promise.resolve([...readinessStore])),
      where: vi.fn((q: any) => {
        const filtered = readinessStore.filter(r =>
          (!q.id_jugadora || r.id_jugadora === q.id_jugadora) &&
          (!q.fecha || r.fecha === q.fecha)
        )
        return {
          toArray: vi.fn(() => Promise.resolve(filtered)),
          first: vi.fn(() => Promise.resolve(filtered[0] || null)),
        }
      }),
      put: vi.fn((item: any) => {
        if (item.id) {
          const idx = readinessStore.findIndex(r => r.id === item.id)
          if (idx !== -1) {
            readinessStore[idx] = { ...item }
            return Promise.resolve(item.id)
          }
        }
        const newId = readinessStore.length + 1
        const newItem = { ...item, id: newId }
        readinessStore.push(newItem)
        return Promise.resolve(newId)
      }),
      delete: vi.fn((id: number) => {
        const idx = readinessStore.findIndex(r => r.id === id)
        if (idx !== -1) readinessStore.splice(idx, 1)
        return Promise.resolve()
      })
    },
    jugadoras: {
      toArray: vi.fn(() => Promise.resolve([...jugadorasStore]))
    },
    wellness: {
      where: vi.fn((q: any) => ({
        toArray: vi.fn(() => Promise.resolve(wellnessStore.filter(w => !q.id_jugadora || w.id_jugadora === q.id_jugadora)))
      }))
    },
    sesion_rpe: {
      where: vi.fn((q: any) => ({
        toArray: vi.fn(() => Promise.resolve(sesionRpeStore.filter(s => !q.id_jugadora || s.id_jugadora === q.id_jugadora)))
      }))
    },
    rpe_partido: {
      where: vi.fn((q: any) => ({
        toArray: vi.fn(() => Promise.resolve([]))
      }))
    },
    sesiones: {
      toArray: vi.fn(() => Promise.resolve([]))
    },
    transaction: vi.fn((mode: string, tables: any[], cb: () => Promise<any>) => cb())
  }
}))

vi.mock('@/store/store', () => ({
  useStore: {
    getState: () => ({
      loadAll: vi.fn(() => Promise.resolve())
    })
  }
}))

describe('readinessMaintenance - Diagnóstico y Reparación de Readiness', () => {
  beforeEach(() => {
    readinessStore = []
    jugadorasStore = []
    wellnessStore = []
    sesionRpeStore = []
  })

  describe('Diagnóstico (solo lectura)', () => {
    it('1. Sin duplicados devuelve lista vacía', async () => {
      readinessStore = [
        { id: 1, id_jugadora: 'J01', fecha: '2026-07-28', creada: '2026-07-28T10:00:00.000Z' },
        { id: 2, id_jugadora: 'J02', fecha: '2026-07-28', creada: '2026-07-28T10:00:00.000Z' }
      ]

      const diag = await diagnosticarDuplicadosReadiness()
      expect(diag.totalGruposDuplicados).toBe(0)
      expect(diag.totalFilasDuplicadas).toBe(0)
      expect(diag.detalles.length).toBe(0)
    })

    it('2. Un grupo duplicado es detectado con sus IDs y fechas de creación', async () => {
      readinessStore = [
        { id: 1, id_jugadora: 'J01', fecha: '2026-07-28', creada: '2026-07-28T09:00:00.000Z' },
        { id: 2, id_jugadora: 'J01', fecha: '2026-07-28', creada: '2026-07-28T12:00:00.000Z' }
      ]

      const diag = await diagnosticarDuplicadosReadiness()
      expect(diag.totalGruposDuplicados).toBe(1)
      expect(diag.totalFilasDuplicadas).toBe(1)
      expect(diag.detalles[0].id_jugadora).toBe('J01')
      expect(diag.detalles[0].fecha).toBe('2026-07-28')
      expect(diag.detalles[0].cantidad).toBe(2)
      expect(diag.detalles[0].ids).toEqual([1, 2])
      expect(diag.detalles[0].id_seleccionado_actual).toBe(2) // Creada más reciente
    })

    it('3. Separa correctamente múltiples grupos duplicados', async () => {
      readinessStore = [
        { id: 1, id_jugadora: 'J01', fecha: '2026-07-28' },
        { id: 2, id_jugadora: 'J01', fecha: '2026-07-28' },
        { id: 3, id_jugadora: 'J02', fecha: '2026-07-27' },
        { id: 4, id_jugadora: 'J02', fecha: '2026-07-27' },
        { id: 5, id_jugadora: 'J02', fecha: '2026-07-27' }
      ]

      const diag = await diagnosticarDuplicadosReadiness()
      expect(diag.totalGruposDuplicados).toBe(2)
      expect(diag.totalFilasDuplicadas).toBe(3)
    })
  })

  describe('Reparación explícita', () => {
    it('4. Exige confirmación explícita (lanza error si confirmado no es true)', async () => {
      await expect(repararDuplicadosReadiness(false)).rejects.toThrow(
        'La reparación de readiness requiere confirmación explícita del usuario.'
      )
    })

    it('5. Repara un grupo duplicado dejando una única fila conservada', async () => {
      readinessStore = [
        { id: 1, id_jugadora: 'J01', fecha: '2026-07-28', creada: '2026-07-28T09:00:00.000Z', score: 50 },
        { id: 2, id_jugadora: 'J01', fecha: '2026-07-28', creada: '2026-07-28T14:00:00.000Z', score: 85 }
      ]

      const res = await repararDuplicadosReadiness(true)

      expect(res.gruposDetectados).toBe(1)
      expect(res.gruposReparados).toBe(1)
      expect(res.filasEliminadas).toBe(1)

      const filasJ01 = readinessStore.filter(r => r.id_jugadora === 'J01' && r.fecha === '2026-07-28')
      expect(filasJ01.length).toBe(1)
    })

    it('6. No altera la readiness de otras jugadoras o fechas no duplicadas', async () => {
      readinessStore = [
        { id: 10, id_jugadora: 'J01', fecha: '2026-07-28', creada: '2026-07-28T09:00:00.000Z' },
        { id: 11, id_jugadora: 'J01', fecha: '2026-07-28', creada: '2026-07-28T12:00:00.000Z' },
        { id: 99, id_jugadora: 'J02', fecha: '2026-07-28', creada: '2026-07-28T08:00:00.000Z', score: 77 }
      ]

      await repararDuplicadosReadiness(true)

      const filaJ02 = readinessStore.find(r => r.id_jugadora === 'J02')
      expect(filaJ02).toBeDefined()
      expect(filaJ02?.id).toBe(99)
      expect(filaJ02?.score).toBe(77)
    })
  })
})
