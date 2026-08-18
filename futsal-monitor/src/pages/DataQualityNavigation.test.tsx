import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { DataQualityPage } from './DataQualityPage'
import { MatchesPage } from './MatchesPage'
import { SessionsPage } from './SessionsPage'
import { useStore } from '@/store/store'

vi.mock('./MatchesPage', () => ({
  MatchesPage: () => {
    const location = useLocation()
    return <div data-testid="matches-page">{JSON.stringify(location.state)}</div>
  }
}))

vi.mock('./SessionsPage', () => ({
  SessionsPage: () => {
    const location = useLocation()
    return <div data-testid="sessions-page">{JSON.stringify(location.state)}</div>
  }
}))

// Mockear componentes pesados
vi.mock('@/components/shared/DataTable', () => ({
  DataTable: ({ children }: any) => <div><table data-testid="table">{children}</table></div>,
  DataRow: ({ children }: any) => <tr data-testid="row">{children}</tr>,
  DataCell: ({ children }: any) => <td>{children}</td>
}))
vi.mock('@/components/shared/Modal', () => ({
  Modal: ({ isOpen, children }: any) => isOpen ? <div data-testid="modal">{children}</div> : null
}))
vi.mock('@/components/shared/DatePicker', () => ({
  DatePicker: () => <div />
}))
vi.mock('@/components/shared/Filters', () => ({
  Filters: () => <div />
}))
vi.mock('@/components/planning/WeeklyCalendar', () => ({
  WeeklyCalendar: () => <div />
}))
vi.mock('@/components/ui/Loading', () => ({
  Loading: () => <div />
}))
vi.mock('@/components/ui/ErrorState', () => ({
  ErrorState: () => <div />
}))
vi.mock('@/components/ui/EmptyState', () => ({
  EmptyState: () => <div />
}))
vi.mock('lucide-react', () => ({
  Plus: () => <span />,
  Calendar: () => <span />,
  Search: () => <span />,
  ChevronLeft: () => <span />,
  ChevronRight: () => <span />,
  Download: () => <span />,
  Upload: () => <span />
}))


const TestRouter = () => (
  <MemoryRouter initialEntries={['/calidad-datos']}>
    <Routes>
      <Route path="/calidad-datos" element={<DataQualityPage />} />
      <Route path="/matches" element={<MatchesPage />} />
      <Route path="/sessions" element={<SessionsPage />} />
    </Routes>
  </MemoryRouter>
)

describe('DataQualityPage Navigation & Integration', () => {
  beforeEach(() => {
    const store = useStore.getState()
    store.jugadoras = [{ id_jugadora: 'j1', nombre: 'Jugadora 1', activa: true, posicion: 'Ala' }] as any
    // Un partido reciente para provocar alerta de participación pendiente
    store.partidos = [{ id_partido: 'p1', rival: 'Test Rival', fecha: '2026-08-15', competicion: '', lugar: 'Local', resultado: '' }] as any
    store.rpe_partido = [] 
    
    // Una sesión reciente para provocar alerta de sesión pendiente
    store.sesiones = [{ id_sesion: 's1', fecha: '2026-08-16', tipo_sesion: 'Entrenamiento' }] as any
    store.sesion_rpe = [{
      id_sesion: 's1',
      id_jugadora: 'j1',
      asistencia: 'completa',
      fecha: '2026-08-16',
      rpe: null
    }] as any
    
    store.wellness = []
    store.compensacion_postpartido = []
    store.filters = {
      texto: '',
      tipo_sesion: '',
      competicion: '',
      fecha_inicio: '',
      fecha_fin: '',
      asistencia: '',
      estado_lesion: '',
      jugadora: '',
      mes: '',
      temporada: ''
    }
  })

  it('debe navegar a MatchesPage y SessionsPage con el state correcto', async () => {
    render(<TestRouter />)
    
    // Esperar a que se rendericen las alertas
    const resolveButtons = await screen.findAllByText('Resolver →')
    expect(resolveButtons.length).toBe(2)
    
    // Click en la alerta de partido
    fireEvent.click(resolveButtons[0])

    // Verificar que estamos en MatchesPage con el estado correcto
    await waitFor(() => {
      const matchesPage = screen.getByTestId('matches-page')
      expect(matchesPage.textContent).toContain('"openRpePartidoId":"p1"')
      expect(matchesPage.textContent).toContain('"source":"calidad-datos"')
    })
  })
})
