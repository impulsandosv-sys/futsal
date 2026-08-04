import { describe, it, expect } from 'vitest'
import {
  seleccionarReadinessDeterminista,
  obtenerListaReadinessDeterminista
} from './monitoring'
import type { Readiness } from '@/types'

describe('readinessSelector - Selección determinística de readiness', () => {
  const mockBaseReadiness = (overrides: Partial<Readiness>): Readiness => ({
    id: 1,
    id_jugadora: 'J01',
    fecha: '2026-07-28',
    score: 80,
    nivel: 'verde',
    diasDesdeWellness: 0,
    creada: '2026-07-28T10:00:00.000Z',
    factores: {
      wellness: 80,
      acwr: 1.0,
      cargaAguda: 400,
      cargaCronica: 400,
      penalizacionWellnessAusente: 0
    },
    ...overrides
  })

  it('1. Entre dos readiness para misma jugadora y fecha, elige el de creada más reciente', () => {
    const r1 = mockBaseReadiness({ id: 10, creada: '2026-07-28T09:00:00.000Z', score: 60 })
    const r2 = mockBaseReadiness({ id: 5, creada: '2026-07-28T12:00:00.000Z', score: 90 })

    const res = seleccionarReadinessDeterminista([r1, r2], 'J01', '2026-07-28')
    expect(res).toBeDefined()
    expect(res?.id).toBe(5)
    expect(res?.score).toBe(90)
  })

  it('2. Si creada es igual, ausente o inválida, se elige el mayor id', () => {
    const r1 = mockBaseReadiness({ id: 10, creada: 'sin_fecha', score: 70 })
    const r2 = mockBaseReadiness({ id: 25, creada: 'sin_fecha', score: 85 })

    const res = seleccionarReadinessDeterminista([r1, r2], 'J01', '2026-07-28')
    expect(res?.id).toBe(25)
    expect(res?.score).toBe(85)
  })

  it('3. Dos jugadoras distintas no se mezclan', () => {
    const rJ1 = mockBaseReadiness({ id: 1, id_jugadora: 'J01', fecha: '2026-07-28' })
    const rJ2 = mockBaseReadiness({ id: 2, id_jugadora: 'J02', fecha: '2026-07-28' })

    const resJ1 = seleccionarReadinessDeterminista([rJ1, rJ2], 'J01', '2026-07-28')
    const resJ2 = seleccionarReadinessDeterminista([rJ1, rJ2], 'J02', '2026-07-28')

    expect(resJ1?.id_jugadora).toBe('J01')
    expect(resJ2?.id_jugadora).toBe('J02')
  })

  it('4. Dos fechas distintas no se mezclan', () => {
    const rF1 = mockBaseReadiness({ id: 1, fecha: '2026-07-27' })
    const rF2 = mockBaseReadiness({ id: 2, fecha: '2026-07-28' })

    const resF1 = seleccionarReadinessDeterminista([rF1, rF2], 'J01', '2026-07-27')
    const resF2 = seleccionarReadinessDeterminista([rF1, rF2], 'J01', '2026-07-28')

    expect(resF1?.fecha).toBe('2026-07-27')
    expect(resF2?.fecha).toBe('2026-07-28')
  })

  it('5. obtenerListaReadinessDeterminista deduplica correctamente listas con múltiples fechas y jugadoras', () => {
    const list: Readiness[] = [
      mockBaseReadiness({ id: 1, id_jugadora: 'J01', fecha: '2026-07-28', creada: '2026-07-28T08:00:00.000Z' }),
      mockBaseReadiness({ id: 2, id_jugadora: 'J01', fecha: '2026-07-28', creada: '2026-07-28T14:00:00.000Z' }),
      mockBaseReadiness({ id: 3, id_jugadora: 'J01', fecha: '2026-07-27' }),
      mockBaseReadiness({ id: 4, id_jugadora: 'J02', fecha: '2026-07-28' })
    ]

    const dedup = obtenerListaReadinessDeterminista(list)
    expect(dedup.length).toBe(3)
    const j01_28 = dedup.find(r => r.id_jugadora === 'J01' && r.fecha === '2026-07-28')
    expect(j01_28?.id).toBe(2)
  })
})
