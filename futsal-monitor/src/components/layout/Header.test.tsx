import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
vi.unmock('@/db/database')
import { render, screen, waitFor, act, cleanup } from '@testing-library/react'
import { db } from '@/db/database'

// Header uses useStore, useNavigate, and various imports — mock them
vi.mock('@/store/store', () => ({
  useStore: () => ({
    jugadoras: [],
    alertas: [],
    lesiones: [],
    logout: vi.fn(),
  }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('@/utils/auth', () => ({
  changePassword: vi.fn(() => Promise.resolve(false)),
}))

vi.mock('@/constants/theme', () => ({
  getStoredTheme: () => 'light',
  toggleTheme: () => 'dark',
}))

// Import Header after mocks are set up
import { Header } from './Header'

describe('T-02B-R — Header badge de temporada activa', () => {
  beforeEach(async () => {
    await db.temporadas.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('1. Si existe temporada activa, muestra nombre y rango de fechas', async () => {
    await db.temporadas.put({
      id_temporada: 'T-HDR-1',
      nombre: 'Temporada 25-26',
      fecha_inicio: '2025-09-01',
      fecha_fin: '2026-06-30',
      activa: true,
    })

    render(<Header />)

    await waitFor(() => {
      expect(screen.getByText(/Temporada activa: Temporada 25-26/)).toBeInTheDocument()
    })

    expect(screen.getByText(/2025-09-01/)).toBeInTheDocument()
    expect(screen.getByText(/2026-06-30/)).toBeInTheDocument()
  })

  it('2. Si no existe temporada activa, muestra "Sin temporada activa"', async () => {
    render(<Header />)

    await waitFor(() => {
      expect(screen.getByText(/Sin temporada activa/)).toBeInTheDocument()
    })
  })

  it('3. Después de despachar temporadas-updated, Header recarga la temporada activa desde Dexie', async () => {
    render(<Header />)

    await waitFor(() => {
      expect(screen.getByText(/Sin temporada activa/)).toBeInTheDocument()
    })

    // Insert a new active season
    await db.temporadas.put({
      id_temporada: 'T-HDR-2',
      nombre: 'Nueva Activa',
      fecha_inicio: '2026-09-01',
      fecha_fin: '2027-06-30',
      activa: true,
    })

    // Dispatch the real event
    act(() => {
      window.dispatchEvent(new Event('temporadas-updated'))
    })

    await waitFor(() => {
      expect(screen.getByText(/Temporada activa: Nueva Activa/)).toBeInTheDocument()
    })

    expect(screen.getByText(/2026-09-01/)).toBeInTheDocument()
    expect(screen.getByText(/2027-06-30/)).toBeInTheDocument()
  })

  it('4. Si la carga falla, Header muestra fallback seguro sin romper la navegación', async () => {
    // Temporarily break the DB query
    const originalToArray = db.temporadas.toArray
    db.temporadas.toArray = vi.fn(() => Promise.reject(new Error('DB corrupted'))) as typeof db.temporadas.toArray

    render(<Header />)

    await waitFor(() => {
      expect(screen.getByText(/Sin temporada activa/)).toBeInTheDocument()
    })

    // Navigation elements are still present
    expect(screen.getByText('Alertas')).toBeInTheDocument()
    expect(screen.getByText('Salir')).toBeInTheDocument()

    db.temporadas.toArray = originalToArray
  })

  it('5. Al desmontar, elimina el listener temporadas-updated', async () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = render(<Header />)

    await waitFor(() => {
      expect(screen.getByText(/Sin temporada activa/)).toBeInTheDocument()
    })

    unmount()

    const removedListeners = removeEventListenerSpy.mock.calls.filter(
      ([event]) => event === 'temporadas-updated'
    )
    expect(removedListeners.length).toBeGreaterThanOrEqual(1)

    removeEventListenerSpy.mockRestore()
  })

  it('6. No usa localStorage como fuente de verdad para la temporada activa', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem')

    await db.temporadas.put({
      id_temporada: 'T-HDR-3',
      nombre: 'Temp LS',
      fecha_inicio: '2025-09-01',
      fecha_fin: '2026-06-30',
      activa: true,
    })

    render(<Header />)

    await waitFor(() => {
      expect(screen.getByText(/Temporada activa: Temp LS/)).toBeInTheDocument()
    })

    // Check that no localStorage.getItem call was made with a temporada-related key
    const temporadaCalls = getItemSpy.mock.calls.filter(
      ([key]) => typeof key === 'string' && key.toLowerCase().includes('temporada')
    )
    expect(temporadaCalls.length).toBe(0)

    getItemSpy.mockRestore()
  })

  it('7. Con temporada inactiva pero ninguna activa, muestra "Sin temporada activa"', async () => {
    await db.temporadas.put({
      id_temporada: 'T-HDR-4',
      nombre: 'Temp Archivada',
      fecha_inicio: '2024-09-01',
      fecha_fin: '2025-06-30',
      activa: false,
    })

    render(<Header />)

    await waitFor(() => {
      expect(screen.getByText(/Sin temporada activa/)).toBeInTheDocument()
    })

    expect(screen.queryByText(/Temp Archivada/)).toBeNull()
  })
})
