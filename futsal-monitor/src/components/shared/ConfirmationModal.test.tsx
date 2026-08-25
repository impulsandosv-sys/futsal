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

  it('2. Sin prop requireReason, bloquea confirmación con campo vacío o espacios', () => {
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

  it('3. Con requireReason={true}, bloquea vacío, espacios y saltos de línea', () => {
    const onConfirmSpy = vi.fn()
    render(
      <ConfirmationModal
        open={true}
        requireReason={true}
        onClose={() => {}}
        onConfirm={onConfirmSpy}
        entidad="sRPE"
        valorAnterior={6}
        valorNuevo={9}
      />
    )

    const inputMotivo = screen.getByPlaceholderText(/Describa el motivo/i)
    fireEvent.change(inputMotivo, { target: { value: '   \n\n  \t  ' } })

    const btnConfirmar = screen.getByRole('button', { name: /Confirmar cambio/i })
    fireEvent.click(btnConfirmar)

    expect(onConfirmSpy).not.toHaveBeenCalled()
    expect(screen.getByText(/El motivo es obligatorio/i)).toBeInTheDocument()
  })

  it('4. Con requireReason={false}, confirma con motivo vacío y no muestra error', () => {
    const onConfirmSpy = vi.fn()
    render(
      <ConfirmationModal
        open={true}
        requireReason={false}
        onClose={() => {}}
        onConfirm={onConfirmSpy}
        entidad="alerta"
        valorAnterior="abierta"
        valorNuevo="resuelta"
      />
    )

    expect(screen.queryByText(/El motivo es obligatorio/i)).not.toBeInTheDocument()
    const btnConfirmar = screen.getByRole('button', { name: /Confirmar cambio/i })
    fireEvent.click(btnConfirmar)

    expect(onConfirmSpy).toHaveBeenCalledWith('')
  })

  it('5. Con requireReason={false}, la UI indica claramente que es opcional', () => {
    render(
      <ConfirmationModal
        open={true}
        requireReason={false}
        onClose={() => {}}
        onConfirm={() => {}}
        entidad="alerta"
        valorAnterior="abierta"
        valorNuevo="resuelta"
      />
    )

    expect(screen.getByText(/Motivo o nota \(opcional\)/i)).toBeInTheDocument()
    expect(screen.queryByText(/\* Obligatorio/i)).not.toBeInTheDocument()
    expect(screen.getByText(/^Opcional$/i)).toBeInTheDocument()
  })

  it('6. Con requireReason={false}, transmite el motivo recortado si se escribe una nota', () => {
    const onConfirmSpy = vi.fn()
    render(
      <ConfirmationModal
        open={true}
        requireReason={false}
        onClose={() => {}}
        onConfirm={onConfirmSpy}
        entidad="alerta"
        valorAnterior="abierta"
        valorNuevo="resuelta"
      />
    )

    const inputMotivo = screen.getByRole('textbox')
    fireEvent.change(inputMotivo, { target: { value: '   Nota de staff   ' } })

    const btnConfirmar = screen.getByRole('button', { name: /Confirmar cambio/i })
    fireEvent.click(btnConfirmar)

    expect(onConfirmSpy).toHaveBeenCalledWith('Nota de staff')
  })

  it('7. Confirma exitosamente y transmite el motivo recortado cuando es válido con requireReason={true}', () => {
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

  it('8. Pulsar Cancelar llama a onClose sin ejecutar onConfirm', () => {
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

  it('9. Pulsar la tecla Escape llama a onClose sin ejecutar onConfirm', () => {
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

  it('10. Flujo no relacionado que usa ConfirmationModal (por defecto) mantiene motivo obligatorio', () => {
    const onConfirmSpy = vi.fn()
    render(
      <ConfirmationModal
        open={true}
        onClose={() => {}}
        onConfirm={onConfirmSpy}
        entidad="RPE"
        valorAnterior={7}
        valorNuevo={9}
      />
    )

    expect(screen.getByText(/\* Obligatorio/i)).toBeInTheDocument()
    const btnConfirmar = screen.getByRole('button', { name: /Confirmar cambio/i })
    fireEvent.click(btnConfirmar)

    expect(onConfirmSpy).not.toHaveBeenCalled()
    expect(screen.getByText(/El motivo es obligatorio/i)).toBeInTheDocument()
  })
})
