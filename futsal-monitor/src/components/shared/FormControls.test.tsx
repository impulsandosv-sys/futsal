import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { Filters } from './Filters'

describe('FormControls & Visual Contrast — Controles de formulario de alto contraste', () => {
  it('1. Renderiza los controles de Filters con clases de alto contraste', () => {
    render(<Filters showPlayer showDate showWeek showSessionType showStatus />)

    const playerSelect = screen.getByRole('combobox', { name: /seleccionar jugadora/i })
    expect(playerSelect.className).toContain('text-surface-900')
    expect(playerSelect.className).toContain('dark:text-surface-50')

    const dateDesde = screen.getByPlaceholderText('Desde')
    expect(dateDesde.className).toContain('text-surface-900')
    expect(dateDesde.className).toContain('placeholder-surface-500')
  })
})
