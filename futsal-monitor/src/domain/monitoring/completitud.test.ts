import { describe, it, expect } from 'vitest'
import { esSesionRPECompleta, calcularCompletitudSesion, calcularCompletitudSemana } from './monitoring'
import type { Jugadora, Sesion, SesionRPE } from '@/types'

describe('BLOQUE D — Completitud de sesiones y semanas (completitud.test.ts)', () => {
  it('1. completa + RPE y duración válidos: completo (true)', () => {
    const rpe: SesionRPE = {
      id_sesion: 'S1',
      id_jugadora: 'J1',
      fecha: '2026-08-01',
      asistencia: 'completa',
      rpe: 7,
      duracion_min: 60
    }
    expect(esSesionRPECompleta(rpe)).toBe(true)
  })

  it('2. parcial + RPE y duración válidos: completo (true)', () => {
    const rpe: SesionRPE = {
      id_sesion: 'S1',
      id_jugadora: 'J1',
      fecha: '2026-08-01',
      asistencia: 'parcial',
      rpe: 5,
      duracion_min: 30
    }
    expect(esSesionRPECompleta(rpe)).toBe(true)
  })

  it('3. parcial sin RPE: incompleto (false)', () => {
    const rpe: SesionRPE = {
      id_sesion: 'S1',
      id_jugadora: 'J1',
      fecha: '2026-08-01',
      asistencia: 'parcial',
      rpe: null,
      duracion_min: 30
    }
    expect(esSesionRPECompleta(rpe)).toBe(false)
  })

  it('4. ausente: completo como asistencia, sin carga (true)', () => {
    const rpe: SesionRPE = {
      id_sesion: 'S1',
      id_jugadora: 'J1',
      fecha: '2026-08-01',
      asistencia: 'ausente',
      rpe: null,
      duracion_min: null
    }
    expect(esSesionRPECompleta(rpe)).toBe(true)
  })

  it('5. no_convocada: completo como asistencia, sin carga (true)', () => {
    const rpe: SesionRPE = {
      id_sesion: 'S1',
      id_jugadora: 'J1',
      fecha: '2026-08-01',
      asistencia: 'no_convocada'
    }
    expect(esSesionRPECompleta(rpe)).toBe(true)
  })

  it('6. excusada: completo como asistencia, sin carga (true)', () => {
    const rpe: SesionRPE = {
      id_sesion: 'S1',
      id_jugadora: 'J1',
      fecha: '2026-08-01',
      asistencia: 'excusada'
    }
    expect(esSesionRPECompleta(rpe)).toBe(true)
  })

  it('7. sin_registrar: incompleto (false)', () => {
    const rpe: SesionRPE = {
      id_sesion: 'S1',
      id_jugadora: 'J1',
      fecha: '2026-08-01',
      asistencia: 'sin_registrar'
    }
    expect(esSesionRPECompleta(rpe)).toBe(false)
  })

  it('8. legado sin asistencia con RPE y duración: completo (true)', () => {
    const rpe: SesionRPE = {
      id_sesion: 'S1',
      id_jugadora: 'J1',
      fecha: '2026-08-01',
      rpe: 6,
      duracion_min: 45
    }
    expect(esSesionRPECompleta(rpe)).toBe(true)
  })

  it('9. legado sin asistencia sin RPE o duración: incompleto (false)', () => {
    const rpe: SesionRPE = {
      id_sesion: 'S1',
      id_jugadora: 'J1',
      fecha: '2026-08-01',
      rpe: null,
      duracion_min: 45
    }
    expect(esSesionRPECompleta(rpe)).toBe(false)
  })

  it('10. calcularCompletitudSemana con combinación de estados', () => {
    const jugadoras: Jugadora[] = [
      { id_jugadora: 'J1', nombre: 'Ana', fecha_nacimiento: '2000-01-01', posicion: 'Ala', altura_cm: 165, peso_kg: 55, imc: 20, grasa: 15, anos_experiencia_futsal: 5, historial_lesional: '', notas: '', activa: true },
      { id_jugadora: 'J2', nombre: 'Bea', fecha_nacimiento: '2000-01-01', posicion: 'Pivot', altura_cm: 170, peso_kg: 60, imc: 20, grasa: 15, anos_experiencia_futsal: 5, historial_lesional: '', notas: '', activa: true }
    ]
    const sesiones: Sesion[] = [
      { id_sesion: 'S1', fecha: '2026-08-01', tipo_dia: 'Entreno', tipo_sesion: 'Fisico', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const rpeSesiones: SesionRPE[] = [
      { id_sesion: 'S1', id_jugadora: 'J1', asistencia: 'completa', rpe: 7, duracion_min: 60, fecha: '2026-08-01' },
      { id_sesion: 'S1', id_jugadora: 'J2', asistencia: 'ausente', fecha: '2026-08-01' }
    ]

    // Ambos están completados (uno asistió, otro estuvo ausente registrado) -> 100% completitud
    const pct = calcularCompletitudSemana(jugadoras, sesiones, rpeSesiones)
    expect(pct).toBe(100)
  })

  it('11. calcularCompletitudSesion con jugadora sin registrar', () => {
    const jugadoras: Jugadora[] = [
      { id_jugadora: 'J1', nombre: 'Ana', fecha_nacimiento: '2000-01-01', posicion: 'Ala', altura_cm: 165, peso_kg: 55, imc: 20, grasa: 15, anos_experiencia_futsal: 5, historial_lesional: '', notas: '', activa: true },
      { id_jugadora: 'J2', nombre: 'Bea', fecha_nacimiento: '2000-01-01', posicion: 'Pivot', altura_cm: 170, peso_kg: 60, imc: 20, grasa: 15, anos_experiencia_futsal: 5, historial_lesional: '', notas: '', activa: true }
    ]
    const rpeSesiones: SesionRPE[] = [
      { id_sesion: 'S1', id_jugadora: 'J1', asistencia: 'completa', rpe: 7, duracion_min: 60, fecha: '2026-08-01' },
      { id_sesion: 'S1', id_jugadora: 'J2', asistencia: 'sin_registrar', fecha: '2026-08-01' }
    ]

    // 1 de 2 completas -> 50% completitud
    const pct = calcularCompletitudSesion(jugadoras, rpeSesiones)
    expect(pct).toBe(50)
  })
})
