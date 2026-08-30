import { describe, it, expect } from 'vitest'

import type { Jugadora, SesionRPE } from '@/types'

import { validateIdUnico, validateRange, validateJugadora, validateSesionRPE, validateWellness } from '@/utils/validation'

describe('validateIdUnico', () => {
  it('retorna error para id vacío', () => {
    const result = validateIdUnico('', [])
    expect(result).not.toBeNull()
    expect(result?.field).toBe('id')
  })

  it('retorna error para longitud < 2', () => {
    const result = validateIdUnico('A', [])
    expect(result).not.toBeNull()
    expect(result?.message).toContain('2 y 10 caracteres')
  })

  it('retorna error para longitud > 10', () => {
    const result = validateIdUnico('A'.repeat(11), [])
    expect(result).not.toBeNull()
    expect(result?.message).toContain('2 y 10 caracteres')
  })

  it('retorna error por caracteres inválidos', () => {
    const result = validateIdUnico('A@', [])
    expect(result).not.toBeNull()
    expect(result?.message).toContain('solo puede contener')
  })

  it('retorna error por ID duplicado', () => {
    const result = validateIdUnico('EXISTENTE', ['EXISTENTE', 'OTRO'])
    expect(result).not.toBeNull()
    expect(result?.message).toContain('ya existe')
  })

  it('funciona con valores válidos', () => {
    const result = validateIdUnico('VALID01', ['OTRO'])
    expect(result).toBeNull()
  })
})

describe('validateRange', () => {
  it('retorna error para valor NaN', () => {
    const result = validateRange(NaN, 0, 10, 'test')
    expect(result).not.toBeNull()
    expect(result?.field).toBe('test')
  })

  it('retorna error para valor menor que mínimo', () => {
    const result = validateRange(-1, 0, 10, 'test')
    expect(result).not.toBeNull()
  })

  it('retorna error para valor mayor que máximo', () => {
    const result = validateRange(11, 0, 10, 'test')
    expect(result).not.toBeNull()
  })

  it('funciona con valores válidos dentro del rango', () => {
    const result = validateRange(5, 0, 10, 'test')
    expect(result).toBeNull()
  })

  it('funciona con valores válidos en límites', () => {
    const result = validateRange(0, 0, 10, 'test')
    expect(result).toBeNull()
    const result2 = validateRange(10, 0, 10, 'test')
    expect(result2).toBeNull()
  })
})

describe('validateJugadora', () => {
  const defaultPlayer: Jugadora = {
    id_jugadora: 'J01',
    nombre: 'Test Player',
    fecha_nacimiento: '1990-01-01',
    posicion: 'Portera',
    altura_cm: 175,
    peso_kg: 70,
    imc: 22.5,
    grasa: 15,
    anos_experiencia_futsal: 5,
    historial_lesional: '',
    notas: '',
    activa: true,
  }

  it('retorna error para nombre vacío', () => {
    const player = { ...defaultPlayer, nombre: '' }
    const result = validateJugadora(player, [])
    expect(result.length).toBeGreaterThan(0)
    expect(result.some(e => e.field === 'nombre')).toBe(true)
  })

  it('retorna error para altura fuera de rango', () => {
    const player = { ...defaultPlayer, altura_cm: 250 }
    const result = validateJugadora(player, [])
    expect(result.some(e => e.field === 'altura_cm')).toBe(true)
  })

  it('retorna error para peso fuera de rango', () => {
    const player = { ...defaultPlayer, peso_kg: 150 }
    const result = validateJugadora(player, [])
    expect(result.some(e => e.field === 'peso_kg')).toBe(true)
  })

  it('retorna error para grasa fuera de rango', () => {
    const player = { ...defaultPlayer, grasa: 60 }
    const result = validateJugadora(player, [])
    expect(result.some(e => e.field === 'grasa')).toBe(true)
  })

  it('retorna error para edad fuera de rango', () => {
    const player = { ...defaultPlayer, anos_experiencia_futsal: 50 }
    const result = validateJugadora(player, [])
    expect(result.some(e => e.field === 'anos_experiencia_futsal')).toBe(true)
  })

  it('funciona con valores v\u00e1lidos', () => {
    const result = validateJugadora(defaultPlayer, [])
    expect(result.length).toBe(0)
  })

  it('retorna error para ID duplicado', () => {
    const result = validateJugadora(defaultPlayer, ['J01', 'J02'])
    expect(result.some(e => e.message.includes('ya existe'))).toBe(true)
  })
})

describe('validateSesionRPE', () => {
  const validInput: SesionRPE = {
    id_sesion: 'SES01',
    id_jugadora: 'J01',
    rpe: 7,
    duracion_min: 60,
    fecha: '2026-01-15',
    carga_ua: 420,
  }

  it('retorna error para id_sesion vac\u00edo', () => {
    const input = { ...validInput, id_sesion: '' }
    const result = validateSesionRPE(input)
    expect(result.some(e => e.field === 'id_sesion')).toBe(true)
  })

  it('retorna error para id_jugadora vac\u00edo', () => {
    const input = { ...validInput, id_jugadora: '' }
    const result = validateSesionRPE(input)
    expect(result.some(e => e.field === 'id_jugadora')).toBe(true)
  })

  it('retorna error para rpe fuera de rango (menor a 1)', () => {
    const input = { ...validInput, rpe: 0 }
    const result = validateSesionRPE(input)
    expect(result.some(e => e.field === 'rpe')).toBe(true)
  })

  it('retorna error para rpe fuera de rango (mayor a 10)', () => {
    const input = { ...validInput, rpe: 11 }
    const result = validateSesionRPE(input)
    expect(result.some(e => e.field === 'rpe')).toBe(true)
  })

  it('retorna error para duracion_min < 0', () => {
    const input = { ...validInput, duracion_min: -1 }
    const result = validateSesionRPE(input)
    expect(result.some(e => e.field === 'duracion_min')).toBe(true)
  })

  it('retorna error para fecha vac\u00eda', () => {
    const input = { ...validInput, fecha: '' }
    const result = validateSesionRPE(input)
    expect(result.some(e => e.field === 'fecha')).toBe(true)
  })

  it('funciona con entrada v\u00e1lida', () => {
    const result = validateSesionRPE(validInput)
    expect(result.length).toBe(0)
  })
})

describe('validateWellness', () => {
  const validInput = {
    id_jugadora: 'J01',
    fecha: '2026-07-13',
    calidad_sueno: 8,
    fatiga: 5,
    dolor_muscular: 4,
    estres: 3,
    estado_animo: 7,
    dolor_especifico: '',
  }

  it('funciona con entrada válida', () => {
    const result = validateWellness(validInput)
    expect(result.length).toBe(0)
  })

  it('permite valores nulos/vacíos (no respondidos)', () => {
    const result = validateWellness({
      ...validInput,
      calidad_sueno: null as any,
      fatiga: undefined as any,
      dolor_muscular: '' as any,
    })
    expect(result.length).toBe(0)
  })

  it('retorna error para jugadora vacía', () => {
    const result = validateWellness({ ...validInput, id_jugadora: '' })
    expect(result.some(e => e.field === 'id_jugadora')).toBe(true)
  })

  it('retorna error para fecha vacía', () => {
    const result = validateWellness({ ...validInput, fecha: '' })
    expect(result.some(e => e.field === 'fecha')).toBe(true)
  })

  it('retorna error si un valor respondido está fuera de rango 1-10', () => {
    const result = validateWellness({ ...validInput, calidad_sueno: 11 })
    expect(result.some(e => e.field === 'calidad_sueno')).toBe(true)
  })

  it('retorna error si un valor respondido no es entero', () => {
    const result = validateWellness({ ...validInput, fatiga: 5.5 })
    expect(result.some(e => e.field === 'fatiga')).toBe(true)
  })
})

import { validateSesion, inferirParticipacionPartido, validateRPE_Partido } from '@/utils/validation'
import type { Sesion, RPE_Partido } from '@/types'

describe('validateSesion (regresiones)', () => {
  it('Sesión sin id_sesion rechazada', () => {
    const s: Sesion = { id_sesion: '', fecha: '2026-08-01', tipo_sesion: 'Gimnasio', estado: 'completada' }
    const result = validateSesion(s)
    expect(result.some(e => e.field === 'id_sesion')).toBe(true)
  })
  it('Sesión sin fecha rechazada', () => {
    const s: Sesion = { id_sesion: 'S1', fecha: '', tipo_sesion: 'Gimnasio', estado: 'completada' }
    const result = validateSesion(s)
    expect(result.some(e => e.field === 'fecha')).toBe(true)
  })
})

describe('inferirParticipacionPartido y validateRPE_Partido (regresiones)', () => {
  it('0 minutos no infiere convocada_sin_minutos', () => {
    const rpe: RPE_Partido = { id: 1, id_partido: 'P1', id_jugadora: 'J1', minutos_jugados: 0 }
    inferirParticipacionPartido(rpe)
    expect(rpe.participacion).toBeUndefined()
  })

  it('Estados de 0 minutos rechazan null y minutos_jugados distintos a 0', () => {
    const result = validateRPE_Partido({ id_partido: 'P1', id_jugadora: 'J1', participacion: 'no_convocada' } as any)
    expect(result.some(e => e.field === 'minutos_jugados')).toBe(true)

    const result2 = validateRPE_Partido({ id_partido: 'P1', id_jugadora: 'J1', participacion: 'convocada_sin_minutos', minutos_jugados: 10 } as any)
    expect(result2.some(e => e.field === 'minutos_jugados')).toBe(true)
  })

  it('Modificada con 40 minutos rechazada', () => {
    const result = validateRPE_Partido({ id_partido: 'P1', id_jugadora: 'J1', participacion: 'modificada', minutos_jugados: 40, rpe: 5, motivo_participacion_reducida: 'golpe' } as any)
    expect(result.some(e => e.field === 'minutos_jugados')).toBe(true)
  })

  it('Modificada con 0 minutos y RPE presente rechazada', () => {
    const result = validateRPE_Partido({ id_partido: 'P1', id_jugadora: 'J1', participacion: 'modificada', minutos_jugados: 0, rpe: 5, motivo_participacion_reducida: 'golpe' } as any)
    expect(result.some(e => e.field === 'rpe')).toBe(true)
  })
})