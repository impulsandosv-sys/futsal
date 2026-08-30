// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.unmock('@/db/database')

import { db } from '@/db/database'
import { useStore } from '@/store/store'
import { getTodayLocalISO } from '@/domain/dates/dates'
import { sumarDias } from '@/domain/menstrual/menstrualEngine'

describe('Menstrual Fase 4B - Modelo y Store', () => {
  beforeEach(async () => {
    await db.registro_menstrual.clear()
    await db.jugadoras.clear()
    await db.alertas.clear()
    await db.wellness.clear()
    useStore.setState({
      registros_menstruales: [],
      jugadoras: [],
      alertas: [],
      wellness: []
    })
  })

  it('1. Registro histórico sin accion_ajuste ni fecha_decision funciona', async () => {
    const { addRegistroMenstrual } = useStore.getState()
    const reg = await addRegistroMenstrual({
      id_jugadora: 'J1',
      fecha_inicio: getTodayLocalISO(),
      impacto_percibido: 5,
      comentario: 'Molestias'
    })
    expect(reg.accion_ajuste).toBeNull()
    expect(reg.fecha_decision).toBeNull()
  })

  it('2. Guardar decisión válida persiste accion, fecha_decision, nota, actualizado_en sin modificar creado_en', async () => {
    const { addRegistroMenstrual, updateRegistroMenstrual } = useStore.getState()
    const reg = await addRegistroMenstrual({
      id_jugadora: 'J1',
      fecha_inicio: '2023-01-01',
      impacto_percibido: 3
    })
    const createdTime = reg.creado_en

    // Wait a bit to ensure time difference if necessary, though mocked time is better, we'll just check it doesn't change
    await updateRegistroMenstrual(reg.id!, {
      fecha_inicio: '2023-01-01',
      impacto_percibido: 3,
      accion_ajuste: 'AJUSTE_VOLUMEN',
      fecha_decision: '2023-01-02',
      nota_ajuste: 'Revisado'
    })

    const { registros_menstruales } = useStore.getState()
    const updated = registros_menstruales.find(r => r.id === reg.id)
    expect(updated?.accion_ajuste).toBe('AJUSTE_VOLUMEN')
    expect(updated?.fecha_decision).toBe('2023-01-02')
    expect(updated?.nota_ajuste).toBe('Revisado')
    expect(updated?.creado_en).toBe(createdTime)
    expect(updated?.actualizado_en).not.toBe(createdTime)
  })

  it('3. Rechazar fecha_decision futura', async () => {
    const { addRegistroMenstrual, updateRegistroMenstrual } = useStore.getState()
    const reg = await addRegistroMenstrual({
      id_jugadora: 'J1',
      fecha_inicio: getTodayLocalISO(),
      impacto_percibido: 3
    })

    const futura = sumarDias(getTodayLocalISO(), 2)

    await expect(updateRegistroMenstrual(reg.id!, {
      fecha_inicio: getTodayLocalISO(),
      impacto_percibido: 3,
      fecha_decision: futura
    })).rejects.toThrow(/futuras/)
  })

  it('4. Permitir decisión sin acción y sin nota', async () => {
    const { addRegistroMenstrual, updateRegistroMenstrual } = useStore.getState()
    const reg = await addRegistroMenstrual({
      id_jugadora: 'J1',
      fecha_inicio: getTodayLocalISO(),
      impacto_percibido: 3
    })

    await expect(updateRegistroMenstrual(reg.id!, {
      fecha_inicio: getTodayLocalISO(),
      impacto_percibido: 3,
      accion_ajuste: null,
      nota_ajuste: null,
      fecha_decision: getTodayLocalISO()
    })).resolves.not.toThrow()
  })

  it('5. No crear ni modificar wellness, readiness, RPE, carga, lesión, sesión o disponibilidad', async () => {
    const { addRegistroMenstrual } = useStore.getState()
    await addRegistroMenstrual({
      id_jugadora: 'J1',
      fecha_inicio: getTodayLocalISO(),
      impacto_percibido: 8
    })

    // Impacto alto no crea wellness ni modifica nada
    const state = useStore.getState()
    expect(state.wellness.length).toBe(0)
    expect(state.readiness.length).toBe(0)
    expect(state.rpe_partido.length).toBe(0)
    expect(state.sesion_rpe.length).toBe(0)
    expect(state.carga_gps.length).toBe(0)
    expect(state.lesiones.length).toBe(0)
    // Nota: Disponibilidad (activa) no tiene escritura aislada en este flujo
  })
})
