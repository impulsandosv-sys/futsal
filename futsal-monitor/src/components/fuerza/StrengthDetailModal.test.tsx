import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StrengthDetailModal } from './StrengthDetailModal'
import { useStore } from '@/store/store'

vi.mock('@/store/store')

describe('StrengthDetailModal (Detalle de Sesión de Fuerza)', () => {
  const mockJugadoras = [
    { id_jugadora: 'J1', nombre: 'Laura García', activa: true },
  ]

  const mockSesion = {
    id_sesion_fuerza: 'sf1',
    id_jugadora: 'J1',
    fecha: '2023-10-15',
    finalidad: 'fuerza_maxima' as const,
    rpe_sesion: null, // Ausencia
    duracion_min: null, // Ausencia
    observacion_staff: null, // Ausencia
    createdAt: '2023-10-15T10:00:00Z',
    updatedAt: '2023-10-15T10:00:00Z',
  }

  const mockTrabajoNoCuantificable = {
    id_trabajo: 'tr1',
    id_sesion_fuerza: 'sf1',
    id_jugadora: 'J1',
    id_ejercicio: 'ej1',
    ejercicio_nombre_historico: 'Plancha Isométrica',
    realizado: [{ id_serie: 's1', orden: 1, repeticiones: null, carga_kg: null, rpe_serie: null, observacion: '30s' }],
    estado: 'completado' as const,
    updatedAt: '2023-10-15T10:00:00Z',
  }

  const mockTrabajoCuantificable = {
    id_trabajo: 'tr2',
    id_sesion_fuerza: 'sf1',
    id_jugadora: 'J1',
    id_ejercicio: 'ej2',
    ejercicio_nombre_historico: 'Sentadilla Trasera',
    realizado: [{ id_serie: 's2', orden: 1, repeticiones: 10, carga_kg: 50, rpe_serie: 8, observacion: '' }],
    estado: 'completado' as const,
    updatedAt: '2023-10-15T10:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('22. Detalle muestra correctamente series y datos no cuantificables', () => {
    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({
        jugadoras: mockJugadoras,
        sesiones_fuerza_individual: [mockSesion],
        trabajos_fuerza: [mockTrabajoNoCuantificable],
      })
    )

    render(
      <StrengthDetailModal
        open={true}
        onClose={vi.fn()}
        sesionId="sf1"
      />
    )

    expect(screen.getByText('Detalle de Sesión de Fuerza')).toBeInTheDocument()
    expect(screen.getByText(/Plancha Isométrica/i)).toBeInTheDocument()
    
    // Tonelaje total debe ser '—' porque el trabajo no es cuantificable
    const headers = screen.getAllByText('—')
    expect(headers.length).toBeGreaterThan(0)
  })

  it('Detalle muestra Tonelaje parcial cuando hay series cuantificables y no cuantificables', () => {
    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({
        jugadoras: mockJugadoras,
        sesiones_fuerza_individual: [mockSesion],
        trabajos_fuerza: [mockTrabajoNoCuantificable, mockTrabajoCuantificable],
      })
    )

    render(
      <StrengthDetailModal
        open={true}
        onClose={vi.fn()}
        sesionId="sf1"
      />
    )

    expect(screen.getByText(/Tonelaje parcial \(500 kg\)/i)).toBeInTheDocument()
  })

  it('Ausencias de datos sRPE y duración se muestran como —', () => {
    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({
        jugadoras: mockJugadoras,
        sesiones_fuerza_individual: [mockSesion],
        trabajos_fuerza: [],
      })
    )

    render(
      <StrengthDetailModal
        open={true}
        onClose={vi.fn()}
        sesionId="sf1"
      />
    )

    // sRPE Sesión: —
    expect(screen.getByText('sRPE Sesión:')).toBeInTheDocument()
    expect(screen.getByText('Duración:')).toBeInTheDocument()
  })

  it('readOnly={true} muestra sesión correcta y NO presenta botón Editar ni acciones de escritura', () => {
    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({
        jugadoras: mockJugadoras,
        sesiones_fuerza_individual: [mockSesion],
        trabajos_fuerza: [mockTrabajoCuantificable],
      })
    )

    render(
      <StrengthDetailModal
        open={true}
        onClose={vi.fn()}
        sesionId="sf1"
        onEdit={vi.fn()}
        readOnly={true}
      />
    )

    expect(screen.getByText('Detalle de Sesión de Fuerza')).toBeInTheDocument()
    expect(screen.getByText('Laura García')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar Sesión' })).not.toBeInTheDocument()
  })

  it('Sin onEdit no presenta botón Editar Sesión', () => {
    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({
        jugadoras: mockJugadoras,
        sesiones_fuerza_individual: [mockSesion],
        trabajos_fuerza: [mockTrabajoCuantificable],
      })
    )

    render(
      <StrengthDetailModal
        open={true}
        onClose={vi.fn()}
        sesionId="sf1"
      />
    )

    expect(screen.queryByRole('button', { name: 'Editar Sesión' })).not.toBeInTheDocument()
  })

  it('Modo habitual (sin readOnly y con onEdit) conserva botón Editar Sesión', () => {
    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({
        jugadoras: mockJugadoras,
        sesiones_fuerza_individual: [mockSesion],
        trabajos_fuerza: [mockTrabajoCuantificable],
      })
    )

    render(
      <StrengthDetailModal
        open={true}
        onClose={vi.fn()}
        sesionId="sf1"
        onEdit={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Editar Sesión' })).toBeInTheDocument()
  })

  it('Ejercicio inactivo histórico y ejercicio_nombre_historico se muestran correctamente', () => {
    const trabajoHistoricoInactivo = {
      id_trabajo: 'tr_hist',
      id_sesion_fuerza: 'sf1',
      id_jugadora: 'J1',
      id_ejercicio: 'ej_inactivo',
      ejercicio_nombre_historico: 'Sentadilla Antigua (Inactiva)',
      realizado: [{ id_serie: 's_h', orden: 1, repeticiones: 8, carga_kg: 60, rpe_serie: 8, observacion: '' }],
      estado: 'completado' as const,
      updatedAt: '2023-10-15T10:00:00Z',
    }

    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({
        jugadoras: mockJugadoras,
        sesiones_fuerza_individual: [mockSesion],
        trabajos_fuerza: [trabajoHistoricoInactivo],
      })
    )

    render(
      <StrengthDetailModal
        open={true}
        onClose={vi.fn()}
        sesionId="sf1"
      />
    )

    expect(screen.getByText(/Sentadilla Antigua \(Inactiva\)/i)).toBeInTheDocument()
  })
})
