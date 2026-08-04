import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StrengthFormModal } from './StrengthFormModal'
import { useStore } from '@/store/store'

vi.mock('@/store/store')

describe('StrengthFormModal (Alta y Edición de Fuerza)', () => {
  const mockJugadoras = [
    { id_jugadora: 'J1', nombre: 'Laura García', activa: true },
    { id_jugadora: 'J2', nombre: 'Ana Martínez', activa: false },
  ]

  const mockEjercicios = [
    {
      id_ejercicio: 'ej1',
      nombre: 'Sentadilla Trasera',
      nombre_normalizado: 'sentadillatrasera',
      categoria: 'sentadilla' as const,
      activo: true,
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01',
    },
  ]

  const mockSesiones = [
    {
      id_sesion_fuerza: 'sf_old',
      id_jugadora: 'J2', // Jugadora inactiva
      fecha: '2023-05-10',
      finalidad: 'fuerza_maxima' as const,
      createdAt: '2023-05-10T10:00:00Z',
      updatedAt: '2023-05-10T10:00:00Z',
    },
  ]

  const mockTrabajos = [
    {
      id_trabajo: 'tr1',
      id_sesion_fuerza: 'sf_old',
      id_jugadora: 'J2',
      id_ejercicio: 'ej1',
      ejercicio_nombre_historico: 'Sentadilla Trasera',
      realizado: [{ id_serie: 's1', orden: 1, repeticiones: 10, carga_kg: 50 }],
      estado: 'completado' as const,
      updatedAt: '2023-05-10T10:00:00Z',
    },
  ]

  const mockAddSesionCompleta = vi.fn()
  const mockUpdateSesionCompleta = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    const mockState = {
      jugadoras: mockJugadoras,
      ejercicios_fuerza: mockEjercicios,
      sesiones_fuerza_individual: mockSesiones,
      trabajos_fuerza: mockTrabajos,
      addSesionFuerzaCompleta: mockAddSesionCompleta,
      updateSesionFuerzaCompleta: mockUpdateSesionCompleta,
    }
    vi.mocked(useStore).mockImplementation((selector?: any) =>
      selector ? selector(mockState) : mockState
    )
  })

  it('5. En alta sólo muestra jugadoras activas', () => {
    render(<StrengthFormModal open={true} onClose={vi.fn()} />)
    const options = screen.getAllByRole('option')
    const optionValues = options.map((o) => (o as HTMLOptionElement).value)
    expect(optionValues).toContain('J1')
    expect(optionValues).not.toContain('J2')
  })

  it('6. En edición conserva la jugadora histórica aunque esté inactiva', () => {
    render(<StrengthFormModal open={true} onClose={vi.fn()} editingId="sf_old" />)
    const options = screen.getAllByRole('option')
    const optionValues = options.map((o) => (o as HTMLOptionElement).value)
    expect(optionValues).toContain('J2')
    expect(screen.getByText(/Ana Martínez \(Inactiva\)/i)).toBeInTheDocument()
  })

  it('11, 12, 13 & 15. Calcula y actualiza derivados visuales (Tonelaje parcial vs total) en tiempo real', () => {
    render(<StrengthFormModal open={true} onClose={vi.fn()} />)

    // Inicialmente con serie sin reps ni kg -> "—"
    expect(screen.getByText('—')).toBeInTheDocument()

    // Rellenamos reps: 10 y kg: 50 -> 500 kg cuantificable
    const inputs = screen.getAllByRole('spinbutton')
    const repsInput = inputs.find((i) => (i as HTMLInputElement).placeholder === '—' && (i as HTMLInputElement).className.includes('w-16'))
    const kgInput = inputs.find((i) => (i as HTMLInputElement).placeholder === '—' && (i as HTMLInputElement).className.includes('w-20'))

    if (repsInput && kgInput) {
      fireEvent.change(repsInput, { target: { value: '10' } })
      fireEvent.change(kgInput, { target: { value: '50' } })
    }

    expect(screen.getByText('500 kg')).toBeInTheDocument()
  })

  it('16. Solicita confirmación antes de eliminar una serie informada', async () => {
    render(<StrengthFormModal open={true} onClose={vi.fn()} />)

    const inputs = screen.getAllByRole('spinbutton')
    const repsInput = inputs.find((i) => (i as HTMLInputElement).placeholder === '—' && (i as HTMLInputElement).className.includes('w-16'))
    if (repsInput) {
      fireEvent.change(repsInput, { target: { value: '8' } })
    }

    const deleteSerieButton = screen.getByTitle('Eliminar serie')
    fireEvent.click(deleteSerieButton)

    expect(screen.getByText(/¿Confirmas eliminar la serie #1\?/i)).toBeInTheDocument()
  })

  it('17. Entrada de RPE fuera de rango (15) bloquea el envío y muestra error', async () => {
    render(<StrengthFormModal open={true} onClose={vi.fn()} />)

    const selectJugadora = screen.getAllByRole('combobox')[0]
    fireEvent.change(selectJugadora, { target: { value: 'J1' } })

    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[2], { target: { value: '10' } })
    fireEvent.change(inputs[3], { target: { value: '50' } })
    fireEvent.change(inputs[4], { target: { value: '15' } })

    const form = screen.getByRole('button', { name: /Guardar Sesión/i }).closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText(/El RPE de la serie #1 debe estar entre 0 y 10/i)).toBeInTheDocument()
    })
    expect(mockAddSesionCompleta).not.toHaveBeenCalled()
  })

  it('18. Observaciones compuestas solo por espacios se normalizan a null en el payload persistido', async () => {
    render(<StrengthFormModal open={true} onClose={vi.fn()} />)

    const selectJugadora = screen.getAllByRole('combobox')[0]
    fireEvent.change(selectJugadora, { target: { value: 'J1' } })

    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[2], { target: { value: '10' } })
    fireEvent.change(inputs[3], { target: { value: '50' } })

    const obsStaffInput = screen.getByPlaceholderText(/Notas generales de la sesión\.\.\./i)
    fireEvent.change(obsStaffInput, { target: { value: '    ' } })

    const saveButton = screen.getByRole('button', { name: /Guardar Sesión/i })
    fireEvent.click(saveButton)

    expect(mockAddSesionCompleta).toHaveBeenCalledTimes(1)
    const [sesionPayload, trabajosPayload] = mockAddSesionCompleta.mock.calls[0]
    expect(sesionPayload.observacion_staff).toBeNull()
    expect(trabajosPayload[0].observacion_staff).toBeNull()
  })

  it('19. Doble clic rápido en guardar solo invoca la persistencia una vez', async () => {
    let resolveSave: () => void = () => {}
    mockAddSesionCompleta.mockImplementation(() => new Promise((res) => { resolveSave = res }))

    render(<StrengthFormModal open={true} onClose={vi.fn()} />)

    const selectJugadora = screen.getAllByRole('combobox')[0]
    fireEvent.change(selectJugadora, { target: { value: 'J1' } })

    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[2], { target: { value: '10' } })
    fireEvent.change(inputs[3], { target: { value: '50' } })

    const saveButton = screen.getByRole('button', { name: /Guardar Sesión/i })
    fireEvent.click(saveButton)
    fireEvent.click(saveButton)

    expect(mockAddSesionCompleta).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /Guardando\.\.\./i })).toBeDisabled()

    resolveSave()
  })

  it('20. Error en la acción de persistencia no cierra el modal ni notifica éxito', async () => {
    mockAddSesionCompleta.mockRejectedValue(new Error('Fallo crítico en IndexedDB'))

    render(<StrengthFormModal open={true} onClose={vi.fn()} />)

    const selectJugadora = screen.getAllByRole('combobox')[0]
    fireEvent.change(selectJugadora, { target: { value: 'J1' } })

    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[2], { target: { value: '10' } })
    fireEvent.change(inputs[3], { target: { value: '50' } })

    const saveButton = screen.getByRole('button', { name: /Guardar Sesión/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText(/Fallo crítico en IndexedDB/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Guardar Sesión/i })).not.toBeDisabled()
    })
  })
})
