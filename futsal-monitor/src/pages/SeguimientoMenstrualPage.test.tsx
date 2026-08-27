// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SeguimientoMenstrualPage } from './SeguimientoMenstrualPage'
import { useStore } from '@/store/store'
import type { Jugadora, RegistroMenstrual, Alerta } from '@/types'

describe('SeguimientoMenstrualPage — Pruebas de Interfaz y Flujos', () => {
  const jugadoraActiva: Jugadora = {
    id_jugadora: 'J01',
    nombre: 'Carla Gómez',
    posicion: 'Ala',
    activa: true
  }

  const jugadoraInactiva: Jugadora = {
    id_jugadora: 'J02',
    nombre: 'Lucía Fernández',
    posicion: 'Portera',
    activa: false
  }

  const hoyStr = new Date().toISOString().slice(0, 10)

  beforeEach(() => {
    vi.clearAllMocks()
    useStore.setState({
      jugadoras: [jugadoraActiva, jugadoraInactiva],
      registros_menstruales: [],
      alertas: [],
      addRegistroMenstrual: vi.fn(async (reg) => {
        const nuevo: RegistroMenstrual = {
          id: 101,
          ...reg,
          creado_en: new Date().toISOString(),
          actualizado_en: new Date().toISOString()
        }
        useStore.setState((s) => ({
          registros_menstruales: [nuevo, ...s.registros_menstruales]
        }))
        return nuevo
      }),
      updateRegistroMenstrual: vi.fn(async (reg) => {
        useStore.setState((s) => ({
          registros_menstruales: s.registros_menstruales.map((r) =>
            r.id === reg.id ? reg : r
          )
        }))
      }),
      deleteRegistroMenstrual: vi.fn(async (id) => {
        useStore.setState((s) => ({
          registros_menstruales: s.registros_menstruales.filter((r) => r.id !== id)
        }))
      }),
      updateAlertaEstado: vi.fn(async (id, nuevoEstado) => {
        useStore.setState((s) => ({
          alertas: s.alertas.map((a) => (a.id === id ? { ...a, estado: nuevoEstado } : a))
        }))

  it('7. Eliminar registro falla y muestra error sin cerrar modal', async () => {
    const reg = {
      id: 77,
      id_jugadora: 'J01',
      fecha_inicio: '2026-05-10',
      impacto_percibido: 2,
      creado_en: '',
      actualizado_en: ''
    }

    const deleteMock = vi.fn().mockRejectedValue(new Error('Error fingido al eliminar'))
    useStore.setState({ registros_menstruales: [reg as any], deleteRegistroMenstrual: deleteMock })
    renderComponent()

    const btnEliminar = screen.getByRole('button', { name: /eliminar/i })
    fireEvent.click(btnEliminar)

    const btnConfirmar = screen.getByRole('button', { name: 'Eliminar registro' })
    fireEvent.click(btnConfirmar)

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith(77)
    })

    expect(screen.getByText('Error fingido al eliminar')).toBeInTheDocument()
    expect(screen.getByText(/deseas eliminar el registro/i)).toBeInTheDocument() // modal sigue abierto
  })
})
    })
  })

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <SeguimientoMenstrualPage />
      </MemoryRouter>
    )
  }

  it('1. Renderiza el título y el disclaimer de contexto individual', () => {
    renderComponent()
    expect(screen.getByRole('heading', { level: 1, name: /seguimiento menstrual/i })).toBeInTheDocument()
    expect(
      screen.getByText(/registro voluntario comunicado por la jugadora/i)
    ).toBeInTheDocument()
  })

  it('2. Jugadora inactiva no aparece en el selector de nuevo registro, pero conserva su historial', () => {
    const regInactiva: RegistroMenstrual = {
      id: 1,
      id_jugadora: 'J02',
      fecha_inicio: '2026-05-01',
      impacto_percibido: 3,
      comentario: 'Registro histórico',
      creado_en: '',
      actualizado_en: ''
    }

    useStore.setState({ registros_menstruales: [regInactiva] })
    renderComponent()

    // El selector del formulario solo debe tener opción de Carla Gómez (activa)
    const select = screen.getByRole('combobox', { name: 'Jugadora' })
    expect(select).toHaveTextContent('Carla Gómez')
    expect(select).not.toHaveTextContent('Lucía Fernández')

    // Pero la tabla de historial sí muestra el registro de Lucía
    expect(screen.getByText('Lucía Fernández')).toBeInTheDocument()
    expect(screen.getAllByText(/inactiva/i).length).toBeGreaterThanOrEqual(1)
  })

  it('3. Formulario registra un nuevo inicio válido', async () => {
    renderComponent()

    const selectJugadora = screen.getByRole('combobox', { name: 'Jugadora' })
    fireEvent.change(selectJugadora, { target: { value: 'J01' } })

    const btnSubmit = screen.getByRole('button', { name: /guardar registro/i })
    fireEvent.click(btnSubmit)

    await waitFor(() => {
      expect(useStore.getState().addRegistroMenstrual).toHaveBeenCalledWith(
        expect.objectContaining({
          id_jugadora: 'J01',
          fecha_inicio: hoyStr,
          impacto_percibido: 3
        })
      )
    })

    expect(screen.getByText(/registro guardado correctamente/i)).toBeInTheDocument()
  })

  it('4. Resumen "Hoy" y "Últimos 7 días" muestran los registros correctos', () => {
    const regHoy: RegistroMenstrual = {
      id: 1,
      id_jugadora: 'J01',
      fecha_inicio: hoyStr,
      impacto_percibido: 4,
      creado_en: '',
      actualizado_en: ''
    }

    useStore.setState({ registros_menstruales: [regHoy] })
    renderComponent()

    expect(screen.getByText(`Hoy (${hoyStr})`)).toBeInTheDocument()
    expect(screen.getByText('1 inicio')).toBeInTheDocument()
    expect(screen.getByText('Últimos 7 días')).toBeInTheDocument()
  })

  it('5. Muestra recordatorios estimados y permite descartarlos', async () => {
    const alertaEstimada: Alerta = {
      id: 50,
      tipo: 'MENSTRUACION_PROXIMA_ESTIMADA',
      prioridad: 'bajo',
      id_jugadora: 'J01',
      fecha: hoyStr,
      mensaje: 'Carla Gómez: Recordatorio estimado',
      nivel: 'bajo',
      leida: false,
      creada: new Date().toISOString(),
      fecha_creacion: new Date().toISOString(),
      origen: 'Seguimiento Menstrual Estimado',
      datos_sustento: JSON.stringify({
        fecha_estimada: hoyStr,
        ultimo_inicio: '2026-07-29',
        mediana_intervalos: 28,
        intervalos_usados: [28, 28],
        variabilidad_reciente: false
      }),
      estado: 'abierta',
      responsable: '',
      nota_decision: '',
      sugerencia: 'Confirmar contexto'
    }

    useStore.setState({ alertas: [alertaEstimada] })
    renderComponent()

    expect(screen.getByText(/recordatorios estimados \(1\)/i)).toBeInTheDocument()
    expect(screen.getByText('Estimado hoy')).toBeInTheDocument()

    const btnDescartar = screen.getByRole('button', { name: /descartar/i })
    fireEvent.click(btnDescartar)

    await waitFor(() => {
      expect(useStore.getState().updateAlertaEstado).toHaveBeenCalledWith(50, 'descartada')
    })
  })

  it('6. Modal de confirmación al eliminar un registro', async () => {
    const reg: RegistroMenstrual = {
      id: 77,
      id_jugadora: 'J01',
      fecha_inicio: '2026-05-10',
      impacto_percibido: 2,
      creado_en: '',
      actualizado_en: ''
    }

    useStore.setState({ registros_menstruales: [reg] })
    renderComponent()

    const btnEliminar = screen.getByRole('button', { name: /eliminar/i })
    fireEvent.click(btnEliminar)

    expect(screen.getByText(/¿estás seguro de que deseas eliminar el registro de inicio/i)).toBeInTheDocument()

    const btnConfirmar = screen.getByRole('button', { name: 'Eliminar registro' })
    fireEvent.click(btnConfirmar)

    await waitFor(() => {
      expect(useStore.getState().deleteRegistroMenstrual).toHaveBeenCalledWith(77)
    })
  })
})
