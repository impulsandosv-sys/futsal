import { create } from 'zustand'
import { db } from '@/db/database'
import { validateSesion, formatValidationErrors } from '@/utils/validation'

interface SesionesState {
  sesiones: Sesion[]
  loading: boolean
  
  loadSesiones: () => Promise<void>
  addSesion: (s: Sesion) => Promise<void>
  updateSesion: (s: Sesion) => Promise<void>
}

export const useSesionesStore = create<SesionesState>((set, get) => ({
  sesiones: [],
  loading: false,
  
  loadSesiones: async () => {
    set({ loading: true })
    try {
      const sesiones = await db.sesiones.toArray()
      set({ 
        sesiones: sesiones.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        loading: false 
      })
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
  
  addSesion: async (s) => {
    const errors = validateSesion(s)
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(errors))
    }
    await db.sesiones.put(s)
    set((state) => ({ sesiones: [s, ...state.sesiones] }))
  },
  
  updateSesion: async (s) => {
    const errors = validateSesion(s)
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(errors))
    }
    await db.sesiones.put(s)
    set((state) => ({
      sesiones: state.sesiones.map(r => (r.id_sesion === s.id_sesion ? s : r))
    }))
  }
}))

import type { Sesion } from '@/types'