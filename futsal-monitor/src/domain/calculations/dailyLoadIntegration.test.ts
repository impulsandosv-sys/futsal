import { describe, it, expect } from 'vitest'
import { obtenerCargasDiariasJugadora } from './dailyLoad'
import { construirDecisionDiaria } from '../dailyDecision/dailyDecisionEngine'
import { calcularResumenSemanal } from '../monitoring/monitoring'
import type { Sesion, SesionRPE, RPE_Partido, Jugadora } from '@/types'

describe('REQUISITO 5 & 7: Consistencia total entre Readiness, Decisión Diaria y Resumen Semanal', () => {
  const J1 = 'JUG_INTEGRACION'
  const semana = '2026-08-10' // Lunes
  const jugadoras: Jugadora[] = [
    { id_jugadora: J1, nombre: 'Jugadora Test', activa: true, dorsal: 10, posicion: 'Ala' } as any
  ]

  it('Escenario 1: Solo sesión (400 UA)', () => {
    const fecha = '2026-08-10'
    const sesiones: Sesion[] = [
      { id_sesion: 'S1', fecha, tipo_dia: 'Entreno', tipo_sesion: 'Campo', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'S1', id_jugadora: J1, rpe: 8, duracion_min: 50, carga_ua: 400, fecha }
    ]

    // 1. DailyLoad (Fuente Única)
    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: semana,
      fechaHasta: '2026-08-16',
      sesiones,
      sesionesRPE,
      rpePartidos: []
    })
    const cargaLunes = map.get(fecha)!.carga

    // 2. Resumen Semanal
    const resumen = calcularResumenSemanal(
      J1,
      semana,
      sesiones,
      [],
      sesionesRPE,
      [],
      [],
      []
    )

    // 3. Decisión Diaria
    const decisionResumen = construirDecisionDiaria(
      jugadoras,
      [],
      [],
      [],
      [],
      sesionesRPE,
      [],
      fecha,
      sesiones
    )
    const decisionJ1 = decisionResumen.jugadoras.find(x => x.id_jugadora === J1)!

    expect(cargaLunes).toBe(400)
    expect(resumen.carga_total).toBe(400)
    expect(decisionJ1.carga7d?.ultimaSesionCarga).toBe(400)
  })

  it('Escenario 2: Solo partido (300 UA)', () => {
    const fecha = '2026-08-11'
    const rpePartidos: RPE_Partido[] = [
      { id_partido: 'P1', id_jugadora: J1, rpe: 10, minutos_jugados: 30, carga_ua: 300, fecha }
    ]

    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: semana,
      fechaHasta: '2026-08-16',
      sesiones: [],
      sesionesRPE: [],
      rpePartidos
    })
    const cargaMartes = map.get(fecha)!.carga

    const resumen = calcularResumenSemanal(
      J1,
      semana,
      [],
      [],
      [],
      rpePartidos,
      [],
      []
    )

    const decisionResumen = construirDecisionDiaria(
      jugadoras,
      [],
      [],
      [],
      [],
      [],
      rpePartidos,
      fecha,
      []
    )
    const decisionJ1 = decisionResumen.jugadoras.find(x => x.id_jugadora === J1)!

    expect(cargaMartes).toBe(300)
    expect(resumen.carga_total).toBe(300)
    expect(decisionJ1.carga7d?.ultimaSesionCarga).toBe(300)
  })

  it('Escenario 3: Sesión vinculada a partido + RPE de partido (Deduplicación explícita)', () => {
    const fecha = '2026-08-12'
    const sesiones: Sesion[] = [
      { id_sesion: 'S_PARTIDO', id_partido: 'P_VINCULADO', fecha, tipo_dia: 'Partido', tipo_sesion: 'Partido', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'S_PARTIDO', id_jugadora: J1, rpe: 7, duracion_min: 60, carga_ua: 420, fecha }
    ]
    const rpePartidos: RPE_Partido[] = [
      { id_partido: 'P_VINCULADO', id_jugadora: J1, rpe: 9, minutos_jugados: 40, carga_ua: 360, fecha }
    ]

    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: semana,
      fechaHasta: '2026-08-16',
      sesiones,
      sesionesRPE,
      rpePartidos
    })
    const cargaMiercoles = map.get(fecha)!.carga

    const resumen = calcularResumenSemanal(
      J1,
      semana,
      sesiones,
      [],
      sesionesRPE,
      rpePartidos,
      [],
      []
    )

    const decisionResumen = construirDecisionDiaria(
      jugadoras,
      [],
      [],
      [],
      [],
      sesionesRPE,
      rpePartidos,
      fecha,
      sesiones
    )
    const decisionJ1 = decisionResumen.jugadoras.find(x => x.id_jugadora === J1)!

    // Se debe tomar solo el RPE de partido (360), no 420+360=780
    expect(cargaMiercoles).toBe(360)
    expect(resumen.carga_total).toBe(360)
    expect(decisionJ1.carga7d?.ultimaSesionCarga).toBe(360)
  })

  it('Escenario 4: Sesión tipo Partido sin id_partido (No se elimina si no hay enlace explícito)', () => {
    const fecha = '2026-08-13'
    const sesiones: Sesion[] = [
      { id_sesion: 'S_TIPO_PARTIDO_SIN_LINK', fecha, tipo_dia: 'Partido', tipo_sesion: 'Partido', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'S_TIPO_PARTIDO_SIN_LINK', id_jugadora: J1, rpe: 6, duracion_min: 50, carga_ua: 300, fecha }
    ]
    const rpePartidos: RPE_Partido[] = [
      { id_partido: 'PARTIDO_OTRO', id_jugadora: J1, rpe: 8, minutos_jugados: 30, carga_ua: 240, fecha }
    ]

    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: semana,
      fechaHasta: '2026-08-16',
      sesiones,
      sesionesRPE,
      rpePartidos
    })
    const cargaJueves = map.get(fecha)!.carga

    const resumen = calcularResumenSemanal(
      J1,
      semana,
      sesiones,
      [],
      sesionesRPE,
      rpePartidos,
      [],
      []
    )

    const decisionResumen = construirDecisionDiaria(
      jugadoras,
      [],
      [],
      [],
      [],
      sesionesRPE,
      rpePartidos,
      fecha,
      sesiones
    )
    const decisionJ1 = decisionResumen.jugadoras.find(x => x.id_jugadora === J1)!

    // Al no existir enlace explícito id_partido, ambas cargas (300 y 240) se conservan: 540
    expect(cargaJueves).toBe(540)
    expect(resumen.carga_total).toBe(540)
    expect(decisionJ1.carga7d?.ultimaSesionCarga).toBe(540)
  })
})
