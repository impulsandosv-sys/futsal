import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore } from '@/store/store'
import * as authUtils from '@/utils/auth'

describe('BLOQUE A — Autenticación y eliminación de bypass', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useStore.setState({ isAuthenticated: false })
  })

  it('P-A-01: forceLogin() no debe existir en el store', () => {
    const storeState = useStore.getState() as any
    expect(storeState.forceLogin).toBeUndefined()
  })

  it('P-A-02: login con contraseña correcta establece isAuthenticated a true', async () => {
    vi.spyOn(authUtils, 'verifyPassword').mockImplementation(async (pwd) => pwd === 'futsal2024')
    const success = await useStore.getState().login('futsal2024')
    expect(success).toBe(true)
    expect(useStore.getState().isAuthenticated).toBe(true)
  })

  it('P-A-03: login con contraseña errónea no autentica', async () => {
    vi.spyOn(authUtils, 'verifyPassword').mockImplementation(async (pwd) => pwd === 'futsal2024')
    const success = await useStore.getState().login('password_incorrecta')
    expect(success).toBe(false)
    expect(useStore.getState().isAuthenticated).toBe(false)
  })
})
