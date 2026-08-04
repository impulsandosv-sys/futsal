import { describe, it, expect } from 'vitest'
import {
  calcularIMC,
  calcularScoreWellness,
  calcularCargaUA,
  calcularTendenciaACWR,
  calcularTendenciaWellness,
  getPercentilEquipo,
  calcularCargaACWR,
  calcularMonotonyStrain,
  calcularACWREWMA,
  calcularCargaObjetivoIndividual,
  calcularCargaObjetivoTotalEquipo,
  calcularCargaMediaRealizada
} from './loadCalculations'

describe('calcularIMC', () => {
  it('calculates IMC correctly for normal case', () => {
    const result = calcularIMC(65, 172)
    expect(result).toBeCloseTo(22.0, 1)
  })

  it('returns 0 for invalid height', () => {
    const result = calcularIMC(65, 0)
    expect(result).toBe(0)
  })
})

describe('calcularScoreWellness', () => {
  it('calculates with scale inversion for negative variables', () => {
    // Sueño (8), Ánimo (7)
    // Fatiga (6 -> inverted: 5)
    // Dolor muscular (4 -> inverted: 7)
    // Estrés (5 -> inverted: 6)
    // Sum = 8 + 5 + 7 + 6 + 7 = 33 -> Average = 6.6
    const result = calcularScoreWellness({ calidad_sueno: 8, fatiga: 6, dolor_muscular: 4, estres: 5, estado_animo: 7 })
    expect(result).toBe(6.6)
  })

  it('handles best possible values (10 for positive, 1 for negative) to get 10.0', () => {
    const result = calcularScoreWellness({ calidad_sueno: 10, fatiga: 1, dolor_muscular: 1, estres: 1, estado_animo: 10 })
    expect(result).toBe(10.0)
  })

  it('handles missing values (null/undefined/NaN) by ignoring them in the average', () => {
    // Sueño: 8, Fatiga: 6 (inverted: 5), Dolor Muscular: null, Estrés: undefined, Ánimo: 7
    // Sum = 8 + 5 + 7 = 20 -> count = 3 -> Average = 6.7
    const result = calcularScoreWellness({ calidad_sueno: 8, fatiga: 6, dolor_muscular: null, estres: undefined, estado_animo: 7 })
    expect(result).toBe(6.7)
  })

  it('returns 0 if all values are missing', () => {
    const result = calcularScoreWellness({ calidad_sueno: null, fatiga: undefined })
    expect(result).toBe(0)
  })
})

describe('calcularCargaUA', () => {
  it('calculates carga UA', () => {
    const result = calcularCargaUA(5, 90)
    expect(result).toBe(450)
  })

  it('returns null if RPE or duration is missing', () => {
    expect(calcularCargaUA(null, 90)).toBeNull()
    expect(calcularCargaUA(5, null)).toBeNull()
    expect(calcularCargaUA(undefined, undefined)).toBeNull()
  })
})

describe('calcularTendenciaACWR', () => {
  it('retorna valor para array de un elemento', () => {
    expect(calcularTendenciaACWR([10])).toBe(10)
    expect(calcularTendenciaACWR([0])).toBe(0)
  })

  it('calcula tendencia ponderada', () => {
    const result = calcularTendenciaACWR([10, 20, 30])
    expect(result).toBeCloseTo(22.5, 1)
  })
})

describe('calcularTendenciaWellness', () => {
  it('retorna valor para array de un elemento', () => {
    expect(calcularTendenciaWellness([5])).toBe(5)
    expect(calcularTendenciaWellness([0])).toBe(0)
  })

  it('calcula tendencia ponderada', () => {
    const result = calcularTendenciaWellness([4, 6, 8])
    expect(result).toBeCloseTo(6.1, 1)
  })
})

describe('getPercentilEquipo', () => {
  it('retorna ceros para array vacío o no válido', () => {
    expect(getPercentilEquipo([])).toEqual({ p25: 0, p50: 0, p75: 0 })
  })

  it('calculates percentiles correctly for 10 elements', () => {
    const result = getPercentilEquipo([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(result).toEqual({ p25: 3, p50: 6, p75: 8 })
  })
})

describe('calcularCargaACWR', () => {
  it('retorna 0 para array vacío', () => {
    expect(calcularCargaACWR([])).toBe(0)
  })

  it('calculates average carga con smooth', () => {
    const result = calcularCargaACWR([10, 20, 30, 40, 50])
    expect(result).toBeCloseTo(23.3, 1)
  })
})

describe('calcularMonotonyStrain', () => {
  it('retorna ceros para array vacío', () => {
    const result = calcularMonotonyStrain([])
    expect(result).toEqual({ monotonia: 0, strain: 0, carga_semanal_media: 0, carga_semanal_std: 0 })
  })

  it('calculates monotonía y strain correctamente', () => {
    const cargas = [10, 10, 10, 10, 10]
    const result = calcularMonotonyStrain(cargas)
    expect(result.monotonia).toBe(0)
    expect(result.strain).toBe(0)
    expect(result.carga_semanal_media).toBe(10)
    expect(result.carga_semanal_std).toBe(0)
  })

  it('calculates varianza y std correctamente', () => {
    const cargas = [5, 10, 15, 20, 25]
    const result = calcularMonotonyStrain(cargas)
    expect(result.monotonia).toBeCloseTo(2.12, 2)
    expect(result.strain).toBeCloseTo(159, 1)
    expect(result.carga_semanal_media).toBe(15)
    expect(result.carga_semanal_std).toBeCloseTo(7.1, 1)
  })
})

describe('calcularACWREWMA', () => {
  it('retorna 0 para array vacío', () => {
    expect(calcularACWREWMA([])).toBe(0)
  })

  it('calculates EWMA ACWR', () => {
    const cargas = [100, 110, 120, 130, 140]
    const result = calcularACWREWMA(cargas)
    expect(result).toBeCloseTo(1.32, 2)
  })

  it('works with lambda personalizado', () => {
    const cargas = [50, 60, 70, 80]
    const result = calcularACWREWMA(cargas, 0.5)
    expect(result).toBeCloseTo(1.12, 2)
  })
})

describe('Comparación válida de carga planificada y realizada (Fase 4)', () => {
  it('calcularCargaObjetivoIndividual devuelve el producto correcto', () => {
    expect(calcularCargaObjetivoIndividual(90, 5)).toBe(450)
    expect(calcularCargaObjetivoIndividual(undefined, 5)).toBeNull()
    expect(calcularCargaObjetivoIndividual(90, undefined)).toBeNull()
  })

  it('calcularCargaObjetivoTotalEquipo solo calcula si hay participantes previstos explícitos', () => {
    expect(calcularCargaObjetivoTotalEquipo(90, 5, 10)).toBe(4500) // 90 * 5 * 10
    expect(calcularCargaObjetivoTotalEquipo(90, 5, undefined)).toBeNull()
    expect(calcularCargaObjetivoTotalEquipo(90, 5, null as any)).toBeNull()
  })

  it('calcularCargaMediaRealizada calcula la media ignorando nulos, pero no permite comparación inválida entre objetivo individual y suma total', () => {
    // La suma total de equipo no debe usarse para comparar con el objetivo individual.
    // Media de 3 jugadoras: (450 + 500 + 400) / 3 = 1350 / 3 = 450
    const rpes = [
      { carga_ua: 450 },
      { carga_ua: 500 },
      { carga_ua: 400 },
      { carga_ua: null }, // Ausente o sin registrar
      { } // Sin carga
    ]
    expect(calcularCargaMediaRealizada(rpes)).toBe(450)
  })
})
