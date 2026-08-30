// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AlertsPage } from './AlertsPage'
import { useStore } from '@/store/store'
import * as auditService from '@/services/auditService'
import type { Alerta, Jugadora } from '@/types'

vi.mock('@/db/database', () => ({
  db: {
    alertas: {
      update: vi.fn(() => Promise.resolve(1)),
      where: vi.fn(() => ({
        anyOf: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
          delete: vi.fn(() => Promise.resolve(0))
        }))
      }))
    }
  }
}))

const mockJugadoras: Jugadora[] = [
  {
    id_jugadora: 'J01',
    nombre: 'Ana López',
    fecha_nacimiento: '2000-01-01',
    posicion: 'Ala',
    altura_cm: 165,
    peso_kg: 58,
    imc: 21.3,
    grasa: 18,
    anos_experiencia_futsal: 5,
    historial_lesional: '',
    notas: '',
    activa: true
  }
]

const mockAlertas: Alerta[] = [
  {
    id: 1,
    tipo: 'carga_alta',
    prioridad: 'alto',
    nivel: 'alto',
    id_jugadora: 'J01',
    fecha: '2026-08-14',
    mensaje: 'ACWR elevado (1.65)',
    leida: false,
    creada: '2026-08-14T10:00:00.000Z',
    fecha_creacion: '2026-08-14T10:00:00.000Z',
    origen: 'Monitoreo Semanal',
    datos_sustento: 'ACWR: 1.65',
    estado: 'abierta',
    responsable: '',
    nota_decision: '',
    sugerencia: 'Reducir minutos de pista'
  },
  {
    id: 2,
    tipo: 'wellness_bajo',
    prioridad: 'medio',
    nivel: 'medio',
    id_jugadora: 'J01',
    fecha: '2026-08-14',
    mensaje: 'Fatiga alta y dolor muscular',
    leida: false,
    creada: '2026-08-14T10:00:00.000Z',
    fecha_creacion: '2026-08-14T10:00:00.000Z',
    origen: 'Wellness Matutino',
    datos_sustento: 'Fatiga: 4, Dolor: 5',
    estado: 'abierta',
    responsable: '',
    nota_decision: '',
    sugerencia: 'Evaluar con fisio'
  }
]

describe('AlertsPage - Resolución y Descarte de Alertas con Motivo Opcional (PR-2)', () => {
  beforeEach(() => {
    auditService.limpiarAuditoriaPruebas()
    useStore.setState({
      alertas: JSON.parse(JSON.stringify(mockAlertas)),
      jugadoras: mockJugadoras
    })
  })

  it('1. Resolver alerta abre modal con requireReason={false} y muestra que la nota es opcional', async () => {
    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>
    )

    const btnResolver = screen.getAllByRole('button', { name: /^Resolver$/i })[0]
    fireEvent.click(btnResolver)

    expect(screen.getByText('Resolver alerta')).toBeInTheDocument()
    expect(screen.getByText(/Motivo o nota \(opcional\)/i)).toBeInTheDocument()
    expect(screen.queryByText(/\* Obligatorio/i)).not.toBeInTheDocument()
  })

  it('2. Resolver alerta sin nota confirma y genera auditoría con "Sin comentario"', async () => {
    const spyAudit = vi.spyOn(auditService, 'registrarCambioAuditoria')

    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>
    )

    const btnResolver = screen.getAllByRole('button', { name: /^Resolver$/i })[0]
    fireEvent.click(btnResolver)

    const btnConfirmar = screen.getByRole('button', { name: /Confirmar cambio/i })
    fireEvent.click(btnConfirmar)

    await waitFor(() => {
      expect(useStore.getState().alertas.find((a) => a.id === 1)?.estado).toBe('resuelta')
    })

    expect(spyAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entidad: 'alerta',
        idEntidad: '1',
        idJugadora: 'J01',
        campoModificado: 'estado',
        valorAnterior: 'abierta',
        valorNuevo: 'resuelta'
      })
    )

    const auditHistory = auditService.obtenerHistorialAuditoria({ entidad: 'alerta' })
    expect(auditHistory).toHaveLength(1)
    expect(auditHistory[0].motivo).toBe('Sin comentario')
  })

  it('3. Resolver alerta con nota personalizada guarda el texto recortado en auditoría', async () => {
    const spyAudit = vi.spyOn(auditService, 'registrarCambioAuditoria')

    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>
    )

    const btnResolver = screen.getAllByRole('button', { name: /^Resolver$/i })[0]
    fireEvent.click(btnResolver)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '   Jugadora adaptó minutos y descansó   ' } })

    const btnConfirmar = screen.getByRole('button', { name: /Confirmar cambio/i })
    fireEvent.click(btnConfirmar)

    await waitFor(() => {
      expect(useStore.getState().alertas.find((a) => a.id === 1)?.estado).toBe('resuelta')
    })

    expect(spyAudit).toHaveBeenCalled()
    const auditHistory = auditService.obtenerHistorialAuditoria({ entidad: 'alerta' })
    expect(auditHistory).toHaveLength(1)
    expect(auditHistory[0].motivo).toBe('Jugadora adaptó minutos y descansó')
  })

  it('4. Descartar alerta abre modal de confirmación con título "Descartar alerta" y permite confirmar sin nota', async () => {
    const spyAudit = vi.spyOn(auditService, 'registrarCambioAuditoria')

    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>
    )

    const btnDescartar = screen.getAllByRole('button', { name: /^Descartar$/i })[0]
    fireEvent.click(btnDescartar)

    expect(screen.getByText('Descartar alerta')).toBeInTheDocument()
    expect(screen.getByText(/Motivo o nota \(opcional\)/i)).toBeInTheDocument()

    const btnConfirmar = screen.getByRole('button', { name: /Confirmar cambio/i })
    fireEvent.click(btnConfirmar)

    await waitFor(() => {
      expect(useStore.getState().alertas.find((a) => a.id === 1)?.estado).toBe('descartada')
    })

    expect(spyAudit).toHaveBeenCalled()

    const auditHistory = auditService.obtenerHistorialAuditoria({ entidad: 'alerta' })
    expect(auditHistory).toHaveLength(1)
    expect(auditHistory[0].motivo).toBe('Sin comentario')
    expect(auditHistory[0].valorNuevo).toBe('descartada')
  })

  it('5. Descartar alerta con nota guarda la justificación recortada', async () => {
    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>
    )

    const btnDescartar = screen.getAllByRole('button', { name: /^Descartar$/i })[1]
    fireEvent.click(btnDescartar)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '  Falso positivo por error de carga  ' } })

    const btnConfirmar = screen.getByRole('button', { name: /Confirmar cambio/i })
    fireEvent.click(btnConfirmar)

    await waitFor(() => {
      expect(useStore.getState().alertas.find((a) => a.id === 2)?.estado).toBe('descartada')
    })

    const auditHistory = auditService.obtenerHistorialAuditoria({ entidad: 'alerta' })
    expect(auditHistory[0].motivo).toBe('Falso positivo por error de carga')
    expect(auditHistory[0].valorNuevo).toBe('descartada')
  })

  it('6. Si falla la actualización en base de datos, el modal no se cierra con éxito falso', async () => {
    vi.spyOn(useStore.getState(), 'updateAlertaEstado').mockRejectedValueOnce(new Error('DB Error'))
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>
    )

    const btnResolver = screen.getAllByRole('button', { name: /^Resolver$/i })[0]
    fireEvent.click(btnResolver)

    const btnConfirmar = screen.getByRole('button', { name: /Confirmar cambio/i })
    fireEvent.click(btnConfirmar)

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalled()
    })

    // El modal sigue abierto y el estado no cambió
    expect(screen.getByText('Resolver alerta')).toBeInTheDocument()
    expect(useStore.getState().alertas.find((a) => a.id === 1)?.estado).toBe('abierta')
  })
})
