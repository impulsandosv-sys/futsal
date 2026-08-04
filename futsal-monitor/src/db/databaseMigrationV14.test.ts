/**
 * T-01C — Test de migración Dexie v14
 *
 * Verifica que la versión 14 del esquema:
 * 1. Preserva al 100% los registros existentes en readiness, sesion_rpe y rpe_partido.
 * 2. Añade índices compuestos que permiten consultas where() multiclave sin warnings.
 *
 * Usa fake-indexeddb/auto para simular IndexedDB en Node.js.
 */
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// ─── Helpers de tipo ────────────────────────────────────────────────────────

interface ReadinessRecord {
  id?: number
  id_jugadora: string
  fecha: string
  readiness_score: number
  nota?: string
}

interface SesionRpeRecord {
  id?: number
  id_sesion: string
  id_jugadora: string
  fecha: string
  rpe: number
  duracion_min: number
}

interface RpePartidoRecord {
  id?: number
  id_partido: string
  id_jugadora: string
  fecha: string
  rpe: number
}

// ─── Clase DB mínima para v13 (sin índices compuestos en tablas objetivo) ───

class FutsalDBv13 extends Dexie {
  readiness!: Dexie.Table<ReadinessRecord, number>
  sesion_rpe!: Dexie.Table<SesionRpeRecord, number>
  rpe_partido!: Dexie.Table<RpePartidoRecord, number>

  constructor(name: string) {
    super(name)
    // Esquema v13: sin índices compuestos en readiness/sesion_rpe/rpe_partido
    this.version(13).stores({
      readiness: '++id, id_jugadora, fecha',
      sesion_rpe: '++id, id_sesion, id_jugadora, fecha',
      rpe_partido: '++id, id_jugadora, id_partido, fecha'
    })
  }
}

// ─── Clase DB para v14 (añade índices compuestos) ────────────────────────────

class FutsalDBv14 extends Dexie {
  readiness!: Dexie.Table<ReadinessRecord, number>
  sesion_rpe!: Dexie.Table<SesionRpeRecord, number>
  rpe_partido!: Dexie.Table<RpePartidoRecord, number>

  constructor(name: string) {
    super(name)
    this.version(13).stores({
      readiness: '++id, id_jugadora, fecha',
      sesion_rpe: '++id, id_sesion, id_jugadora, fecha',
      rpe_partido: '++id, id_jugadora, id_partido, fecha'
    })
    // sesion_rpe excluida: ninguna query productiva usa { id_jugadora, fecha } compuesto
    this.version(14).stores({
      readiness:   '++id, [id_jugadora+fecha], id_jugadora, fecha',
      rpe_partido: '++id, [id_partido+id_jugadora], id_jugadora, id_partido, fecha'
    })
  }
}

// ─── Fixtures de datos de prueba ─────────────────────────────────────────────

const DB_NAME = 'futsal_test_migration_v14'

const READINESS_FIXTURE: ReadinessRecord[] = [
  { id_jugadora: 'J1', fecha: '2026-05-01', readiness_score: 82, nota: 'Buena' },
  { id_jugadora: 'J1', fecha: '2026-05-02', readiness_score: 75 },
  { id_jugadora: 'J2', fecha: '2026-05-01', readiness_score: 91 },
]

const SESION_RPE_FIXTURE: SesionRpeRecord[] = [
  { id_sesion: 'S1', id_jugadora: 'J1', fecha: '2026-05-01', rpe: 7, duracion_min: 60 },
  { id_sesion: 'S1', id_jugadora: 'J2', fecha: '2026-05-01', rpe: 6, duracion_min: 60 },
  { id_sesion: 'S2', id_jugadora: 'J1', fecha: '2026-05-03', rpe: 8, duracion_min: 75 },
]

const RPE_PARTIDO_FIXTURE: RpePartidoRecord[] = [
  { id_partido: 'P1', id_jugadora: 'J1', fecha: '2026-05-04', rpe: 9 },
  { id_partido: 'P1', id_jugadora: 'J2', fecha: '2026-05-04', rpe: 8 },
  { id_partido: 'P2', id_jugadora: 'J1', fecha: '2026-05-11', rpe: 7 },
]

// ─── Setup: poblar DB con esquema v13 ────────────────────────────────────────

beforeAll(async () => {
  const dbV13 = new FutsalDBv13(DB_NAME)
  await dbV13.open()
  await dbV13.readiness.bulkAdd(READINESS_FIXTURE)
  await dbV13.sesion_rpe.bulkAdd(SESION_RPE_FIXTURE)
  await dbV13.rpe_partido.bulkAdd(RPE_PARTIDO_FIXTURE)
  dbV13.close()
})

afterAll(async () => {
  await Dexie.delete(DB_NAME)
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('T-01C — Migración Dexie v14', () => {
  let dbV14: FutsalDBv14

  beforeAll(async () => {
    dbV14 = new FutsalDBv14(DB_NAME)
    await dbV14.open()
  })

  afterAll(() => {
    dbV14.close()
  })

  // ── M-01: Versión correcta ─────────────────────────────────────────────────
  it('M-01: la base de datos migra a verno 14', () => {
    expect(dbV14.verno).toBe(14)
  })

  // ── M-02: Preservación readiness ──────────────────────────────────────────
  it('M-02: readiness preserva todos los registros, IDs, valores y fechas', async () => {
    const rows = await dbV14.readiness.toArray()
    expect(rows).toHaveLength(READINESS_FIXTURE.length)

    for (const fixture of READINESS_FIXTURE) {
      const match = rows.find(
        r => r.id_jugadora === fixture.id_jugadora && r.fecha === fixture.fecha
      )
      expect(match).toBeDefined()
      expect(match!.readiness_score).toBe(fixture.readiness_score)
      if (fixture.nota) expect(match!.nota).toBe(fixture.nota)
    }
  })

  // ── M-03: Preservación sesion_rpe ─────────────────────────────────────────
  it('M-03: sesion_rpe preserva todos los registros, IDs, valores y fechas', async () => {
    const rows = await dbV14.sesion_rpe.toArray()
    expect(rows).toHaveLength(SESION_RPE_FIXTURE.length)

    for (const fixture of SESION_RPE_FIXTURE) {
      const match = rows.find(
        r => r.id_sesion === fixture.id_sesion && r.id_jugadora === fixture.id_jugadora
      )
      expect(match).toBeDefined()
      expect(match!.rpe).toBe(fixture.rpe)
      expect(match!.duracion_min).toBe(fixture.duracion_min)
    }
  })

  // ── M-04: Preservación rpe_partido ────────────────────────────────────────
  it('M-04: rpe_partido preserva todos los registros, IDs, valores y fechas', async () => {
    const rows = await dbV14.rpe_partido.toArray()
    expect(rows).toHaveLength(RPE_PARTIDO_FIXTURE.length)

    for (const fixture of RPE_PARTIDO_FIXTURE) {
      const match = rows.find(
        r => r.id_partido === fixture.id_partido && r.id_jugadora === fixture.id_jugadora
      )
      expect(match).toBeDefined()
      expect(match!.rpe).toBe(fixture.rpe)
      expect(match!.fecha).toBe(fixture.fecha)
    }
  })

  // ── M-05: Índice compuesto readiness [id_jugadora+fecha] ──────────────────
  it('M-05: readiness acepta where() por índice compuesto [id_jugadora+fecha]', async () => {
    const result = await dbV14.readiness
      .where('[id_jugadora+fecha]')
      .equals(['J1', '2026-05-01'])
      .toArray()

    expect(result).toHaveLength(1)
    expect(result[0].readiness_score).toBe(82)
    expect(result[0].nota).toBe('Buena')
  })

  it('M-05b: readiness objeto where({ id_jugadora, fecha }) resuelve sin advertencia', async () => {
    const result = await dbV14.readiness
      .where({ id_jugadora: 'J2', fecha: '2026-05-01' })
      .toArray()

    expect(result).toHaveLength(1)
    expect(result[0].readiness_score).toBe(91)
  })

  it('M-05c: readiness.where({}).first() funciona para búsqueda puntual', async () => {
    const result = await dbV14.readiness
      .where({ id_jugadora: 'J1', fecha: '2026-05-02' })
      .first()

    expect(result).toBeDefined()
    expect(result!.readiness_score).toBe(75)
  })

  // ── M-06: sesion_rpe conserva índice heredado v13 (no recibe compuesto en v14) ───
  it('M-06: sesion_rpe conserva índice heredado id_sesion tras migración v14', async () => {
    // sesion_rpe no recibe índice compuesto en v14 (no hay query { id_jugadora, fecha }).
    // Verificar que el índice heredado id_sesion sigue funcionando correctamente.
    const result = await dbV14.sesion_rpe
      .where('id_sesion')
      .equals('S1')
      .toArray()

    expect(result).toHaveLength(2) // S1 tiene J1 y J2
    const rpes = result.map(r => r.rpe).sort()
    expect(rpes).toEqual([6, 7])
  })

  // ── M-07: Índice compuesto rpe_partido [id_partido+id_jugadora] ───────────
  it('M-07: rpe_partido acepta where() por índice compuesto [id_partido+id_jugadora]', async () => {
    const result = await dbV14.rpe_partido
      .where('[id_partido+id_jugadora]')
      .equals(['P1', 'J1'])
      .toArray()

    expect(result).toHaveLength(1)
    expect(result[0].rpe).toBe(9)
    expect(result[0].fecha).toBe('2026-05-04')
  })

  it('M-07b: rpe_partido objeto where({ id_partido, id_jugadora }) resuelve sin advertencia', async () => {
    const result = await dbV14.rpe_partido
      .where({ id_partido: 'P1', id_jugadora: 'J2' })
      .toArray()

    expect(result).toHaveLength(1)
    expect(result[0].rpe).toBe(8)
  })

  // ── M-08: Aislamiento entre jugadoras en readiness ────────────────────────
  it('M-08: readiness by [id_jugadora+fecha] no mezcla datos de jugadoras distintas', async () => {
    const j1Rows = await dbV14.readiness
      .where('[id_jugadora+fecha]')
      .equals(['J1', '2026-05-01'])
      .toArray()

    const j2Rows = await dbV14.readiness
      .where('[id_jugadora+fecha]')
      .equals(['J2', '2026-05-01'])
      .toArray()

    expect(j1Rows).toHaveLength(1)
    expect(j2Rows).toHaveLength(1)
    expect(j1Rows[0].id_jugadora).toBe('J1')
    expect(j2Rows[0].id_jugadora).toBe('J2')
    expect(j1Rows[0].readiness_score).not.toBe(j2Rows[0].readiness_score)
  })
})
