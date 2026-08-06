import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DatePicker } from './DatePicker'
import { getTodayLocalISO } from '@/domain/dates/dates'

describe('DatePicker Component (src/components/shared/DatePicker.tsx)', () => {
  it('1. Renderiza correctamente con una fecha válida (de hoy)', () => {
    const hoyStr = getTodayLocalISO()
    render(<DatePicker value={hoyStr} onChange={() => {}} label="Fecha de sesión" />)

    const input = screen.getByLabelText(/Fecha de sesión/i) as HTMLInputElement
    expect(input.value).toBe(hoyStr)
    expect(input.className).toContain('border-emerald-500')
    expect(screen.queryByText(/Requerido|futura/i)).not.toBeInTheDocument()
  })

  it('2. Muestra estado pendiente (borde amarillo + Requerido) si es obligatorio y está vacío', () => {
    render(<DatePicker value="" onChange={() => {}} label="Fecha requerida" required={true} />)

    const input = screen.getByLabelText(/Fecha requerida/i) as HTMLInputElement
    expect(input.className).toContain('border-amber-400')
    expect(screen.getByText('Requerido')).toBeInTheDocument()
  })

  it('3. Muestra error de fecha futura si allowFuture es false (borde rojo + La fecha no puede ser futura)', () => {
    render(<DatePicker value="2099-01-01" onChange={() => {}} label="Fecha futura" allowFuture={false} />)

    const input = screen.getByLabelText(/Fecha futura/i) as HTMLInputElement
    expect(input.className).toContain('border-rose-500')
    expect(screen.getByText('La fecha no puede ser futura')).toBeInTheDocument()
  })

  it('4. Permite fecha futura si allowFuture es true', () => {
    render(<DatePicker value="2099-01-01" onChange={() => {}} label="Fecha planificada" allowFuture={true} />)

    const input = screen.getByLabelText(/Fecha planificada/i) as HTMLInputElement
    expect(input.className).toContain('border-emerald-500')
    expect(screen.queryByText('La fecha no puede ser futura')).not.toBeInTheDocument()
  })

  it('5. Llama a onChange cuando el usuario selecciona una fecha', () => {
    const fn = vi.fn()
    render(<DatePicker value="2026-08-01" onChange={fn} label="Fecha selec" />)

    const input = screen.getByLabelText(/Fecha selec/i)
    fireEvent.change(input, { target: { value: '2026-08-05' } })

    expect(fn).toHaveBeenCalledWith('2026-08-05')
  })
})
