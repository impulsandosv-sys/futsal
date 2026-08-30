import { describe, it, expect } from 'vitest'
import { validateSesion } from '@/utils/validation'
import { verificarConsistenciaRelacional } from '@/domain/imports/integridad'
import { obtenerCargasDiariasJugadora } from '@/domain/calculations/dailyLoad'
import type { Sesion, SesionRPE, RPE_Partido, Partido } from '@/types'

describe('Integridad de Sesiones tipo Partido y rpe_partido', () => {
  it('rechaza una sesión de tipo Partido sin id_partido', () => {
    const sesionSinPartido: Sesion = {
      id_sesion: 'SES_PARTIDO_01',
      fecha: '2026-05-10',
      tipo_sesion: 'Partido',
      duracion_planificada_min: 60,
    }

    const errors = validateSesion(sesionSinPartido)
    expect(errors.some((e) => e.field === 'id_partido')).toBe(true)
  })

  it('permite una sesión de tipo Partido con id_partido existente', () => {
    const sesionConPartido: Sesion = {
      id_sesion: 'SES_PARTIDO_01',
      fecha: '2026-05-10',
      tipo_sesion: 'Partido',
      id_partido: 'PARTIDO_01',
      duracion_planificada_min: 60,
    }

    const errors = validateSesion(sesionConPartido)
    expect(errors.some((e) => e.field === 'id_partido')).toBe(false)
    expect(errors).toHaveLength(0)
  })

  it('detecta una sesión histórica de tipo Partido sin id_partido', () => {
    const dataset = {
      jugadoras: [{ id_jugadora: 'J001', nombre: 'Ana' }],
      sesiones: [
        {
          id_sesion: 'HIST_PARTIDO_SIN_LINK',
          fecha: '2026-04-01',
          tipo_sesion: 'Partido' as const,
        },
      ],
    }

    const reporte = verificarConsistenciaRelacional(dataset as any)
    expect(reporte.tieneInconsistencias).toBe(true)
    expect(reporte.sesionesPartidoSinLink).toHaveLength(1)
    expect(reporte.sesionesPartidoSinLink[0].idSesion).toBe('HIST_PARTIDO_SIN_LINK')
  })

  it('verifica que un partido vinculado + rpe_partido solo cuenta una vez', () => {
    const partido: Partido = {
      id_partido: 'P01',
      fecha: '2026-05-10',
      rival: 'Rival FC',
    }

    const sesionPartidoVinculada: Sesion = {
      id_sesion: 'S_PARTIDO_LINKED',
      fecha: '2026-05-10',
      tipo_sesion: 'Partido',
      id_partido: 'P01',
      duracion_real_grupal_min: 40,
    }

    const srpe: SesionRPE = {
      id: 101,
      id_sesion: 'S_PARTIDO_LINKED',
      id_jugadora: 'J001',
      fecha: '2026-05-10',
      rpe: 8,
      duracion_min: 40,
      carga_ua: 320,
    }

    const rpePartido: RPE_Partido = {
      id: 201,
      id_partido: 'P01',
      id_jugadora: 'J001',
      fecha: '2026-05-10',
      rpe: 8,
      minutos_jugados: 30,
      carga_ua: 240,
    }

    const cargas = obtenerCargasDiariasJugadora({
      jugadoraId: 'J001',
      fechaDesde: '2026-05-10',
      fechaHasta: '2026-05-10',
      sesiones: [sesionPartidoVinculada],
      sesionesRPE: [srpe],
      rpePartidos: [rpePartido],
      partidos: [partido],
    })

    const entry = cargas.get('2026-05-10')
    expect(entry).toBeDefined()
    expect(entry?.numActividades).toBe(1) // ¡Sólo cuenta 1 actividad de partido!
    expect(entry?.carga).toBe(240) // ¡Usa la carga real individual del partido rpePartido!
  })

  it('verifica que una sesión normal y un partido el mismo día sí pueden sumar si son eventos distintos', () => {
    const partido: Partido = {
      id_partido: 'P01',
      fecha: '2026-05-10',
      rival: 'Rival FC',
    }

    const sesionEntrenoNormal: Sesion = {
      id_sesion: 'S_ENTRENO_MATUTINO',
      fecha: '2026-05-10',
      tipo_sesion: 'Fisico',
      duracion_real_grupal_min: 60,
    }

    const srpeEntreno: SesionRPE = {
      id: 102,
      id_sesion: 'S_ENTRENO_MATUTINO',
      id_jugadora: 'J001',
      fecha: '2026-05-10',
      rpe: 7,
      duracion_min: 60,
      carga_ua: 420,
    }

    const rpePartido: RPE_Partido = {
      id: 202,
      id_partido: 'P01',
      id_jugadora: 'J001',
      fecha: '2026-05-10',
      rpe: 8,
      minutos_jugados: 30,
      carga_ua: 240,
    }

    const cargas = obtenerCargasDiariasJugadora({
      jugadoraId: 'J001',
      fechaDesde: '2026-05-10',
      fechaHasta: '2026-05-10',
      sesiones: [sesionEntrenoNormal],
      sesionesRPE: [srpeEntreno],
      rpePartidos: [rpePartido],
      partidos: [partido],
    })

    const entry = cargas.get('2026-05-10')
    expect(entry).toBeDefined()
    expect(entry?.numActividades).toBe(2) // Dos eventos independientes en el mismo día
    expect(entry?.carga).toBe(660) // 420 (entreno) + 240 (partido) = 660 UA
  })
})
