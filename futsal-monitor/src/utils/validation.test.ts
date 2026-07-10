import { describe, it, expect } from 'vitest'

import type { Jugadora } from '@/types'

import { validateIdUnico, validateRange, validateJugadora } from '@/utils/validation'

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
    expect(result?.message).toContain('solo contener letras')
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

  it('funciona con valores válidos', () => {
    const result = validateJugadora(defaultPlayer, [])
    expect(result.length).toBe(0)
  })

  it('retorna error para ID duplicado', () => {
    const result = validateJugadora(defaultPlayer, ['J01', 'J02'])
    expect(result.some(e => e.message.includes('ya existe'))).toBe(true)
  })
})