import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { WeeklySummaryPage } from './WeeklySummaryPage'
import { useStore } from '@/store/store'

vi.mock('@/store/store', () => ({
  useStore: vi.fn()
}))

// Mock de exportPDF y Excel
vi.mock('@/utils/export', () => ({ exportToExcel: vi.fn() }))
vi.mock('@/utils/pdf', () => ({ generatePDFStaff: vi.fn() }))

describe('WeeklySummaryPage - Exposicion Competitiva Integration', () => {
  beforeEach(() => {
    vi.mocked(useStore).mockReturnValue({
      jugadoras: [
        { id_jugadora: 'j1', nombre: 'Jugadora 1', posicion: 'Ala', estado_activo: true }
      ],
      sesiones: [],
      partidos: [],
      sesion_rpe: [],
      rpe_partido: [
        { id_registro: 'r1', id_jugadora: 'j1', id_partido: 'p1', fecha: '2026-08-05', minutos_jugados: 30 }
      ],
      resumen_semanal: [
        { 
          id: 'rs1', semana: '2026-W32', id_jugadora: 'j1', 
          carga_entreno: 0, carga_partido: 0, carga_total: 0, carga_cronica: 0, acwr: 1, wellness_medio: 0, num_sesiones: 0, estado: 'optimo'
        }
      ],
      filters: { semana: '2026-W32' },
      setFilter: vi.fn(),
      generateWeeklySummary: vi.fn()
    } as import("@/store/store").StoreState)
  })

  it('Resumen semanal: muestra solo datos de cada jugadora, respetando la fecha', async () => {
    render(
      <MemoryRouter>
        <WeeklySummaryPage />
      </MemoryRouter>
    )

    // Busca los valores del Card renderizado en fila
    expect(screen.getByText('30')).toBeInTheDocument() // Minutos
    // El badge parcial se deberia mostrar (1-39 mins)
    expect(screen.getByText('Parcial')).toBeInTheDocument()
  })
})
