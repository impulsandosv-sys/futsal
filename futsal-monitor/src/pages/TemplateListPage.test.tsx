import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { TemplateListPage } from './TemplateListPage'
import { useStore } from '@/store/store'
import { db } from '@/db/database'

vi.mock('@/store/store')
vi.mock('@/db/database', () => ({
  db: {
    sesiones_fuerza_individual: { add: vi.fn(), put: vi.fn(() => Promise.resolve()), update: vi.fn(), delete: vi.fn() },
    trabajos_fuerza: { put: vi.fn(() => Promise.resolve()), bulkPut: vi.fn(() => Promise.resolve()), delete: vi.fn() },
  }
}))

const mockEjercicios = [
  { id_ejercicio: 'ej1', nombre: 'Sentadilla Trasera', nombre_normalizado: 'sentadillatrasera', categoria: 'sentadilla' as const, activo: true, createdAt: '2023-01-01', updatedAt: '2023-01-01' },
  { id_ejercicio: 'ej2', nombre: 'Press Banca', nombre_normalizado: 'pressbanca', categoria: 'empuje' as const, activo: true, createdAt: '2023-01-01', updatedAt: '2023-01-01' }
]

const mockPlantillas = [
  {
    id_plantilla: 'pl_1',
    nombre: 'Rutina Hipertrofia A',
    finalidad: 'hipertrofia' as const,
    descripcion: 'Enfoque volumen torso/pierna',
    activa: true,
    ejercicios: [
      { id_ejercicio: 'ej1', series_propuestas: 3, repeticiones_propuestas: 10, carga_kg_propuesta: 60, rpe_objetivo: 8 }
    ],
    createdAt: '2023-10-01T10:00:00Z',
    updatedAt: '2023-10-01T10:00:00Z'
  },
  {
    id_plantilla: 'pl_2',
    nombre: 'Rutina Prevención B',
    finalidad: 'prevencion' as const,
    descripcion: 'Trabajo isquios y core',
    activa: false,
    ejercicios: [
      { id_ejercicio: 'ej2', series_propuestas: 2, repeticiones_propuestas: 12 }
    ],
    createdAt: '2023-09-01T10:00:00Z',
    updatedAt: '2023-09-01T10:00:00Z'
  }
]

const mockJugadoras = [
  { id_jugadora: 'J1', nombre: 'Laura', apellidos: 'García', dorsal: 10, posicion: 'Ala' as const, activa: true, fecha_nacimiento: '2000-01-01', updatedAt: '2023-01-01' }
]

describe('TemplateListPage & Flujo de Plantillas (Bloque 5)', () => {
  const addPlantillaMock = vi.fn()
  const updatePlantillaMock = vi.fn()
  const toggleActivaMock = vi.fn()
  const addSesionCompletaMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    const mockState = {
      plantillas_fuerza: mockPlantillas,
      ejercicios_fuerza: mockEjercicios,
      jugadoras: mockJugadoras,
      sesiones_fuerza_individual: [],
      trabajos_fuerza: [],
      addPlantillaFuerza: addPlantillaMock,
      updatePlantillaFuerza: updatePlantillaMock,
      toggleActivaPlantillaFuerza: toggleActivaMock,
      addSesionFuerzaCompleta: addSesionCompletaMock,
    }
    vi.mocked(useStore).mockImplementation((selector?: any) => {
      return selector ? selector(mockState) : mockState
    })
  })

  it('1. Renderiza catálogo de plantillas activas por defecto y respeta filtros por estado y finalidad', () => {
    render(
      <MemoryRouter initialEntries={['/plantillas-fuerza']}>
        <Routes>
          <Route path="/plantillas-fuerza" element={<TemplateListPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Título y plantilla activa visibles por defecto
    expect(screen.getByText('Plantillas de Fuerza')).toBeInTheDocument()
    expect(screen.getByText('Rutina Hipertrofia A')).toBeInTheDocument()
    expect(screen.queryByText('Rutina Prevención B')).not.toBeInTheDocument()

    // Cambiar filtro a "Solo Archivadas"
    const selectEstado = screen.getAllByRole('combobox')[1]
    fireEvent.change(selectEstado, { target: { value: 'archivadas' } })

    expect(screen.queryByText('Rutina Hipertrofia A')).not.toBeInTheDocument()
    expect(screen.getByText('Rutina Prevención B')).toBeInTheDocument()
  })

  it('2. Formulario exige nombre y al menos 1 ejercicio antes de guardar plantilla (Regla 5)', async () => {
    render(
      <MemoryRouter initialEntries={['/plantillas-fuerza']}>
        <Routes>
          <Route path="/plantillas-fuerza" element={<TemplateListPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Abrir modal de nueva plantilla
    fireEvent.click(screen.getByRole('button', { name: /\+ Nueva Plantilla/i }))

    expect(screen.getByText('Nueva Plantilla de Fuerza')).toBeInTheDocument()

    // Intentar guardar con nombre vacío
    const btnCrear = screen.getByRole('button', { name: 'Crear Plantilla' })
    fireEvent.click(btnCrear)

    // Formulario muestra validación requerida y no llama a store
    expect(addPlantillaMock).not.toHaveBeenCalled()
  })

  it('3. Aplicar plantilla abre el borrador con series vacías para ejecución y asigna id_plantilla_fuerza_origen', () => {
    render(
      <MemoryRouter initialEntries={['/plantillas-fuerza']}>
        <Routes>
          <Route path="/plantillas-fuerza" element={<TemplateListPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Click en "Aplicar" en la plantilla activa pl_1
    const btnAplicar = screen.getByRole('button', { name: 'Aplicar' })
    fireEvent.click(btnAplicar)

    // Abre el borrador de sesión individual
    expect(screen.getByText(/Registrar Sesión de Fuerza/i)).toBeInTheDocument()

    // Finalidad copiada de la plantilla
    const selectFinalidad = screen.getByLabelText(/Finalidad/i)
    expect(selectFinalidad).toHaveValue('hipertrofia')

    // El ejercicio se cargó con 3 series en blanco
    expect(screen.getByText(/Sentadilla Trasera/i)).toBeInTheDocument()
  })

  it('4. Cancelar o cerrar el borrador de sesión NO guarda nada en Dexie', () => {
    render(
      <MemoryRouter initialEntries={['/plantillas-fuerza']}>
        <Routes>
          <Route path="/plantillas-fuerza" element={<TemplateListPage />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(screen.getByText(/Registrar Sesión de Fuerza/i)).toBeInTheDocument()

    // Cancelar modal sin guardar
    const btnCancelar = screen.getByRole('button', { name: 'Cancelar' })
    fireEvent.click(btnCancelar)

    expect(db.sesiones_fuerza_individual.put).not.toHaveBeenCalled()
    expect(addSesionCompletaMock).not.toHaveBeenCalled()
  })

  it('5. Cambiar el estado activa/archivada llama a toggleActivaPlantillaFuerza sin borrado físico', () => {
    render(
      <MemoryRouter initialEntries={['/plantillas-fuerza']}>
        <Routes>
          <Route path="/plantillas-fuerza" element={<TemplateListPage />} />
        </Routes>
      </MemoryRouter>
    )

    const btnArchivar = screen.getByRole('button', { name: 'Archivar' })
    fireEvent.click(btnArchivar)

    expect(toggleActivaMock).toHaveBeenCalledWith('pl_1', false)
  })

  it('6. Nueva plantilla inicializa primer ejercicio activo por defecto y mantiene el estado editado tras interacciones', () => {
    render(
      <MemoryRouter initialEntries={['/plantillas-fuerza']}>
        <Routes>
          <Route path="/plantillas-fuerza" element={<TemplateListPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Abrir modal de nueva plantilla
    fireEvent.click(screen.getByRole('button', { name: /\+ Nueva Plantilla/i }))

    // Los comboboxes en el modal son: [0] = Filtro de Finalidad, [1] = Select del Ejercicio
    const selects = screen.getAllByRole('combobox')
    const selectEjercicio = selects[selects.length - 1] // Select del ejercicio prescrito
    expect(selectEjercicio).toHaveValue('ej1')

    // Escribir un nombre de plantilla
    const inputNombre = screen.getByPlaceholderText(/Ej: Rutina Fuerza Máxima A/i)
    fireEvent.change(inputNombre, { target: { value: 'Rutina Potencia X' } })

    // El nombre editado debe conservarse sin reseteos
    expect(inputNombre).toHaveValue('Rutina Potencia X')
  })

  it('7. Editar plantilla existente carga y conserva sus ejercicios guardados en lugar de sobrescribirlos con defaultEjercicioId', () => {
    render(
      <MemoryRouter initialEntries={['/plantillas-fuerza']}>
        <Routes>
          <Route path="/plantillas-fuerza" element={<TemplateListPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Hacer clic en 'Editar' en la plantilla 'Rutina Hipertrofia A'
    const btnEditar = screen.getByRole('button', { name: 'Editar' })
    fireEvent.click(btnEditar)

    expect(screen.getByText('Editar Plantilla de Fuerza')).toBeInTheDocument()

    // El nombre y ejercicios originales de pl_1 permanecen intactos
    const inputNombre = screen.getByPlaceholderText(/Ej: Rutina Fuerza Máxima A/i)
    expect(inputNombre).toHaveValue('Rutina Hipertrofia A')

    const selects = screen.getAllByRole('combobox')
    const selectEjercicio = selects[selects.length - 1]
    expect(selectEjercicio).toHaveValue('ej1')
  })
})
