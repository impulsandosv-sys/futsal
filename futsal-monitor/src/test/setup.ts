import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Dexie for tests
vi.mock('@/db/database', () => ({
  db: {
    jugadoras: { toArray: vi.fn(() => Promise.resolve([])) },
    wellness: { toArray: vi.fn(() => Promise.resolve([])) },
    sesiones: { toArray: vi.fn(() => Promise.resolve([])) },
    partidos: { toArray: vi.fn(() => Promise.resolve([])) },
    lesiones: { toArray: vi.fn(() => Promise.resolve([])) },
    tests_fisicos: { toArray: vi.fn(() => Promise.resolve([])) },
    rpe_entreno: { toArray: vi.fn(() => Promise.resolve([])) },
    rpe_partido: { toArray: vi.fn(() => Promise.resolve([])) },
    resumen_semanal: { toArray: vi.fn(() => Promise.resolve([])) },
    alertas: { toArray: vi.fn(() => Promise.resolve([])) },
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
}))