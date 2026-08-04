// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { recalcularReadinessJugadora } from './readiness'

let readinessStore: any[] = []
let jugadorasStore: any[] = []
let wellnessStore: any[] = []
let sesionRpeStore: any[] = []

vi.mock('@/db/database', () => ({
  db: {
    readiness: {
      where: vi.fn((q: any) => {
        const filtered = readinessStore.filter(r =>
          (!q.id_jugadora || r.id_jugadora === q.id_jugadora) &&
          (!q.fecha || r.fecha === q.fecha)
        )
        return {
          first: vi.fn(() => Promise.resolve(filtered[0] || null)),
          toArray: vi.fn(() => Promise.resolve(filtered)),
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
      toArray: vi.fn(() => Promise.resolve([...readinessStore])),
      clear: vi.fn(() => { readinessStore = []; return Promise.resolve() }),
    },
    jugadoras: {
      get: vi.fn((id: string) => Promise.resolve(jugadorasStore.find(j => j.id_jugadora === id))),
      toArray: vi.fn(() => Promise.resolve([...jugadorasStore])),
      put: vi.fn((j: any) => { jugadorasStore.push(j); return Promise.resolve(j.id_jugadora) }),
      bulkPut: vi.fn((arr: any[]) => { jugadorasStore.push(...arr); return Promise.resolve() }),
      clear: vi.fn(() => { jugadorasStore = []; return Promise.resolve() }),
    },
    wellness: {
      where: vi.fn((q: any) => {
        const filtered = wellnessStore.filter(w => !q.id_jugadora || w.id_jugadora === q.id_jugadora)
        return { toArray: vi.fn(() => Promise.resolve(filtered)) }
      }),
      put: vi.fn((w: any) => { wellnessStore.push(w); return Promise.resolve() }),
      clear: vi.fn(() => { wellnessStore = []; return Promise.resolve() }),
    },
    sesion_rpe: {
      where: vi.fn((q: any) => {
        const filtered = sesionRpeStore.filter(s => !q.id_jugadora || s.id_jugadora === q.id_jugadora)
        return { toArray: vi.fn(() => Promise.resolve(filtered)) }
      }),
      clear: vi.fn(() => { sesionRpeStore = []; return Promise.resolve() }),
    },
    rpe_partido: {
      where: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([]))
      })),
      toArray: vi.fn(() => Promise.resolve([])),
      clear: vi.fn(() => Promise.resolve()),
    },
    sesiones: {
      toArray: vi.fn(() => Promise.resolve([])),
      clear: vi.fn(() => Promise.resolve()),
    }
  }
}))

describe('readinessIdempotency', () => {
  beforeEach(async () => {
    readinessStore = []
    jugadorasStore = []
    wellnessStore = []
    sesionRpeStore = []

    jugadorasStore.push(
      {
        id_jugadora: 'J01',
        nombre: 'Jugadora 1',
        fecha_nacimiento: '2000-01-01',
        posicion: 'Ala',
        altura_cm: 165,
        peso_kg: 60,
        imc: 22,
        grasa: 15,
        anos_experiencia_futsal: 5,
        historial_lesional: '',
        notas: '',
        activa: true,
      },
      {
        id_jugadora: 'J02',
        nombre: 'Jugadora 2',
        fecha_nacimiento: '2001-02-02',
        posicion: 'Cierre',
        altura_cm: 170,
        peso_kg: 65,
        imc: 22.5,
        grasa: 16,
        anos_experiencia_futsal: 6,
        historial_lesional: '',
        notas: '',
        activa: true,
      }
    )
  })

  it('1. Primer recálculo crea una única fila en db.readiness', async () => {
    await recalcularReadinessJugadora('J01', '2026-07-28')
    const records = readinessStore.filter(r => r.id_jugadora === 'J01' && r.fecha === '2026-07-28')
    expect(records.length).toBe(1)
    expect(records[0].id_jugadora).toBe('J01')
    expect(records[0].fecha).toBe('2026-07-28')
  })

  it('2. Cuatro recálculos consecutivos para misma jugadora y fecha conservan una sola fila', async () => {
    await recalcularReadinessJugadora('J01', '2026-07-28')
    await recalcularReadinessJugadora('J01', '2026-07-28')
    await recalcularReadinessJugadora('J01', '2026-07-28')
    await recalcularReadinessJugadora('J01', '2026-07-28')

    expect(readinessStore.length).toBe(1)
    expect(readinessStore[0].id_jugadora).toBe('J01')
  })

  it('3. El registro final refleja el último cálculo válido', async () => {
    // Inicial sin wellness -> score menor por penalización de wellness ausente
    await recalcularReadinessJugadora('J01', '2026-07-28')
    const inicial = { ...readinessStore[0] }
    expect(inicial.score).toBeLessThan(100)

    // Insertar wellness perfecto 10/10
    wellnessStore.push({
      id_jugadora: 'J01',
      fecha: '2026-07-28',
      calidad_sueno: 10,
      fatiga: 1, // Invertido -> 10
      dolor_muscular: 1, // Invertido -> 10
      estres: 1, // Invertido -> 10
      estado_animo: 10,
      dolor_especifico: '',
      score_wellness: 10,
    })

    // Recalcular de nuevo sobre la misma fecha
    await recalcularReadinessJugadora('J01', '2026-07-28')
    const finalRec = readinessStore.find(r => r.id_jugadora === 'J01' && r.fecha === '2026-07-28')

    expect(readinessStore.length).toBe(1)
    expect(finalRec?.id).toBe(inicial.id)
    expect(finalRec?.score).toBeGreaterThan(inicial.score)
  })

  it('4. Dos fechas distintas para la misma jugadora crean dos filas distintas', async () => {
    await recalcularReadinessJugadora('J01', '2026-07-27')
    await recalcularReadinessJugadora('J01', '2026-07-28')

    expect(readinessStore.length).toBe(2)
  })

  it('5. Dos jugadoras distintas en la misma fecha crean dos filas distintas', async () => {
    await recalcularReadinessJugadora('J01', '2026-07-28')
    await recalcularReadinessJugadora('J02', '2026-07-28')

    expect(readinessStore.length).toBe(2)
  })
})
