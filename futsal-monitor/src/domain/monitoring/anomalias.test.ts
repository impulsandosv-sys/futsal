import { describe, it, expect } from 'vitest'
import { detectarAnomalias } from './anomalias'

describe('Detección de Anomalías (src/domain/monitoring/anomalias.ts)', () => {
  it('detecta RPE mayor a 10 o menor a 0', () => {
    const anomaliasHigh = detectarAnomalias({ tipo: 'rpe', rpe: 11, minutos: 60, fecha: '2026-05-10' })
    expect(anomaliasHigh.some((a) => a.regla === 'rpe_fuera_de_rango')).toBe(true)

    const anomaliasLow = detectarAnomalias({ tipo: 'rpe', rpe: -1, minutos: 60, fecha: '2026-05-10' })
    expect(anomaliasLow.some((a) => a.regla === 'rpe_fuera_de_rango')).toBe(true)
  })

  it('detecta minutos de sesión mayores a 120 o negativos', () => {
    const anomaliasMax = detectarAnomalias({ tipo: 'rpe', rpe: 7, minutos: 150, fecha: '2026-05-10' })
    expect(anomaliasMax.some((a) => a.regla === 'minutos_excesivos')).toBe(true)

    const anomaliasNeg = detectarAnomalias({ tipo: 'rpe', rpe: 7, minutos: -10, fecha: '2026-05-10' })
    expect(anomaliasNeg.some((a) => a.regla === 'minutos_negativos')).toBe(true)
  })

  it('detecta cambios drásticos de wellness (>4 puntos de variación diaria)', () => {
    const wellnessHoy = { tipo: 'wellness', score: 18, scoreAyer: 12, fecha: '2026-05-10' }
    const anomalias = detectarAnomalias(wellnessHoy)
    expect(anomalias.some((a) => a.regla === 'wellness_salto_drastico')).toBe(true)
  })

  it('detecta picos de carga semanal (>3 veces la semana anterior)', () => {
    const cargaSemanal = { tipo: 'carga_semanal', cargaActual: 2400, cargaAnterior: 600, semana: '2026-W20' }
    const anomalias = detectarAnomalias(cargaSemanal)
    expect(anomalias.some((a) => a.regla === 'carga_multiplicador_excesivo')).toBe(true)
  })

  it('detecta fechas futuras en registros históricos', () => {
    const registroFuturo = { tipo: 'rpe', rpe: 5, minutos: 60, fecha: '2099-01-01' }
    const anomalias = detectarAnomalias(registroFuturo)
    expect(anomalias.some((a) => a.regla === 'fecha_futura')).toBe(true)
  })
})
