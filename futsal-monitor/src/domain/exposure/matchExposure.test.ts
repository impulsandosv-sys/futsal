import { describe, it, expect } from 'vitest'
import { calcularExposicionCompetitiva } from './matchExposure'
import type { ParticipacionPartido, RPE_Partido } from '@/types'

describe('calcularExposicionCompetitiva', () => {
  const defaultFechaCorte = '2026-08-07'

  const makeRecord = (
    fecha: string,
    participacion?: ParticipacionPartido,
    minutos: number | null | undefined = undefined
  ): RPE_Partido => ({
    id_partido: 'P_' + fecha,
    id_jugadora: 'J1',
    fecha,
    participacion,
    minutos_jugados: minutos,
    rpe: 5, // irrelevant for exposure
    carga_ua: 100
  })

  it('1. Jugadora no convocada: no cuenta como convocatoria ni falta de dato', () => {
    const records = [makeRecord('2026-08-05', 'no_convocada', 0)]
    const result = calcularExposicionCompetitiva(records, defaultFechaCorte)
    expect(result.convocatorias7d).toBe(0)
    expect(result.partidosJugados7d).toBe(0)
    expect(result.minutos7d).toBe(0)
    expect(result.calidadDato).toBe('completa')
  })

  it('2. Convocada sin minutos: cuenta como convocatoria, no partido jugado', () => {
    const records = [makeRecord('2026-08-05', 'convocada_sin_minutos', 0)]
    const result = calcularExposicionCompetitiva(records, defaultFechaCorte)
    expect(result.convocatorias7d).toBe(1)
    expect(result.convocadaSinMinutos7d).toBe(1)
    expect(result.partidosJugados7d).toBe(0)
    expect(result.minutos7d).toBe(0)
    expect(result.porcentajeExposicion7d).toBe(0)
    expect(result.calidadDato).toBe('completa')
  })

  it('3. Participación parcial (minutos > 0)', () => {
    const records = [makeRecord('2026-08-05', 'parcial', 20)]
    const result = calcularExposicionCompetitiva(records, defaultFechaCorte)
    expect(result.convocatorias7d).toBe(1)
    expect(result.partidosJugados7d).toBe(1)
    expect(result.minutos7d).toBe(20)
    expect(result.porcentajeExposicion7d).toBe(50) // 20 / 40 * 100
    expect(result.calidadDato).toBe('completa')
  })

  it('4. Participación completa con 40 minutos', () => {
    const records = [makeRecord('2026-08-05', 'completa', 40)]
    const result = calcularExposicionCompetitiva(records, defaultFechaCorte)
    expect(result.convocatorias7d).toBe(1)
    expect(result.partidosJugados7d).toBe(1)
    expect(result.minutos7d).toBe(40)
    expect(result.porcentajeExposicion7d).toBe(100)
    expect(result.calidadDato).toBe('completa')
  })

  it('5. Participación modificada con minutos', () => {
    const records = [makeRecord('2026-08-05', 'modificada', 10)]
    const result = calcularExposicionCompetitiva(records, defaultFechaCorte)
    expect(result.convocatorias7d).toBe(1)
    expect(result.partidosJugados7d).toBe(1)
    expect(result.minutos7d).toBe(10)
    expect(result.porcentajeExposicion7d).toBe(25)
    expect(result.calidadDato).toBe('completa')
  })

  it('6. Dos partidos en una misma semana', () => {
    const records = [
      makeRecord('2026-08-03', 'completa', 40),
      makeRecord('2026-08-05', 'parcial', 20)
    ]
    const result = calcularExposicionCompetitiva(records, defaultFechaCorte)
    expect(result.convocatorias7d).toBe(2)
    expect(result.partidosJugados7d).toBe(2)
    expect(result.minutos7d).toBe(60)
    expect(result.porcentajeExposicion7d).toBe(75) // 60 / 80 * 100
  })

  it('7. Semana sin convocatoria', () => {
    const records: RPE_Partido[] = []
    const result = calcularExposicionCompetitiva(records, defaultFechaCorte)
    expect(result.convocatorias7d).toBe(0)
    expect(result.porcentajeExposicion7d).toBeNull()
    expect(result.calidadDato).toBe('sin_competicion')
  })

  it('8. Datos nulos o incompletos que no se transforman en 0', () => {
    // Si participacion=parcial pero minutos=null, degrada calidad
    const records = [makeRecord('2026-08-05', 'parcial', null)]
    const result = calcularExposicionCompetitiva(records, defaultFechaCorte)
    expect(result.calidadDato).toBe('insuficiente')
    expect(result.minutos7d).toBe(0) // No se asume 0, no suma
    expect(result.motivosCalidadDato.length).toBeGreaterThan(0)
    expect(result.motivosCalidadDato[0]).toContain('sin datos de minutos')
  })

  it('9. mantiene referencia y ratio con calidad parcial si hay un null aislado', () => {
    const records = [
      makeRecord('2026-07-15', 'completa', 40), // 28d
      makeRecord('2026-08-05', 'parcial', null)  // 7d, error
    ]
    const result = calcularExposicionCompetitiva(records, defaultFechaCorte)
    // Hay al menos 1 convocatoria válida en 28d, por lo que la calidad es parcial
    expect(result.calidadDato).toBe('parcial')
    expect(result.minutos28d).toBe(40)
    // Ahora referenciaSemanal28d sí se calcula con calidad 'parcial'
    expect(result.referenciaSemanal28d).toBe(10)
    expect(result.ratioCambioExposicion).toBe(0) // 0 / 10 = 0
  })

  it('10. Ventanas límite: fecha de corte inclusiva, día 7 y día 28', () => {
    const diaCorte = '2026-08-07'
    const dia7 = '2026-08-01' // 7 days window (1, 2, 3, 4, 5, 6, 7 -> inclusive 7 days)
    const dia8 = '2026-07-31' // outside 7 days
    const dia28 = '2026-07-11' // 28 days window (July 11 to Aug 7)
    const dia29 = '2026-07-10' // outside 28 days

    const records = [
      makeRecord(diaCorte, 'completa', 40),
      makeRecord(dia7, 'parcial', 20),
      makeRecord(dia8, 'completa', 40),
      makeRecord(dia28, 'completa', 40),
      makeRecord(dia29, 'completa', 40)
    ]
    const result = calcularExposicionCompetitiva(records, diaCorte)
    expect(result.minutos7d).toBe(60) // diaCorte y dia7
    expect(result.minutos28d).toBe(140) // diaCorte, dia7, dia8, dia28
    // dia29 is ignored entirely
  })

  it('11. Ratio no calculable por historial insuficiente (referencia 0)', () => {
    const records = [
      makeRecord('2026-08-05', 'completa', 40)
    ] // Solo un partido en toda la ventana de 28d
    const result = calcularExposicionCompetitiva(records, defaultFechaCorte)
    expect(result.calidadDato).toBe('completa')
    expect(result.referenciaSemanal28d).toBe(10) // 40 / 4
    expect(result.ratioCambioExposicion).toBe(4) // 40 / 10 = 4. Wait, the prompt says "Ratio no calculable por historial insuficiente" pero no define un umbral de histórico explícito en la regla.
    // Regla 7: "Ratio de cambio: minutos7d / referenciaSemanal28d, solo si referencia > 0 y calidad suficiente; en caso contrario null."
    // 40 / 4 = 10 > 0. Por tanto SÍ es calculable aquí.

    // Testeamos referencia = 0 (historial insuficiente en minutos)
    const emptyRecords: RPE_Partido[] = []
    const emptyResult = calcularExposicionCompetitiva(emptyRecords, defaultFechaCorte)
    expect(emptyResult.referenciaSemanal28d).toBeNull() // Antes era 0, ahora con 'sin_competicion' es null (no entra en if 'completa' o 'parcial')
    expect(emptyResult.ratioCambioExposicion).toBeNull()
  })

  it('12. Compatibilidad con registros históricos no_participa, si siguen existiendo', () => {
    // Para minutos 1-39 -> inferencia parcial, calidad parcial
    const records = [makeRecord('2026-08-05', undefined, 30)]
    const result = calcularExposicionCompetitiva(records, defaultFechaCorte)
    expect(result.convocatorias7d).toBe(1)
    expect(result.minutos7d).toBe(30)
    expect(result.calidadDato).toBe('parcial')

    // Para minutos 40 -> inferencia completa, calidad parcial
    const records40 = [makeRecord('2026-08-05', undefined, 40)]
    const result40 = calcularExposicionCompetitiva(records40, defaultFechaCorte)
    expect(result40.convocatorias7d).toBe(1)
    expect(result40.minutos7d).toBe(40)
    expect(result40.calidadDato).toBe('parcial')

    // Para minutos 0 -> no inferir participación, no calcular exposición, reportar como incompleto
    const records0 = [makeRecord('2026-08-05', undefined, 0)]
    const result0 = calcularExposicionCompetitiva(records0, defaultFechaCorte)
    expect(result0.convocatorias7d).toBe(0)
    expect(result0.minutos7d).toBe(0)
    expect(result0.calidadDato).toBe('insuficiente')
  })
})
