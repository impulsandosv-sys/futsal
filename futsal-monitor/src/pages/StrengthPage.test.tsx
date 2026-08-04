import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { StrengthPage } from './StrengthPage'
import { useStore } from '@/store/store'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/store/store')

describe('StrengthPage (Interfaz de Fuerza)', () => {
  const mockJugadoras = [
    { id_jugadora: 'J1', nombre: 'Laura García', activa: true },
    { id_jugadora: 'J2', nombre: 'Ana Martínez', activa: true },
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
      id_sesion_fuerza: 'sf1',
      id_jugadora: 'J1',
      fecha: '2023-10-15',
      finalidad: 'fuerza_maxima' as const,
      rpe_sesion: 8,
      duracion_min: 60,
      observacion_staff: 'Sesión pesada',
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

  let currentSesiones = mockSesiones

  beforeEach(() => {
    vi.clearAllMocks()
    currentSesiones = mockSesiones

    const mockState = {
      sesiones_fuerza_individual: currentSesiones,
      trabajos_fuerza: mockTrabajos,
      jugadoras: mockJugadoras,
      ejercicios_fuerza: mockEjercicios,
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
      mockState.sesiones_fuerza_individual = currentSesiones
      return selector ? selector(mockState) : mockState
    })
  })

  it('1. Renderiza estado vacío y CTA cuando no hay sesiones', () => {
    currentSesiones = []

    render(
      <MemoryRouter>
        <StrengthPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Aún no hay sesiones de fuerza registradas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar sesión de fuerza' })).toBeInTheDocument()
  })

  it('2, 3 & 24. Renderiza tabla de sesiones válidas y filtra correctamente', () => {
    render(
      <MemoryRouter>
        <StrengthPage />
      </MemoryRouter>
    )

    const table = screen.getByRole('table')
    expect(within(table).getByText('Laura García')).toBeInTheDocument()
    expect(within(table).getByText('Fuerza Máxima')).toBeInTheDocument()
    expect(within(table).getByText('500 kg')).toBeInTheDocument()

    // Ver detalle
    fireEvent.click(within(table).getByText('Ver detalle'))
    expect(screen.getByText('Detalle de Sesión de Fuerza')).toBeInTheDocument()
  })

  it('?jugadora=<id_valido> aplica el filtro visible inicial con dicho id', () => {
    render(
      <MemoryRouter initialEntries={['/fuerza?jugadora=J1']}>
        <StrengthPage />
      </MemoryRouter>
    )

    const selectJugadora = screen.getAllByRole('combobox')[0]
    expect(selectJugadora).toHaveValue('J1')
  })

  it('Parámetro jugadora inexistente o inválido no deja la tabla vacía ni aplica un filtro falso', () => {
    render(
      <MemoryRouter initialEntries={['/fuerza?jugadora=J_INVALIDA']}>
        <StrengthPage />
      </MemoryRouter>
    )

    const table = screen.getByRole('table')
    expect(within(table).getByText('Laura García')).toBeInTheDocument()
  })

  it('Restablecer filtros tiene comportamiento coherente con URL y estado local', () => {
    render(
      <MemoryRouter initialEntries={['/fuerza?jugadora=J1']}>
        <StrengthPage />
      </MemoryRouter>
    )

    const btnReset = screen.getByRole('button', { name: 'Restablecer Filtros' })
    fireEvent.click(btnReset)

    const selectJugadora = screen.getAllByRole('combobox')[0]
    expect(selectJugadora).toHaveValue('')
  })
})
