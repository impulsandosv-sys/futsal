import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CMJFormModal } from './CMJFormModal'
import { useStore } from '@/store/store'

describe('CMJFormModal', () => {
  let onCloseMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onCloseMock = vi.fn()
    useStore.setState({
      jugadoras: [
        { id_jugadora: 'j1', nombre: 'Jugadora 1', activa: true, posicion: 'Ala', fecha_nacimiento: '', altura_cm: 0, peso_kg: 0, imc: 0, grasa: 0, anos_experiencia_futsal: 0, historial_lesional: '', notas: '' }
      ],
      protocolos_cmj: [
        { id_protocolo: 'p1', nombre: 'Prot 1', activo: true, createdAt: '', updatedAt: '' },
        { id_protocolo: 'p2', nombre: 'Prot 2', activo: true, createdAt: '', updatedAt: '' }
      ],
      pruebas_cmj: [],
      addPruebaCMJ: vi.fn(),
      updatePruebaCMJ: vi.fn()
    })
  })

  it('5. Alta exige jugadora, fecha y protocolo activo', async () => {
    render(<CMJFormModal open={true} onClose={onCloseMock as any} />)
    
    fireEvent.click(screen.getByText('Guardar Medición'))
    
    // Al intentar guardar sin datos saltan alertas visuales de validación de HTML o no se llama a addPruebaCMJ
    expect(useStore.getState().addPruebaCMJ).not.toHaveBeenCalled()
  })

  it('6. Intento válido sin altura ni tiempo de vuelo no guarda', async () => {
    const { container } = render(<CMJFormModal open={true} onClose={onCloseMock as any} />)
    
    const selects = screen.getAllByRole('combobox')
    const dateInput = container.querySelector('input[type="date"]')!
    
    fireEvent.change(selects[0], { target: { value: 'j1' } })
    fireEvent.change(dateInput, { target: { value: '2026-07-21' } })
    fireEvent.change(selects[2], { target: { value: 'p1' } })
    
    // No metemos ni altura ni vuelo
    fireEvent.click(screen.getByText('Guardar Medición'))
    
    await waitFor(() => {
      expect(screen.getByText(/está marcado como válido pero no tiene altura ni tiempo de vuelo/)).toBeDefined()
    })
    expect(useStore.getState().addPruebaCMJ).not.toHaveBeenCalled()
  })

  it('11. Mejor intento no es editable directamente', () => {
    render(<CMJFormModal open={true} onClose={onCloseMock as any} />)
    expect(screen.queryByLabelText(/Mejor Intento/i)).toBeNull() // Se muestra visual pero no es input
  })

  it('18, 19, 20, 21. Duplicado reactivo: aviso, revisar no guarda, de todos modos requiere finalidad, conserva ambas', async () => {
    const p1 = {
      id_medicion: 'm1', id_jugadora: 'j1', fecha: '2026-07-21', tipo_prueba: 'cmj_bilateral' as const,
      id_protocolo: 'p1', protocolo_nombre_historico: 'Prot 1', intentos: [{ id_intento: 'i1', orden: 1, valido: true, altura_cm: 30, tiempo_vuelo_ms: null }], fuente: 'manual' as const, createdAt: '', updatedAt: ''
    }
    useStore.setState({ pruebas_cmj: [p1] })
    
    const { container } = render(<CMJFormModal open={true} onClose={onCloseMock as any} />)
    const selects = screen.getAllByRole('combobox')
    const dateInput = container.querySelector('input[type="date"]')!

    fireEvent.change(selects[0], { target: { value: 'j1' } })
    fireEvent.change(dateInput, { target: { value: '2026-07-21' } })
    fireEvent.change(selects[2], { target: { value: 'p1' } })
    
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[0], { target: { value: '1' } })
    fireEvent.change(inputs[1], { target: { value: '30' } }) // Altura del intento 1
    
    fireEvent.click(screen.getByText('Guardar Medición'))
    
    // Req 18: Aviso de duplicado
    await waitFor(() => expect(screen.getByText(/Posible medición duplicada/)).toBeDefined())
    
    // Req 19: Volver y revisar no guarda
    fireEvent.click(screen.getByText('Volver y revisar'))
    expect(screen.queryByText(/Posible medición duplicada/)).toBeNull()
    expect(useStore.getState().addPruebaCMJ).not.toHaveBeenCalled()
    
    // Volver a guardar
    fireEvent.click(screen.getByText('Guardar Medición'))
    await waitFor(() => expect(screen.getByText(/Posible medición duplicada/)).toBeDefined())
    
    // Req 21: Guardar de todos modos exige finalidad (la finalidad está vacía por defecto)
    fireEvent.click(screen.getByText('Guardar de todos modos'))
    await waitFor(() => expect(screen.getByText(/debes especificar una finalidad o incluir una observación/i)).toBeDefined())
    
    // Rellenamos finalidad para poder guardar
    fireEvent.click(screen.getByText('Volver y revisar'))
    const currentSelects = screen.getAllByRole('combobox')
    fireEvent.change(currentSelects[1], { target: { value: 'control' } })
    fireEvent.click(screen.getByText('Guardar Medición'))
    await waitFor(() => expect(screen.getByText(/Posible medición duplicada/)).toBeDefined())
    
    // Req 20: Ahora sí guarda
    fireEvent.click(screen.getByText('Guardar de todos modos'))
    await waitFor(() => expect(useStore.getState().addPruebaCMJ).toHaveBeenCalled())
  })

  it('22. Mismo día con protocolo diferente no abre aviso', async () => {
    const p1 = {
      id_medicion: 'm1', id_jugadora: 'j1', fecha: '2026-07-21', tipo_prueba: 'cmj_bilateral' as const,
      id_protocolo: 'p1', protocolo_nombre_historico: 'Prot 1', intentos: [{ id_intento: 'i1', orden: 1, valido: true, altura_cm: 30, tiempo_vuelo_ms: null }], fuente: 'manual' as const, createdAt: '', updatedAt: ''
    }
    useStore.setState({ pruebas_cmj: [p1] })
    
    const { container } = render(<CMJFormModal open={true} onClose={onCloseMock as any} />)
    const selects = screen.getAllByRole('combobox')
    const dateInput = container.querySelector('input[type="date"]')!

    fireEvent.change(selects[0], { target: { value: 'j1' } })
    fireEvent.change(dateInput, { target: { value: '2026-07-21' } })
    fireEvent.change(selects[2], { target: { value: 'p2' } }) // Diferente protocolo
    
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[0], { target: { value: '1' } })
    fireEvent.change(inputs[1], { target: { value: '30' } }) // Altura
    
    fireEvent.click(screen.getByText('Guardar Medición'))
    
    // No hay modal, guarda directamente
    await waitFor(() => expect(useStore.getState().addPruebaCMJ).toHaveBeenCalled())
  })

  it('23 y 24. Guardar en edición sin cambiar no avisa. Cambiar a existente avisa.', async () => {
    const p1 = {
      id_medicion: 'm1', id_jugadora: 'j1', fecha: '2026-07-21', tipo_prueba: 'cmj_bilateral' as const,
      id_protocolo: 'p1', protocolo_nombre_historico: 'Prot 1', intentos: [{ id_intento: 'i1', orden: 1, valido: true, altura_cm: 30, tiempo_vuelo_ms: null }], fuente: 'manual' as const, createdAt: '', updatedAt: ''
    }
    const p2 = {
      id_medicion: 'm2', id_jugadora: 'j1', fecha: '2026-07-22', tipo_prueba: 'cmj_bilateral' as const,
      id_protocolo: 'p1', protocolo_nombre_historico: 'Prot 1', intentos: [{ id_intento: 'i2', orden: 1, valido: true, altura_cm: 30, tiempo_vuelo_ms: null }], fuente: 'manual' as const, createdAt: '', updatedAt: ''
    }
    useStore.setState({ pruebas_cmj: [p1, p2] })
    
    // Editamos m1
    const { unmount } = render(<CMJFormModal editingId="m1" open={true} onClose={onCloseMock as any} />)
    
    // Req 23
    fireEvent.click(screen.getByText('Guardar Medición'))
    await waitFor(() => expect(useStore.getState().updatePruebaCMJ).toHaveBeenCalled())
    vi.mocked(useStore.getState().updatePruebaCMJ).mockClear()
    
    unmount()
    const { container } = render(<CMJFormModal editingId="m1" open={true} onClose={onCloseMock as any} />)
    
    const dateInput = container.querySelector('input[type="date"]')!
    fireEvent.change(dateInput, { target: { value: '2026-07-22' } })
    fireEvent.click(screen.getByText('Guardar Medición'))
    
    await waitFor(() => expect(screen.getByText(/Posible medición duplicada/)).toBeDefined())
  })
})
