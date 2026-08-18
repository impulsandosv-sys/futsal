import { create } from 'zustand'
import { db } from '@/db/database'
import { seedDatabase } from '@/utils/seed'
import {
  initializeAuth, verifyPassword, createSession, isSessionValid,
  clearSession, startSessionMonitor, stopSessionMonitor
} from '@/utils/auth'
import { createBackup, startAutoBackup, stopAutoBackup } from '@/utils/backup'
import { calcularScoreWellness } from '@/utils/calculations'
import { ensureDefaultImportTemplate } from '@/utils/importEngine'
import type { FiltrosCarga } from '@/domain/monitoring/monitoring'
import { 
  validateJugadora,
  validateWellness, validateSesion, validatePartido, validateLesion, 
  validateTest, validateRPE_Partido, inferirParticipacionPartido,
  formatValidationErrors,
  validateSesionRPE
} from '@/utils/validation'
import { recalcularResumenSemanal } from '@/services/resumenSemanal'
import { recalcularReadinessJugadora } from '@/services/readiness'
import { getLocalDateString, getWeekId } from '@/domain/dates/dates'
import { UMBRALES } from '@/config/monitoringThresholds'
import type {
  Jugadora, FormularioRespuesta, Wellness, Sesion, Partido,
  Lesion, TestFisico, RPE_Partido, ResumenSemanal,
  Alerta, FiltersState, SesionRPE, Readiness, AlertaEstado,
  HistorialImportacion, CicloMenstrual, CargaGPS, FuerzaVBT, Hidratacion,
  RTPChecklist, TestPsicologico, HistorialCopia, PlantillaImportacion,
  ProtocoloCMJ, MedicionCMJ, EjercicioFuerza, TrabajoFuerzaIndividual, PlantillaFuerza, SesionFuerzaIndividual
} from '@/types'

interface AppState {
  jugadoras: Jugadora[]
  wellness: Wellness[]
  sesiones: Sesion[]
  partidos: Partido[]
  lesiones: Lesion[]
    tests: TestFisico[]
    rpe_partido: RPE_Partido[]
    resumen_semanal: ResumenSemanal[]
    alertas: Alerta[]
    sesion_rpe: SesionRPE[]
    readiness: Readiness[]
    historial_importaciones: HistorialImportacion[]
    ciclo_menstrual: CicloMenstrual[]
    carga_gps: CargaGPS[]
    fuerza_vbt: FuerzaVBT[]
    hidratacion: Hidratacion[]
    rtp_checklist: RTPChecklist[]
    test_psicologico: TestPsicologico[]
    historial_copias: HistorialCopia[]
    plantillas_importacion: PlantillaImportacion[]
    protocolos_cmj: ProtocoloCMJ[]
    pruebas_cmj: MedicionCMJ[]
    ejercicios_fuerza: EjercicioFuerza[]
    trabajos_fuerza: TrabajoFuerzaIndividual[]
    plantillas_fuerza: PlantillaFuerza[]
    sesiones_fuerza_individual: SesionFuerzaIndividual[]
  filters: FiltersState
  loading: boolean
  isAuthenticated: boolean
  hasData: boolean

  loadAll: () => Promise<void>
  setFilter: (key: keyof FiltersState, value: any) => void
  resetFilters: () => void
  seedDemoData: () => Promise<void>

  addJugadora: (j: Jugadora) => Promise<string | null>
  updateJugadora: (j: Jugadora) => Promise<void>
  deleteJugadora: (id: string) => Promise<void>
  reactivarJugadora: (id: string) => Promise<void>

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

  addRPE_Partido: (r: RPE_Partido) => Promise<void>
  saveRpePartidoBatch: (rpes: RPE_Partido[]) => Promise<void>

  addSesionRPE: (srpe: SesionRPE) => Promise<void>
  updateSesionRPE: (srpe: SesionRPE) => Promise<void>
  deleteSesionRPE: (id: number) => Promise<void>
  recalculateReadiness: (jugadoraId: string, fecha?: string) => Promise<void>
  generateWeeklySummary: (semana: string, config?: FiltrosCarga) => Promise<void>

  addAlerta: (a: Alerta) => Promise<void>
  markAlertaLeida: (id: number) => Promise<void>
  updateAlertaEstado: (id: number, estado: AlertaEstado) => Promise<void>
  registrarAlertaDecision: (id: number, responsable: string, nota: string) => Promise<void>
  archivarAlertasResueltas: () => Promise<void>
  clearAlertas: () => Promise<void>

  addHistorialImportacion: (h: HistorialImportacion) => Promise<void>

  addCicloMenstrual: (c: CicloMenstrual) => Promise<void>
  addCargaGPS: (g: CargaGPS) => Promise<void>
  addFuerzaVBT: (v: FuerzaVBT) => Promise<void>
  addHidratacion: (h: Hidratacion) => Promise<void>

  addRTPChecklist: (r: RTPChecklist) => Promise<void>
  updateRTPChecklist: (r: RTPChecklist) => Promise<void>
  addTestPsicologico: (t: TestPsicologico) => Promise<void>
  addHistorialCopia: (h: HistorialCopia) => Promise<void>

  addPlantillaImportacion: (p: PlantillaImportacion) => Promise<void>
  updatePlantillaImportacion: (p: PlantillaImportacion) => Promise<void>
  deletePlantillaImportacion: (id: number) => Promise<void>
  evaluarSeguimientoJugadora: (jugadoraId: string) => Promise<void>

  login: (password: string) => Promise<boolean>
  logout: () => void

  duplicateSesion: (id: string, nuevaFecha: string) => Promise<void>
  cancelSesion: (id: string, motivo?: string) => Promise<void>
  saveRpeBatch: (rpes: SesionRPE[]) => Promise<void>

  // Fase 5: CMJ y Fuerza
  addProtocoloCMJ: (p: ProtocoloCMJ) => Promise<void>
  updateProtocoloCMJ: (p: ProtocoloCMJ) => Promise<void>
  activateProtocoloCMJ: (id: string) => Promise<void>
  deactivateProtocoloCMJ: (id: string) => Promise<void>
  
  addPruebaCMJ: (p: MedicionCMJ) => Promise<void>
  updatePruebaCMJ: (p: MedicionCMJ) => Promise<void>
  
  addSesionFuerzaIndividual: (s: SesionFuerzaIndividual) => Promise<void>
  addEjercicioFuerza: (e: EjercicioFuerza) => Promise<void>
  updateEjercicioFuerza: (e: EjercicioFuerza) => Promise<void>
  activateEjercicioFuerza: (id: string) => Promise<void>
  deactivateEjercicioFuerza: (id: string) => Promise<void>
  addSesionFuerzaCompleta: (sesion: SesionFuerzaIndividual, trabajos: TrabajoFuerzaIndividual[]) => Promise<void>
  updateSesionFuerzaCompleta: (sesion: SesionFuerzaIndividual, trabajos: TrabajoFuerzaIndividual[]) => Promise<void>

  addPlantillaFuerza: (
    plantilla: Omit<PlantillaFuerza, 'id_plantilla' | 'createdAt' | 'updatedAt' | 'activa'>
  ) => Promise<void>
  updatePlantillaFuerza: (p: PlantillaFuerza) => Promise<void>
  toggleActivaPlantillaFuerza: (id: string, activa: boolean) => Promise<void>
}

const DEFAULT_FILTERS: FiltersState = {
  id_jugadora: '',
  fecha_desde: '',
  fecha_hasta: '',
  semana: '',
  tipo_sesion: '',
  estado: '',
  incluirPartidos: true,
  incluirGimnasio: true,
  incluirReadaptacion: true,
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

      const wTemp = {
        id_jugadora: id,
        fecha: r.fecha,
        calidad_sueno: clampOrNull(r.calidad_sueno, 1, 10),
        fatiga: clampOrNull(r.fatiga, 1, 10),
        dolor_muscular: clampOrNull(r.dolor_muscular, 1, 10),
        estres: clampOrNull(r.estres, 1, 10),
        estado_animo: clampOrNull(r.estado_animo, 1, 10),
        dolor_especifico: r.dolor_especifico || '',
      }
      const score = calcularScoreWellness(wTemp)

      result.push({
        id_jugadora: id,
        fecha: r.fecha,
        calidad_sueno: wTemp.calidad_sueno as any,
        fatiga: wTemp.fatiga as any,
        dolor_muscular: wTemp.dolor_muscular as any,
        estres: wTemp.estres as any,
        estado_animo: wTemp.estado_animo as any,
        dolor_especifico: wTemp.dolor_especifico,
        score_wellness: score,
      })
    }

    return result
  })()
}

function clampOrNull(v: any, min: number, max: number): number | null {
  if (v === undefined || v === null || v === '' || isNaN(Number(v))) return null
  const num = Number(v)
  return Math.max(min, Math.min(max, num))
}

const dispararResumenSemanal = async (jugadoraId: string, fecha?: string): Promise<void> => {
  try {
    const config = useStore.getState().filters
    await recalcularResumenSemanal(jugadoraId, fecha, {
      incluirPartidos: config.incluirPartidos,
      incluirGimnasio: config.incluirGimnasio,
      incluirReadaptacion: config.incluirReadaptacion,
    })
  } catch (error) {
    console.error(`Error recalculating summary for jugadora ${jugadoraId}:`, error)
    throw error
  }
}

const dispararReadiness = async (jugadoraId: string, fecha?: string): Promise<void> => {
  try {
    await recalcularReadinessJugadora(jugadoraId, fecha)
  } catch (error) {
    console.error(`Error recalculating readiness for ${jugadoraId}:`, error)
    throw error
  }
}

// ─── Bloque 2H: Evaluador pos-commit de alertas basado en Dexie ───────────────

/**
 * Lee directamente de Dexie (sin Zustand) los tres dominios necesarios para la
 * regla de seguimiento automático: resumen_semanal, wellness y ciclo_menstrual.
 * Selecciona el registro más reciente de cada dominio de forma independiente,
 * exactamente igual que hacía la función anterior sobre el array de Zustand.
 *
 * Si se cumplen las tres condiciones (ACWR > 1.5, score < 50, fase Ovulacion/Lutea)
 * y no existe ya una alerta abierta de tipo carga_alta para esa jugadora,
 * inserta la alerta en una transacción local exclusiva sobre db.alertas.
 *
 * La comprobación de existencia usa los mismos tres campos que la implementación
 * anterior: id_jugadora + tipo + estado. El campo `origen` se ignora en la
 * comprobación, preservando la semántica estricta actual.
 *
 * La transacción local reduce la reentrada en el mismo contexto IndexedDB pero
 * no constituye una garantía de unicidad absoluta: db.alertas no tiene un índice
 * único compuesto, y no se modifica el esquema en este bloque.
 */
const evaluarSeguimientoJugadoraDexie = async (jugadoraId: string): Promise<void> => {
  // Lectura directa de Dexie mediante índice simple por id_jugadora
  const [rsAll, welAll, cicloAll] = await Promise.all([
    db.resumen_semanal.where('id_jugadora').equals(jugadoraId).toArray(),
    db.wellness.where('id_jugadora').equals(jugadoraId).toArray(),
    db.ciclo_menstrual.where('id_jugadora').equals(jugadoraId).toArray(),
  ])

  // Selección del registro más reciente de cada dominio — orden idéntico al anterior
  const rs    = rsAll.sort((a, b) => b.semana.localeCompare(a.semana))[0]
  const wel   = welAll.sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  const ciclo = cicloAll.sort((a, b) => b.fecha.localeCompare(a.fecha))[0]

  // Si falta cualquiera de los tres dominios, no se evalúa ni se crea alerta
  if (!rs || !wel || !ciclo) return

  const isAltaCarga    = rs.acwr > 1.5
  const isBajoWellness = wel.score_wellness < UMBRALES.ALERTAS.WELLNESS_BAJO || (wel.score_wellness > 10 && wel.score_wellness < 65)
  const isFaseSensible = ciclo.fase === 'Ovulacion' || ciclo.fase === 'Lutea'

  if (!isAltaCarga || !isBajoWellness || !isFaseSensible) return

  // Transacción local exclusiva sobre db.alertas:
  // la lectura de candidatas y el put ocurren en el mismo ciclo atómico.
  await db.transaction('rw', db.alertas, async () => {
    const candidatas = await db.alertas.where('id_jugadora').equals(jugadoraId).toArray()

    // Identidad de existencia: id_jugadora + tipo + estado (Alternativa A — compatibilidad estricta)
    const existente = candidatas.find(
      (a) => a.tipo === 'carga_alta' && a.estado === 'abierta'
    )

    if (!existente) {
      await db.alertas.put({
        id_jugadora: jugadoraId,
        fecha: getLocalDateString(),
        creada: new Date().toISOString(),
        fecha_creacion: new Date().toISOString(),
        tipo: 'carga_alta',
        nivel: 'alto',
        prioridad: 'alto',
        leida: false,
        estado: 'abierta',
        origen: 'algoritmo_seguimiento',
        responsable: '',
        nota_decision: '',
        sugerencia: 'Revisión prioritaria de preparación física (ACWR descriptivo > 1.5 + Score < 50 + Fase Ovulatoria/Lútea).',
        mensaje: `REVISIÓN PRIORITARIA. ACWR descriptivo: ${rs.acwr.toFixed(2)}, Wellness: ${wel.score_wellness}, Ciclo: ${ciclo.fase}.`,
        datos_sustento: JSON.stringify({ acwr: rs.acwr, score: wel.score_wellness, fase: ciclo.fase }),
      })
    }
  })
}

/**
 * Orquestador pos-commit de alertas. Llama al evaluador Dexie y luego
 * sincroniza únicamente state.alertas en Zustand — sin segundo loadAll() global.
 *
 * Es no fatal: si cualquier parte falla, registra un aviso pero no relanza
 * el error, garantizando que el dato principal ya confirmado nunca produzca
 * un falso mensaje de error en la UI.
 *
 * @param jugadoraId ID de la jugadora a evaluar.
 * @param setFn      Función set del store Zustand para actualizar state.alertas.
 */
const evaluarYSincronizarAlertas = async (
  jugadoraId: string,
  setFn: (partial: Partial<AppState>) => void,
): Promise<void> => {
  try {
    await evaluarSeguimientoJugadoraDexie(jugadoraId)
  } catch (err) {
    console.warn(
      `[2H] Fallo en evaluación de alertas pos-commit para jugadora ${jugadoraId}:`,
      err,
    )
    // Datos principales ya confirmados — no se relanza.
    return
  }

  // Sincronización selectiva: solo se sustituye state.alertas
  try {
    const todasAlertas = await db.alertas.toArray()
    const alertasOrdenadas = todasAlertas.sort((a, b) => b.creada.localeCompare(a.creada))
    setFn({ alertas: alertasOrdenadas })
  } catch (err) {
    // Si la sincronización de memoria falla, la alerta queda en Dexie.
    // Un loadAll() posterior la recuperará. No se revierte nada.
    console.warn(
      `[2H] Fallo al sincronizar state.alertas tras evaluación de jugadora ${jugadoraId}:`,
      err,
    )
  }
}

/**
 * Versión para lotes: evalúa y sincroniza varias jugadoras secuencialmente.
 * No usa Promise.all para evitar lecturas simultáneas sobre db.alertas.
 * Sincroniza state.alertas una única vez al finalizar todas las evaluaciones.
 *
 * @param jugadoraIds IDs deduplicados de las jugadoras a evaluar.
 * @param setFn       Función set del store Zustand.
 */
const evaluarYSincronizarAlertasLote = async (
  jugadoraIds: string[],
  setFn: (partial: Partial<AppState>) => void,
): Promise<void> => {
  for (const jugadoraId of jugadoraIds) {
    try {
      await evaluarSeguimientoJugadoraDexie(jugadoraId)
    } catch (err) {
      console.warn(
        `[2H] Fallo en evaluación de alertas pos-commit para jugadora ${jugadoraId}:`,
        err,
      )
      // Continúa con la siguiente jugadora
    }
  }

  // Sincronización selectiva única al final del lote
  try {
    const todasAlertas = await db.alertas.toArray()
    const alertasOrdenadas = todasAlertas.sort((a, b) => b.creada.localeCompare(a.creada))
    setFn({ alertas: alertasOrdenadas })
  } catch (err) {
    console.warn('[2H] Fallo al sincronizar state.alertas tras evaluación de lote:', err)
  }
}

// ─── Bloque 4A: Control de Recencia y Concurrencia de loadAll ─────────────────
let loadEpoch = 0
let activeLoadsCount = 0

/**
 * Helper de refresco incremental puntual para addWellness (Bloque 4A).
 * Relee el registro de wellness recién insertado (con su ID autoincremental real)
 * y la fila de readiness recalculada para la misma jugadora y fecha.
 *
 * Fusiona ambos de forma funcional en Zustand y ordena descendentemente por `fecha`,
 * preservando la misma ordenación y contenido exactos que produciría loadAll().
 *
 * Incrementa `loadEpoch` para invalidar cualquier snapshot masivo de `loadAll()`
 * que hubiese iniciado lecturas I/O en Dexie antes del commit.
 *
 * Ante un fallo no esperado durante el refresco incremental, ejecuta un loadAll()
 * global de recuperación no-fatal sin revertir datos ni lanzar un falso error a la UI.
 */
const sincronizarWellnessIncremental = async (
  jugadoraId: string,
  fecha: string,
  setFn: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  getFn: () => AppState,
): Promise<void> => {
  // Incrementar loadEpoch invalida snapshots antiguos de loadAll() iniciados antes del commit
  loadEpoch++

  try {
    const [wSaved, rSaved] = await Promise.all([
      db.wellness.where({ id_jugadora: jugadoraId, fecha }).first(),
      db.readiness.where({ id_jugadora: jugadoraId, fecha }).first(),
    ])

    setFn((state) => {
      const wellnessFiltrados = state.wellness.filter(
        (x) => !((wSaved && x.id === wSaved.id) || (x.id_jugadora === jugadoraId && x.fecha === fecha)),
      )
      const nuevosWellness = wSaved ? [...wellnessFiltrados, wSaved] : wellnessFiltrados
      nuevosWellness.sort((a, b) => b.fecha.localeCompare(a.fecha))

      const readinessFiltrados = state.readiness.filter(
        (r) => !((rSaved && r.id === rSaved.id) || (r.id_jugadora === jugadoraId && r.fecha === fecha)),
      )
      const nuevosReadiness = rSaved ? [...readinessFiltrados, rSaved] : readinessFiltrados
      nuevosReadiness.sort((a, b) => b.fecha.localeCompare(a.fecha))

      return {
        wellness: nuevosWellness,
        readiness: nuevosReadiness,
      }
    })
  } catch (err) {
    console.warn(
      `[4A] Fallo en refresco incremental para ${jugadoraId} (${fecha}), ejecutando loadAll de recuperación:`,
      err,
    )
    try {
      await getFn().loadAll()
    } catch (fallbackErr) {
      console.warn(`[4A] Fallo en loadAll de recuperación tras error incremental:`, fallbackErr)
    }
  }
}

// ─── Bloque 4B: Refresco Incremental para updateWellness ─────────────────────
/**
 * Helper de refresco incremental puntual para updateWellness (Bloque 4B).
 * Relee el registro de wellness editado por su ID real y las filas de readiness
 * de todos los pares (id_jugadora, fecha) afectados (hasta 2 pares si cambia fecha/jugadora).
 *
 * Reemplaza funcionalmente los registros en Zustand y reordena descendentemente por `fecha`,
 * igualando el resultado exacto de loadAll().
 *
 * Incrementa `loadEpoch` para invalidar snapshots antiguos de loadAll().
 * Si cualquier registro de readiness o wellness resulta inexistente tras la transacción,
 * o si ocurre un fallo I/O, ejecuta loadAll() de recuperación no-fatal.
 */
const sincronizarWellnessEditadoIncremental = async (
  wellnessId: number,
  affectedPairs: Array<{ id_jugadora: string; fecha: string }>,
  setFn: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  getFn: () => AppState,
): Promise<void> => {
  loadEpoch++

  try {
    const [wUpdated, ...readinessList] = await Promise.all([
      db.wellness.get(wellnessId),
      ...affectedPairs.map(({ id_jugadora, fecha }) =>
        db.readiness.where({ id_jugadora, fecha }).first(),
      ),
    ])

    // Invariante: wellness y todos los readiness de los pares afectados deben existir pos-commit.
    // Si alguno no aparece o es undefined, no se omite en silencio: se activa loadAll() de recuperación.
    if (!wUpdated || readinessList.some((r) => !r)) {
      console.warn(
        `[4B] Inconsistencia en refresco incremental (wellness o readiness ausente), ejecutando loadAll de recuperación.`,
      )
      await getFn().loadAll()
      return
    }

    setFn((state) => {
      // 1. Reemplazar wellness editado por su id
      const wellnessFiltrados = state.wellness.filter((x) => x.id !== wUpdated.id)
      const nuevosWellness = [...wellnessFiltrados, wUpdated]
      nuevosWellness.sort((a, b) => b.fecha.localeCompare(a.fecha))

      // 2. Reemplazar readiness de todos los pares afectados
      let readinessFiltrados = [...state.readiness]
      for (const rSaved of readinessList) {
        if (!rSaved) continue
        readinessFiltrados = readinessFiltrados.filter(
          (r) =>
            !((rSaved.id && r.id === rSaved.id) ||
              (r.id_jugadora === rSaved.id_jugadora && r.fecha === rSaved.fecha)),
        )
        readinessFiltrados.push(rSaved)
      }
      readinessFiltrados.sort((a, b) => b.fecha.localeCompare(a.fecha))

      return {
        wellness: nuevosWellness,
        readiness: readinessFiltrados,
      }
    })
  } catch (err) {
    console.warn('[4B] Fallo en refresco incremental para updateWellness, ejecutando loadAll de recuperación:', err)
    try {
      await getFn().loadAll()
    } catch (fallbackErr) {
      console.warn('[4B] Fallo en loadAll de recuperación tras error incremental:', fallbackErr)
    }
  }
}

// ─── Fin Bloque 4B ────────────────────────────────────────────────────────────

// ─── Bloque 4C: Refresco Incremental para addRPE_Partido ──────────────────────
/**
 * Helper de refresco incremental puntual para addRPE_Partido (Bloque 4C).
 * Relee de Dexie:
 * 1. El registro de rpe_partido recién insertado/actualizado por (id_partido, id_jugadora).
 * 2. La fila de readiness recalculada para (id_jugadora, fechaEfectiva).
 * 3. La fila de resumen_semanal recalculada para (id_jugadora, semana).
 *
 * Fusiona los tres de forma inmutable en Zustand y los ordena exactamente como loadAll():
 * - rpe_partido: b.fecha.localeCompare(a.fecha)
 * - readiness: b.fecha.localeCompare(a.fecha)
 * - resumen_semanal: b.semana.localeCompare(a.semana)
 *
 * Incrementa loadEpoch para invalidar snapshots de loadAll() en curso.
 * Si alguna de las filas esperadas es undefined o si ocurre un error I/O, ejecuta
 * un loadAll() de recuperación no-fatal sin revertir datos ni relanzar error a la UI.
 */
const sincronizarRpePartidoIncremental = async (
  idPartido: string,
  jugadoraId: string,
  fechaEfectiva: string,
  setFn: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  getFn: () => AppState,
): Promise<void> => {
  loadEpoch++

  const semana = getWeekId(fechaEfectiva)

  try {
    const [rpeSaved, readinessSaved, resumenSaved] = await Promise.all([
      db.rpe_partido.where('id_partido').equals(idPartido).and((x) => x.id_jugadora === jugadoraId).first(),
      db.readiness.where('id_jugadora').equals(jugadoraId).and((x) => x.fecha === fechaEfectiva).first(),
      db.resumen_semanal.where('id_jugadora').equals(jugadoraId).and((x) => x.semana === semana).first(),
    ])

    if (!rpeSaved || !readinessSaved || !resumenSaved) {
      console.warn(
        `[4C] Inconsistencia en refresco incremental para addRPE_Partido (${idPartido}, ${jugadoraId}, ${fechaEfectiva}): rpe, readiness o resumen ausente. Ejecutando loadAll de recuperación.`,
      )
      try {
        await getFn().loadAll()
      } catch (fallbackErr) {
        console.warn('[4C] Fallo en loadAll de recuperación tras inconsistencia incremental:', fallbackErr)
      }
      return
    }

    setFn((state) => {
      // 1. rpe_partido
      const rpeFiltrados = state.rpe_partido.filter(
        (x) => !((rpeSaved.id && x.id === rpeSaved.id) || (x.id_partido === idPartido && x.id_jugadora === jugadoraId)),
      )
      const nuevosRpe = [...rpeFiltrados, rpeSaved]
      nuevosRpe.sort((a, b) => b.fecha.localeCompare(a.fecha))

      // 2. readiness
      const readinessFiltrados = state.readiness.filter(
        (r) => !((readinessSaved.id && r.id === readinessSaved.id) || (r.id_jugadora === jugadoraId && r.fecha === fechaEfectiva)),
      )
      const nuevosReadiness = [...readinessFiltrados, readinessSaved]
      nuevosReadiness.sort((a, b) => b.fecha.localeCompare(a.fecha))

      // 3. resumen_semanal
      const resumenFiltrados = state.resumen_semanal.filter(
        (s) => !((resumenSaved.id && s.id === resumenSaved.id) || (s.id_jugadora === jugadoraId && s.semana === semana)),
      )
      const nuevosResumen = [...resumenFiltrados, resumenSaved]
      nuevosResumen.sort((a, b) => b.semana.localeCompare(a.semana))

      return {
        rpe_partido: nuevosRpe,
        readiness: nuevosReadiness,
        resumen_semanal: nuevosResumen,
      }
    })
  } catch (err) {
    console.warn(
      `[4C] Fallo en refresco incremental para addRPE_Partido (${idPartido}, ${jugadoraId}, ${fechaEfectiva}), ejecutando loadAll de recuperación:`,
      err,
    )
    try {
      await getFn().loadAll()
    } catch (fallbackErr) {
      console.warn('[4C] Fallo en loadAll de recuperación tras error incremental:', fallbackErr)
    }
  }
}

// ─── Fin Bloque 4C ────────────────────────────────────────────────────────────

// ─── Bloque 4D: Refresco Incremental para addSesionRPE ──────────────────────
/**
 * Helper de refresco incremental puntual para addSesionRPE (Bloque 4D).
 * Relee de Dexie:
 * 1. El registro de sesion_rpe recién insertado/actualizado por (id_sesion, id_jugadora).
 * 2. La fila de readiness recalculada para (id_jugadora, fechaEfectiva).
 * 3. La fila de resumen_semanal recalculada para (id_jugadora, semana).
 *
 * Fusiona los tres de forma inmutable en Zustand y los ordena exactamente como loadAll():
 * - sesion_rpe: b.fecha.localeCompare(a.fecha)
 * - readiness: b.fecha.localeCompare(a.fecha)
 * - resumen_semanal: b.semana.localeCompare(a.semana)
 *
 * Incrementa loadEpoch para invalidar snapshots de loadAll() en curso.
 * Si alguna de las filas esperadas es undefined o si ocurre un error I/O, ejecuta
 * un loadAll() de recuperación no-fatal sin revertir datos ni relanzar error a la UI.
 */
const sincronizarSesionRpeIncremental = async (
  idSesion: string,
  jugadoraId: string,
  fechaEfectiva: string,
  setFn: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  getFn: () => AppState,
): Promise<void> => {
  loadEpoch++

  const semana = getWeekId(fechaEfectiva)

  try {
    const [srpeSaved, readinessSaved, resumenSaved] = await Promise.all([
      db.sesion_rpe.where('id_sesion').equals(idSesion).and((x) => x.id_jugadora === jugadoraId).first(),
      db.readiness.where('id_jugadora').equals(jugadoraId).and((x) => x.fecha === fechaEfectiva).first(),
      db.resumen_semanal.where('id_jugadora').equals(jugadoraId).and((x) => x.semana === semana).first(),
    ])

    if (!srpeSaved || !readinessSaved || !resumenSaved) {
      console.warn(
        `[4D] Inconsistencia en refresco incremental para addSesionRPE (${idSesion}, ${jugadoraId}, ${fechaEfectiva}): srpe, readiness o resumen ausente. Ejecutando loadAll de recuperación.`,
      )
      try {
        await getFn().loadAll()
      } catch (fallbackErr) {
        console.warn('[4D] Fallo en loadAll de recuperación tras inconsistencia incremental:', fallbackErr)
      }
      return
    }

    setFn((state) => {
      // 1. sesion_rpe
      const srpeFiltrados = state.sesion_rpe.filter(
        (x) => !((srpeSaved.id && x.id === srpeSaved.id) || (x.id_sesion === idSesion && x.id_jugadora === jugadoraId)),
      )
      const nuevosSrpe = [...srpeFiltrados, srpeSaved]
      nuevosSrpe.sort((a, b) => b.fecha.localeCompare(a.fecha))

      // 2. readiness
      const readinessFiltrados = state.readiness.filter(
        (r) => !((readinessSaved.id && r.id === readinessSaved.id) || (r.id_jugadora === jugadoraId && r.fecha === fechaEfectiva)),
      )
      const nuevosReadiness = [...readinessFiltrados, readinessSaved]
      nuevosReadiness.sort((a, b) => b.fecha.localeCompare(a.fecha))

      // 3. resumen_semanal
      const resumenFiltrados = state.resumen_semanal.filter(
        (s) => !((resumenSaved.id && s.id === resumenSaved.id) || (s.id_jugadora === jugadoraId && s.semana === semana)),
      )
      const nuevosResumen = [...resumenFiltrados, resumenSaved]
      nuevosResumen.sort((a, b) => b.semana.localeCompare(a.semana))

      return {
        sesion_rpe: nuevosSrpe,
        readiness: nuevosReadiness,
        resumen_semanal: nuevosResumen,
      }
    })
  } catch (err) {
    console.warn(
      `[4D] Fallo en refresco incremental para addSesionRPE (${idSesion}, ${jugadoraId}, ${fechaEfectiva}), ejecutando loadAll de recuperación:`,
      err,
    )
    try {
      await getFn().loadAll()
    } catch (fallbackErr) {
      console.warn('[4D] Fallo en loadAll de recuperación tras error incremental:', fallbackErr)
    }
  }
}

// ─── Fin Bloque 4D ────────────────────────────────────────────────────────────

// ─── Bloque 4E: Refresco Incremental para updateSesionRPE ───────────────────
/**
 * Helper de refresco incremental puntual para updateSesionRPE (Bloque 4E).
 * Relee de Dexie:
 * 1. El registro de sesion_rpe actualizado por srpeId.
 * 2. Las filas de readiness recalculadas para todos los pares (id_jugadora, fecha) en affectedPairs.
 * 3. Las filas de resumen_semanal recalculadas para todas las semanas en affectedPairs.
 *
 * Fusiona los tres de forma inmutable en Zustand y los ordena exactamente como loadAll():
 * - sesion_rpe: b.fecha.localeCompare(a.fecha)
 * - readiness: b.fecha.localeCompare(a.fecha)
 * - resumen_semanal: b.semana.localeCompare(a.semana)
 *
 * Incrementa loadEpoch para invalidar snapshots de loadAll() en curso.
 * Si alguna de las filas esperadas es undefined o si ocurre un error I/O, ejecuta
 * un loadAll() de recuperación no-fatal sin revertir datos ni relanzar error a la UI.
 */
const sincronizarSesionRpeEditadoIncremental = async (
  srpeId: number,
  affectedPairs: Array<{ idJugadora: string; fecha: string }>,
  setFn: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  getFn: () => AppState,
): Promise<void> => {
  loadEpoch++

  // Deduplicar semanas afectadas únicas
  const weekMap = new Map<string, { idJugadora: string; semana: string }>()
  for (const p of affectedPairs) {
    const semana = getWeekId(p.fecha)
    const key = `${p.idJugadora}|${semana}`
    weekMap.set(key, { idJugadora: p.idJugadora, semana })
  }
  const affectedWeeks = Array.from(weekMap.values())

  try {
    const [srpeUpdated, readinessList, resumenList] = await Promise.all([
      db.sesion_rpe.get(srpeId),
      Promise.all(affectedPairs.map((p) => db.readiness.where('id_jugadora').equals(p.idJugadora).and((x) => x.fecha === p.fecha).first())),
      Promise.all(affectedWeeks.map((w) => db.resumen_semanal.where('id_jugadora').equals(w.idJugadora).and((x) => x.semana === w.semana).first())),
    ])

    if (!srpeUpdated || readinessList.some((r) => !r) || resumenList.some((s) => !s)) {
      console.warn(
        `[4E] Inconsistencia en refresco incremental para updateSesionRPE (id=${srpeId}): RPE, readiness o resumen ausente. Ejecutando loadAll de recuperación.`,
      )
      try {
        await getFn().loadAll()
      } catch (fallbackErr) {
        console.warn('[4E] Fallo en loadAll de recuperación tras inconsistencia incremental:', fallbackErr)
      }
      return
    }

    setFn((state) => {
      // 1. sesion_rpe: descartar por id y por clave lógica previa
      const srpeFiltrados = state.sesion_rpe.filter(
        (x) => !(x.id === srpeId || (x.id_sesion === srpeUpdated.id_sesion && x.id_jugadora === srpeUpdated.id_jugadora)),
      )
      const nuevosSrpe = [...srpeFiltrados, srpeUpdated]
      nuevosSrpe.sort((a, b) => b.fecha.localeCompare(a.fecha))

      // 2. readiness: descartar registros correspondientes a affectedPairs
      const validReadiness = readinessList as NonNullable<(typeof readinessList)[number]>[]
      const readinessFiltrados = state.readiness.filter(
        (r) =>
          !affectedPairs.some(
            (p) => (r.id && validReadiness.some((rl) => rl.id === r.id)) || (r.id_jugadora === p.idJugadora && r.fecha === p.fecha),
          ),
      )
      const todosReadiness = [...readinessFiltrados, ...validReadiness]
      const uniqueReadinessMap = new Map<string, (typeof todosReadiness)[number]>()
      for (const r of todosReadiness) {
        const key = r.id ? `id_${r.id}` : `${r.id_jugadora}|${r.fecha}`
        uniqueReadinessMap.set(key, r)
      }
      const nuevosReadiness = Array.from(uniqueReadinessMap.values())
      nuevosReadiness.sort((a, b) => b.fecha.localeCompare(a.fecha))

      // 3. resumen_semanal: descartar registros correspondientes a affectedWeeks
      const validResumen = resumenList as NonNullable<(typeof resumenList)[number]>[]
      const resumenFiltrados = state.resumen_semanal.filter(
        (s) =>
          !affectedWeeks.some(
            (w) => (s.id && validResumen.some((rl) => rl.id === s.id)) || (s.id_jugadora === w.idJugadora && s.semana === w.semana),
          ),
      )
      const todosResumen = [...resumenFiltrados, ...validResumen]
      const uniqueResumenMap = new Map<string, (typeof todosResumen)[number]>()
      for (const s of todosResumen) {
        const key = s.id ? `id_${s.id}` : `${s.id_jugadora}|${s.semana}`
        uniqueResumenMap.set(key, s)
      }
      const nuevosResumen = Array.from(uniqueResumenMap.values())
      nuevosResumen.sort((a, b) => b.semana.localeCompare(a.semana))

      return {
        sesion_rpe: nuevosSrpe,
        readiness: nuevosReadiness,
        resumen_semanal: nuevosResumen,
      }
    })
  } catch (err) {
    console.warn(
      `[4E] Fallo en refresco incremental para updateSesionRPE (id=${srpeId}), ejecutando loadAll de recuperación:`,
      err,
    )
    try {
      await getFn().loadAll()
    } catch (fallbackErr) {
      console.warn('[4E] Fallo en loadAll de recuperación tras error incremental:', fallbackErr)
    }
  }
}

// ─── Fin Bloque 4E ────────────────────────────────────────────────────────────

// ─── Bloque 4F: Refresco Incremental para deleteSesionRPE ───────────────────
/**
 * Helper de refresco incremental puntual para deleteSesionRPE (Bloque 4F).
 * Relee de Dexie:
 * 1. Verifica que el registro deletedId esté ausente (undefined) en sesion_rpe.
 * 2. La fila de readiness recalculada para (jugadoraId, fechaEfectiva).
 * 3. La fila de resumen_semanal recalculada para (jugadoraId, semana).
 *
 * Elimina deletedId de sesion_rpe y sustituye readiness/resumen en Zustand de forma inmutable.
 * Ordena exactamente como loadAll():
 * - sesion_rpe: b.fecha.localeCompare(a.fecha)
 * - readiness: b.fecha.localeCompare(a.fecha)
 * - resumen_semanal: b.semana.localeCompare(a.semana)
 *
 * Incrementa loadEpoch para invalidar snapshots de loadAll() en curso.
 * Si rpeStillExists es definido, o alguna de las filas derivadas es undefined,
 * o ante un error I/O, ejecuta un loadAll() de recuperación no-fatal.
 */
const sincronizarSesionRpeEliminadoIncremental = async (
  deletedId: number,
  jugadoraId: string,
  fechaEfectiva: string,
  setFn: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  getFn: () => AppState,
): Promise<void> => {
  loadEpoch++

  const semana = getWeekId(fechaEfectiva)

  try {
    const [rpeStillExists, readinessSaved, resumenSaved] = await Promise.all([
      db.sesion_rpe.get(deletedId),
      db.readiness.where('id_jugadora').equals(jugadoraId).and((x) => x.fecha === fechaEfectiva).first(),
      db.resumen_semanal.where('id_jugadora').equals(jugadoraId).and((x) => x.semana === semana).first(),
    ])

    if (rpeStillExists || !readinessSaved || !resumenSaved) {
      console.warn(
        `[4F] Inconsistencia en refresco incremental para deleteSesionRPE (id=${deletedId}): RPE aún presente o derivados ausentes. Ejecutando loadAll de recuperación.`,
      )
      try {
        await getFn().loadAll()
      } catch (fallbackErr) {
        console.warn('[4F] Fallo en loadAll de recuperación tras inconsistencia incremental:', fallbackErr)
      }
      return
    }

    setFn((state) => {
      // 1. sesion_rpe: eliminar deletedId
      const nuevosSrpe = state.sesion_rpe.filter((x) => x.id !== deletedId)

      // 2. readiness: reemplazar (jugadoraId, fechaEfectiva)
      const readinessFiltrados = state.readiness.filter(
        (r) => !((readinessSaved.id && r.id === readinessSaved.id) || (r.id_jugadora === jugadoraId && r.fecha === fechaEfectiva)),
      )
      const nuevosReadiness = [...readinessFiltrados, readinessSaved]
      nuevosReadiness.sort((a, b) => b.fecha.localeCompare(a.fecha))

      // 3. resumen_semanal: reemplazar (jugadoraId, semana)
      const resumenFiltrados = state.resumen_semanal.filter(
        (s) => !((resumenSaved.id && s.id === resumenSaved.id) || (s.id_jugadora === jugadoraId && s.semana === semana)),
      )
      const nuevosResumen = [...resumenFiltrados, resumenSaved]
      nuevosResumen.sort((a, b) => b.semana.localeCompare(a.semana))

      return {
        sesion_rpe: nuevosSrpe,
        readiness: nuevosReadiness,
        resumen_semanal: nuevosResumen,
      }
    })
  } catch (err) {
    console.warn(
      `[4F] Fallo en refresco incremental para deleteSesionRPE (id=${deletedId}), ejecutando loadAll de recuperación:`,
      err,
    )
    try {
      await getFn().loadAll()
    } catch (fallbackErr) {
      console.warn('[4F] Fallo en loadAll de recuperación tras error incremental:', fallbackErr)
    }
  }
}

// ─── Fin Bloque 4F ────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  const resetPwd = new URLSearchParams(window.location.search).get('reset-password')
  if (resetPwd === 'true') {
    window.localStorage.removeItem('futsal_password_hash')
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
  rpe_partido: [],
  resumen_semanal: [],
  alertas: [],
  sesion_rpe: [],
  readiness: [],
  historial_importaciones: [],
  historial_copias: [],
  ciclo_menstrual: [],
  carga_gps: [],
  fuerza_vbt: [],
  hidratacion: [],
  rtp_checklist: [],
  test_psicologico: [],
  filters: { ...DEFAULT_FILTERS },
  loading: false,
  isAuthenticated: isSessionValid(),
  hasData: false,
  plantillas_importacion: [],
  protocolos_cmj: [],
  pruebas_cmj: [],
  ejercicios_fuerza: [],
  trabajos_fuerza: [],
  plantillas_fuerza: [],
  sesiones_fuerza_individual: [],

  loadAll: async () => {
    activeLoadsCount++
    const currentEpoch = ++loadEpoch
    set({ loading: true })

    try {
      // Garantizar plantilla por defecto de forma idempotente
      await ensureDefaultImportTemplate()

      const [
        jugadoras, wellness, sesiones, partidos, lesiones, tests, rpe_partido, 
        resumen_semanal, alertas, sesion_rpe, readiness, historial_importaciones,
        historial_copias,
        ciclo_menstrual, carga_gps, fuerza_vbt, hidratacion,
        rtp_checklist, test_psicologico, plantillas_importacion,
        protocolos_cmj, pruebas_cmj, ejercicios_fuerza, trabajos_fuerza, plantillas_fuerza, sesiones_fuerza_individual
      ] =
        await Promise.all([
          db.jugadoras.toArray(),
          db.wellness.toArray(),
          db.sesiones.toArray(),
          db.partidos.toArray(),
          db.lesiones.toArray(),
          db.tests_fisicos.toArray(),
          db.rpe_partido.toArray(),
          db.resumen_semanal.toArray(),
          db.alertas.toArray(),
          db.sesion_rpe.toArray(),
          db.readiness.toArray(),
          db.historial_importaciones.toArray(),
          db.historial_copias.toArray(),
          db.ciclo_menstrual.toArray(),
          db.carga_gps.toArray(),
          db.fuerza_vbt.toArray(),
          db.hidratacion.toArray(),
          db.rtp_checklist.toArray(),
          db.test_psicologico.toArray(),
          db.plantillas_importacion.toArray(),
          db.protocolos_cmj.toArray(),
          db.pruebas_cmj.toArray(),
          db.ejercicios_fuerza.toArray(),
          db.trabajos_fuerza.toArray(),
          db.plantillas_fuerza.toArray(),
          db.sesiones_fuerza_individual.toArray()
        ])

      // Si loadEpoch cambió durante la lectura I/O, este snapshot está obsoleto y se omite el set global
      if (currentEpoch !== loadEpoch) {
        console.warn(`[4A] loadAll() (epoch ${currentEpoch}) descartado porque ocurrió una recarga o sincronización más reciente (epoch actual ${loadEpoch}).`)
        return
      }

      set({
        jugadoras: jugadoras.sort((a, b) => a.nombre.localeCompare(b.nombre)),
        wellness: wellness.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        sesiones: sesiones.map(s => {
          // Migración histórica en memoria
          const realGrupal = s.duracion_real_grupal_min ?? s.duracion_min
          return { ...s, duracion_real_grupal_min: realGrupal }
        }).sort((a, b) => b.fecha.localeCompare(a.fecha)),
        partidos: partidos.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        lesiones: lesiones.sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio)),
        tests: tests.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        rpe_partido: rpe_partido.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        resumen_semanal: resumen_semanal.sort((a, b) => b.semana.localeCompare(a.semana)),
        alertas: alertas.sort((a, b) => b.creada.localeCompare(a.creada)),
        sesion_rpe: sesion_rpe.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        readiness: readiness.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        historial_importaciones: historial_importaciones.sort((a, b) => b.fechaHora.localeCompare(a.fechaHora)),
        historial_copias: historial_copias.sort((a, b) => b.fechaHora.localeCompare(a.fechaHora)),
        ciclo_menstrual: ciclo_menstrual.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        carga_gps: carga_gps.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        fuerza_vbt: fuerza_vbt.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        hidratacion: hidratacion.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        rtp_checklist: rtp_checklist,
        test_psicologico: test_psicologico.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        plantillas_importacion: plantillas_importacion.sort((a, b) => a.nombre.localeCompare(b.nombre)),
        protocolos_cmj,
        pruebas_cmj: pruebas_cmj.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        ejercicios_fuerza: ejercicios_fuerza.sort((a, b) => a.nombre.localeCompare(b.nombre)),
        trabajos_fuerza,
        plantillas_fuerza,
        sesiones_fuerza_individual: sesiones_fuerza_individual.sort((a, b) => b.fecha.localeCompare(a.fecha)),
        hasData: true
      })
    } finally {
      activeLoadsCount = Math.max(0, activeLoadsCount - 1)
      set({ loading: activeLoadsCount > 0 })
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
    const normalized: Jugadora = {
      ...j,
      id_jugadora: j.id_jugadora.trim().toUpperCase(),
      activa: j.activa !== undefined ? j.activa : true
    }
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
    const updated: Jugadora = {
      ...j,
      activa: j.activa !== undefined ? j.activa : true
    }
    await db.jugadoras.put(updated)
    set((state) => ({
      jugadoras: state.jugadoras.map(p => (p.id_jugadora === j.id_jugadora ? updated : p))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    }))
  },

  deleteJugadora: async (id) => {
    const target = get().jugadoras.find(p => p.id_jugadora === id)
    if (!target) return
    const archived: Jugadora = { ...target, activa: false }
    await db.jugadoras.put(archived)
    set((state) => ({
      jugadoras: state.jugadoras.map(p => (p.id_jugadora === id ? archived : p))
    }))
  },

  reactivarJugadora: async (id) => {
    const target = get().jugadoras.find(p => p.id_jugadora === id)
    if (!target) return
    const reactivated: Jugadora = { ...target, activa: true }
    await db.jugadoras.put(reactivated)
    set((state) => ({
      jugadoras: state.jugadoras.map(p => (p.id_jugadora === id ? reactivated : p))
    }))
  },

  addRPE_Partido: async (r) => {
    inferirParticipacionPartido(r)
    const errors = validateRPE_Partido(r)
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(errors))
    }

    let fechaEfectivaCalculada = ''

    await db.transaction(
      'rw',
      [
        db.rpe_partido,
        db.resumen_semanal,
        db.readiness,
        db.sesiones,
        db.partidos,
        db.sesion_rpe,
        db.wellness,
        db.jugadoras,
      ],
      async () => {
        const player = await db.jugadoras.get(r.id_jugadora as any)
        if (!player) {
          throw new Error(`La jugadora '${r.id_jugadora}' no existe en la base de datos`)
        }

        const match = await db.partidos.get(r.id_partido as any)
        if (!match) {
          throw new Error(`El partido '${r.id_partido}' no existe en la base de datos`)
        }

        const existing = await db.rpe_partido
          .where({ id_partido: r.id_partido, id_jugadora: r.id_jugadora })
          .first()

        if (existing) {
          throw new Error('Ya existe un registro de RPE de partido para esta jugadora en este partido')
        }

        const fechaEfectiva = r.fecha || match.fecha

        if (!fechaEfectiva) {
          throw new Error('No se pudo determinar la fecha del RPE de partido')
        }

        fechaEfectivaCalculada = fechaEfectiva

        const rpeGuardar = { ...r, fecha: fechaEfectiva }

        await db.rpe_partido.put(rpeGuardar)

        const config = useStore.getState().filters
        await recalcularResumenSemanal(rpeGuardar.id_jugadora, rpeGuardar.fecha, {
          incluirPartidos: config.incluirPartidos,
          incluirGimnasio: config.incluirGimnasio,
          incluirReadaptacion: config.incluirReadaptacion,
        })
        await recalcularReadinessJugadora(rpeGuardar.id_jugadora, rpeGuardar.fecha)
      }
    )

    await sincronizarRpePartidoIncremental(r.id_partido, r.id_jugadora, fechaEfectivaCalculada, set, get)
    await evaluarYSincronizarAlertas(r.id_jugadora, set)
  },

  saveRpePartidoBatch: async (rpes) => {
    const erroresTodas: string[] = []
    const procesados: RPE_Partido[] = []
    
    for (const r of rpes) {
      inferirParticipacionPartido(r)
      const errs = validateRPE_Partido(r)
      if (errs.length > 0) {
        erroresTodas.push(...errs.map(e => `[${r.id_jugadora}] ${e.message}`))
      } else {
        procesados.push(r)
      }
    }
    
    if (erroresTodas.length > 0) {
      throw new Error(`Errores de validación:\n${erroresTodas.join('\n')}`)
    }

    if (procesados.length === 0) return

    const affectedPairs = new Map<string, { id_jugadora: string; fecha: string }>()

    await db.transaction(
      'rw',
      [db.rpe_partido, db.resumen_semanal, db.readiness, db.sesiones, db.partidos, db.sesion_rpe, db.wellness, db.jugadoras],
      async () => {
        const config = useStore.getState().filters
        
        for (const r of procesados) {
          const match = await db.partidos.get(r.id_partido as any)
          if (!match) throw new Error(`El partido '${r.id_partido}' no existe.`)
          
          const fechaEfectiva = r.fecha || match.fecha
          if (!fechaEfectiva) throw new Error('No se pudo determinar la fecha del RPE de partido')

          const existing = await db.rpe_partido
            .where({ id_partido: r.id_partido, id_jugadora: r.id_jugadora })
            .first()
          
          const rpeGuardar = { ...r, fecha: fechaEfectiva }
          if (existing?.id) {
            rpeGuardar.id = existing.id
          }
          
          await db.rpe_partido.put(rpeGuardar)
          
          const keyNew = JSON.stringify([rpeGuardar.id_jugadora, rpeGuardar.fecha])
          affectedPairs.set(keyNew, { id_jugadora: rpeGuardar.id_jugadora, fecha: rpeGuardar.fecha })
          
          await recalcularResumenSemanal(rpeGuardar.id_jugadora, rpeGuardar.fecha, {
            incluirPartidos: config.incluirPartidos,
            incluirGimnasio: config.incluirGimnasio,
            incluirReadaptacion: config.incluirReadaptacion,
          })
          await recalcularReadinessJugadora(rpeGuardar.id_jugadora, rpeGuardar.fecha)
        }
      }
    )

    await get().loadAll()
    
    const affectedPlayers = Array.from(
      new Set(Array.from(affectedPairs.values(), ({ id_jugadora }) => id_jugadora))
    )
    await evaluarYSincronizarAlertasLote(affectedPlayers, set)
  },

  addWellness: async (w) => {
    const errors = validateWellness(w)
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(errors))
    }

    await db.transaction('rw', [db.wellness, db.readiness, db.sesion_rpe, db.rpe_partido, db.sesiones, db.jugadoras], async () => {
      const player = await db.jugadoras.get(w.id_jugadora as any)
      if (!player) {
        throw new Error(`La jugadora '${w.id_jugadora}' no existe en la base de datos`)
      }

      const existing = await db.wellness.where({ id_jugadora: w.id_jugadora, fecha: w.fecha }).first()
      if (existing) {
        throw new Error('Ya existe un registro de wellness para esta jugadora en esta fecha')
      }

      await db.wellness.put(w)
      await recalcularReadinessJugadora(w.id_jugadora, w.fecha)
    })

    await sincronizarWellnessIncremental(w.id_jugadora, w.fecha, set, get)
    await evaluarYSincronizarAlertas(w.id_jugadora, set)
  },

  updateWellness: async (w) => {
    const errors = validateWellness(w)
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(errors))
    }
    if (w.id === undefined || w.id === null) {
      throw new Error('No se puede actualizar wellness sin identificador')
    }

    const affectedPairs = new Map<string, { id_jugadora: string; fecha: string }>()

    await db.transaction('rw', [db.wellness, db.readiness, db.sesion_rpe, db.rpe_partido, db.sesiones, db.jugadoras], async () => {
      const prev = await db.wellness.get(w.id!)
      if (!prev) {
        throw new Error('No existe el registro de wellness a actualizar')
      }

      const player = await db.jugadoras.get(w.id_jugadora as any)
      if (!player) {
        throw new Error(`La jugadora '${w.id_jugadora}' no existe en la base de datos`)
      }

      if (prev.id_jugadora !== w.id_jugadora || prev.fecha !== w.fecha) {
        const duplicate = await db.wellness.where({ id_jugadora: w.id_jugadora, fecha: w.fecha }).first()
        if (duplicate && duplicate.id !== w.id) {
          throw new Error('Ya existe otro registro de wellness para esta jugadora en esta fecha')
        }
      }

      await db.wellness.put(w)

      const keyNew = JSON.stringify([w.id_jugadora, w.fecha])
      affectedPairs.set(keyNew, { id_jugadora: w.id_jugadora, fecha: w.fecha })

      if (prev.id_jugadora !== w.id_jugadora || prev.fecha !== w.fecha) {
        const keyPrev = JSON.stringify([prev.id_jugadora, prev.fecha])
        affectedPairs.set(keyPrev, { id_jugadora: prev.id_jugadora, fecha: prev.fecha })
      }

      for (const { id_jugadora, fecha } of affectedPairs.values()) {
        await recalcularReadinessJugadora(id_jugadora, fecha)
      }
    })

    await sincronizarWellnessEditadoIncremental(
      w.id!,
      Array.from(affectedPairs.values()),
      set,
      get,
    )

    const affectedPlayers = Array.from(
      new Set(Array.from(affectedPairs.values(), ({ id_jugadora }) => id_jugadora))
    )
    await evaluarYSincronizarAlertasLote(affectedPlayers, set)
  },

  importFormResponses: async (responses) => {
    const cleaned = await normalizeAndImport(responses)
    if (cleaned.length === 0) return

    const affectedPairs = new Map<string, { id_jugadora: string; fecha: string }>()

    await db.transaction('rw', [db.wellness, db.readiness, db.sesion_rpe, db.rpe_partido, db.sesiones, db.jugadoras], async () => {
      for (const w of cleaned) {
        const existing = await db.wellness.where({ id_jugadora: w.id_jugadora, fecha: w.fecha }).first()
        if (!existing) {
          await db.wellness.put(w)
          const key = JSON.stringify([w.id_jugadora, w.fecha])
          if (!affectedPairs.has(key)) {
            affectedPairs.set(key, { id_jugadora: w.id_jugadora, fecha: w.fecha })
          }
        }
      }

      for (const { id_jugadora, fecha } of affectedPairs.values()) {
        await recalcularReadinessJugadora(id_jugadora, fecha)
      }
    })

    if (affectedPairs.size === 0) return

    await get().loadAll()

    const affectedPlayers = Array.from(
      new Set(Array.from(affectedPairs.values(), ({ id_jugadora }) => id_jugadora))
    )
    await evaluarYSincronizarAlertasLote(affectedPlayers, set)
  },

  addSesion: async (s) => {
    const errors = validateSesion(s)
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(errors))
    }
    if (s.tipo_sesion === 'Partido' && s.id_partido) {
      const matchExists = get().partidos.some(p => p.id_partido === s.id_partido)
      if (!matchExists) {
        throw new Error(`El partido referenciado no existe: ${s.id_partido}`)
      }
    }
    await db.sesiones.put(s)
    set((state) => ({ sesiones: [s, ...state.sesiones] }))
  },

  updateSesion: async (s) => {
    const errors = validateSesion(s)
    if (errors.length > 0) {
      throw new Error(formatValidationErrors(errors))
    }
    if (s.tipo_sesion === 'Partido' && s.id_partido) {
      const matchExists = get().partidos.some(p => p.id_partido === s.id_partido)
      if (!matchExists) {
        throw new Error(`El partido referenciado no existe: ${s.id_partido}`)
      }
    }
    await db.sesiones.put(s)
    set((state) => ({ sesiones: state.sesiones.map(r => (r.id_sesion === s.id_sesion ? s : r)).sort((a, b) => b.fecha.localeCompare(a.fecha)) }))
  },

  duplicateSesion: async (id, nuevaFecha) => {
    const sesion = get().sesiones.find(s => s.id_sesion === id)
    if (!sesion) throw new Error('Sesión no encontrada')
    
    const newId = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const newSesion: Sesion = {
      ...sesion,
      id_sesion: newId,
      fecha: nuevaFecha,
      estado: 'planificada',
      // No copiamos RPEs, ni minutos grupales reales, solo la planificación
      duracion_real_grupal_min: undefined,
      duracion_min: undefined // Ya no usamos duracion_min para nuevas
    }
    await get().addSesion(newSesion)
  },

  cancelSesion: async (id, motivo) => {
    const sesion = get().sesiones.find(s => s.id_sesion === id)
    if (!sesion) throw new Error('Sesión no encontrada')

    const rpesAsociados = get().sesion_rpe.filter(r => r.id_sesion === id)
    const hasData = rpesAsociados.some(rpe => (
      (rpe.rpe !== undefined && rpe.rpe !== null) ||
      (rpe.carga_ua !== undefined && rpe.carga_ua !== null) ||
      (rpe.asistencia && rpe.asistencia !== 'sin_registrar')
    ))

    if (hasData) {
      throw new Error('No se puede cancelar una sesión que ya tiene datos reales registrados. Utiliza la edición.')
    }

    const cancelada = {
      ...sesion,
      estado: 'cancelada' as const,
      observaciones_grupo: motivo ? `${sesion.observaciones_grupo}\n[Cancelada]: ${motivo}`.trim() : sesion.observaciones_grupo
    }
    await get().updateSesion(cancelada)
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
    await get().updateAlertaEstado(id, 'resuelta')
  },

  updateAlertaEstado: async (id, estado) => {
    const fecha_resolucion = (estado === 'resuelta' || estado === 'descartada')
      ? getLocalDateString()
      : undefined
    const leida = (estado === 'resuelta' || estado === 'descartada')
    
    await db.alertas.update(id, { estado, fecha_resolucion, leida })
    set((state) => ({
      alertas: state.alertas.map(a => (a.id === id ? { ...a, estado, fecha_resolucion, leida } : a)),
    }))
  },

  registrarAlertaDecision: async (id, responsable, nota_decision) => {
    await db.alertas.update(id, { responsable, nota_decision })
    set((state) => ({
      alertas: state.alertas.map(a => (a.id === id ? { ...a, responsable, nota_decision } : a)),
    }))
  },

  archivarAlertasResueltas: async () => {
    const toDelete = await db.alertas.where('estado').anyOf('resuelta', 'descartada').toArray()
    const ids = toDelete.map(a => a.id).filter((id): id is number => id !== undefined)
    await db.alertas.bulkDelete(ids)
    set((state) => ({
      alertas: state.alertas.filter(a => !a.id || !ids.includes(a.id)),
    }))
  },

  clearAlertas: async () => {
    await db.alertas.clear()
    set({ alertas: [] })
  },

  addHistorialImportacion: async (h) => {
    await db.historial_importaciones.put(h)
    set((state) => ({ historial_importaciones: [h, ...state.historial_importaciones] }))
  },

  addHistorialCopia: async (h) => {
    await db.historial_copias.put(h)
    set((state) => ({ historial_copias: [h, ...state.historial_copias].sort((a, b) => b.fechaHora.localeCompare(a.fechaHora)) }))
  },

  addCicloMenstrual: async (c) => {
    await db.ciclo_menstrual.put(c)
    set((state) => ({ ciclo_menstrual: [c, ...state.ciclo_menstrual].sort((a, b) => b.fecha.localeCompare(a.fecha)) }))
  },

  addCargaGPS: async (g) => {
    await db.carga_gps.put(g)
    set((state) => ({ carga_gps: [g, ...state.carga_gps].sort((a, b) => b.fecha.localeCompare(a.fecha)) }))
  },

  addFuerzaVBT: async (v) => {
    await db.fuerza_vbt.put(v)
    set((state) => ({ fuerza_vbt: [v, ...state.fuerza_vbt].sort((a, b) => b.fecha.localeCompare(a.fecha)) }))
  },

  addHidratacion: async (h) => {
    await db.hidratacion.put(h)
    set((state) => ({ hidratacion: [h, ...state.hidratacion].sort((a, b) => b.fecha.localeCompare(a.fecha)) }))
  },

  addRTPChecklist: async (r) => {
    await db.rtp_checklist.put(r)
    set((state) => ({ rtp_checklist: [r, ...state.rtp_checklist] }))
  },

  updateRTPChecklist: async (r) => {
    await db.rtp_checklist.put(r)
    set((state) => ({ rtp_checklist: state.rtp_checklist.map(x => x.id === r.id ? r : x) }))
  },

  addTestPsicologico: async (t) => {
    await db.test_psicologico.put(t)
    set((state) => ({ test_psicologico: [t, ...state.test_psicologico].sort((a, b) => b.fecha.localeCompare(a.fecha)) }))
  },

  addSesionRPE: async (srpe) => {
    const errors = validateSesionRPE({ ...srpe, fecha: srpe.fecha || '1970-01-01' })
    if (errors.length > 0) throw new Error(formatValidationErrors(errors))

    let fechaEfectivaCalculada = ''

    await db.transaction(
      'rw',
      [
        db.sesion_rpe,
        db.resumen_semanal,
        db.readiness,
        db.jugadoras,
        db.sesiones,
        db.partidos,
        db.rpe_partido,
        db.wellness,
      ],
      async () => {
        const player = await db.jugadoras.get(srpe.id_jugadora as any)
        if (!player) {
          throw new Error(`La jugadora '${srpe.id_jugadora}' no existe en la base de datos`)
        }

        const sesion = await db.sesiones.get(srpe.id_sesion as any)
        if (!sesion) {
          throw new Error(`La sesión '${srpe.id_sesion}' no existe en la base de datos`)
        }

        const fechaNueva = srpe.fecha || sesion.fecha
        if (!fechaNueva) {
          throw new Error('No se pudo determinar la fecha del RPE de sesión')
        }

        fechaEfectivaCalculada = fechaNueva

        const registrosSesion = await db.sesion_rpe
          .where('id_sesion')
          .equals(srpe.id_sesion)
          .toArray()

        const duplicado = registrosSesion.find(r => r.id_jugadora === srpe.id_jugadora)
        if (duplicado) {
          throw new Error('Ya existe un registro de RPE para esta jugadora en esta sesión')
        }

        const rpeGuardar = { ...srpe, fecha: fechaNueva }
        await db.sesion_rpe.put(rpeGuardar)

        const config = useStore.getState().filters
        await recalcularResumenSemanal(rpeGuardar.id_jugadora, rpeGuardar.fecha, {
          incluirPartidos: config.incluirPartidos,
          incluirGimnasio: config.incluirGimnasio,
          incluirReadaptacion: config.incluirReadaptacion,
        })
        await recalcularReadinessJugadora(rpeGuardar.id_jugadora, rpeGuardar.fecha)
      }
    )

    await sincronizarSesionRpeIncremental(srpe.id_sesion, srpe.id_jugadora, fechaEfectivaCalculada, set, get)
    await evaluarYSincronizarAlertas(srpe.id_jugadora, set)
  },

  updateSesionRPE: async (srpe) => {
    const errors = validateSesionRPE({ ...srpe, fecha: srpe.fecha || '1970-01-01' })
    if (errors.length > 0) throw new Error(formatValidationErrors(errors))

    if (typeof srpe.id !== 'number' || !Number.isInteger(srpe.id) || srpe.id <= 0) {
      throw new Error('No se puede actualizar RPE de sesión sin un ID válido')
    }

    const affectedMap = new Map<string, { idJugadora: string; fecha: string }>()

    await db.transaction(
      'rw',
      [
        db.sesion_rpe,
        db.resumen_semanal,
        db.readiness,
        db.jugadoras,
        db.sesiones,
        db.partidos,
        db.rpe_partido,
        db.wellness,
      ],
      async () => {
        const prev = await db.sesion_rpe.get(srpe.id!)
        if (!prev) {
          throw new Error('No existe el registro de RPE de sesión a actualizar')
        }

        const sesionPrevia = await db.sesiones.get(prev.id_sesion as any)
        const fechaPrevia = prev.fecha || sesionPrevia?.fecha
        if (!fechaPrevia) {
          throw new Error('No se pudo determinar la fecha previa del RPE de sesión')
        }

        const player = await db.jugadoras.get(srpe.id_jugadora as any)
        if (!player) {
          throw new Error(`La jugadora '${srpe.id_jugadora}' no existe en la base de datos`)
        }

        const sesionNueva = await db.sesiones.get(srpe.id_sesion as any)
        if (!sesionNueva) {
          throw new Error(`La sesión '${srpe.id_sesion}' no existe en la base de datos`)
        }

        const fechaNueva = srpe.fecha || sesionNueva.fecha
        if (!fechaNueva) {
          throw new Error('No se pudo determinar la fecha del RPE de sesión')
        }

        const registrosSesion = await db.sesion_rpe
          .where('id_sesion')
          .equals(srpe.id_sesion)
          .toArray()

        const duplicado = registrosSesion.find(r => r.id_jugadora === srpe.id_jugadora && r.id !== srpe.id)
        if (duplicado) {
          throw new Error('Ya existe otro registro de RPE para esta jugadora en esta sesión')
        }

        const rpeGuardar = { ...srpe, fecha: fechaNueva }
        await db.sesion_rpe.put(rpeGuardar)

        const keyPrev = `${prev.id_jugadora}|${fechaPrevia}`
        affectedMap.set(keyPrev, { idJugadora: prev.id_jugadora, fecha: fechaPrevia })

        const keyNueva = `${rpeGuardar.id_jugadora}|${fechaNueva}`
        affectedMap.set(keyNueva, { idJugadora: rpeGuardar.id_jugadora, fecha: fechaNueva })

        const config = useStore.getState().filters
        for (const { idJugadora, fecha } of affectedMap.values()) {
          await recalcularResumenSemanal(idJugadora, fecha, {
            incluirPartidos: config.incluirPartidos,
            incluirGimnasio: config.incluirGimnasio,
            incluirReadaptacion: config.incluirReadaptacion,
          })
          await recalcularReadinessJugadora(idJugadora, fecha)
        }
      }
    )

    const affectedPairs = Array.from(affectedMap.values())
    await sincronizarSesionRpeEditadoIncremental(srpe.id!, affectedPairs, set, get)

    const uniquePlayers = Array.from(new Set(affectedPairs.map(x => x.idJugadora)))
    await evaluarYSincronizarAlertasLote(uniquePlayers, set)
  },

  saveRpeBatch: async (rpes) => {
    if (rpes.length === 0) return
    const validRpes = rpes.map(r => {
      const errors = validateSesionRPE(r)
      if (errors.length > 0) throw new Error(formatValidationErrors(errors))
      return r
    })
    
    const uniquePlayers = Array.from(new Set(validRpes.map(r => r.id_jugadora)))
    const fecha = validRpes[0].fecha

    await db.transaction(
      'rw',
      [
        db.sesion_rpe,
        db.resumen_semanal,
        db.readiness,
        db.jugadoras,
        db.sesiones,
        db.partidos,
        db.rpe_partido,
        db.wellness,
      ],
      async () => {
        await db.sesion_rpe.bulkPut(validRpes)
        for (const jugId of uniquePlayers) {
          await dispararResumenSemanal(jugId, fecha)
          await dispararReadiness(jugId, fecha)
        }
      }
    )

    await evaluarYSincronizarAlertasLote(uniquePlayers, set)
    await get().loadAll()
  },

  deleteSesionRPE: async (id) => {
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
      throw new Error('No se puede eliminar RPE de sesión sin un ID válido')
    }

    let jugadoraAfectada = ''
    let fechaEfectivaPrevia = ''

    await db.transaction(
      'rw',
      [
        db.sesion_rpe,
        db.resumen_semanal,
        db.readiness,
        db.jugadoras,
        db.sesiones,
        db.partidos,
        db.rpe_partido,
        db.wellness,
      ],
      async () => {
        const prev = await db.sesion_rpe.get(id)
        if (!prev) {
          throw new Error('No existe el registro de RPE de sesión a eliminar')
        }

        const sesionPrevia = await db.sesiones.get(prev.id_sesion as any)
        const fechaPrevia = prev.fecha || sesionPrevia?.fecha
        if (!fechaPrevia) {
          throw new Error('No se pudo determinar la fecha previa del RPE de sesión')
        }

        jugadoraAfectada = prev.id_jugadora
        fechaEfectivaPrevia = fechaPrevia

        await db.sesion_rpe.delete(id)

        const config = useStore.getState().filters
        await recalcularResumenSemanal(prev.id_jugadora, fechaPrevia, {
          incluirPartidos: config.incluirPartidos,
          incluirGimnasio: config.incluirGimnasio,
          incluirReadaptacion: config.incluirReadaptacion,
        })
        await recalcularReadinessJugadora(prev.id_jugadora, fechaPrevia)
      }
    )

    await sincronizarSesionRpeEliminadoIncremental(id, jugadoraAfectada, fechaEfectivaPrevia, set, get)
    await evaluarYSincronizarAlertas(jugadoraAfectada, set)
  },

  recalculateReadiness: async (jugadoraId, fecha) => {
    await dispararReadiness(jugadoraId, fecha)
    await get().loadAll()
  },

  generateWeeklySummary: async (semana, config) => {
    const activePlayers = get().jugadoras.filter(j => j.activa !== false)
    for (const jug of activePlayers) {
      await recalcularResumenSemanal(jug.id_jugadora, semana, config)
    }
    await get().loadAll()
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

  addPlantillaImportacion: async (p) => {
    await db.plantillas_importacion.put(p)
    await get().loadAll()
  },

  updatePlantillaImportacion: async (p) => {
    if (p.esPredeterminada) {
      throw new Error('No se puede sobrescribir la plantilla predeterminada')
    }
    await db.plantillas_importacion.put(p)
    await get().loadAll()
  },

  deletePlantillaImportacion: async (id) => {
    const existing = await db.plantillas_importacion.get(id)
    if (existing?.esPredeterminada) {
      throw new Error('No se puede eliminar la plantilla predeterminada')
    }
    await db.plantillas_importacion.delete(id)
    await get().loadAll()
  },

  evaluarSeguimientoJugadora: async (jugadoraId) => {
    await evaluarYSincronizarAlertas(jugadoraId, set)
  },

  // --- FASE 5: CMJ ---
  addProtocoloCMJ: async (p) => {
    await db.protocolos_cmj.add(p)
    await get().loadAll()
  },
  
  updateProtocoloCMJ: async (p) => {
    await db.protocolos_cmj.put(p)
    await get().loadAll()
  },

  activateProtocoloCMJ: async (id) => {
    const p = await db.protocolos_cmj.get(id)
    if (p) {
      await db.protocolos_cmj.put({ ...p, activo: true, updatedAt: new Date().toISOString() })
      await get().loadAll()
    }
  },

  deactivateProtocoloCMJ: async (id) => {
    const p = await db.protocolos_cmj.get(id)
    if (p) {
      // Regla: no permitir desactivar el último activo
      const activos = get().protocolos_cmj.filter(prot => prot.activo)
      if (activos.length === 1 && activos[0].id_protocolo === id) {
        throw new Error('No se puede desactivar el último protocolo activo.')
      }
      await db.protocolos_cmj.put({ ...p, activo: false, updatedAt: new Date().toISOString() })
      await get().loadAll()
    }
  },

  addPruebaCMJ: async (p) => {
    await db.pruebas_cmj.add(p)
    await get().loadAll()
  },

  updatePruebaCMJ: async (p) => {
    await db.pruebas_cmj.put(p)
    await get().loadAll()
  },

  addSesionFuerzaIndividual: async (s) => {
    await db.sesiones_fuerza_individual.put(s)
    await get().loadAll()
  },

  addEjercicioFuerza: async (e) => {
    await db.ejercicios_fuerza.put(e)
    await get().loadAll()
  },

  updateEjercicioFuerza: async (e) => {
    await db.ejercicios_fuerza.put(e)
    await get().loadAll()
  },

  activateEjercicioFuerza: async (id) => {
    await db.ejercicios_fuerza.update(id, { activo: true })
    await get().loadAll()
  },

  deactivateEjercicioFuerza: async (id) => {
    await db.ejercicios_fuerza.update(id, { activo: false })
    await get().loadAll()
  },

  addSesionFuerzaCompleta: async (sesion, trabajos) => {
    await db.transaction('rw', [db.sesiones_fuerza_individual, db.trabajos_fuerza], async () => {
      await db.sesiones_fuerza_individual.put(sesion)
      if (trabajos.length > 0) await db.trabajos_fuerza.bulkPut(trabajos)
    })
    await get().loadAll()
  },

  updateSesionFuerzaCompleta: async (sesion, trabajos) => {
    await db.transaction('rw', [db.sesiones_fuerza_individual, db.trabajos_fuerza], async () => {
      await db.sesiones_fuerza_individual.put(sesion)
      await db.trabajos_fuerza.where({ id_sesion_fuerza: sesion.id_sesion_fuerza }).delete()
      if (trabajos.length > 0) await db.trabajos_fuerza.bulkPut(trabajos)
    })
    await get().loadAll()
  },

  addPlantillaFuerza: async (plantilla) => {
    const now = new Date().toISOString()
    const nuevaPlantilla: PlantillaFuerza = {
      nombre: plantilla.nombre,
      finalidad: plantilla.finalidad ?? null,
      descripcion: plantilla.descripcion ?? null,
      ejercicios: plantilla.ejercicios ?? [],
      id_plantilla: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      activa: true,
      createdAt: now,
      updatedAt: now,
    }
    await db.plantillas_fuerza.put(nuevaPlantilla)
    await get().loadAll()
  },

  updatePlantillaFuerza: async (p) => {
    await db.plantillas_fuerza.put(p)
    await get().loadAll()
  },

  toggleActivaPlantillaFuerza: async (id, activa) => {
    await db.plantillas_fuerza.update(id, { activa, updatedAt: new Date().toISOString() })
    await get().loadAll()
  },

}))