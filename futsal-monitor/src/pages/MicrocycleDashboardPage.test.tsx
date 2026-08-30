import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MicrocycleDashboardPage } from './MicrocycleDashboardPage'
import { MemoryRouter } from 'react-router-dom'
import { useStore } from '@/store/store'
import { getTodayLocalISO, getWeekStartDateISO } from '@/domain/dates/dates'

vi.mock('@/store/store', () => ({
  useStore: vi.fn()
}))

describe('MicrocycleDashboardPage', () => {
  let mockStore: any

  beforeEach(() => {
    mockStore = {
      jugadoras: [
        { id_jugadora: '1', nombre: 'Alice', activa: true, posicion: 'Ala', fecha_nacimiento: '', altura_cm: 1, peso_kg: 1, imc: 1, grasa: 1, anos_experiencia_futsal: 1, historial_lesional: '', notas: '' }
      ],
      sesiones: [],
      partidos: [],
      wellness: [],
      sesiones_rpe: [],
      rpe_partidos: [],
      alertas: [],
      lesiones: [],
      update: vi.fn(),
      setState: vi.fn()
    }
    vi.mocked(useStore).mockImplementation((selector: any) => {
      if (selector) return selector(mockStore)
      return mockStore
    })
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

    // Checks that side effect functions were not called during render
    expect(mockStore.update).not.toHaveBeenCalled()
    expect(mockStore.setState).not.toHaveBeenCalled()
  })

  it('navigates weeks forward and backward without writing to store', () => {
    render(
      <MemoryRouter>
        <MicrocycleDashboardPage />
      </MemoryRouter>
    )

    const nextBtn = screen.getByText(/Siguiente/i)
    const prevBtn = screen.getByText(/Anterior/i)
    const currentBtn = screen.getByText(/Actual/i)

    act(() => { prevBtn.click() })
    act(() => { nextBtn.click() })
    act(() => { currentBtn.click() })

    // Verify mutations weren't triggered
    expect(mockStore.update).not.toHaveBeenCalled()
    expect(mockStore.setState).not.toHaveBeenCalled()
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
})
