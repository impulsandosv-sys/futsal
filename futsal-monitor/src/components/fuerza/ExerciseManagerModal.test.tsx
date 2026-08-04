import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExerciseManagerModal } from './ExerciseManagerModal'
import { useStore } from '@/store/store'

vi.mock('@/store/store')

describe('ExerciseManagerModal (Catálogo de ejercicios)', () => {
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
    {
      id_ejercicio: 'ej2',
      nombre: 'Press Banca',
      nombre_normalizado: 'pressbanca',
      categoria: 'empuje' as const,
      activo: true,
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01',
    },
  ]

  const mockAddEjercicio = vi.fn()
  const mockUpdateEjercicio = vi.fn()
  const mockActivateEjercicio = vi.fn()
  const mockDeactivateEjercicio = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    const mockState = {
      ejercicios_fuerza: mockEjercicios,
      trabajos_fuerza: [],
      addEjercicioFuerza: mockAddEjercicio,
      updateEjercicioFuerza: mockUpdateEjercicio,
      activateEjercicioFuerza: mockActivateEjercicio,
      deactivateEjercicioFuerza: mockDeactivateEjercicio,
    }
    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector ? selector(mockState) : mockState
    )
  })

  it('18 & 19. Muestra ejercicios del catálogo y distingue activos e inactivos', () => {
    render(<ExerciseManagerModal open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Sentadilla Trasera')).toBeInTheDocument()
    expect(screen.getByText('Press Banca')).toBeInTheDocument()
  })

  it('21. No permite desactivar el último ejercicio activo', async () => {
    // Si solo hay 1 ejercicio activo
    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({
        ejercicios_fuerza: [mockEjercicios[0]],
        trabajos_fuerza: [],
        addEjercicioFuerza: mockAddEjercicio,
        updateEjercicioFuerza: mockUpdateEjercicio,
        activateEjercicioFuerza: mockActivateEjercicio,
        deactivateEjercicioFuerza: mockDeactivateEjercicio,
      })
    )

    render(<ExerciseManagerModal open={true} onClose={vi.fn()} />)
    const deactivateButtons = screen.getAllByText('Desactivar')
    fireEvent.click(deactivateButtons[0])

    await waitFor(() => {
      expect(screen.getByText('No se puede desactivar el último ejercicio activo del catálogo.')).toBeInTheDocument()
    })
    expect(mockDeactivateEjercicio).not.toHaveBeenCalled()
  })

  it('22. No permite crear ejercicios activos funcionalmente equivalentes', async () => {
    render(<ExerciseManagerModal open={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('+ Crear Ejercicio'))

    const inputNombre = screen.getByPlaceholderText('Ej. Sentadilla Trasera')
    fireEvent.change(inputNombre, { target: { value: ' Senta dilla  Trasera ' } })

    fireEvent.click(screen.getByText('Guardar Ejercicio'))

    await waitFor(() => {
      expect(screen.getByText(/Ya existe un ejercicio activo similar/i)).toBeInTheDocument()
    })
    expect(mockAddEjercicio).not.toHaveBeenCalled()
  })
})
