import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Desmockear base de datos y servicio para usar Dexie real en memoria
vi.unmock('@/db/database')
vi.unmock('@/services/readiness')

import { FutsalDB } from '@/db/database'
import { recalcularReadinessJugadora } from '@/services/readiness'
import { obtenerCargasDiariasJugadora } from '@/domain/calculations/dailyLoad'
import { calcularResumenSemanal } from '@/domain/monitoring/monitoring'
import { construirDecisionDiaria } from '@/domain/dailyDecision/dailyDecisionEngine'
import type { Jugadora, Sesion, SesionRPE, RPE_Partido } from '@/types'

describe('BLOQUE B — Test de integración real de readiness con Dexie real', () => {
  let db: FutsalDB
  const J1 = 'JUG_READINESS_REAL'
  const jugadora: Jugadora = {
    id_jugadora: J1,
    nombre: 'Jugadora Test Real',
    activa: true,
    posicion: 'Ala',
    fecha_nacimiento: '2000-01-01',
    altura_cm: 168,
    peso_kg: 58,
    imc: 20.5,
    grasa: 18,
    anos_experiencia_futsal: 4,
    historial_lesional: '',
    notas: ''
  }

  beforeEach(async () => {
    const dbName = `futsal_test_db_${Date.now()}_${Math.random().toString(36).slice(2)}`
    db = new FutsalDB(dbName)
    await db.jugadoras.put(jugadora)
  })

  afterEach(async () => {
    if (db) {
      db.close()
      await db.delete()
    }
  })

  it('Escenario 1 — Solo sesión: recalcularReadinessJugadora usa carga diaria y persiste en Dexie real', async () => {
    const fecha = '2026-08-10'
    const sesiones: Sesion[] = [
      { id_sesion: 'S1', fecha, tipo_dia: 'Entreno', tipo_sesion: 'Campo', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'S1', id_jugadora: J1, rpe: 8, duracion_min: 50, carga_ua: 400, fecha }
    ]

    await db.sesiones.bulkPut(sesiones)
    await db.sesion_rpe.bulkPut(sesionesRPE)

    // Servicio real que persiste en Dexie real
    await recalcularReadinessJugadora(J1, fecha, db)

    // Lectura del readiness persistido en Dexie
    const readinessSaved = await db.readiness.where({ id_jugadora: J1, fecha }).first()
    expect(readinessSaved).toBeDefined()
    expect(readinessSaved!.factores.carga_aguda).toBe(400)

    // Verificación de consistencia entre capas (Fuente Única, Resumen, Decisión Diaria)
    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: fecha,
      fechaHasta: fecha,
      sesiones,
      sesionesRPE,
      rpePartidos: []
    })
    expect(map.get(fecha)!.carga).toBe(400)

    const resumen = calcularResumenSemanal(J1, fecha, sesiones, [], sesionesRPE, [], [], [])
    expect(resumen.carga_total).toBe(400)

    const decision = construirDecisionDiaria([jugadora], [], [], [], [], sesionesRPE, [], fecha, sesiones)
    const decisionJ1 = decision.jugadoras.find(x => x.id_jugadora === J1)!
    expect(decisionJ1.carga7d?.ultimaSesionCarga).toBe(400)
  })

  it('Escenario 2 — Solo partido: readiness real incorpora la carga de RPE_Partido', async () => {
    const fecha = '2026-08-11'
    const rpePartidos: RPE_Partido[] = [
      { id_partido: 'P1', id_jugadora: J1, rpe: 10, minutos_jugados: 30, carga_ua: 300, fecha }
    ]

    await db.rpe_partido.bulkPut(rpePartidos)

    await recalcularReadinessJugadora(J1, fecha, db)

    const readinessSaved = await db.readiness.where({ id_jugadora: J1, fecha }).first()
    expect(readinessSaved).toBeDefined()
    expect(readinessSaved!.factores.carga_aguda).toBe(300)

    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: fecha,
      fechaHasta: fecha,
      sesiones: [],
      sesionesRPE: [],
      rpePartidos
    })
    expect(map.get(fecha)!.carga).toBe(300)

    const resumen = calcularResumenSemanal(J1, fecha, [], [], [], rpePartidos, [], [])
    expect(resumen.carga_total).toBe(300)

    const decision = construirDecisionDiaria([jugadora], [], [], [], [], [], rpePartidos, fecha, [])
    const decisionJ1 = decision.jugadoras.find(x => x.id_jugadora === J1)!
    expect(decisionJ1.carga7d?.ultimaSesionCarga).toBe(300)
  })

  it('Escenario 3 — Sesión vinculada + partido: readiness y todas las capas deduplican por id_partido', async () => {
    const fecha = '2026-08-12'
    const sesiones: Sesion[] = [
      { id_sesion: 'S_PARTIDO', id_partido: 'P_VINCULADO', fecha, tipo_dia: 'Partido', tipo_sesion: 'Partido', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'S_PARTIDO', id_jugadora: J1, rpe: 7, duracion_min: 60, carga_ua: 420, fecha }
    ]
    const rpePartidos: RPE_Partido[] = [
      { id_partido: 'P_VINCULADO', id_jugadora: J1, rpe: 9, minutos_jugados: 40, carga_ua: 360, fecha }
    ]

    await db.sesiones.bulkPut(sesiones)
    await db.sesion_rpe.bulkPut(sesionesRPE)
    await db.rpe_partido.bulkPut(rpePartidos)

    await recalcularReadinessJugadora(J1, fecha, db)

    const readinessSaved = await db.readiness.where({ id_jugadora: J1, fecha }).first()
    expect(readinessSaved).toBeDefined()
    // Solo toma la carga del partido (360), no 420 + 360 = 780
    expect(readinessSaved!.factores.carga_aguda).toBe(360)

    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: fecha,
      fechaHasta: fecha,
      sesiones,
      sesionesRPE,
      rpePartidos
    })
    expect(map.get(fecha)!.carga).toBe(360)

    const resumen = calcularResumenSemanal(J1, fecha, sesiones, [], sesionesRPE, rpePartidos, [], [])
    expect(resumen.carga_total).toBe(360)

    const decision = construirDecisionDiaria([jugadora], [], [], [], [], sesionesRPE, rpePartidos, fecha, sesiones)
    const decisionJ1 = decision.jugadoras.find(x => x.id_jugadora === J1)!
    expect(decisionJ1.carga7d?.ultimaSesionCarga).toBe(360)
  })

  it('Escenario 4 — Sesión tipo Partido sin vínculo: ambos registros se conservan sin deduplicación ciega', async () => {
    const fecha = '2026-08-13'
    const sesiones: Sesion[] = [
      { id_sesion: 'S_SIN_LINK', fecha, tipo_dia: 'Partido', tipo_sesion: 'Partido', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'S_SIN_LINK', id_jugadora: J1, rpe: 6, duracion_min: 50, carga_ua: 300, fecha }
    ]
    const rpePartidos: RPE_Partido[] = [
      { id_partido: 'P_OTRO', id_jugadora: J1, rpe: 8, minutos_jugados: 30, carga_ua: 240, fecha }
    ]

    await db.sesiones.bulkPut(sesiones)
    await db.sesion_rpe.bulkPut(sesionesRPE)
    await db.rpe_partido.bulkPut(rpePartidos)

    await recalcularReadinessJugadora(J1, fecha, db)

    const readinessSaved = await db.readiness.where({ id_jugadora: J1, fecha }).first()
    expect(readinessSaved).toBeDefined()
    // Ambas cargas se suman (300 + 240 = 540) al no haber enlace id_partido explícito
    expect(readinessSaved!.factores.carga_aguda).toBe(540)

    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: fecha,
      fechaHasta: fecha,
      sesiones,
      sesionesRPE,
      rpePartidos
    })
    expect(map.get(fecha)!.carga).toBe(540)

    const resumen = calcularResumenSemanal(J1, fecha, sesiones, [], sesionesRPE, rpePartidos, [], [])
    expect(resumen.carga_total).toBe(540)

    const decision = construirDecisionDiaria([jugadora], [], [], [], [], sesionesRPE, rpePartidos, fecha, sesiones)
    const decisionJ1 = decision.jugadoras.find(x => x.id_jugadora === J1)!
    expect(decisionJ1.carga7d?.ultimaSesionCarga).toBe(540)
  })

  it('Escenario 5 — Carga cero: se registra y persiste cuantitativamente como 0 (no como null ni sin registro)', async () => {
    const fecha = '2026-08-14'
    const sesiones: Sesion[] = [
      { id_sesion: 'S0', fecha, tipo_dia: 'Entreno', tipo_sesion: 'Fisico', objetivo_principal: '', observaciones_grupo: '' }
    ]
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'S0', id_jugadora: J1, rpe: 0, duracion_min: 60, carga_ua: 0, fecha, asistencia: 'ausente' }
    ]

    await db.sesiones.bulkPut(sesiones)
    await db.sesion_rpe.bulkPut(sesionesRPE)

    await recalcularReadinessJugadora(J1, fecha, db)

    const readinessSaved = await db.readiness.where({ id_jugadora: J1, fecha }).first()
    expect(readinessSaved).toBeDefined()
    expect(readinessSaved!.factores.carga_aguda).toBe(0)

    const map = obtenerCargasDiariasJugadora({
      jugadoraId: J1,
      fechaDesde: fecha,
      fechaHasta: fecha,
      sesiones,
      sesionesRPE,
      rpePartidos: []
    })
    const entry = map.get(fecha)!
    expect(entry.tieneDato).toBe(true)
    expect(entry.carga).toBe(0)
  })
})
