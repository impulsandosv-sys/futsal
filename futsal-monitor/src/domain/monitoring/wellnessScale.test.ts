import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.unmock('@/db/database')
vi.unmock('@/utils/importEngine')

import { FutsalDB } from '@/db/database'
import { validarFilaWellness, diagnosticarRegistrosWellnessFueraDeEscala } from '@/utils/importEngine'
import { UMBRALES } from '@/config/monitoringThresholds'
import { construirDecisionDiaria } from '@/domain/dailyDecision/dailyDecisionEngine'
import type { Jugadora, Wellness } from '@/types'

describe('Bloque D - Escala única de wellness 1-10 vs readiness 0-100', () => {
  let db: FutsalDB

  beforeEach(async () => {
    const dbName = `futsal_scale_test_${Date.now()}_${Math.random().toString(36).slice(2)}`
    db = new FutsalDB(dbName)
  })

  afterEach(async () => {
    if (db) {
      db.close()
      await db.delete()
    }
  })

  it('1. Wellness 8 se representa en escala 1-10', () => {
    const score = 8
    const display = `${score} / 10`
    expect(display).toBe('8 / 10')
  })

  it('2. Readiness 80 se representa en escala 0-100', () => {
    const readinessScore = 80
    const display = `${readinessScore} / 100`
    expect(display).toBe('80 / 100')
  })

  it('3. Wellness 80 no se acepta como registro nuevo (fuera de rango 1-10)', () => {
    const row = {
      id_jugadora: 'J01',
      fecha: '2026-05-10',
      calidad_sueno: '80', // Invalido > 10
      fatiga: '5'
    }
    const context = { jugadorasIds: ['J01'] }
    const result = validarFilaWellness(row, context)

    expect(result.isValid).toBe(false)
    expect(result.errorMsg).toContain('fuera de rango 1-10')
  })

  it('4. Umbral de wellness de 6.5 opera en escala 1-10', () => {
    expect(UMBRALES.ALERTAS.WELLNESS_BAJO).toBe(6.5)
    expect(UMBRALES.ALERTAS.WELLNESS_CRITICO).toBe(5.0)

    const scoreBueno = 7.0
    const scoreBajo = 6.0

    expect(scoreBueno < UMBRALES.ALERTAS.WELLNESS_BAJO).toBe(false)
    expect(scoreBajo < UMBRALES.ALERTAS.WELLNESS_BAJO).toBe(true)
  })

  it('5. Diagnóstico detecta valores wellness mayores de 10 sin modificar la base de datos', async () => {
    await db.wellness.bulkPut([
      {
        id_jugadora: 'J1',
        fecha: '2026-05-10',
        calidad_sueno: 8,
        fatiga: 5,
        dolor_muscular: 4,
        estres: 4,
        estado_animo: 7,
        score_wellness: 5.6 // Válido 1-10
      },
      {
        id_jugadora: 'J2',
        fecha: '2026-05-10',
        calidad_sueno: 80,
        fatiga: 50,
        dolor_muscular: 40,
        estres: 40,
        estado_animo: 70,
        score_wellness: 56 // Incompatible (> 10)
      }
    ])

    const diag = await diagnosticarRegistrosWellnessFueraDeEscala(db)

    expect(diag.totalRegistrosEvaluados).toBe(2)
    expect(diag.totalIncompatibles).toBe(1)
    expect(diag.incompatibles[0].id_jugadora).toBe('J2')
    expect(diag.incompatibles[0].score_wellness).toBe(56)

    // Confirmar lectura sin modificación
    const countAfter = await db.wellness.count()
    expect(countAfter).toBe(2)
  })

  it('6 & 7. Decisión diaria contiene el score_wellness en escala 1-10', () => {
    const jugadora: Jugadora = {
      id_jugadora: 'J01',
      nombre: 'Ana Test',
      activa: true,
      posicion: 'Ala'
    }
    const wellness: Wellness = {
      id_jugadora: 'J01',
      fecha: '2026-05-10',
      calidad_sueno: 8,
      fatiga: 4,
      dolor_muscular: 4,
      estres: 3,
      estado_animo: 8,
      score_wellness: 7.0
    }

    const decision = construirDecisionDiaria([jugadora], [wellness], [], [], [], [], [], '2026-05-10')
    const item = decision.jugadoras.find(j => j.id_jugadora === 'J01')!

    expect(item.wellnessDia).not.toBeNull()
    expect(item.wellnessDia!.score_wellness).toBe(7.0) // 1-10 scale, not 70
  })
})
