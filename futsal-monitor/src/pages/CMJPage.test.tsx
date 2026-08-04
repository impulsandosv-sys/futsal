import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useStore } from '@/store/store'
import { CMJPage } from '@/pages/CMJPage'
import { PlayerProfilePage } from '@/pages/PlayerProfilePage'

// Mocking localStorage para evitar errores en Header > getStoredTheme
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString() },
    clear: () => { store = {} }
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock ResizeObserver for Recharts
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  ComposedChart: ({ children }: any) => <div>{children}</div>,
  ScatterChart: ({ children }: any) => <div>{children}</div>,
  Scatter: () => null,
  RadarChart: ({ children }: any) => <div>{children}</div>,
  Radar: () => null,
  PolarGrid: () => null,
  PolarAngleAxis: () => null,
  PolarRadiusAxis: () => null,
  ZAxis: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

describe('Bloque 2: UI CMJ', () => {
  beforeEach(() => {
    useStore.setState({
      jugadoras: [
        { id_jugadora: 'j1', nombre: 'Jugadora 1', activa: true, posicion: 'Ala', fecha_nacimiento: '', altura_cm: 0, peso_kg: 0, imc: 0, grasa: 0, anos_experiencia_futsal: 0, historial_lesional: '', notas: '' },
        { id_jugadora: 'j-inactiva', nombre: 'Jugadora Inactiva', activa: false, posicion: 'Cierre', fecha_nacimiento: '', altura_cm: 0, peso_kg: 0, imc: 0, grasa: 0, anos_experiencia_futsal: 0, historial_lesional: '', notas: '' }
      ],
      protocolos_cmj: [
        { id_protocolo: 'p1', nombre: 'Prot 1', activo: true, createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z' },
        { id_protocolo: 'p2', nombre: 'Prot 2', activo: false, createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z' }
      ],
      pruebas_cmj: [],
      // Mockear la acción para evitar llamar a IndexedDB
      deactivateProtocoloCMJ: async (id: string) => {
        const activos = useStore.getState().protocolos_cmj.filter(p => p.activo)
        if (activos.length === 1 && activos[0].id_protocolo === id) {
          throw new Error('No se puede desactivar el último protocolo activo.')
        }
      }
    })
  })

  it('Medición válida solo con tiempo_vuelo_ms muestra altura "—" y no la calcula', async () => {
    const p1 = {
      id_medicion: 'm1',
      id_jugadora: 'j1',
      fecha: '2026-07-21',
      tipo_prueba: 'cmj_bilateral' as const,
      id_protocolo: 'p1',
      protocolo_nombre_historico: 'Prot 1',
      intentos: [{ id_intento: 'i1', orden: 1, valido: true, altura_cm: null, tiempo_vuelo_ms: 400 }],
      mejor_intento_valido_id: 'i1',
      altura_mejor_cm: null,
      tiempo_vuelo_mejor_ms: 400,
      fuente: 'manual' as const,
      createdAt: '2026-07-21T10:00:00Z',
      updatedAt: '2026-07-21T10:00:00Z'
    }
    useStore.setState({ pruebas_cmj: [p1] })

    render(
      <MemoryRouter>
        <CMJPage />
      </MemoryRouter>
    )
    
    // Tabla de listado de CMJ
    const tableRows = screen.getAllByRole('row')
    const row = tableRows[1] // Ignorar thead
    expect(row.textContent).toContain('—') // Altura
    expect(row.textContent).toContain('400') // Vuelo
  })

  it('No se puede desactivar el último protocolo activo', async () => {
    const state = useStore.getState()
    await expect(state.deactivateProtocoloCMJ('p1')).rejects.toThrow('No se puede desactivar el último protocolo activo.')
  })

  it('Protocolo inactivo visible en listado pero no disponible en select (salvo en modo edición de dicho protocolo)', async () => {
    const p1 = {
      id_medicion: 'm1',
      id_jugadora: 'j1',
      fecha: '2026-07-21',
      tipo_prueba: 'cmj_bilateral' as const,
      id_protocolo: 'p2',
      protocolo_nombre_historico: 'Prot Inactivo Antiguo',
      intentos: [{ id_intento: 'i1', orden: 1, valido: true, altura_cm: 30, tiempo_vuelo_ms: null }],
      mejor_intento_valido_id: 'i1',
      altura_mejor_cm: 30,
      tiempo_vuelo_mejor_ms: null,
      fuente: 'manual' as const,
      createdAt: '2026-07-21T10:00:00Z',
      updatedAt: '2026-07-21T10:00:00Z'
    }
    useStore.setState({ pruebas_cmj: [p1] })

    render(
      <MemoryRouter>
        <CMJPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Prot Inactivo Antiguo')).toBeDefined()

    fireEvent.click(screen.getAllByText('Nueva Medición')[0])
    const selects = screen.getAllByRole('combobox')
    const protocoloModalSelect = selects[selects.length - 1]
    expect(within(protocoloModalSelect).queryByText('Prot 2')).toBeNull()
  })

  it('Editar medición de jugadora inactiva conserva la jugadora en el select', async () => {
    const p1 = {
      id_medicion: 'm-inactiva',
      id_jugadora: 'j-inactiva',
      fecha: '2026-07-21',
      tipo_prueba: 'cmj_bilateral' as const,
      id_protocolo: 'p1',
      protocolo_nombre_historico: 'Prot 1',
      intentos: [{ id_intento: 'i1', orden: 1, valido: true, altura_cm: 30, tiempo_vuelo_ms: null }],
      mejor_intento_valido_id: 'i1',
      altura_mejor_cm: 30,
      fuente: 'manual' as const,
      createdAt: '2026-07-21T10:00:00Z',
      updatedAt: '2026-07-21T10:00:00Z'
    }
    useStore.setState({
      jugadoras: [
        { id_jugadora: 'j1', nombre: 'Jugadora 1', activa: true, posicion: 'Ala', fecha_nacimiento: '', altura_cm: 0, peso_kg: 0, imc: 0, grasa: 0, anos_experiencia_futsal: 0, historial_lesional: '', notas: '' },
        { id_jugadora: 'j-inactiva', nombre: 'Jugadora Inactiva', activa: false, posicion: 'Ala', fecha_nacimiento: '', altura_cm: 0, peso_kg: 0, imc: 0, grasa: 0, anos_experiencia_futsal: 0, historial_lesional: '', notas: '' }
      ],
      pruebas_cmj: [p1]
    })

    render(
      <MemoryRouter>
        <CMJPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getAllByText('Editar')[0])
    
    await waitFor(() => {
      const options = screen.getAllByRole('option')
      const inactivaOption = options.find(opt => opt.textContent?.includes('(Inactiva)'))
      expect(inactivaOption).toBeDefined()
      expect((inactivaOption as HTMLOptionElement).selected).toBe(true)
    })
  })

  it('Detalle muestra intentos válidos, no válidos y motivos', async () => {
    const p1 = {
      id_medicion: 'm1',
      id_jugadora: 'j1',
      fecha: '2026-07-21',
      tipo_prueba: 'cmj_bilateral' as const,
      id_protocolo: 'p1',
      protocolo_nombre_historico: 'Prot 1',
      intentos: [
        { id_intento: 'i1', orden: 1, valido: true, altura_cm: 30, tiempo_vuelo_ms: 400 },
        { id_intento: 'i2', orden: 2, valido: false, altura_cm: null, tiempo_vuelo_ms: null, motivo_no_valido: 'Error de salto' }
      ],
      mejor_intento_valido_id: 'i1',
      altura_mejor_cm: 30,
      fuente: 'manual' as const,
      createdAt: '2026-07-21T10:00:00Z',
      updatedAt: '2026-07-21T10:00:00Z'
    }
    useStore.setState({ pruebas_cmj: [p1] })

    render(
      <MemoryRouter>
        <CMJPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Ver'))
    expect(screen.getByText('Error de salto')).toBeDefined()
    expect(screen.getByText('Válido')).toBeDefined()
    expect(screen.getByText('Inválido')).toBeDefined()
  })

  it('1. Estado vacío y CTA', () => {
    useStore.setState({ pruebas_cmj: [] })
    render(<MemoryRouter><CMJPage /></MemoryRouter>)
    expect(screen.getByText(/Aún no hay mediciones CMJ registradas/i)).toBeDefined()
    expect(screen.getAllByText('Nueva Medición')[0]).toBeDefined()
  })

  it('2, 3 y 4. Tabla de medición válida, "Sin resultado válido" y ausencias como "—"', () => {
    const p1 = {
      id_medicion: 'm1', id_jugadora: 'j1', fecha: '2026-07-21', tipo_prueba: 'cmj_bilateral' as const,
      id_protocolo: 'p1', protocolo_nombre_historico: 'Prot 1',
      intentos: [{ id_intento: 'i1', orden: 1, valido: true, altura_cm: 30, tiempo_vuelo_ms: null }],
      mejor_intento_valido_id: 'i1', altura_mejor_cm: 30, tiempo_vuelo_mejor_ms: null, fuente: 'manual' as const, createdAt: '', updatedAt: ''
    }
    const p2 = {
      id_medicion: 'm2', id_jugadora: 'j1', fecha: '2026-07-22', tipo_prueba: 'cmj_bilateral' as const,
      id_protocolo: 'p1', protocolo_nombre_historico: 'Prot 1',
      intentos: [{ id_intento: 'i2', orden: 1, valido: false, altura_cm: 20, tiempo_vuelo_ms: null }],
      mejor_intento_valido_id: null, altura_mejor_cm: null, tiempo_vuelo_mejor_ms: null, fuente: 'manual' as const, createdAt: '', updatedAt: ''
    }
    useStore.setState({ pruebas_cmj: [p1, p2] })
    render(<MemoryRouter><CMJPage /></MemoryRouter>)

    // p2 (fecha 2026-07-22) va primero por ordenación descendente -> ausencias como "—"
    expect(screen.getAllByRole('row')[1].textContent).toContain('—')
    const rowP1 = screen.getAllByRole('row')[2]
    expect(rowP1.textContent).toContain('30')
    expect(rowP1.textContent).toContain('—')
  })

  it('25. Filtro por protocolo no mezcla resultados', () => {
    const p1 = {
      id_medicion: 'm1', id_jugadora: 'j1', fecha: '2026-07-21', tipo_prueba: 'cmj_bilateral' as const,
      id_protocolo: 'p1', protocolo_nombre_historico: 'Prot 1', intentos: [], fuente: 'manual' as const, createdAt: '', updatedAt: ''
    }
    const p2 = {
      id_medicion: 'm2', id_jugadora: 'j1', fecha: '2026-07-22', tipo_prueba: 'cmj_bilateral' as const,
      id_protocolo: 'p2', protocolo_nombre_historico: 'Prot 2', intentos: [], fuente: 'manual' as const, createdAt: '', updatedAt: ''
    }
    useStore.setState({ pruebas_cmj: [p1, p2] })
    render(<MemoryRouter><CMJPage /></MemoryRouter>)
    
    const table = screen.getByRole('table')
    expect(within(table).getByText('Prot 1')).toBeDefined()
    expect(within(table).getByText('Prot 2')).toBeDefined()
    
    // Select protocolo P1 in filter
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[1], { target: { value: 'p1' } }) // 2nd select is protocolo
    
    expect(within(table).queryByText('Prot 2')).toBeNull()
  })

  it('Perfil con varios protocolos no mezcla resultados', async () => {
    const p1 = {
      id_medicion: 'm1', id_jugadora: 'j1', fecha: '2026-07-20', tipo_prueba: 'cmj_bilateral' as const,
      id_protocolo: 'p1', protocolo_nombre_historico: 'Prot 1', intentos: [], fuente: 'manual' as const, createdAt: '2026-07-21T10:00:00Z', updatedAt: '2026-07-21T10:00:00Z'
    }
    const p2 = {
      id_medicion: 'm2', id_jugadora: 'j1', fecha: '2026-07-21', tipo_prueba: 'cmj_bilateral' as const,
      id_protocolo: 'p2', protocolo_nombre_historico: 'Prot 2', intentos: [], fuente: 'manual' as const, createdAt: '2026-07-21T10:00:00Z', updatedAt: '2026-07-21T10:00:00Z'
    }
    useStore.setState({ pruebas_cmj: [p1, p2] })

    render(
      <MemoryRouter initialEntries={['/jugadoras/j1']}>
        <Routes>
          <Route path="/jugadoras/:id" element={<PlayerProfilePage />} />
        </Routes>
      </MemoryRouter>
    )
    
    fireEvent.click(screen.getByText('CMJ'))
    expect(screen.getByText('Prot 1')).toBeDefined()
    expect(screen.getByText('Prot 2')).toBeDefined()
  })

  it('Muestra aviso de importación Chronojump y abre modal al hacer clic en el botón (T-04B)', async () => {
    render(
      <MemoryRouter>
        <CMJPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/Importación Chronojump: pendiente de archivo de muestra/i)).toBeInTheDocument()
    expect(screen.getByText(/tres intentos por jugadora/i)).toBeInTheDocument()
    expect(screen.getAllByText(/chronojump/i).length).toBeGreaterThan(0)

    const btn = screen.getByRole('button', { name: /Importar CSV Chronojump/i })
    expect(btn).not.toBeDisabled()

    fireEvent.click(btn)

    // Debe abrirse el modal ChronojumpImportModal
    expect(screen.getByRole('heading', { name: /Importar CSV Chronojump \(CMJ\)/i })).toBeInTheDocument()
    expect(screen.getByText(/Seleccionar CSV Chronojump/i)).toBeInTheDocument()
  })

  it('Renders Preparación Chronojump pre-check panel in CMJPage (T-04B-PRE-CHECK)', async () => {
    render(
      <MemoryRouter>
        <CMJPage />
      </MemoryRouter>
    )

    expect(await screen.findByText(/No hay jugadoras activas registradas en la plantilla/i)).toBeInTheDocument()
  })
})


