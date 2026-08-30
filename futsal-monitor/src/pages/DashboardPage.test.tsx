import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useStore } from '@/store/store'
import { DashboardPage } from './DashboardPage'
import { getTodayLocalISO } from '@/domain/dates/dates'

// Evitar error de localStorage en entorno de test
if (typeof window !== 'undefined' && !window.localStorage) {
  Object.defineProperty(window, 'localStorage', {
    value: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }
  })
}

describe('DashboardPage - Fase 4B', () => {
  it('Muestra ContextoMenstrualWidget y permite abrir el modal sin exponer comentarios', () => {
    useStore.setState({
      jugadoras: [{ id_jugadora: 'J1', nombre: 'Ana Lopez', activa: true, posicion: 'Ala', fecha_nacimiento: '2000-01-01', altura_cm: 160, peso_kg: 60, imc: 23, grasa: 20, anos_experiencia_futsal: 2, historial_lesional: '', notas: '' }],
      wellness: [],
      registros_menstruales: [
        {
          id: 1,
          id_jugadora: 'J1',
          fecha_inicio: getTodayLocalISO(),
          impacto_percibido: 7,
          comentario: 'Secreto medico',
          nota_ajuste: 'Nota secreta',
          creado_en: '2023',
          actualizado_en: '2023'
        }
      ],
      alertas: [],
      sesiones: [], partidos: [], lesiones: [], tests: [], rpe_partido: [],
      sesion_rpe: [], readiness: [], historial_importaciones: [], ciclo_menstrual: [],
      carga_gps: [], fuerza_vbt: []
    })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    // ContextoMenstrualWidget está presente
    expect(screen.getByText('Contexto menstrual del día')).toBeInTheDocument()

    // Aparece la jugadora
    expect(screen.getAllByText('Ana Lopez')[0]).toBeInTheDocument()
    expect(screen.getByText('Impacto percibido: 7/10')).toBeInTheDocument()

    // Comentarios excluidos
    expect(screen.queryByText('Secreto medico')).not.toBeInTheDocument()
    expect(screen.queryByText('Nota secreta')).not.toBeInTheDocument()

    // Abrir modal
    const btn = screen.getByText('Registrar decisión')
    fireEvent.click(btn)

    expect(screen.getByText('Decisión operativa menstrual')).toBeInTheDocument()
    // El select está
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
