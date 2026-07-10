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
  it('calculates average of 5 values (8,6,4,5,7)', () => {
    const result = calcularScoreWellness({ calidad_sueno: 8, fatiga: 6, dolor_muscular: 4, estres: 5, estado_animo: 7 })
    expect(result).toBe(6.0)
  })

  it('calculates with decimal result', () => {
    const result = calcularScoreWellness({ calidad_sueno: 10, fatiga: 10, dolor_muscular: 10, estres: 10, estado_animo: 10 })
    expect(result).toBe(10.0)
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
  it('retorna Riesgo lesión para acwr >= 1.5', () => {
    expect(getLoadStatus(1.5)).toMatchObject({ label: 'Riesgo lesión' })
    expect(getLoadStatus(2.0)).toMatchObject({ label: 'Riesgo lesión' })
  })

  it('retorna Elevado para 1.3 <= acwr < 1.5', () => {
    expect(getLoadStatus(1.3)).toMatchObject({ label: 'Elevado' })
    expect(getLoadStatus(1.4)).toMatchObject({ label: 'Elevado' })
  })

  it('retorna Muy bajo para acwr <= 0.5', () => {
    expect(getLoadStatus(0.5)).toMatchObject({ label: 'Muy bajo' })
    expect(getLoadStatus(0.1)).toMatchObject({ label: 'Muy bajo' })
  })

  it('retorna Bajo para 0.8 <= acwr < 1.0', () => {
    expect(getLoadStatus(0.8)).toMatchObject({ label: 'Bajo' })
    expect(getLoadStatus(0.9)).toMatchObject({ label: 'Bajo' })
  })

  it('retorna Óptimo para resto', () => {
    expect(getLoadStatus(0.99)).toMatchObject({ label: 'Óptimo' })
    expect(getLoadStatus(1.0)).toMatchObject({ label: 'Óptimo' })
  })
})

describe('calcularTendenciaACWR', () => {
  it('retorna valor para array de un elemento', () => {
    expect(calcularTendenciaACWR([10])).toBe(10)
    expect(calcularTendenciaACWR([0])).toBe(0)
  })

  it('calcula tendencia ponderada', () => {
    const result = calcularTendenciaACWR([10, 20, 30])
    expect(result).toBeCloseTo(19.0, 1)
  })
})

describe('calcularTendenciaWellness', () => {
  it('retorna valor para array de un elemento', () => {
    expect(calcularTendenciaWellness([5])).toBe(5)
    expect(calcularTendenciaWellness([0])).toBe(0)
  })

  it('calcula tendencia ponderada', () => {
    const result = calcularTendenciaWellness([4, 6, 8])
    expect(result).toBeCloseTo(5.8, 1)
  })
})

describe('getPercentilEquipo', () => {
  it('retorna ceros para array vacío', () => {
    const result = getPercentilEquipo([])
    expect(result).toEqual({ p25: 0, p50: 0, p75: 0 })
  })

  it('calculates percentiles correctly', () => {
    const result = getPercentilEquipo([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(result).toEqual({ p25: 3, p50: 5, p75: 7 })
  })
})

describe('calcularCargaACWR', () => {
  it('retorna 0 para array vacío', () => {
    expect(calcularCargaACWR([])).toBe(0)
  })

  it('calculates average carga con smooth', () => {
    const result = calcularCargaACWR([10, 20, 30, 40, 50])
    expect(result).toBeCloseTo(30.0, 1)
  })
})