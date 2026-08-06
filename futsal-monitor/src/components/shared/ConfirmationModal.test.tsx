import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmationModal } from './ConfirmationModal'

describe('ConfirmationModal Component (src/components/shared/ConfirmationModal.tsx)', () => {
  it('1. Renderiza valor anterior y valor nuevo cuando open es true', () => {
    render(
      <ConfirmationModal
        open={true}
        onClose={() => {}}
        onConfirm={() => {}}
        entidad="sRPE"
        valorAnterior={6}
        valorNuevo={9}
      />
    )

    expect(screen.getByText('Confirmación de cambio crítico')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
  })

  it('2. Bloquea confirmación si el motivo está vacío o solo contiene espacios', () => {
    const onConfirmSpy = vi.fn()
    render(
      <ConfirmationModal
        open={true}
        onClose={() => {}}
        onConfirm={onConfirmSpy}
        entidad="sRPE"
        valorAnterior={6}
        valorNuevo={9}
      />
    )

    const btnConfirmar = screen.getByRole('button', { name: /Confirmar cambio/i })
    fireEvent.click(btnConfirmar)

    expect(onConfirmSpy).not.toHaveBeenCalled()
    expect(screen.getByText(/El motivo es obligatorio/i)).toBeInTheDocument()
  })

  it('3. Confirma exitosamente y transmite el motivo recortado cuando es válido', () => {
    const onConfirmSpy = vi.fn()
    render(
      <ConfirmationModal
        open={true}
        onClose={() => {}}
        onConfirm={onConfirmSpy}
        entidad="wellness"
        valorAnterior={3}
        valorNuevo={8}
      />
    )

    const inputMotivo = screen.getByPlaceholderText(/Describa el motivo/i)
    fireEvent.change(inputMotivo, { target: { value: '  Corrección de error de usuario  ' } })

    const btnConfirmar = screen.getByRole('button', { name: /Confirmar cambio/i })
    fireEvent.click(btnConfirmar)

    expect(onConfirmSpy).toHaveBeenCalledWith('Corrección de error de usuario')
  })

  it('4. Pulsar Cancelar llama a onClose sin ejecutar onConfirm', () => {
    const onCloseSpy = vi.fn()
    const onConfirmSpy = vi.fn()
    render(
      <ConfirmationModal
        open={true}
        onClose={onCloseSpy}
        onConfirm={onConfirmSpy}
        entidad="alerta"
        valorAnterior="abierta"
        valorNuevo="resuelta"
      />
    )

    const btnCancelar = screen.getByRole('button', { name: /Cancelar/i })
    fireEvent.click(btnCancelar)

    expect(onCloseSpy).toHaveBeenCalled()
    expect(onConfirmSpy).not.toHaveBeenCalled()
  })

  it('5. Pulsar la tecla Escape llama a onClose sin ejecutar onConfirm', () => {
    const onCloseSpy = vi.fn()
    const onConfirmSpy = vi.fn()
    render(
      <ConfirmationModal
        open={true}
        onClose={onCloseSpy}
        onConfirm={onConfirmSpy}
        entidad="test_cmj"
        valorAnterior={35}
        valorNuevo={null}
      />
    )

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onCloseSpy).toHaveBeenCalled()
    expect(onConfirmSpy).not.toHaveBeenCalled()
  })
})
