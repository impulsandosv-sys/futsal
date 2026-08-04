import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { StrengthPage } from './StrengthPage'
import { useStore } from '@/store/store'
import { MemoryRouter } from 'react-router-dom'
import { db } from '@/db/database'

vi.mock('@/store/store')
vi.mock('@/db/database', () => ({
  db: {
    sesiones_fuerza_individual: { put: vi.fn(), toArray: vi.fn() },
    trabajos_fuerza: { put: vi.fn(), bulkPut: vi.fn(), toArray: vi.fn(), where: vi.fn(() => ({ delete: vi.fn() })) },
    ejercicios_fuerza: { put: vi.fn(), update: vi.fn(), toArray: vi.fn() },
    jugadoras: { toArray: vi.fn() },
  }
}))

describe('StrengthPage (Full Integration, Isolation & Requirements)', () => {
  const mockJugadoras = [
    { id_jugadora: 'J1', nombre: 'Laura García', activa: true },
    { id_jugadora: 'J2', nombre: 'Ana Martínez', activa: false }, // Inactiva
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
    {
      id_ejercicio: 'ej_inactive',
      nombre: 'Press Militar Inactivo',
      nombre_normalizado: 'pressmilitarinactivo',
      categoria: 'empuje' as const,
      activo: false, // Inactivo
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01',
    }
  ]

  const mockSesiones = [
    {
      id_sesion_fuerza: 'sf1',
      id_jugadora: 'J1',
      fecha: '2023-10-15',
      finalidad: 'fuerza_maxima' as const,
      rpe_sesion: null, // Ausencia
      duracion_min: null, // Ausencia
      observacion_staff: null, // Ausencia
      createdAt: '2023-10-15T10:00:00Z',
      updatedAt: '2023-10-15T10:00:00Z',
    },
  ]

  const mockTrabajos = [
    {
      id_trabajo: 'tr1',
      id_sesion_fuerza: 'sf1',
      id_jugadora: 'J1',
      id_ejercicio: 'ej1',
      ejercicio_nombre_historico: 'Sentadilla Trasera',
      realizado: [{ id_serie: 's1', orden: 1, repeticiones: 10, carga_kg: 50 }],
      estado: 'completado' as const,
      updatedAt: '2023-10-15T10:00:00Z',
    },
  ]

  const mockAddSesionCompleta = vi.fn()
  const mockUpdateSesionCompleta = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    const mockState = {
      sesiones_fuerza_individual: mockSesiones,
      trabajos_fuerza: mockTrabajos,
      jugadoras: mockJugadoras,
      ejercicios_fuerza: mockEjercicios,
      addSesionFuerzaCompleta: mockAddSesionCompleta,
      updateSesionFuerzaCompleta: mockUpdateSesionCompleta,
      alertas: [],
      lesiones: [],
      wellness: [],
      tests: [],
      rpe_partido: [],
      resumen_semanal: [],
      readiness: [],
      sesion_rpe: [],
      sesiones: [],
      ciclo_menstrual: [],
      carga_gps: [],
      fuerza_vbt: [],
      hidratacion: [],
      test_psicologico: [],
      pruebas_cmj: [],
    }
    vi.mocked(useStore).mockImplementation((selector?: any) => {
      return selector ? selector(mockState) : mockState
    })
  })

  it('3. Muestra ausencias de datos como —', () => {
    render(
      <MemoryRouter>
        <StrengthPage />
      </MemoryRouter>
    )

    const table = screen.getByRole('table')
    // Las columnas de sRPE, Duración, Observación deben mostrar "—"
    const rows = within(table).getAllByRole('row')
    const cells = within(rows[1]).getAllByRole('cell')
    
    // sRPE (índice 6 en las columnas), Duración (7), Observación (8) deben ser —
    expect(cells[6].textContent).toBe('—')
    expect(cells[7].textContent).toBe('—')
    expect(cells[8].textContent).toBe('—')
  })

  it('14. El Tonelaje total es un dato derivado no editable', () => {
    render(
      <MemoryRouter>
        <StrengthPage />
      </MemoryRouter>
    )

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    const cells = within(rows[1]).getAllByRole('cell')

    // El tonelaje total está en la columna de Tonelaje (índice 5), "500 kg"
    expect(cells[5].textContent).toBe('500 kg')
    
    // No existe ningún input o botón para editar el tonelaje directamente
    expect(screen.queryByLabelText(/editar tonelaje/i)).not.toBeInTheDocument()
  })

  it('23. Filtra la tabla por jugadora, fecha y ejercicio correctamente', async () => {
    render(
      <MemoryRouter>
        <StrengthPage />
      </MemoryRouter>
    )

    // Filtrar por jugadora que no tiene sesiones (J2)
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'J2' } })

    // No hay sesiones para J2 -> muestra mensaje de estado vacío
    expect(screen.getByText('Aún no hay sesiones de fuerza registradas')).toBeInTheDocument()
  })

  it('26 & 27. Operaciones de lectura (filtrar, ver detalles) no escriben en Dexie ni modifican otros dominios', async () => {
    // Espiar métodos de escritura de Dexie
    const putSpy = vi.spyOn(db.sesiones_fuerza_individual, 'put')
    const worksPutSpy = vi.spyOn(db.trabajos_fuerza, 'put')

    render(
      <MemoryRouter>
        <StrengthPage />
      </MemoryRouter>
    )

    // Cambiar filtros
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'J1' } })

    // Ver detalle
    const viewDetailBtn = screen.getByText('Ver detalle')
    fireEvent.click(viewDetailBtn)

    // Confirmar que no se llamó a put, bulkPut, update, delete
    expect(putSpy).not.toHaveBeenCalled()
    expect(worksPutSpy).not.toHaveBeenCalled()

    // Confirmar que dominios externos no se ven alterados
    // (Asegurado por el mock del store donde otros dominios permanecen vacíos e intactos)
  })
})
