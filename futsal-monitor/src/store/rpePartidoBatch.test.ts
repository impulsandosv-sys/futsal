import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.unmock('@/db/database')
vi.unmock('@/services/readiness')
vi.unmock('@/services/resumenSemanal')

import { db } from '@/db/database'
import { useStore } from '@/store/store'
import type { Partido, RPE_Partido } from '@/types'

describe('saveRpePartidoBatch', () => {
  beforeEach(async () => {
    await Promise.all([
      db.jugadoras.clear(),
      db.partidos.clear(),
      db.rpe_partido.clear(),
      db.readiness.clear(),
      db.resumen_semanal.clear(),
      db.alertas.clear(),
      db.wellness.clear(),
      db.sesion_rpe.clear(),
      db.sesiones.clear(),
    ])
    useStore.setState({ isAuthenticated: true, filters: {} })

    await db.jugadoras.bulkAdd([
      { id_jugadora: 'j1', nombre: 'Jugadora 1', fecha_nacimiento: '2000-01-01', activa: true, demarcacion: 'Ala' },
      { id_jugadora: 'j2', nombre: 'Jugadora 2', fecha_nacimiento: '2000-01-01', activa: true, demarcacion: 'Cierre' },
    ])
    const p1: Partido = {
      id_partido: 'p1',
      fecha: '2026-08-10',
      rival: 'Rival A',
      competicion: 'Liga',
      resultado: '1-1',
      lugar: 'Local'
    }
    await db.partidos.add(p1)
    await useStore.getState().loadAll()
  })

  it('guarda múltiples rpe_partido en lote correctamente y re-calcula estado una vez', async () => {
    const store = useStore.getState()
    const rpes: RPE_Partido[] = [
      { id_partido: 'p1', id_jugadora: 'j1', minutos_jugados: 30, rpe: 8, participacion: 'parcial', fecha: '2026-08-10', carga_ua: 240 },
      { id_partido: 'p1', id_jugadora: 'j2', minutos_jugados: 0, rpe: null, participacion: 'no_convocada', fecha: '2026-08-10', carga_ua: 0 }
    ]

    await store.saveRpePartidoBatch(rpes)

    const updatedStore = useStore.getState()
    const j1 = updatedStore.rpe_partido.find(r => r.id_jugadora === 'j1')
    const j2 = updatedStore.rpe_partido.find(r => r.id_jugadora === 'j2')

    expect(j1).toBeDefined()
    expect(j1?.carga_ua).toBe(240)
    expect(j1?.minutos_jugados).toBe(30)

    expect(j2).toBeDefined()
    expect(j2?.carga_ua).toBe(0)
    expect(j2?.minutos_jugados).toBe(0)

    // Check that we don't have duplicated entries
    expect(updatedStore.rpe_partido.length).toBe(2)
  })

  it('actualiza un RPE de partido existente y mantiene la identidad funcional', async () => {
    const store = useStore.getState()
    // First save
    await store.saveRpePartidoBatch([{
      id_partido: 'p1', id_jugadora: 'j1', minutos_jugados: 30, rpe: 8, participacion: 'parcial', fecha: '2026-08-10', carga_ua: 240
    }])

    expect(useStore.getState().rpe_partido.length).toBe(1)
    const idFirstSave = useStore.getState().rpe_partido[0].id

    // Update with batch
    await store.saveRpePartidoBatch([{
      id_partido: 'p1', id_jugadora: 'j1', minutos_jugados: 40, rpe: 9, participacion: 'completa', fecha: '2026-08-10', carga_ua: 360
    }])

    const updatedRpes = useStore.getState().rpe_partido
    expect(updatedRpes.length).toBe(1)
    expect(updatedRpes[0].id).toBe(idFirstSave) // Id dexie debe mantenerse
    expect(updatedRpes[0].carga_ua).toBe(360)
  })

  it('recalcula la carga_ua antes de guardar, ignorando la recibida', async () => {
    const store = useStore.getState()
    const rpes: RPE_Partido[] = [
      // Entrada con 30 minutos, RPE 8 y carga_ua: 999 -> debe persistir 240
      { id_partido: 'p1', id_jugadora: 'j1', minutos_jugados: 30, rpe: 8, participacion: 'parcial', fecha: '2026-08-10', carga_ua: 999 },
      // Entrada con 0 minutos explícitos -> debe persistir carga 0
      { id_partido: 'p1', id_jugadora: 'j2', minutos_jugados: 0, rpe: null, participacion: 'no_convocada', fecha: '2026-08-10', carga_ua: 100 }
    ]

    await store.saveRpePartidoBatch(rpes)

    const updatedStore = useStore.getState()
    const j1 = updatedStore.rpe_partido.find(r => r.id_jugadora === 'j1')
    const j2 = updatedStore.rpe_partido.find(r => r.id_jugadora === 'j2')

    expect(j1?.carga_ua).toBe(240)
    expect(j2?.carga_ua).toBe(0)
  })



  it('valida que no se guarden datos requeridos ausentes y devuelve error', async () => {
    const store = useStore.getState()
    const rpes: RPE_Partido[] = [
      { id_partido: 'p1', id_jugadora: 'j1', minutos_jugados: null, rpe: null, participacion: 'parcial', fecha: '2026-08-10', carga_ua: null as any }
    ]

    await expect(store.saveRpePartidoBatch(rpes)).rejects.toThrow(/Errores de validación/)
  })
})
