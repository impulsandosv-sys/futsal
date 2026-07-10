import { create } from 'zustand'
import { db } from '@/db/database'
import { seedDatabase } from '@/utils/seed'
import {
  initializeAuth, verifyPassword, createSession, isSessionValid,
  clearSession, startSessionMonitor, stopSessionMonitor
} from '@/utils/auth'
import { createBackup, startAutoBackup, stopAutoBackup } from '@/utils/backup'
import { 
  validateJugadora,
  validateWellness, validateSesion, validatePartido, validateLesion, 
  validateTest, validateRPE_Entreno, validateRPE_Partido, 
  formatValidationErrors
} from '@/utils/validation'
import { recalcularResumenSemanal } from '@/services/resumenSemanal'
import type {
  Jugadora, FormularioRespuesta, Wellness, Sesion, Partido,
  Lesion, TestFisico, RPE_Entreno, RPE_Partido, ResumenSemanal,
  Alerta, FiltersState
} from '@/types'

interface AppState {
  jugadoras: Jugadora[]
  wellness: Wellness[]
  sesiones: Sesion[]
  partidos: Partido[]
  lesiones: Lesion[]
  tests: TestFisico[]
  rpe_entreno: RPE_Entreno[]
  rpe_partido: RPE_Partido[]
  resumen_semanal: ResumenSemanal[]
  alertas: Alerta[]
  filters: FiltersState
  loading: boolean
  isAuthenticated: boolean
  hasData: boolean

  loadAll: () => Promise<void>
  setFilter: (key: keyof FiltersState, value: string) => void
  resetFilters: () => void
  seedDemoData: () => Promise<void>

  addJugadora: (j: Jugadora) => Promise<string | null>
  updateJugadora: (j: Jugadora) => Promise<void>
  deleteJugadora: (id: string) => Promise<void>

  addWellness: (w: Wellness) => Promise<void>
  updateWellness: (w: Wellness) => Promise<void>
  importFormResponses: (responses: FormularioRespuesta[]) => Promise<void>

  addSesion: (s: Sesion) => Promise<void>
  updateSesion: (s: Sesion) => Promise<void>

  addPartido: (p: Partido) => Promise<void>
  updatePartido: (p: Partido) => Promise<void>

  addLesion: (l: Lesion) => Promise<void>
  updateLesion: (l: Lesion) => Promise<void>

  addTest: (t: TestFisico) => Promise<void>

  addRPE_Entreno: (r: RPE_Entreno) => Promise<void>
  addRPE_Partido: (r: RPE_Partido) => Promise<void>

  addAlerta: (a: Alerta) => Promise<void>
  markAlertaLeida: (id: number) => Promise<void>
  clearAlertas: () => Promise<void>

  login: (password: string) => Promise<boolean>
  logout: () => void
}

const DEFAULT_FILTERS: FiltersState = {
  id_jugadora: '',
  fecha_desde: '',
  fecha_hasta: '',
  semana: '',
  tipo_sesion: '',
  estado: '',
}

function normalizeAndImport(responses: FormularioRespuesta[]): Promise<Wellness[]> {
  return (async () => {
    const jugadoras = await db.jugadoras.toArray()
    const idsValidos = new Set(jugadoras.map(j => j.id_jugadora))

    const result: Wellness[] = []
    const seen = new Set<string>()

    for (const r of responses) {
      const id = r.id_jugadora?.toString().trim().toUpperCase()
      if (!id || !idsValidos.has(id)) continue

      const key = `${id}_${r.fecha}`
      if (seen.has(key)) continue
      seen.add(key)

      const score = Math.round(
        ((r.calidad_sueno || 5) +
          (r.fatiga || 5) +
          (r.dolor_muscular || 5) +
          (r.estres || 5) +
          (r.estado_animo || 5)) / 5 * 10
      ) / 10

      result.push({
        id_jugadora: id,
        fecha: r.fecha,
        calidad_sueno: clamp(r.calidad_sueno, 1, 10),
        fatiga: clamp(r.fatiga, 1, 10),
        dolor_muscular: clamp(r.dolor_muscular, 1, 10),
        estres: clamp(r.estres, 1, 10),
        estado_animo: clamp(r.estado_animo, 1, 10),
        dolor_especifico: r.dolor_especifico || '',
        score_wellness: score,
      })
    }

    return result
  })()
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

const dispararResumenSemanal = async (jugadoraId: string): Promise<void> => {
  try {
    await recalcularResumenSemanal(jugadoraId)
  } catch (error) {
    console.error(`Error recalculating summary for jugadora ${jugadoraId}:`, error)
  }
}

initializeAuth()

export const useStore = create<AppState>((set, get) => ({
  jugadoras: [],
  wellness: [],
  sesiones: [],
  partidos: [],
  lesiones: [],
  tests: [],
  rpe_entreno: [],
  rpe_partido: [],
  resumen_semanal: [],
  alertas: [],
  filters: { ...DEFAULT_FILTERS },
  loading: false,
  isAuthenticated: isSessionValid(),
  hasData: false,

  loadAll: async () => {
    set({ loading: true })
    try {
      const [jugadoras, wellness, sesiones, partidos, lesiones, tests, rpe_entreno, rpe_partido, resumen_semanal, alertas] =
        await Promise.all([
          db.jugadoras.toArray(),
          db.wellness.toArray(),
          db.sesiones.toArray(),
          db.partidos.toArray(),
          db.lesiones.toArray(),
          db.tests_fisicos.toArray(),
          db.rpe_entreno.toArray(),
          db.rpe_partido.toArray(),
          db.resumen_semanal.toArray(),
          db.alertas.toArray(),
        ])
      set({
        jugadoras: jugadoras.sort((a, b) => a.nombre.localeCompare(b.nombre)),
        wellness: wellness.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        sesiones: sesiones.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        partidos: partidos.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        lesiones: lesiones.sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio)),
        tests: tests.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        rpe_entreno: rpe_entreno.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        rpe_partido: rpe_partido.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        resumen_semanal: resumen_semanal.sort((a, b) => b.semana.localeCompare(a.semana)),
        alertas: alertas.sort((a, b) => b.creada.localeCompare(a.creada)),
        loading: false,
        hasData: jugadoras.length > 0,
      })
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },

  setFilter: (key, value) => {
    set((state) => ({ filters: { ...state.filters, [key]: value } }))
  },

  resetFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS } })
  },

  seedDemoData: async () => {
    await seedDatabase()
    await createBackup()
    await get().loadAll()
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
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    }))
  },

  deleteJugadora: async (id) => {
    await db.jugadoras.delete(id as any)
    set((state) => ({ jugadoras: state.jugadoras.filter(p => p.id_jugadora !== id) }))
  },

  addRPE_Entreno: async (r) => {
    const errors = validateRPE_Entreno(r)
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(errors))
    }
    await db.rpe_entreno.put(r)
    set((state) => ({ rpe_entreno: [r, ...state.rpe_entreno] }))
    dispararResumenSemanal(r.id_jugadora)
  },

  addRPE_Partido: async (r) => {
    const errors = validateRPE_Partido(r)
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(errors))
    }
    await db.rpe_partido.put(r)
    set((state) => ({ rpe_partido: [r, ...state.rpe_partido] }))
    dispararResumenSemanal(r.id_jugadora)
  },

  addWellness: async (w) => {
    const errors = validateWellness(w)
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(errors))
    }
    const existing = await db.wellness.where({ id_jugadora: w.id_jugadora, fecha: w.fecha }).first()
    if (existing) throw new Error('Ya existe un registro de wellness para esta jugadora en esta fecha')
    await db.wellness.put(w)
    set((state) => ({ wellness: [w, ...state.wellness] }))
  },

  updateWellness: async (w) => {
    const errors = validateWellness(w)
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(errors))
    }
    await db.wellness.put(w)
    set((state) => ({
      wellness: state.wellness.map(r => (r.id === w.id ? w : r)),
    }))
  },

  importFormResponses: async (responses) => {
    const cleaned = await normalizeAndImport(responses)
    const added: Wellness[] = []
    for (const w of cleaned) {
      const existing = await db.wellness.where({ id_jugadora: w.id_jugadora, fecha: w.fecha }).first()
      if (!existing) {
        await db.wellness.put(w)
        added.push(w)
      }
    }
    if (added.length > 0) {
      set((state) => ({ wellness: [...added, ...state.wellness] }))
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
    set((state) => ({ sesiones: state.sesiones.map(r => (r.id_sesion === s.id_sesion ? s : r)) }))
  },

  addPartido: async (p) => {
    const errors = validatePartido(p)
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(errors))
    }
    await db.partidos.put(p)
    set((state) => ({ partidos: [p, ...state.partidos] }))
  },

  updatePartido: async (p) => {
    const errors = validatePartido(p)
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(errors))
    }
    await db.partidos.put(p)
    set((state) => ({ partidos: state.partidos.map(r => (r.id_partido === p.id_partido ? p : r)) }))
  },

  addLesion: async (l) => {
    const errors = validateLesion(l)
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(errors))
    }
    await db.lesiones.put(l)
    set((state) => ({ lesiones: [l, ...state.lesiones] }))
  },

  updateLesion: async (l) => {
    const errors = validateLesion(l)
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(errors))
    }
    await db.lesiones.put(l)
    set((state) => ({ lesiones: state.lesiones.map(r => (r.id_lesion === l.id_lesion ? l : r)) }))
  },

  addTest: async (t) => {
    const errors = validateTest(t)
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(errors))
    }
    await db.tests_fisicos.put(t)
    set((state) => ({ tests: [t, ...state.tests] }))
  },

  addAlerta: async (a) => {
    await db.alertas.put(a)
    set((state) => ({ alertas: [a, ...state.alertas] }))
  },

  markAlertaLeida: async (id) => {
    await db.alertas.update(id, { leida: true })
    set((state) => ({
      alertas: state.alertas.map(a => (a.id === id ? { ...a, leida: true } : a)),
    }))
  },

  clearAlertas: async () => {
    await db.alertas.clear()
    set({ alertas: [] })
  },

  login: async (password) => {
    const valid = await verifyPassword(password)
    if (valid) {
      createSession()
      set({ isAuthenticated: true })
      startSessionMonitor(() => {
        get().logout()
      })
      startAutoBackup()
      return true
    }
    return false
  },

  logout: () => {
    clearSession()
    stopSessionMonitor()
    stopAutoBackup()
    set({ isAuthenticated: false })
  },
}))