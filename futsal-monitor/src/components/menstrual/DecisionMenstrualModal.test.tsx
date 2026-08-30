import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { DecisionMenstrualModal } from './DecisionMenstrualModal'
import { useStore } from '@/store/store'
import type { RegistroMenstrual } from '@/types'

describe('DecisionMenstrualModal', () => {
  const mockOnClose = vi.fn()
  const jugadoraName = 'Ana Lopez'

  beforeEach(() => {
    vi.clearAllMocks()
    useStore.setState({ registros_menstruales: [], jugadoras: [] })
  })

  it('1) Carga valores iniciales persistidos y permite escribir un borrador sin perderlo ante una recarga externa', () => {
    const registroPersistido: RegistroMenstrual = {
      id: 10,
      id_jugadora: 'J-1',
      fecha_inicio: '2026-08-01',
      impacto_percibido: 3,
      accion_ajuste: 'SIN_CAMBIOS',
      nota_ajuste: 'Nota persistida inicial',
      comentario: 'Test',
      fecha_decision: '2026-08-02',
      creado_en: '2026-08-01T10:00:00Z',
      actualizado_en: '2026-08-01T10:00:00Z'
    }

    const mockUpdateRegistroMenstrual = vi.fn()
    useStore.setState({
      registros_menstruales: [registroPersistido],
      updateRegistroMenstrual: mockUpdateRegistroMenstrual
    })

    const { rerender } = render(
      <DecisionMenstrualModal
        open={true}
        onClose={mockOnClose}
        registroId={10}
        jugadoraName={jugadoraName}
      />
    )

    // Verify initial values
    const textArea = screen.getByPlaceholderText(/Opcional.*200/i) as HTMLTextAreaElement
    expect(textArea.value).toBe('Nota persistida inicial')

    // Simulate user editing the draft
    fireEvent.change(textArea, { target: { value: 'Borrador en curso...' } })
    expect(textArea.value).toBe('Borrador en curso...')

    // Simulate an external background update replacing the store array and object references
    act(() => {
      useStore.setState({
        registros_menstruales: [{ ...registroPersistido, actualizado_en: '2026-08-02T12:00:00Z' }]
      })
    })

    rerender(
      <DecisionMenstrualModal
        open={true}
        onClose={mockOnClose}
        registroId={10}
        jugadoraName={jugadoraName}
      />
    )

    // The draft MUST remain, it should not reset back to 'Nota persistida inicial'
    expect(textArea.value).toBe('Borrador en curso...')

    // Confirm that updateRegistroMenstrual is not called automatically just because of the external update
    expect(mockUpdateRegistroMenstrual).not.toHaveBeenCalled()


  })

  it('2) Si se cierra y se vuelve a abrir, recarga el valor persistido', () => {
    const registroPersistido: RegistroMenstrual = {
      id: 11,
      id_jugadora: 'J-2',
      fecha_inicio: '2026-08-01',
      impacto_percibido: 3,
      accion_ajuste: null,
      nota_ajuste: 'Anterior',
      comentario: null,
      fecha_decision: null,
      creado_en: '2026-08-01T10:00:00Z',
      actualizado_en: '2026-08-01T10:00:00Z'
    }

    useStore.setState({ registros_menstruales: [registroPersistido] })

    const { rerender } = render(
      <DecisionMenstrualModal
        open={true}
        onClose={mockOnClose}
        registroId={11}
        jugadoraName={jugadoraName}
      />
    )

    const textArea = screen.getByPlaceholderText(/Opcional.*200/i) as HTMLTextAreaElement
    expect(textArea.value).toBe('Anterior')

    // Change to draft
    fireEvent.change(textArea, { target: { value: 'Nuevo descartado' } })

    // Close modal
    rerender(
      <DecisionMenstrualModal
        open={false}
        onClose={mockOnClose}
        registroId={11}
        jugadoraName={jugadoraName}
      />
    )

    // Open modal again
    rerender(
      <DecisionMenstrualModal
        open={true}
        onClose={mockOnClose}
        registroId={11}
        jugadoraName={jugadoraName}
      />
    )

    // Should reload the persisted value
    const textAreaReopened = screen.getByPlaceholderText(/Opcional.*200/i) as HTMLTextAreaElement
    expect(textAreaReopened.value).toBe('Anterior')
  })

  it('3) Si cambia el registroId estando abierto, inicializa el nuevo registro', () => {
    const regA: RegistroMenstrual = {
      id: 20, id_jugadora: 'J-1', fecha_inicio: '2026-08-01', impacto_percibido: 3,
      accion_ajuste: null, nota_ajuste: 'Nota A', comentario: null, fecha_decision: null,
      creado_en: '', actualizado_en: ''
    }
    const regB: RegistroMenstrual = {
      id: 21, id_jugadora: 'J-2', fecha_inicio: '2026-08-05', impacto_percibido: 2,
      accion_ajuste: null, nota_ajuste: 'Nota B', comentario: null, fecha_decision: null,
      creado_en: '', actualizado_en: ''
    }

    useStore.setState({ registros_menstruales: [regA, regB] })

    const { rerender } = render(
      <DecisionMenstrualModal
        open={true}
        onClose={mockOnClose}
        registroId={20}
        jugadoraName="Ana"
      />
    )

    const textArea = screen.getByPlaceholderText(/Opcional.*200/i) as HTMLTextAreaElement
    expect(textArea.value).toBe('Nota A')

    // Change directly to B
    rerender(
      <DecisionMenstrualModal
        open={true}
        onClose={mockOnClose}
        registroId={21}
        jugadoraName="Berta"
      />
    )

    expect(textArea.value).toBe('Nota B')
  })
})
