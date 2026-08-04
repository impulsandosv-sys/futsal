// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from './store'

vi.mock('@/db/database', () => ({
  db: {
    alertas: {
      update: vi.fn(() => Promise.resolve(1))
    }
  }
}))

describe('updateAlertaEstado - Fecha local de resolución', () => {
  beforeEach(() => {
    useStore.setState({
      alertas: [
        {
          id: 'alt_1',
          id_jugadora: 'J01',
          tipo: 'carga_alta',
          nivel: 'rojo',
          fecha: '2026-07-28',
          creada: '2026-07-28T22:30:00.000Z',
          fecha_creacion: '2026-07-28T22:30:00.000Z',
          estado: 'activa',
          leida: false,
          titulo: 'Alerta carga alta',
          mensaje: 'Test alerta'
        }
      ]
    })
  })

  it('1. Asigna fecha_resolucion en formato YYYY-MM-DD local al resolver una alerta', async () => {
    const mockDate = new Date(2026, 6, 28, 23, 45, 0) // 28 de Julio a las 23:45 hora local
    vi.setSystemTime(mockDate)

    await useStore.getState().updateAlertaEstado('alt_1', 'resuelta')

    const alertaModificada = useStore.getState().alertas.find(a => a.id === 'alt_1')
    expect(alertaModificada).toBeDefined()
    expect(alertaModificada?.estado).toBe('resuelta')
    expect(alertaModificada?.leida).toBe(true)
    expect(alertaModificada?.fecha_resolucion).toBe('2026-07-28')

    vi.useRealTimers()
  })

  it('2. Conserva los timestamps de creación técnicos intactos', async () => {
    await useStore.getState().updateAlertaEstado('alt_1', 'descartada')
    const alerta = useStore.getState().alertas.find(a => a.id === 'alt_1')

    expect(alerta?.creada).toBe('2026-07-28T22:30:00.000Z')
    expect(alerta?.fecha_creacion).toBe('2026-07-28T22:30:00.000Z')
  })
})
