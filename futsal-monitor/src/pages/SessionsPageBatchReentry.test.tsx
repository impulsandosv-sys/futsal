import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SessionsPage } from './SessionsPage'
import { useStore } from '@/store/store'

vi.mock('@/components/planning/WeeklyCalendar', () => ({
  WeeklyCalendar: () => <div data-testid="weekly-calendar">Calendar</div>
}))

describe('SessionsPage - Batch RPE Protection', () => {
  beforeEach(() => {
    useStore.setState({
      sesiones: [
        {
          id_sesion: 'ses_1',
          fecha: '2026-07-28',
          tipo_dia: 'Entreno',
          tipo_sesion: 'Fisico',
          duracion_planificada_min: 60,
          objetivo_principal: 'Fuerza',
          observaciones_grupo: '',
          estado: 'planificada'
        }
      ],
      jugadoras: [
        {
          id_jugadora: 'J01',
          nombre: 'Ana',
          fecha_nacimiento: '2000-01-01',
          posicion: 'Ala',
          altura_cm: 165,
          peso_kg: 60,
          imc: 22,
          grasa: 15,
          anos_experiencia_futsal: 5,
          historial_lesional: '',
          notas: '',
          activa: true
        }
      ],
      sesion_rpe: [],
      filters: {
        id_jugadora: '',
        fecha_desde: '',
        fecha_hasta: '',
        semana: '',
        tipo_sesion: '',
        estado: '',
        incluirPartidos: true,
        incluirGimnasio: true,
        incluirReadaptacion: true
      }
    })
  })

  it('1. Doble clic rápido dispara una sola llamada a saveRpeBatch', async () => {
    let resolveBatch: () => void
    const saveRpeBatchMock = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolveBatch = resolve
      })
    })

    useStore.setState({ saveRpeBatch: saveRpeBatchMock })

    render(<MemoryRouter><SessionsPage /></MemoryRouter>)

    // Cambiar a vista Historial
    const historialBtn = screen.getByText('Historial')
    fireEvent.click(historialBtn)

    // Abrir modal RPE
    const rpeButtons = screen.getAllByText('RPE')
    fireEvent.click(rpeButtons[0])

    // Cambiar asistencia a completa
    const selects = screen.getAllByRole('combobox')
    const selectAsistencia = selects[2]
    fireEvent.change(selectAsistencia, { target: { value: 'completa' } })

    // Seleccionar RPE
    fireEvent.change(selects[3], { target: { value: '7' } })

    const guardarBtn = screen.getByText('Guardar RPE')

    // Doble clic rápido
    fireEvent.click(guardarBtn)
    fireEvent.click(guardarBtn)
    fireEvent.click(guardarBtn)

    expect(saveRpeBatchMock).toHaveBeenCalledTimes(1)

    // Resolver la promesa
    resolveBatch!()
    await waitFor(() => {
      expect(screen.queryByText('Guardar RPE')).toBeNull()
    })
  })

  it('2. El botón queda deshabilitado durante el guardado y muestra Guardando...', async () => {
    let resolveBatch: () => void
    const saveRpeBatchMock = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolveBatch = resolve
      })
    })

    useStore.setState({ saveRpeBatch: saveRpeBatchMock })

    render(<MemoryRouter><SessionsPage /></MemoryRouter>)

    // Cambiar a vista Historial
    const historialBtn = screen.getByText('Historial')
    fireEvent.click(historialBtn)

    const rpeButtons = screen.getAllByText('RPE')
    fireEvent.click(rpeButtons[0])

    const selects = screen.getAllByRole('combobox')
    const selectAsistencia = selects[2]
    fireEvent.change(selectAsistencia, { target: { value: 'completa' } })

    const guardarBtn = screen.getByText('Guardar RPE')
    fireEvent.click(guardarBtn)

    const guardandoBtn = screen.getByText('Guardando...')
    expect(guardandoBtn).toBeDefined()
    expect(guardandoBtn.hasAttribute('disabled')).toBe(true)

    resolveBatch!()
    await waitFor(() => {
      expect(screen.queryByText('Guardando...')).toBeNull()
    })
  })

  it('3. Un error de persistencia no cierra el modal y permite reintentar', async () => {
    const spyConsole = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onUnhandled = () => {}
    process.on('unhandledRejection', onUnhandled)

    const saveRpeBatchMock = vi.fn().mockImplementation(() => {
      const errPromise = Promise.reject(new Error('Fallo de red Dexie'))
      errPromise.catch(() => {})
      return errPromise
    })
    useStore.setState({ saveRpeBatch: saveRpeBatchMock })

    render(<MemoryRouter><SessionsPage /></MemoryRouter>)

    // Cambiar a vista Historial
    const historialBtn = screen.getByText('Historial')
    fireEvent.click(historialBtn)

    const rpeButtons = screen.getAllByText('RPE')
    fireEvent.click(rpeButtons[0])

    const selects = screen.getAllByRole('combobox')
    const selectAsistencia = selects[2]
    fireEvent.change(selectAsistencia, { target: { value: 'completa' } })

    const guardarBtn = screen.getByText('Guardar RPE')
    fireEvent.click(guardarBtn)

    // El modal sigue abierto y el botón vuelve a estar activo para reintentar
    await waitFor(() => {
      const btnPostError = screen.getByText('Guardar RPE')
      expect(btnPostError).toBeDefined()
      expect(btnPostError.hasAttribute('disabled')).toBe(false)
    })

    process.off('unhandledRejection', onUnhandled)
    spyConsole.mockRestore()
  })
})
