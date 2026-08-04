import { describe, it, expect } from 'vitest'
import {
  getWellnessLevel,
  getLoadStatus,
  calcularReadinessDiaria,
  calcularPrioridadRevision,
  calcularEdad,
  calcularCargaDiariaUltimosDias,
  calcularResumenEquipoSemanal,
  calcularResumenSemanal,
  calcularCompletitudSesion,
  calcularCompletitudSemana
} from './monitoring'
import type { Jugadora, Wellness, ResumenSemanal, SesionRPE, RPE_Partido, Sesion } from '@/types'

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

describe('calcularReadinessDiaria', () => {
  const input = {
    id_jugadora: 'test-jugadora',
    fecha: '2025-01-15',
    wellness: null,
    acwr: 1.4,
    cargaAguda: 120,
    cargaCronica: 100,
    diasDesdeWellness: 2,
    creada: '2025-01-15T12:00:00Z'
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
})

describe('calcularEdad', () => {
  it('calculates correct age from birthdate', () => {
    expect(calcularEdad('2000-01-01', '2026-01-01')).toBe(26)
    expect(calcularEdad('2000-07-01', '2026-01-01')).toBe(25)
  })

  it('returns null for empty date', () => {
    expect(calcularEdad('', '2026-01-01')).toBeNull()
  })
})

describe('calcularCargaDiariaUltimosDias', () => {
  it('correctly aggregates loads chronologically', () => {
    const rpe: SesionRPE[] = [
      { id_jugadora: 'J1', id_sesion: 'S1', fecha: '2026-07-13', rpe: 5, duracion_min: 60, carga_ua: 300 },
      { id_jugadora: 'J1', id_sesion: 'S2', fecha: '2026-07-14', rpe: 6, duracion_min: 50, carga_ua: 300 }
    ]
    const partido: RPE_Partido[] = [
      { id_jugadora: 'J1', id_partido: 'P1', fecha: '2026-07-14', minutos_jugados: 30, rpe: 8, carga_ua: 240 }
    ]
    const res = calcularCargaDiariaUltimosDias(rpe, partido, 3, '2026-07-15')
    expect(res).toEqual([
      { fecha: '07-13', carga: 300 },
      { fecha: '07-14', carga: 540 },
      { fecha: '07-15', carga: 0 }
    ])
  })
})

describe('calcularResumenEquipoSemanal', () => {
  it('calculates weekly averages correctly', () => {
    const rsList: ResumenSemanal[] = [
      { semana: '2026-07-13', id_jugadora: 'J1', carga_entreno: 300, carga_partido: 0, carga_total: 300, carga_cronica: 300, acwr: 1.0, estado: 'normal', num_sesiones: 1, wellness_medio: 7.0 },
      { semana: '2026-07-13', id_jugadora: 'J2', carga_entreno: 500, carga_partido: 200, carga_total: 700, carga_cronica: 500, acwr: 1.4, estado: 'elevado', num_sesiones: 2, wellness_medio: 6.0 }
    ]
    const res = calcularResumenEquipoSemanal(rsList)
    expect(res).toEqual({
      carga_total: 1000,
      carga_media: 500,
      acwr_medio: 1.2,
      wellness_medio: 6.5,
      con_datos: 2,
      prioritarias: 0,
      elevado: 1
    })
  })
})

describe('calcularPrioridadRevision', () => {
  const mockJugadora: Jugadora = {
    id_jugadora: 'J001', nombre: 'Test', fecha_nacimiento: '2000-01-01', posicion: 'Ala',
    altura_cm: 170, peso_kg: 60, imc: 20, grasa: 20, anos_experiencia_futsal: 5, historial_lesional: '', notas: '', activa: true
  }

  it('debería retornar prioridad rutinario para datos normales', () => {
    const normalWellness: Wellness[] = [
      { id_jugadora: 'J001', fecha: '2026-07-13', calidad_sueno: 8, fatiga: 8, dolor_muscular: 8, estres: 8, estado_animo: 8, dolor_specific: '', score_wellness: 8.0 } as any
    ]
    const result = calcularPrioridadRevision(mockJugadora, normalWellness, [], [], '2026-07-13')
    expect(result.prioridad).toBe('rutinario')
  })
})

describe('calcularResumenSemanal con filtros y deduplicación', () => {
  const mockJugadoras: Jugadora[] = [
    { id_jugadora: 'J1', nombre: 'P1', fecha_nacimiento: '2000-01-01', posicion: 'Ala', altura_cm: 170, peso_kg: 60, imc: 20, grasa: 20, anos_experiencia_futsal: 5, historial_lesional: '', notas: '', activa: true },
    { id_jugadora: 'J2', nombre: 'P2', fecha_nacimiento: '2000-01-01', posicion: 'Ala', altura_cm: 170, peso_kg: 60, imc: 20, grasa: 20, anos_experiencia_futsal: 5, historial_lesional: '', notas: '', activa: true }
  ]

  const sesiones: Sesion[] = [
    { id_sesion: 'S1', fecha: '2026-07-13', tipo_dia: 'Entreno', tipo_sesion: 'Fisico', duracion_min: 60, objetivo_principal: '', observaciones_grupo: '' },
    { id_sesion: 'S2', fecha: '2026-07-14', tipo_dia: 'Entreno', tipo_sesion: 'Gimnasio', duracion_min: 45, objetivo_principal: '', observaciones_grupo: '' },
    { id_sesion: 'S3', fecha: '2026-07-15', tipo_dia: 'Entreno', tipo_sesion: 'Readaptacion', duracion_min: 30, objetivo_principal: '', observaciones_grupo: '' }
  ]

  const rpes: SesionRPE[] = [
    { id_sesion: 'S1', id_jugadora: 'J1', rpe: 7, duracion_min: 60, carga_ua: 420, fecha: '2026-07-13' },
    { id_sesion: 'S2', id_jugadora: 'J1', rpe: 5, duracion_min: 45, carga_ua: 225, fecha: '2026-07-14' },
    // Duplicate registration for S1: should be skipped
    { id_sesion: 'S1', id_jugadora: 'J1', rpe: 9, duracion_min: 60, carga_ua: 540, fecha: '2026-07-13' },
    { id_sesion: 'S3', id_jugadora: 'J1', rpe: 4, duracion_min: 30, carga_ua: 120, fecha: '2026-07-15' }
  ]

  const rpePartidos: RPE_Partido[] = [
    { id_partido: 'P1', id_jugadora: 'J1', minutos_jugados: 30, rpe: 8, carga_ua: 240, fecha: '2026-07-16' }
  ]

  it('debería calcular la carga total sumando todo si no hay filtros restrictivos y deduplicando S1', () => {
    // S1 (420) + S2 (225) + S3 (120) + P1 (240) = 1005 UA
    const res = calcularResumenSemanal('J1', '2026-07-13', sesiones, [], rpes, rpePartidos, [], [])
    expect(res.carga_total).toBe(1005)
    expect(res.num_sesiones).toBe(3) // S1, S2, S3
  })

  it('debería excluir Gimnasio si incluirGimnasio es false', () => {
    // S1 (420) + S3 (120) + P1 (240) = 780 UA
    const res = calcularResumenSemanal('J1', '2026-07-13', sesiones, [], rpes, rpePartidos, [], [], { incluirGimnasio: false })
    expect(res.carga_total).toBe(780)
  })

  it('debería excluir Readaptación si incluirReadaptacion es false', () => {
    // S1 (420) + S2 (225) + P1 (240) = 885 UA
    const res = calcularResumenSemanal('J1', '2026-07-13', sesiones, [], rpes, rpePartidos, [], [], { incluirReadaptacion: false })
    expect(res.carga_total).toBe(885)
  })

  it('debería excluir Partidos si incluirPartidos es false', () => {
    // S1 (420) + S2 (225) + S3 (120) = 765 UA
    const res = calcularResumenSemanal('J1', '2026-07-13', sesiones, [], rpes, rpePartidos, [], [], { incluirPartidos: false })
    expect(res.carga_total).toBe(765)
  })

  it('debería calcular correctamente la completitud de sesión y semana', () => {
    // Para S1, J1 tiene RPE válido, J2 no tiene RPE
    // Completitud S1 = 1 / 2 = 50%
    const rpesS1 = rpes.filter(r => r.id_sesion === 'S1')
    expect(calcularCompletitudSesion(mockJugadoras, rpesS1)).toBe(50)

    // Completitud semanal (esperado 2 jugadoras * 3 sesiones = 6 registros, válidos = 3 de J1)
    // Completitud semana = 3 / 6 = 50%
    expect(calcularCompletitudSemana(mockJugadoras, sesiones, rpes)).toBe(50)
  })
})
