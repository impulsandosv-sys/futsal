// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validarFilaWellness,
  construirVistaPrevia,
  aplicarImportacionWellness,
  obtenerContextoValidacionWellness,
  obtenerMapaJugadorasDexie
} from './importEngine'
import type { RawImportRow, ColumnMapping, PreviewRow } from '@/types'

vi.unmock('./importEngine')
vi.unmock('@/utils/importEngine')

vi.mock('@/db/database', () => {
  const mockJugadoras = [
    { id_jugadora: 'JUG-001', nombre: 'Ana López', activa: true },
    { id_jugadora: 'JUG-002', nombre: 'María García', activa: false } // Inactive player
  ]

  const mockTable = () => ({
    get: vi.fn(() => Promise.resolve(null)),
    toArray: vi.fn(() => Promise.resolve([])),
    put: vi.fn(() => Promise.resolve(1)),
    bulkPut: vi.fn(() => Promise.resolve([])),
    delete: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
    where: vi.fn(() => ({
      equals: vi.fn().mockReturnThis(),
      between: vi.fn().mockReturnThis(),
      and: vi.fn().mockReturnThis(),
      first: vi.fn(() => Promise.resolve(null)),
      count: vi.fn(() => Promise.resolve(0)),
      toArray: vi.fn(() => Promise.resolve([])),
      delete: vi.fn(() => Promise.resolve()),
      modify: vi.fn(() => Promise.resolve())
    }))
  })

  const dbMock = {
    transaction: vi.fn((mode, tables, callback) => callback()),
    jugadoras: {
      toArray: vi.fn(() => Promise.resolve(mockJugadoras)),
      get: vi.fn((id: string) => Promise.resolve(mockJugadoras.find(j => j.id_jugadora === id) || null))
    },
    temporadas: {
      toArray: vi.fn(() => Promise.resolve([{ id_temporada: 'TEMP-2026', nombre: 'Temporada 2026', fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', activa: true }]))
    },
    alias_jugadora: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([]))
        }))
      }))
    },
    wellness: {
      toArray: vi.fn(() => Promise.resolve([])),
      put: vi.fn(() => Promise.resolve(1)),
      where: vi.fn(() => ({
        first: vi.fn(() => Promise.resolve(null)),
        count: vi.fn(() => Promise.resolve(0)),
        toArray: vi.fn(() => Promise.resolve([]))
      }))
    },
    historial_importaciones: {
      put: vi.fn(() => Promise.resolve(1))
    },
    sesion_rpe: mockTable(),
    readiness: mockTable(),
    sesiones: mockTable(),
    partidos: mockTable(),
    rpe_partido: mockTable(),
    resumen_semanal: mockTable(),
    wellness_diario_importado: mockTable(),
    wellness_semanal_importado: mockTable(),
    alertas: mockTable(),
    lesiones: mockTable()
  }

  return { db: dbMock }
})

describe('Bloque 3A - Unit tests de validación referencial e integridad de importación wellness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. ID_Jugadora existente genera una fila válida', () => {
    const row: RawImportRow = {
      id_jugadora: 'JUG-001',
      fecha: '2026-07-20',
      calidad_sueno: '8',
      fatiga: '4'
    }
    const context = { jugadorasIds: ['JUG-001', 'JUG-002'] }
    const result = validarFilaWellness(row, context)

    expect(result.isValid).toBe(true)
    expect(result.normalRow?.id_jugadora).toBe('JUG-001')
  })

  it('2. ID_Jugadora inexistente genera fila ERROR con campo, valor y mensaje descriptivo', () => {
    const row: RawImportRow = {
      id_jugadora: 'JUG-999',
      fecha: '2026-07-20',
      calidad_sueno: '8'
    }
    const context = { jugadorasIds: ['JUG-001', 'JUG-002'] }
    const result = validarFilaWellness(row, context)

    expect(result.isValid).toBe(false)
    expect(result.errorMsg).toContain("JUG-999")
  })

  it('3. ID_Jugadora vacía o nula genera fila ERROR', () => {
    const context = { jugadorasIds: ['JUG-001'] }

    const resNull = validarFilaWellness({ id_jugadora: null, fecha: '2026-07-20', calidad_sueno: '8' }, context)
    expect(resNull.isValid).toBe(false)
    expect(resNull.errorMsg).toContain('ID_Jugadora ausente')

    const resEmpty = validarFilaWellness({ id_jugadora: '   ', fecha: '2026-07-20', calidad_sueno: '8' }, context)
    expect(resEmpty.isValid).toBe(false)
    expect(resEmpty.errorMsg).toContain('ID_Jugadora vacío')
  })

  it('4. Duplicados dentro del mismo archivo por (id_jugadora, fecha) se marcan como ERROR', () => {
    const rawRows: RawImportRow[] = [
      { id_jugadora: 'JUG-001', fecha: '2026-07-20', calidad_sueno: '8' },
      { id_jugadora: 'JUG-001', fecha: '2026-07-20', calidad_sueno: '7' }
    ]
    const mapping: ColumnMapping[] = [
      { internalField: 'id_jugadora', excelHeader: 'id_jugadora', label: 'ID', required: true },
      { internalField: 'fecha', excelHeader: 'fecha', label: 'Fecha', required: true },
      { internalField: 'calidad_sueno', excelHeader: 'calidad_sueno', label: 'Sueño', required: false }
    ]
    const jugadorasMap = { 'JUG-001': 'Ana López' }

    const preview = construirVistaPrevia(rawRows, mapping, [], jugadorasMap)

    expect(preview.rows).toHaveLength(2)
    expect(preview.rows[0].estado).toBe('NUEVO')
    expect(preview.rows[1].estado).toBe('ERROR')
    expect(preview.rows[1].mensaje).toContain('Duplicado dentro del archivo')
  })

  it('5. Varias filas con errores distintos conservan diagnósticos independientes', () => {
    const rawRows: RawImportRow[] = [
      { id_jugadora: 'JUG-999', fecha: '2026-07-20', calidad_sueno: '8' },
      { id_jugadora: 'JUG-001', fecha: '2026-07-20', calidad_sueno: '15' } // fuera de rango
    ]
    const mapping: ColumnMapping[] = [
      { internalField: 'id_jugadora', excelHeader: 'id_jugadora', label: 'ID', required: true },
      { internalField: 'fecha', excelHeader: 'fecha', label: 'Fecha', required: true },
      { internalField: 'calidad_sueno', excelHeader: 'calidad_sueno', label: 'Sueño', required: false }
    ]
    const jugadorasMap = { 'JUG-001': 'Ana López' }

    const preview = construirVistaPrevia(rawRows, mapping, [], jugadorasMap)

    expect(preview.rows).toHaveLength(2)
    expect(preview.rows[0].estado).toBe('ERROR')
    expect(preview.rows[0].mensaje).toContain("JUG-999")
    expect(preview.rows[1].estado).toBe('ERROR')
    expect(preview.rows[1].mensaje).toContain('fuera de rango')
  })

  it('6. Una fila ERROR no omitida bloquea aplicarImportacionWellness', async () => {
    const rows: PreviewRow[] = [
      {
        filaOriginal: 2,
        estado: 'ERROR',
        id_jugadora: 'JUG-999',
        nombreJugadora: '',
        fecha: '2026-07-20',
        calidad_sueno: null, fatiga: null, dolor_muscular: null, estres: null, estado_animo: null, dolor_especifico: null,
        mensaje: "ID_Jugadora 'JUG-999' no existe en la base de datos"
      }
    ]

    await expect(aplicarImportacionWellness(rows, 'omit', 'test.csv', 'Hoja1', 'default', 'backup.json')).rejects.toThrow(
      'No se puede aplicar la importación porque existen filas con errores no omitidas.'
    )
  })

  it('7. Una fila marcada explícitamente como OMITIDA no bloquea el lote seleccionado', async () => {
    const rows: PreviewRow[] = [
      {
        filaOriginal: 2,
        estado: 'OMITIDA',
        id_jugadora: 'JUG-999',
        nombreJugadora: '',
        fecha: '2026-07-20',
        calidad_sueno: null, fatiga: null, dolor_muscular: null, estres: null, estado_animo: null, dolor_especifico: null,
        mensaje: 'Excluido manualmente por el usuario'
      },
      {
        filaOriginal: 3,
        estado: 'NUEVO',
        id_jugadora: 'JUG-001',
        nombreJugadora: 'Ana López',
        fecha: '2026-07-20',
        calidad_sueno: 8, fatiga: 4, dolor_muscular: 3, estres: 2, estado_animo: 9, dolor_especifico: null,
        mensaje: 'Registro nuevo listo para importar',
        normalRow: {
          id_jugadora: 'JUG-001',
          fecha: '2026-07-20',
          calidad_sueno: 8, fatiga: 4, dolor_muscular: 3, estres: 2, estado_animo: 9, dolor_especifico: null, marca_temporal: null
        }
      }
    ]

    const outcome = await aplicarImportacionWellness(rows, 'omit', 'test.csv', 'Hoja1', 'default', 'backup.json')

    if (!outcome.success) console.error('OUTCOME:', outcome); expect(outcome.success).toBe(true)
    expect(outcome.inserted).toBe(1)
    expect(outcome.skipped).toBe(1)
  })

  it('8. Una jugadora con activa: false pero existente en Dexie se acepta como referencia válida', async () => {
    const row: RawImportRow = {
      id_jugadora: 'JUG-002', // Inactive player present in DB
      fecha: '2026-07-20',
      calidad_sueno: '7'
    }
    const context = await obtenerContextoValidacionWellness()
    const result = validarFilaWellness(row, context)

    expect(result.isValid).toBe(true)

    const map = await obtenerMapaJugadorasDexie()
    expect(map['JUG-002']).toBe('María García')
  })
})
