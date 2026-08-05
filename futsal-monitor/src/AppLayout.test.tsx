import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React, { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'

vi.unmock('@/db/database')

import { db } from '@/db/database'
import { useStore } from '@/store/store'
import App from '@/App'

describe('Bloque D — Unificación de Layout de rutas privadas', () => {
  beforeEach(async () => {
    const storage: Record<string, string> = {}
    global.localStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => { storage[key] = value },
      removeItem: (key: string) => { delete storage[key] },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
      length: 0,
      key: () => null
    } as any

    await db.jugadoras.clear()
    await db.temporadas.clear()

    useStore.setState({
      isAuthenticated: true,
      user: { id: '1', nombre: 'Coach', rol: 'entrenador' }
    })
  })

  it('1. Ruta /dashboard renderiza exactamente UN solo Layout (1 elemento nav / sidebar)', async () => {
    window.history.pushState({}, 'Dashboard', '/')

    render(
      <StrictMode>
        <App />
      </StrictMode>
    )

    await waitFor(() => {
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    const navs = screen.getAllByRole('navigation')
    expect(navs.length).toBe(1)
  })

  it('2. Ruta /pruebas-cmj (Salto CMJ) renderiza exactamente UN solo Layout (sin layout anidado duplicado)', async () => {
    window.history.pushState({}, 'CMJ', '/pruebas-cmj')

    render(
      <StrictMode>
        <App />
      </StrictMode>
    )

    await waitFor(() => {
      expect(screen.getByText('Salto CMJ')).toBeInTheDocument()
    })

    const navs = screen.getAllByRole('navigation')
    expect(navs.length).toBe(1)
  })

  it('3. Ruta /fuerza (Entrenamiento de Fuerza) renderiza exactamente UN solo Layout', async () => {
    window.history.pushState({}, 'Fuerza', '/fuerza')

    render(
      <StrictMode>
        <App />
      </StrictMode>
    )

    await waitFor(() => {
      expect(screen.getByText('Entrenamiento de Fuerza')).toBeInTheDocument()
    })

    const navs = screen.getAllByRole('navigation')
    expect(navs.length).toBe(1)
  })

  it('4. Ruta /login renderiza CERO layouts privados (sin sidebar ni nav privado)', async () => {
    useStore.setState({ isAuthenticated: false })
    window.history.pushState({}, 'Login', '/login')

    render(
      <StrictMode>
        <App />
      </StrictMode>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /acceder/i })).toBeInTheDocument()
    })

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
