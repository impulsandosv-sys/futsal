// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.unmock('@/utils/auth')

import {
  initializeAuth,
  isSessionValid,
  clearSession,
  startSessionMonitor,
  stopSessionMonitor
} from './auth'

describe('auth.ts - Comportamiento seguro fuera de navegador (entorno Node)', () => {
  it('initializeAuth() no lanza error cuando window/localStorage no existen', () => {
    expect(typeof window).toBe('undefined')
    expect(() => initializeAuth()).not.toThrow()
  })

  it('isSessionValid() devuelve false cuando window/sessionStorage no existen', () => {
    expect(typeof window).toBe('undefined')
    expect(isSessionValid()).toBe(false)
  })

  it('clearSession() no lanza error cuando window/sessionStorage no existen', () => {
    expect(typeof window).toBe('undefined')
    expect(() => clearSession()).not.toThrow()
  })

  it('startSessionMonitor() y stopSessionMonitor() no lanzan ni registran listeners sin window', () => {
    expect(typeof window).toBe('undefined')
    expect(() => startSessionMonitor(() => {})).not.toThrow()
    expect(() => stopSessionMonitor()).not.toThrow()
  })
})
