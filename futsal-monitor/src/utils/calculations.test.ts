import { describe, it, expect } from 'vitest'
import {
  calcularIMC,
  calcularScoreWellness,
  calcularCargaUA,
  getWellnessLevel,
  getLoadStatus,
  calcularTendenciaACWR,
  calcularTendenciaWellness,
  getPercentilEquipo,
  calcularCargaACWR,
  calcularMonotonyStrain,
  calcularACWREWMA,
  calcularReadinessDiaria,
  calcularPrioridadRevision,
} from './calculations'

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
  it('calculates average of 5 values (8,6,4,5,7) with inversion', () => {
    const result = calcularScoreWellness({ calidad_sueno: 8, fatiga: 6, dolor_muscular: 4, estres: 5, estado_animo: 7 })
    expect(result).toBe(6.6)
  })

  it('calculates with decimal result with inversion', () => {
    const result = calcularScoreWellness({ calidad_sueno: 10, fatiga: 10, dolor_muscular: 10, estres: 10, estado_animo: 10 })
    expect(result).toBe(4.6)
  })
})

describe('calcularCargaUA', () => {
  it('calculates carga UA', () => {
    const result = calcularCargaUA(5, 90)
    expect(result).toBe(450)
  })
})

describe('getWellnessLevel', () => {
  it('retorna sin_datos para score <= 0', () => {
    expect(getWellnessLevel(0)).toBe('sin_datos')
    expect(getWellnessLevel(-1)).toBe('sin_datos')
  })

  it('retorna critico para score < 4', () => {
    expect(getWellnessLevel(3.9)).toBe('critico')
    expect(getWellnessLevel(3)).toBe('critico')
  })

  it('retorna bajo para score 5', () => {
    expect(getWellnessLevel(5)).toBe('bajo')
  })

  it('retorna normal para score 7', () => {
    expect(getWellnessLevel(7)).toBe('normal')
  })

  it('retorna bueno para score >= 8', () => {
    expect(getWellnessLevel(8)).toBe('bueno')
    expect(getWellnessLevel(9.5)).toBe('bueno')
  })
})

describe('getLoadStatus', () => {
  it('retorna Revisión prioritaria para acwr >= 1.5', () => {
    expect(getLoadStatus(1.5)).toMatchObject({ label: 'Revisión prioritaria' })
    expect(getLoadStatus(2.0)).toMatchObject({ label: 'Revisión prioritaria' })
  })

  it('retorna Elevado para 1.3 <= acwr < 1.5', () => {
    expect(getLoadStatus(1.3)).toMatchObject({ label: 'Elevado' })
    expect(getLoadStatus(1.4)).toMatchObject({ label: 'Elevado' })
  })

  it('retorna Muy bajo para acwr <= 0.5', () => {
    expect(getLoadStatus(0.5)).toMatchObject({ label: 'Muy bajo' })
    expect(getLoadStatus(0.1)).toMatchObject({ label: 'Muy bajo' })
  })

  it('retorna Bajo para 0.5 < acwr <= 0.8', () => {
    expect(getLoadStatus(0.6)).toMatchObject({ label: 'Bajo' })
    expect(getLoadStatus(0.8)).toMatchObject({ label: 'Bajo' })
  })

  it('retorna Óptimo para resto', () => {
    expect(getLoadStatus(1.0)).toMatchObject({ label: 'Óptimo' })
    expect(getLoadStatus(1.2)).toMatchObject({ label: 'Óptimo' })
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
    expect(getPercentilEquipo(null as any)).toEqual({ p25: 0, p50: 0, p75: 0 })
  })

  it('devuelve el mismo valor para array de 1 elemento', () => {
    expect(getPercentilEquipo([10])).toEqual({ p25: 10, p50: 10, p75: 10 })
  })

  it('calcula percentiles correctamente para array de 2 elementos', () => {
    expect(getPercentilEquipo([10, 20])).toEqual({ p25: 10, p50: 20, p75: 20 })
  })

  it('calcula percentiles correctamente para 5 elementos', () => {
    expect(getPercentilEquipo([10, 20, 30, 40, 50])).toEqual({ p25: 20, p50: 30, p75: 40 })
  })

  it('ordena correctamente arrays no ordenados', () => {
    expect(getPercentilEquipo([50, 10, 30, 20, 40])).toEqual({ p25: 20, p50: 30, p75: 40 })
  })

  it('filtra valores no numéricos y repetidos sin lanzar errores', () => {
    expect(getPercentilEquipo([10, NaN, Infinity, 20, 10])).toEqual({ p25: 10, p50: 10, p75: 20 })
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

describe('calcularReadinessDiaria', () => {
  const input = {
    id_jugadora: 'test-jugadora',
    fecha: '2025-01-15',
    wellness: null,
    acwr: 1.4,
    cargaAguda: 120,
    cargaCronica: 100,
    diasDesdeWellness: 2
  }

  it('retorna score bajo sin wellness', () => {
    const result = calcularReadinessDiaria(input)
    expect(result.score).toBeLessThan(75)
    expect(['ambar', 'rojo']).toContain(result.nivel)
  })

  it('calculates green level correctly', () => {
    const greenInput = {
      ...input,
      acwr: 1.2,
      diasDesdeWellness: 0,
      wellness: {
        id_jugadora: 'test-jugadora',
        fecha: '2025-01-15',
        calidad_sueno: 10,
        fatiga: 10,
        dolor_muscular: 10,
        estres: 10,
        estado_animo: 10,
        dolor_especifico: '',
        score_wellness: 10
      }
    }
    const result = calcularReadinessDiaria(greenInput)
    expect(result.nivel).toBe('verde')
  })

  it('calculates red level correctly', () => {
    const redInput = {
      ...input,
      acwr: 2.0,
      diasDesdeWellness: 5
    }
    const redResult = calcularReadinessDiaria(redInput)
    expect(redResult.nivel).toBe('rojo')
  })

  it('calculates ambar level when score between 50-75', () => {
    const ambarInput = {
      ...input,
      acwr: 1.4,
      diasDesdeWellness: 0,
      wellness: {
        id_jugadora: 'test-jugadora',
        fecha: '2025-01-15',
        calidad_sueno: 8,
        fatiga: 8,
        dolor_muscular: 8,
        estres: 8,
        estado_animo: 8,
        dolor_especifico: '',
        score_wellness: 8
      }
    }
    const ambarResult = calcularReadinessDiaria(ambarInput)
    expect(ambarResult.nivel).toBe('ambar')
    expect(ambarResult.score).toBeGreaterThanOrEqual(50)
    expect(ambarResult.score).toBeLessThanOrEqual(75)
  })

  it('calculates score within 0-100 range', () => {
    const extremeInput1 = {
      ...input,
      acwr: 0,
      diasDesdeWellness: 10,
      wellness: null
    }
    const result1 = calcularReadinessDiaria(extremeInput1)
    expect(result1.score).toBeGreaterThanOrEqual(0)
    expect(result1.score).toBeLessThanOrEqual(100)

    const extremeInput2 = {
      ...input,
      acwr: 100,
      diasDesdeWellness: 0,
      wellness: null
    }
    const result2 = calcularReadinessDiaria(extremeInput2)
    expect(result2.score).toBeGreaterThanOrEqual(0)
    expect(result2.score).toBeLessThanOrEqual(100)
  })

  it('wellness contribution is calculated correctly', () => {
    const wellnessInput = {
      ...input,
      wellness: {
        id_jugadora: 'test-jugadora',
        fecha: '2025-01-15',
        calidad_sueno: 10,
        fatiga: 10,
        dolor_muscular: 10,
        estres: 10,
        estado_animo: 10,
        dolor_especifico: '',
        score_wellness: 10
      }
    }
    const result = calcularReadinessDiaria(wellnessInput)
    expect(result.factores.wellness).toBe(100)
  })

  it('acwr over 1.5 causes penalty', () => {
    const highACWRInput = {
      ...input,
      acwr: 1.6
    }
    const result = calcularReadinessDiaria(highACWRInput)
    expect(result.score).toBe(20) // 100 - 40 - 30 - 10 = 20
  })

  it('acwr under 0.8 causes penalty', () => {
    const lowACWRInput = {
      ...input,
      acwr: 0.7
    }
    const result = calcularReadinessDiaria(lowACWRInput)
    expect(result.score).toBe(35) // 100 - 40 - 15 - 10 = 35
  })

  it('no wellness gives max penalty', () => {
    const result = calcularReadinessDiaria(input)
    expect(result.score).toBeLessThan(100)
  })

  it('days since wellness penalty', () => {
    const recentInput = {
      ...input,
      diasDesdeWellness: 0
    }
    const recentResult = calcularReadinessDiaria(recentInput)

    const oldInput = {
      ...input,
      diasDesdeWellness: 4
    }
    const oldResult = calcularReadinessDiaria(oldInput)

    expect(oldResult.score).toBeLessThan(recentResult.score)
  })

  it('complex scenario calculation', () => {
    const complexInput = {
      id_jugadora: 'test-jugadora',
      fecha: '2025-01-15',
      wellness: {
        id_jugadora: 'test-jugadora',
        fecha: '2025-01-15',
        calidad_sueno: 8,
        fatiga: 7,
        dolor_muscular: 6,
        estres: 5,
        estado_animo: 9,
        dolor_especifico: '',
        score_wellness: 7
      },
      acwr: 1.2,
      cargaAguda: 100,
      cargaCronica: 90,
      diasDesdeWellness: 1
    }
    const result = calcularReadinessDiaria(complexInput)
    expect(result.score).toBeGreaterThan(75)
    expect(result.nivel).toBe('verde')
    expect(result.factores.wellness).toBe(70)
    expect(result.factores.acwr).toBe(1.2)
    expect(result.factores.carga_aguda).toBe(100)
    expect(result.factores.carga_cronica).toBe(90)
    expect(result.factores.dias_desde_ultimo_wellness).toBe(1)
  })

  it('string type from input is preserved', () => {
    const stringTypeInput = {
      ...input,
      id_jugadora: '01234567-89ab-cdef-0123-456789abcd',
      fecha: '2025-01-15'
    }
    const result = calcularReadinessDiaria(stringTypeInput)
    expect(typeof result.id_jugadora).toBe('string')
    expect(result.id_jugadora).toBe('01234567-89ab-cdef-0123-456789abcd')
    expect(typeof result.fecha).toBe('string')
    expect(result.fecha).toBe('2025-01-15')
  })

  it('calculates with wellness', () => {
    const wellness = {
      id_jugadora: 'test-jugadora',
      fecha: '2025-01-15',
      calidad_sueno: 8,
      fatiga: 6,
      dolor_muscular: 4,
      estres: 5,
      estado_animo: 7,
      dolor_especifico: '',
      score_wellness: 6.0
    }
    const inputWithWellness = {
      ...input,
      wellness
    }
    const result = calcularReadinessDiaria(inputWithWellness)
    expect(result.score).toBe(54) 
    expect(result.factores.wellness).toBe(60)
    expect(result.factores.acwr).toBe(1.4)
  })
})

describe('calcularPrioridadRevision', () => {
  const mockJugadora: Jugadora = {
    id_jugadora: 'J001', nombre: 'Test', fecha_nacimiento: '2000-01-01', posicion: 'Ala',
    altura_cm: 170, peso_kg: 60, imc: 20, grasa: 20, anos_experiencia_futsal: 5, historial_lesional: '', notas: '', activa: true
  }

  it('debería retornar prioridad rutinario para datos normales', () => {
    const wellness: Wellness[] = [
      { id_jugadora: 'J001', fecha: '2026-07-13', calidad_sueno: 8, fatiga: 8, dolor_muscular: 8, estres: 8, estado_animo: 8, dolor_especifico: '', score_wellness: 8.0 }
    ]
    const result = calcularPrioridadRevision(mockJugadora, wellness, [], [], '2026-07-13')
    expect(result.prioridad).toBe('rutinario')
  })

  it('debería elevar a semana si faltan datos de wellness', () => {
    const wellness: Wellness[] = [
      { id_jugadora: 'J001', fecha: '2025-01-01', calidad_sueno: 7, fatiga: 5, dolor_muscular: 5, estres: 5, estado_animo: 7, dolor_especifico: '', score_wellness: 7.0 }
    ]
    const result = calcularPrioridadRevision(mockJugadora, wellness, [], [], '2026-07-13')
    expect(result.prioridad).toBe('semana')
    expect(result.factores).toContain('Datos insuficientes para interpretar')
  })
})

