import '@testing-library/jest-dom'
import { vi } from 'vitest'

const mockWhereClause = () => ({
  equals: vi.fn(() => ({
    toArray: vi.fn(() => Promise.resolve([])),
    first: vi.fn(() => Promise.resolve(null)),
    count: vi.fn(() => Promise.resolve(0)),
  })),
  toArray: vi.fn(() => Promise.resolve([])),
  first: vi.fn(() => Promise.resolve(null)),
  count: vi.fn(() => Promise.resolve(0)),
})

// Mock Dexie for tests
vi.mock('@/db/database', () => ({
  db: {
    jugadoras: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    wellness: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    sesiones: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    partidos: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    lesiones: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    tests_fisicos: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    rpe_partido: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    resumen_semanal: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    alertas: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    sesion_rpe: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    readiness: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    ciclo_menstrual: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    plantillas_fuerza: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    sesiones_fuerza_individual: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    trabajos_fuerza: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    ejercicios_fuerza: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    compensacion_postpartido: {
      toArray: vi.fn(() => Promise.resolve([])),
      where: vi.fn(mockWhereClause),
      clear: vi.fn(() => Promise.resolve()),
      put: vi.fn(() => Promise.resolve()),
    },
    historial_importaciones: { 
      toArray: vi.fn(() => Promise.resolve([])),
      put: vi.fn(() => Promise.resolve()),
      bulkPut: vi.fn(() => Promise.resolve()),
      clear: vi.fn(() => Promise.resolve())
    },
    historial_copias: {
      toArray: vi.fn(() => Promise.resolve([])),
      where: vi.fn(mockWhereClause),
    },
    plantillas_importacion: {
      toArray: vi.fn(() => Promise.resolve([])),
      where: vi.fn(mockWhereClause),
      put: vi.fn(() => Promise.resolve())
    },
    temporadas: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    alias_jugadora: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    wellness_diario_importado: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    wellness_semanal_importado: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    carga_gps: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    fuerza_vbt: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    hidratacion: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    rtp_checklist: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    test_psicologico: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    protocolos_cmj: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    pruebas_cmj: { toArray: vi.fn(() => Promise.resolve([])), where: vi.fn(mockWhereClause) },
    registro_menstrual: {
      toArray: vi.fn(() => Promise.resolve([])),
      where: vi.fn(mockWhereClause),
      clear: vi.fn(() => Promise.resolve()),
      put: vi.fn(() => Promise.resolve()),
      add: vi.fn(() => Promise.resolve(1)),
      get: vi.fn(() => Promise.resolve(null)),
      delete: vi.fn(() => Promise.resolve()),
    },
    transaction: vi.fn(async (mode, tables, cb) => {
      return await cb()
    }),
  },
}))

vi.mock('@/utils/auth', () => ({
  initializeAuth: vi.fn(),
  verifyPassword: vi.fn(() => Promise.resolve(true)),
  createSession: vi.fn(),
  isSessionValid: vi.fn(() => true),
  clearSession: vi.fn(),
  startSessionMonitor: vi.fn(),
  stopSessionMonitor: vi.fn(),
}))

vi.mock('@/utils/backup', () => ({
  createBackup: vi.fn(() => Promise.resolve()),
  startAutoBackup: vi.fn(),
  stopAutoBackup: vi.fn(),
  getLastExternalBackupInfo: vi.fn(() => ({ exists: false, timestamp: null, daysSince: null })),
  forceExternalBackup: vi.fn(() => Promise.resolve('mock-backup.json')),
  parseBackupFile: vi.fn(() => Promise.resolve({ data: {} })),
  restoreFromData: vi.fn(() => Promise.resolve(true)),
}))

// Global mock for Recharts to prevent timers/handles keeping Node event loop alive
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => children,
  LineChart: ({ children }: any) => children,
  Line: () => null,
  BarChart: ({ children }: any) => children,
  Bar: () => null,
  ComposedChart: ({ children }: any) => children,
  ScatterChart: ({ children }: any) => children,
  Scatter: () => null,
  RadarChart: ({ children }: any) => children,
  Radar: () => null,
  PolarGrid: () => null,
  PolarAngleAxis: () => null,
  PolarRadiusAxis: () => null,
  ZAxis: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))