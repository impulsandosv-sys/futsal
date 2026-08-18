import { describe, it, expect } from 'vitest'
import { calcularCargaCompetitivaJugadora } from './competitiveLoad'
import type { Jugadora, Partido, RPE_Partido, Temporada } from '@/types'

describe('calcularCargaCompetitivaJugadora', () => {
  const jugadora: Jugadora = { id_jugadora: 'j1', nombre: 'Jug 1', activa: true, demarcacion: 'Ala', fecha_nacimiento: '2000-01-01' }
  const p1: Partido = { id_partido: 'p1', fecha: '2026-08-01', rival: 'A', competicion: 'Liga', resultado: '0-0', lugar: 'Local' }
  const p2: Partido = { id_partido: 'p2', fecha: '2026-08-10', rival: 'B', competicion: 'Liga', resultado: '0-0', lugar: 'Local' }
  const p3: Partido = { id_partido: 'p3', fecha: '2026-08-15', rival: 'C', competicion: 'Liga', resultado: '0-0', lugar: 'Local' }
  const p4: Partido = { id_partido: 'p4', fecha: '2026-09-01', rival: 'D', competicion: 'Liga', resultado: '0-0', lugar: 'Local' }
  const pFuturo: Partido = { id_partido: 'p5', fecha: '2026-09-10', rival: 'E', competicion: 'Liga', resultado: '0-0', lugar: 'Local' }
  
  const partidos = [p1, p2, p3, p4, pFuturo]

  const rpes: RPE_Partido[] = [
    { id_partido: 'p1', id_jugadora: 'j1', minutos_jugados: 20, rpe: 5, carga_ua: 100, fecha: '2026-08-01', participacion: 'parcial' },
    { id_partido: 'p2', id_jugadora: 'j1', minutos_jugados: 40, rpe: 8, carga_ua: 320, fecha: '2026-08-10', participacion: 'completa' },
    { id_partido: 'p3', id_jugadora: 'j1', minutos_jugados: 0, rpe: null, carga_ua: 0, fecha: '2026-08-15', participacion: 'no_convocada' },
    { id_partido: 'p4', id_jugadora: 'j1', minutos_jugados: 10, rpe: 6, carga_ua: 60, fecha: '2026-09-01', participacion: 'parcial' },
    { id_partido: 'p5', id_jugadora: 'j1', minutos_jugados: 10, rpe: 6, carga_ua: 60, fecha: '2026-09-10', participacion: 'parcial' },
  ]

  it('Filtro ultimo_partido devuelve solo datos del partido más reciente anterior o igual a fechaReferencia, excluyendo futuros', () => {
    const res = calcularCargaCompetitivaJugadora(jugadora, partidos, rpes, {
      fechaReferencia: '2026-09-05',
      rangoDias: 'ultimo_partido'
    })
    // pFuturo (09-10) is excluded since it's > 09-05
    // p4 (09-01) is the most recent
    expect(res.registros.length).toBe(1)
    expect(res.registros[0].partido.id_partido).toBe('p4')
  })

  it('En ultimo_partido, jugadoras sin registro en el último partido aparecen como pendientes', () => {
    const rpesIncompletos = rpes.filter(r => r.id_partido !== 'p4') // no record for the most recent match (p4)
    const res = calcularCargaCompetitivaJugadora(jugadora, partidos, rpesIncompletos, {
      fechaReferencia: '2026-09-05',
      rangoDias: 'ultimo_partido'
    })
    expect(res.datosPendientes).toBe(1)
    expect(res.registros.length).toBe(0)
  })

  it('Filtro temporada devuelve partidos dentro de la temporada y excluye anteriores o posteriores', () => {
    const temporadaActiva: Temporada = {
      id_temporada: 't1', nombre: 'Temp 26', fecha_inicio: '2026-08-05', fecha_fin: '2026-08-20', activa: true, semanas: []
    }
    const res = calcularCargaCompetitivaJugadora(jugadora, partidos, rpes, {
      fechaReferencia: '2026-09-05',
      rangoDias: 'temporada',
      temporadaActiva
    })
    // p1 (08-01) is before 08-05.
    // p4 (09-01) and pFuturo (09-10) are after 08-20.
    // Only p2 (08-10) and p3 (08-15) are included.
    expect(res.registros.length).toBe(2)
    expect(res.registros.map(r => r.partido.id_partido).sort()).toEqual(['p2', 'p3'])
  })

  it('Filtro temporada sin temporada activa devuelve conjunto vacío', () => {
    const res = calcularCargaCompetitivaJugadora(jugadora, partidos, rpes, {
      fechaReferencia: '2026-09-05',
      rangoDias: 'temporada'
      // temporadaActiva undefined
    })
    expect(res.registros.length).toBe(0)
    expect(res.minutosTotales).toBe(0)
  })

  it('Regresión de filtros 7, 14 y 28 días', () => {
    // fechaReferencia: 2026-08-16
    // 7 días: >= 2026-08-09 (p2, p3)
    // 14 días: >= 2026-08-02 (p2, p3)
    // 28 días: >= 2026-07-19 (p1, p2, p3)
    
    const res7 = calcularCargaCompetitivaJugadora(jugadora, partidos, rpes, {
      fechaReferencia: '2026-08-16',
      rangoDias: 7
    })
    expect(res7.registros.length).toBe(2)
    expect(res7.registros.map(r => r.partido.id_partido).sort()).toEqual(['p2', 'p3'])

    const res14 = calcularCargaCompetitivaJugadora(jugadora, partidos, rpes, {
      fechaReferencia: '2026-08-16',
      rangoDias: 14
    })
    expect(res14.registros.length).toBe(2)
    expect(res14.registros.map(r => r.partido.id_partido).sort()).toEqual(['p2', 'p3'])

    const res28 = calcularCargaCompetitivaJugadora(jugadora, partidos, rpes, {
      fechaReferencia: '2026-08-16',
      rangoDias: 28
    })
    expect(res28.registros.length).toBe(3)
    expect(res28.registros.map(r => r.partido.id_partido).sort()).toEqual(['p1', 'p2', 'p3'])
  })
})
