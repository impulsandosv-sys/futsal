import { describe, it, expect } from 'vitest'
import { evaluarCompletitudDatos } from './completitud'
import type { Jugadora, Partido, RPE_Partido, Wellness, SesionRPE } from '@/types'

describe('Data Quality: evaluarCompletitudDatos', () => {
  const jugadoras: Jugadora[] = [
    { id_jugadora: 'j1', nombre: 'Jugadora 1', activa: true, dorsal: 1, posicion: 'Ala' }
  ]

  const hoyLocal = '2026-08-18'

  it('debe detectar partido pasado sin fila rpe_partido como pendiente de minutos', () => {
    const partidos: Partido[] = [{ id_partido: 'p1', fecha: '2026-08-17', rival: 'Rival', competicion: '', lugar: 'Local', resultado: '' }]
    const report = evaluarCompletitudDatos(jugadoras, [], partidos, [], [], hoyLocal)

    expect(report.alertas).toHaveLength(1)
    expect(report.alertas[0].estado).toBe('pendiente')
    expect(report.alertas[0].tipo).toBe('minutos_partido')
    expect(report.alertas[0].titulo).toBe('Participación/minutos de partido pendientes de registrar')
  })

  it('debe excluir partidos futuros', () => {
    const partidos: Partido[] = [{ id_partido: 'p1', fecha: '2026-08-20', rival: 'Futuro', competicion: '', lugar: 'Local', resultado: '' }]
    const report = evaluarCompletitudDatos(jugadoras, [], partidos, [], [], hoyLocal)

    expect(report.alertas).toHaveLength(0)
  })

  it('debe marcar como "No aplicable" si la jugadora no fue convocada o minutos = 0 explícito', () => {
    const partidos: Partido[] = [{ id_partido: 'p1', fecha: '2026-08-17', rival: 'Rival', competicion: '', lugar: 'Local', resultado: '' }]
    const rpes: RPE_Partido[] = [{
      id_partido: 'p1', id_jugadora: 'j1', fecha: '2026-08-17',
      participacion: 'no_convocada', minutos_jugados: 0, rpe: null, carga_ua: null
    }]

    const report = evaluarCompletitudDatos(jugadoras, [], partidos, rpes, [], hoyLocal)

    expect(report.alertas).toHaveLength(1)
    expect(report.alertas[0].estado).toBe('no_aplicable')
  })

  it('debe marcar como RPE pendiente si jugó minutos pero rpe es nulo', () => {
    const partidos: Partido[] = [{ id_partido: 'p1', fecha: '2026-08-17', rival: 'Rival', competicion: '', lugar: 'Local', resultado: '' }]
    const rpes: RPE_Partido[] = [{
      id_partido: 'p1', id_jugadora: 'j1', fecha: '2026-08-17',
      participacion: 'completa', minutos_jugados: 20, rpe: null, carga_ua: null
    }]

    const report = evaluarCompletitudDatos(jugadoras, [], partidos, rpes, [], hoyLocal)

    expect(report.alertas[0].tipo).toBe('rpe_partido')
    expect(report.alertas[0].estado).toBe('pendiente')
    expect(report.alertas[0].titulo).toBe('RPE competitivo pendiente')
  })

  it('debe contar wellness correctamente dentro de los últimos 7 días y excluir futuros', () => {
    const wellness: Wellness[] = [
      { id_wellness: 'w1', id_jugadora: 'j1', fecha: '2026-08-18', sueno: 5, estres: 5, fatiga: 5, dolor_muscular: 5, humor: 5, puntuacion_total: 25 },
      { id_wellness: 'w2', id_jugadora: 'j1', fecha: '2026-08-15', sueno: 5, estres: 5, fatiga: 5, dolor_muscular: 5, humor: 5, puntuacion_total: 25 },
      { id_wellness: 'w3', id_jugadora: 'j1', fecha: '2026-08-20', sueno: 5, estres: 5, fatiga: 5, dolor_muscular: 5, humor: 5, puntuacion_total: 25 }, // futuro
      { id_wellness: 'w4', id_jugadora: 'j1', fecha: '2026-08-10', sueno: 5, estres: 5, fatiga: 5, dolor_muscular: 5, humor: 5, puntuacion_total: 25 }, // antiguo
    ]

    const report = evaluarCompletitudDatos(jugadoras, wellness, [], [], [], hoyLocal)
    expect(report.wellness).toHaveLength(1)
    expect(report.wellness[0].registros_ultimos_7_dias).toBe(2)
  })
})
