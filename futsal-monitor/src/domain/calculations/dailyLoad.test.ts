import { describe, it, expect } from 'vitest'
import { obtenerCargasDiariasJugadora, obtenerArrayCargaDiaria } from './dailyLoad'
import type { Sesion, SesionRPE, RPE_Partido } from '@/types'

describe('BLOQUE C — Fuente única de carga individual (dailyLoad.ts)', () => {
  const J1 = 'JUG_001'

  it('1. Solo sesión: calcula la carga correctamente', () => {
    const sesiones: Sesion[] = [
      { id_sesion: 'S1', fecha: '2026-08-01', tipo_dia: 'Entreno', tipo_sesion: 'Fisico', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'S1', id_jugadora: J1, rpe: 6, duracion_min: 60, carga_ua: 360, fecha: '2026-08-01', asistencia: 'completa' }
    ]

    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: '2026-08-01',
      fechaHasta: '2026-08-01',
      sesiones,
      sesionesRPE,
      rpePartidos: []
    })

    const entry = map.get('2026-08-01')!
    expect(entry.tieneDato).toBe(true)
    expect(entry.carga).toBe(360)
    expect(entry.fuentes).toEqual(['sesion'])
  })

  it('2. Solo partido: calcula la carga de partido correctamente', () => {
    const rpePartidos: RPE_Partido[] = [
      { id_partido: 'P1', id_jugadora: J1, fecha: '2026-08-02', rpe: 8, minutos_jugados: 30, carga_ua: 240, participacion: 'completa' }
    ]

    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: '2026-08-02',
      fechaHasta: '2026-08-02',
      sesiones: [],
      sesionesRPE: [],
      rpePartidos
    })

    const entry = map.get('2026-08-02')!
    expect(entry.tieneDato).toBe(true)
    expect(entry.carga).toBe(240)
    expect(entry.fuentes).toEqual(['partido'])
  })

  it('3. Sesión y partido no vinculados el mismo día: se suman', () => {
    const sesiones: Sesion[] = [
      { id_sesion: 'S1', fecha: '2026-08-03', tipo_dia: 'Entreno', tipo_sesion: 'Fisico', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'S1', id_jugadora: J1, rpe: 5, duracion_min: 40, carga_ua: 200, fecha: '2026-08-03' }
    ]
    const rpePartidos: RPE_Partido[] = [
      { id_partido: 'P1', id_jugadora: J1, fecha: '2026-08-03', rpe: 9, minutos_jugados: 20, carga_ua: 180 }
    ]

    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: '2026-08-03',
      fechaHasta: '2026-08-03',
      sesiones,
      sesionesRPE,
      rpePartidos
    })

    const entry = map.get('2026-08-03')!
    expect(entry.tieneDato).toBe(true)
    expect(entry.carga).toBe(380)
    expect(entry.fuentes).toContain('sesion')
    expect(entry.fuentes).toContain('partido')
  })

  it('4. Sesión vinculada a partido + RPE de partido: deduplicación (RPE partido prioriza, no se duplica)', () => {
    const sesiones: Sesion[] = [
      { id_sesion: 'S_PARTIDO', fecha: '2026-08-04', tipo_dia: 'Partido', tipo_sesion: 'Partido', id_partido: 'P_VINCULADO', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'S_PARTIDO', id_jugadora: J1, rpe: 7, duracion_min: 50, carga_ua: 350, fecha: '2026-08-04' }
    ]
    const rpePartidos: RPE_Partido[] = [
      { id_partido: 'P_VINCULADO', id_jugadora: J1, fecha: '2026-08-04', rpe: 8, minutos_jugados: 40, carga_ua: 320 }
    ]

    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: '2026-08-04',
      fechaHasta: '2026-08-04',
      sesiones,
      sesionesRPE,
      rpePartidos
    })

    const entry = map.get('2026-08-04')!
    expect(entry.tieneDato).toBe(true)
    expect(entry.carga).toBe(320) // Only RPE partido counted (320), NOT 350+320=670
    expect(entry.fuentes).toEqual(['partido'])
  })

  it('5. Sesión cancelada: no cuenta carga', () => {
    const sesiones: Sesion[] = [
      { id_sesion: 'S_CANCELADA', fecha: '2026-08-05', tipo_dia: 'Entreno', tipo_sesion: 'Fisico', estado: 'cancelada', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'S_CANCELADA', id_jugadora: J1, rpe: 6, duracion_min: 60, carga_ua: 360, fecha: '2026-08-05' }
    ]

    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: '2026-08-05',
      fechaHasta: '2026-08-05',
      sesiones,
      sesionesRPE,
      rpePartidos: []
    })

    const entry = map.get('2026-08-05')!
    expect(entry.tieneDato).toBe(false)
    expect(entry.carga).toBeNull()
  })

  it('6. Carga 0 válida (ausente o RPE 0): se conserva como 0', () => {
    const sesiones: Sesion[] = [
      { id_sesion: 'S1', fecha: '2026-08-06', tipo_dia: 'Entreno', tipo_sesion: 'Fisico', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'S1', id_jugadora: J1, rpe: 0, duracion_min: 60, carga_ua: 0, fecha: '2026-08-06', asistencia: 'ausente' }
    ]

    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: '2026-08-06',
      fechaHasta: '2026-08-06',
      sesiones,
      sesionesRPE,
      rpePartidos: []
    })

    const entry = map.get('2026-08-06')!
    expect(entry.tieneDato).toBe(true)
    expect(entry.carga).toBe(0)
  })

  it('7. Sin registro: se representa como ausencia (carga: null, tieneDato: false)', () => {
    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: '2026-08-07',
      fechaHasta: '2026-08-07',
      sesiones: [],
      sesionesRPE: [],
      rpePartidos: []
    })

    const entry = map.get('2026-08-07')!
    expect(entry.tieneDato).toBe(false)
    expect(entry.carga).toBeNull()
  })

  it('8. Rango de 7 y 28 días inclusivo', () => {
    const map7 = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: '2026-08-01',
      fechaHasta: '2026-08-07',
      sesiones: [],
      sesionesRPE: [],
      rpePartidos: []
    })
    expect(map7.size).toBe(7)

    const map28 = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: '2026-08-01',
      fechaHasta: '2026-08-28',
      sesiones: [],
      sesionesRPE: [],
      rpePartidos: []
    })
    expect(map28.size).toBe(28)
  })

  it('9. obtenerArrayCargaDiaria mapea ausencias como 0 para EWMA/ACWR', () => {
    const sesiones: Sesion[] = [
      { id_sesion: 'S1', fecha: '2026-08-02', tipo_dia: 'Entreno', tipo_sesion: 'Fisico', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'S1', id_jugadora: J1, rpe: 10, duracion_min: 50, carga_ua: 500, fecha: '2026-08-02' }
    ]

    const arr = obtenerArrayCargaDiaria({
      jugadoraId: J1,
      fechaDesde: '2026-08-01',
      fechaHasta: '2026-08-03',
      sesiones,
      sesionesRPE,
      rpePartidos: []
    })

    expect(arr).toEqual([0, 500, 0])
  })

  it('10. Una sesión con id_sesion se localiza correctamente en dailyLoad', () => {
    const sesiones: Sesion[] = [
      { id_sesion: 'SES_100', fecha: '2026-08-10', tipo_dia: 'Entreno', tipo_sesion: 'Campo', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'SES_100', id_jugadora: J1, rpe: 7, duracion_min: 60, fecha: '2026-08-10' }
    ]
    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: '2026-08-10',
      fechaHasta: '2026-08-10',
      sesiones,
      sesionesRPE,
      rpePartidos: []
    })
    const entry = map.get('2026-08-10')!
    expect(entry.carga).toBe(420)
    expect(entry.detalles[0].idSesion).toBe('SES_100')
  })

  it('11. Sesión con id_partido + RPE de partido equivalente no duplica carga (deduplicación explícita)', () => {
    const sesiones: Sesion[] = [
      { id_sesion: 'SES_P1', id_partido: 'PARTIDO_1', fecha: '2026-08-11', tipo_dia: 'Partido', tipo_sesion: 'Partido', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'SES_P1', id_jugadora: J1, rpe: 8, duracion_min: 90, carga_ua: 720, fecha: '2026-08-11' }
    ]
    const rpePartidos: RPE_Partido[] = [
      { id_partido: 'PARTIDO_1', id_jugadora: J1, rpe: 9, minutos_jugados: 40, carga_ua: 360, fecha: '2026-08-11' }
    ]
    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: '2026-08-11',
      fechaHasta: '2026-08-11',
      sesiones,
      sesionesRPE,
      rpePartidos
    })
    const entry = map.get('2026-08-11')!
    expect(entry.carga).toBe(360) // solo rpePartido (360), no 720+360=1080
    expect(entry.detalles.length).toBe(1)
    expect(entry.detalles[0].origen).toBe('partido')
  })

  it('12. Sesión tipo Partido sin id_partido no se elimina de forma automática si no hay enlace explícito', () => {
    const sesiones: Sesion[] = [
      { id_sesion: 'SES_PARTIDO_SIN_LINK', fecha: '2026-08-12', tipo_dia: 'Partido', tipo_sesion: 'Partido', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'SES_PARTIDO_SIN_LINK', id_jugadora: J1, rpe: 6, duracion_min: 50, carga_ua: 300, fecha: '2026-08-12' }
    ]
    const rpePartidos: RPE_Partido[] = [
      { id_partido: 'PARTIDO_OTRO', id_jugadora: J1, rpe: 8, minutos_jugados: 30, carga_ua: 240, fecha: '2026-08-12' }
    ]
    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: '2026-08-12',
      fechaHasta: '2026-08-12',
      sesiones,
      sesionesRPE,
      rpePartidos
    })
    const entry = map.get('2026-08-12')!
    expect(entry.carga).toBe(540) // 300 + 240, ambas se conservan al no haber enlace id_partido
  })

  it('13. Carga explícita carga_ua: 0 se conserva como 0', () => {
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'S0', id_jugadora: J1, rpe: 5, duracion_min: 60, carga_ua: 0, fecha: '2026-08-13' }
    ]
    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: '2026-08-13',
      fechaHasta: '2026-08-13',
      sesiones: [],
      sesionesRPE,
      rpePartidos: []
    })
    const entry = map.get('2026-08-13')!
    expect(entry.tieneDato).toBe(true)
    expect(entry.carga).toBe(0)
  })

  it('14. Carga explícita distinta de rpe × duración tiene prioridad cuando es válida', () => {
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'S_CUSTOM', id_jugadora: J1, rpe: 10, duracion_min: 100, carga_ua: 750, fecha: '2026-08-14' }
    ]
    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: '2026-08-14',
      fechaHasta: '2026-08-14',
      sesiones: [],
      sesionesRPE,
      rpePartidos: []
    })
    const entry = map.get('2026-08-14')!
    expect(entry.carga).toBe(750) // 750 explicit UA takes precedence over 10*100=1000
    expect(entry.detalles[0].esCargaExplicita).toBe(true)
  })
})
