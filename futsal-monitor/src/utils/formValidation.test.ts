import { describe, it, expect } from 'vitest'
import { evaluarEstadoCampo, obtenerClasesVisualesCampo } from './formValidation'
import { getTodayLocalISO } from '@/domain/dates/dates'

describe('Form Validation Helper (formValidation.ts)', () => {
  it('1. Campo obligatorio vacío retorna estado pendiente con borde amarillo y mensaje Requerido', () => {
    const res = evaluarEstadoCampo('', { required: true })
    expect(res.estado).toBe('pendiente')
    expect(res.mensaje).toBe('Requerido')

    const visual = obtenerClasesVisualesCampo(res)
    expect(visual.inputClasses).toContain('border-amber-400')
    expect(visual.messageText).toBe('Requerido')
  })

  it('2. RPE fuera de rango (11 > 10) retorna estado invalid con mensaje de error específico', () => {
    const res = evaluarEstadoCampo(11, { required: true, min: 0, max: 10 })
    expect(res.estado).toBe('invalid')
    expect(res.mensaje).toBe('El valor máximo permitido es 10')

    const visual = obtenerClasesVisualesCampo(res)
    expect(visual.inputClasses).toContain('border-rose-500')
    expect(visual.messageText).toBe('El valor máximo permitido es 10')
  })

  it('3. RPE válido (8) retorna estado valid con borde verde', () => {
    const res = evaluarEstadoCampo(8, { required: true, min: 0, max: 10 })
    expect(res.estado).toBe('valid')
    expect(res.mensaje).toBeNull()

    const visual = obtenerClasesVisualesCampo(res)
    expect(visual.inputClasses).toContain('border-emerald-500')
    expect(visual.messageText).toBeUndefined()
  })

  it('4. Fecha futura sin allowFutureDate retorna estado invalid con mensaje La fecha no puede ser futura', () => {
    const res = evaluarEstadoCampo('2099-01-01', { required: true, isDate: true, allowFutureDate: false })
    expect(res.estado).toBe('invalid')
    expect(res.mensaje).toBe('La fecha no puede ser futura')
  })

  it('5. Fecha de hoy o pasada con isDate retorna estado valid', () => {
    const hoyStr = getTodayLocalISO()
    const res = evaluarEstadoCampo(hoyStr, { required: true, isDate: true, allowFutureDate: false })
    expect(res.estado).toBe('valid')
    expect(res.mensaje).toBeNull()
  })
})
