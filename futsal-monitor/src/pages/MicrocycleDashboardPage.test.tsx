import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MicrocycleDashboardPage } from './MicrocycleDashboardPage'
import { MemoryRouter } from 'react-router-dom'
import { useStore } from '@/store/store'
import { getTodayLocalISO } from '@/domain/dates/dates'
import type { Jugadora } from '@/types'

const alice: Jugadora = {
  id_jugadora: '1',
  nombre: 'Alice',
  activa: true,
  posicion: 'Ala',
  fecha_nacimiento: '2000-01-01',
  altura_cm: 165,
  peso_kg: 58,
  imc: 21.3,
  grasa: 18,
  anos_experiencia_futsal: 5,
  historial_lesional: '',
  notas: ''
}

describe('MicrocycleDashboardPage', () => {
  const initialState = useStore.getState()

  beforeEach(() => {
    useStore.setState({
      jugadoras: [alice],
      sesiones: [],
      partidos: [],
      wellness: [],
      sesion_rpe: [],
      rpe_partido: [],
      alertas: [],
      lesiones: []
    })
  })

  afterEach(() => {
    useStore.setState(initialState, true)
  })

  it('renders title and collective summary safely without menstrual references', () => {
    render(
      <MemoryRouter>
        <MicrocycleDashboardPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Microciclo Operativo')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()

    // Privacy checks
    const content = document.body.innerHTML
    expect(content).not.toMatch(/MENSTRUACION/i)
    expect(content).not.toMatch(/registro_menstrual/i)
    expect(content).not.toMatch(/impacto_percibido/i)
  })

  it('navigates weeks forward and backward without writing to store', () => {
    const setStateSpy = vi.spyOn(useStore, 'setState')

    render(
      <MemoryRouter>
        <MicrocycleDashboardPage />
      </MemoryRouter>
    )

    const callsBefore = setStateSpy.mock.calls.length

    const nextBtn = screen.getByText(/Siguiente/i)
    const prevBtn = screen.getByText(/Anterior/i)
    const currentBtn = screen.getByText(/Actual/i)

    act(() => { prevBtn.click() })
    act(() => { nextBtn.click() })
    act(() => { currentBtn.click() })

    // No new setState calls should have been made by the component
    expect(setStateSpy.mock.calls.length).toBe(callsBefore)
    setStateSpy.mockRestore()
  })

  it('renders profile link correctly', () => {
    render(
      <MemoryRouter>
        <MicrocycleDashboardPage />
      </MemoryRouter>
    )

    const profileLink = screen.getByRole('link', { name: /Perfil/i })
    expect(profileLink).toHaveAttribute('href', '/jugadoras/1')
  })

  it('uses local week as initial state, navigates, and shows correct visual interval', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T12:00:00Z')) // Wednesday, Aug 5 2026

    render(
      <MemoryRouter>
        <MicrocycleDashboardPage />
      </MemoryRouter>
    )

    // Initial state: current week should be Monday Aug 3 to Sunday Aug 9
    expect(screen.getByText('3 ago - 9 ago 2026')).toBeInTheDocument()
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument()

    const prevBtn = screen.getByText(/Anterior/i)
    const nextBtn = screen.getByText(/Siguiente/i)
    const currentBtn = screen.getByText(/Actual/i)

    // Navigate back
    act(() => { prevBtn.click() })
    expect(screen.getByText('27 jul - 2 ago 2026')).toBeInTheDocument()

    // Navigate forward (back to current week)
    act(() => { nextBtn.click() })
    expect(screen.getByText('3 ago - 9 ago 2026')).toBeInTheDocument()

    // Navigate forward again (next week)
    act(() => { nextBtn.click() })
    expect(screen.getByText('10 ago - 16 ago 2026')).toBeInTheDocument()

    // Go back to current week using the button
    act(() => { currentBtn.click() })
    expect(screen.getByText('3 ago - 9 ago 2026')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('shows training and match sRPE when sesion_rpe and rpe_partido contain data', () => {
    const todayLocal = getTodayLocalISO()

    useStore.setState({
      jugadoras: [alice],
      sesiones: [
        { id_sesion: 's1', fecha: todayLocal, tipo: 'entrenamiento', titulo: 'Sesión 1', descripcion: '', estado: 'realizada', notas: '' }
      ],
      partidos: [
        { id_partido: 'p1', fecha: todayLocal, rival: 'Rival FC', lugar: 'local', resultado: '3-2', notas: '' }
      ],
      wellness: [],
      sesion_rpe: [
        { id: 1, id_sesion: 's1', id_jugadora: '1', rpe: 7, duracion_min: 60, carga_ua: 420, fecha: todayLocal }
      ],
      rpe_partido: [
        { id_partido: 'p1', id_jugadora: '1', fecha: todayLocal, minutos_jugados: 40, participacion: 'completa', rpe: 8, carga_ua: 320 }
      ],
      alertas: [],
      lesiones: []
    })

    render(
      <MemoryRouter>
        <MicrocycleDashboardPage />
      </MemoryRouter>
    )

    // Training sRPE = 7 * 60 = 420
    expect(screen.getByText('420')).toBeInTheDocument()
    // Match sRPE = 8 * 40 = 320
    expect(screen.getByText('320')).toBeInTheDocument()
  })
})
