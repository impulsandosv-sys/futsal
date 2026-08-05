import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.unmock('@/db/database')

import type { Sesion, Partido, Lesion, Wellness } from '@/types'
import { FutsalDB } from '@/db/database'

describe('Bloque A — Tipado Dexie de claves primarias (string key generics)', () => {
  let db: FutsalDB

  beforeEach(async () => {
    const mod = await vi.importActual<any>('@/db/database')
    db = mod.db as FutsalDB

    await db.sesiones.clear()
    await db.partidos.clear()
    await db.lesiones.clear()
    await db.wellness.clear()
  })

  it('1. .get(), .put() y .delete() con claves string en sesiones con verificación estricta de tipos', async () => {
    const s: Sesion = {
      id_sesion: 'S-2026-001',
      fecha: '2026-02-10',
      tipo_sesion: 'Entreno',
      rpe_promedio: 6,
      duracion_minutos: 90,
      notas: 'Sesión táctica'
    }

    const returnedKey: string = await db.sesiones.put(s)
    expect(returnedKey).toBe('S-2026-001')

    const fetched: Sesion | undefined = await db.sesiones.get('S-2026-001')
    expect(fetched).toBeDefined()
    expect(fetched?.duracion_minutos).toBe(90)

    await db.sesiones.delete('S-2026-001')
    const deleted: Sesion | undefined = await db.sesiones.get('S-2026-001')
    expect(deleted).toBeUndefined()
  })

  it('2. .get(), .put() y .delete() con claves string en partidos con verificación estricta de tipos', async () => {
    const p: Partido = {
      id_partido: 'P-2026-001',
      fecha: '2026-02-15',
      rival: 'Rival FC',
      condicion: 'Local',
      resultado: '3-1',
      goles_favor: 3,
      goles_contra: 1
    }

    const key: string = await db.partidos.put(p)
    expect(key).toBe('P-2026-001')

    const fetched: Partido | undefined = await db.partidos.get('P-2026-001')
    expect(fetched?.rival).toBe('Rival FC')

    await db.partidos.delete('P-2026-001')
    expect(await db.partidos.get('P-2026-001')).toBeUndefined()
  })

  it('3. .get(), .put() y .delete() con claves string en lesiones con verificación estricta de tipos', async () => {
    const l: Lesion = {
      id_lesion: 'L-2026-001',
      id_jugadora: 'J001',
      fecha_inicio: '2026-02-01',
      tipo_lesion: 'Esguince',
      zona_anatomica: 'Tobillo',
      severidad: 'Moderada',
      disponible: false,
      fase_rtp: 'Fase 1'
    }

    const key: string = await db.lesiones.put(l)
    expect(key).toBe('L-2026-001')

    const fetched: Lesion | undefined = await db.lesiones.get('L-2026-001')
    expect(fetched?.tipo_lesion).toBe('Esguince')

    await db.lesiones.delete('L-2026-001')
    expect(await db.lesiones.get('L-2026-001')).toBeUndefined()
  })

  it('4. .get() y .add() en tablas autoincrementales con clave number (wellness) con verificación estricta de tipos', async () => {
    const w: Wellness = {
      id_jugadora: 'J001',
      fecha: '2026-02-10',
      calidad_sueno: 8,
      fatiga: 3,
      dolor_muscular: 4,
      estres: 2,
      estado_animo: 9,
      score_wellness: 8.0,
      dolor_especifico: ''
    }

    const wellnessKey: number = await db.wellness.add(w)
    expect(typeof wellnessKey).toBe('number')

    const fetched: Wellness | undefined = await db.wellness.get(wellnessKey)
    expect(fetched?.id_jugadora).toBe('J001')
  })

  it('5. Comprobación estricta a nivel de compilación TypeScript (@ts-expect-error para claves inválidas)', async () => {
    // @ts-expect-error: sesiones key generic es string, pasar un number debe fallar en comprobación de tipos
    await db.sesiones.get(123)

    // @ts-expect-error: partidos key generic es string, pasar un number debe fallar en comprobación de tipos
    await db.partidos.delete(123)

    // @ts-expect-error: wellness key generic es number, pasar un string debe fallar en comprobación de tipos
    await db.wellness.get('incorrect-key')
  })
})
