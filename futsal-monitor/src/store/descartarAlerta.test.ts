// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from './store'
import { getEstadoEfectivo, esAlertaActiva } from '@/utils/alerts'
import type { Alerta } from '@/types'

const mockUpdate = vi.fn(() => Promise.resolve(1))

vi.mock('@/db/database', () => ({
  db: {
    alertas: {
      update: (...args: any[]) => mockUpdate(...args)
    }
  }
}))

describe('Descartar Alerta - Flujo de Dominio y Persistencia', () => {
  beforeEach(() => {
    mockUpdate.mockClear()
    useStore.setState({ alertas: [] })
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 14, 12, 0, 0)) // 14 Agosto 2026, 12:00
  })

  const baseAlerta: Alerta = {
    id: 1,
    tipo: 'carga_alta',
    prioridad: 'medio',
    nivel: 'medio',
    id_jugadora: 'J01',
    fecha: '2026-08-14',
    mensaje: 'Alerta test',
    leida: false,
    creada: '2026-08-14T10:00:00.000Z',
    fecha_creacion: '2026-08-14T10:00:00.000Z',
    origen: 'test',
    datos_sustento: 'test',
    estado: 'abierta',
    responsable: '',
    nota_decision: '',
    sugerencia: 'test'
  }

  it('1. Descartar una alerta sin motivo ni responsable y 2. Cambio a descartada y 3. fecha_resolucion', async () => {
    useStore.setState({ alertas: [{ ...baseAlerta }] })

    await useStore.getState().updateAlertaEstado(1, 'descartada')

    const enStore = useStore.getState().alertas[0]
    expect(enStore.estado).toBe('descartada')
    expect(enStore.fecha_resolucion).toBe('2026-08-14')
    expect(enStore.responsable).toBe('')
    expect(enStore.nota_decision).toBe('')
    expect(enStore.leida).toBe(true)

    expect(mockUpdate).toHaveBeenCalledWith(1, {
      estado: 'descartada',
      leida: true,
      fecha_resolucion: '2026-08-14'
    })
  })

  it('4. Compatibilidad de alertas antiguas sin estado interpretadas como activas', () => {
    const alertaAntigua = { ...baseAlerta } as any
    delete alertaAntigua.estado

    expect(getEstadoEfectivo(alertaAntigua)).toBe('abierta')
    expect(esAlertaActiva(alertaAntigua)).toBe(true)
  })

  it('5. Alerta activa con leida=true sigue considerándose activa si estado no es descartada', () => {
    const alertaLeida: Alerta = { ...baseAlerta, leida: true, estado: 'abierta' }

    expect(getEstadoEfectivo(alertaLeida)).toBe('abierta')
    expect(esAlertaActiva(alertaLeida)).toBe(true)
  })

  it('6 & 7. El filtro activo depende de estado efectivo, y la descartada no aparece en activas', async () => {
    useStore.setState({ alertas: [{ ...baseAlerta }] })

    expect(esAlertaActiva(useStore.getState().alertas[0])).toBe(true)

    await useStore.getState().updateAlertaEstado(1, 'descartada')
    expect(esAlertaActiva(useStore.getState().alertas[0])).toBe(false)
  })

  it('8. El descarte no elimina físicamente el registro de Dexie (solo llama update)', async () => {
    useStore.setState({ alertas: [{ ...baseAlerta }] })
    await useStore.getState().updateAlertaEstado(1, 'descartada')

    // Si usara delete habría fallado, pero solo llamó a update
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('9. Idempotencia: descartar varias veces mantiene el estado coherente', async () => {
    useStore.setState({ alertas: [{ ...baseAlerta }] })

    await useStore.getState().updateAlertaEstado(1, 'descartada')
    expect(mockUpdate).toHaveBeenCalledTimes(1)

    // Cambiamos hora
    vi.setSystemTime(new Date(2026, 7, 15, 12, 0, 0))
    await useStore.getState().updateAlertaEstado(1, 'descartada')
    expect(mockUpdate).toHaveBeenCalledTimes(2)

    const enStore = useStore.getState().alertas[0]
    expect(enStore.estado).toBe('descartada')
  })

  it('10. Si falla la persistencia, no actualiza el store', async () => {
    useStore.setState({ alertas: [{ ...baseAlerta }] })
    mockUpdate.mockRejectedValueOnce(new Error('DB Error'))

    try {
      await useStore.getState().updateAlertaEstado(1, 'descartada')
    } catch {}

    const enStore = useStore.getState().alertas[0]
    expect(enStore.estado).toBe('abierta') // No cambió
  })
})
