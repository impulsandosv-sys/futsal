import { create } from 'zustand'
import { db } from '@/db/database'
import { validateJugadora, validateIdUnico, formatValidationErrors } from '@/utils/validation'

interface JugadorasState {
  jugadoras: Jugadora[]
  loading: boolean
  
  loadJugadoras: () => Promise<void>
  addJugadora: (j: Jugadora) => Promise<string | null>
  updateJugadora: (j: Jugadora) => Promise<void>
  deleteJugadora: (id: string) => Promise<void>
}

export const useJugadorasStore = create<JugadorasState>((set, get) => ({
  jugadoras: [],
  loading: false,
  
  loadJugadoras: async () => {
    set({ loading: true })
    try {
      const jugadoras = await db.jugadoras.toArray()
      set({ 
        jugadoras: jugadoras.sort((a, b) => a.nombre.localeCompare(b.nombre)),
        loading: false 
      })
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
  
  addJugadora: async (j) => {
    const existingIds = get().jugadoras.map(p => p.id_jugadora)
    const errors = validateJugadora(j, existingIds)
    if (errors.length > 0) {
      throw new Error(errors.map(e => e.message).join('. '))
    }
    const normalized = { ...j, id_jugadora: j.id_jugadora.trim().toUpperCase() }
    await db.jugadoras.put(normalized)
    set((state) => ({ 
      jugadoras: [...state.jugadoras, normalized].sort((a, b) => a.nombre.localeCompare(b.nombre)) 
    }))
    return normalized.id_jugadora
  },
  
  updateJugadora: async (j) => {
    const existingIds = get().jugadoras.map(p => p.id_jugadora)
    const errors = validateJugadora(j, existingIds, j.id_jugadora)
    if (errors.length > 0) {
      throw new Error(errors.map(e => e.message).join('. '))
    }
    await db.jugadoras.put(j)
    set((state) => ({
      jugadoras: state.jugadoras.map(p => (p.id_jugadora === j.id_jugadora ? j : p))
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    }))
  },
  
  deleteJugadora: async (id) => {
    await db.jugadoras.delete(id)
    set((state) => ({ jugadoras: state.jugadoras.filter(p => p.id_jugadora !== id) }))
  }
}))

import type { Jugadora } from '@/types'