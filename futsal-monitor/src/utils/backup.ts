import { db } from '@/db/database'
import type { TipoCopia, HistorialCopia } from '@/types'
import { recalcularResumenSemanal } from '@/services/resumenSemanal'
import { recalcularReadinessJugadora } from '@/services/readiness'
import { getWeekId, getTodayLocalISO } from '@/domain/dates/dates'

const BACKUP_KEY = 'futsal_backup'
const LAST_EXTERNAL_BACKUP_KEY = 'futsal_last_external_backup'
const _BACKUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutos
const _AUTO_BACKUP_ENABLED_KEY = 'futsal_autobackup'

let _backupTimer: ReturnType<typeof setInterval> | null = null

export const BACKUP_FORMAT_VERSION = 1
export const DATABASE_SCHEMA_VERSION = 15
export const APP_VERSION = '1.0.0'

export const createBackup = createBackupData

export function startAutoBackup(): void {
  if (_backupTimer) return
  _backupTimer = setInterval(async () => {
    try {
      await createBackupData()
    } catch {
      // Autobackup silencioso
    }
  }, _BACKUP_INTERVAL_MS)
}

export function stopAutoBackup(): void {
  if (_backupTimer) {
    clearInterval(_backupTimer)
    _backupTimer = null
  }
}

export const CRITICAL_TABLES = [
  'jugadoras',
  'sesiones',
  'partidos',
  'lesiones',
  'temporadas'
]

// Únicamente tablas 100% matemáticas sin metadatos ni decisiones humanas
export const DERIVED_TABLES = [
  'readiness',
  'resumen_semanal'
]

// Tablas de dominio opcionales y restaurables (incluye alertas para preservar trazabilidad humana: estado, responsable, nota_decision)
export const OPTIONAL_TABLES = [
  'formulario_respuestas',
  'wellness',
  'tests_fisicos',
  'rpe_partido',
  'sesion_rpe',
  'alertas',
  'historial_importaciones',
  'historial_copias',
  'ciclo_menstrual',
  'carga_gps',
  'fuerza_vbt',
  'hidratacion',
  'rtp_checklist',
  'test_psicologico',
  'protocolos_cmj',
  'pruebas_cmj',
  'ejercicios_fuerza',
  'trabajos_fuerza',
  'plantillas_fuerza',
  'sesiones_fuerza_individual',
  'plantillas_importacion',
  'alias_jugadora'
]

export interface ValidationResult {
  isValid: boolean
  canRestore: boolean
  error?: string
  warnings: string[]
  details?: {
    versionBackup: number
    backupFormatVersion: number
    databaseSchemaVersion: number
    versionApp: number
    tablesFound: string[]
    tablesMissing: string[]
    criticalMissing: string[]
    unknownEntities: string[]
  }
}

export interface RestoreResult {
  success: boolean
  error?: string
  mode: 'merge' | 'replace'
  stats: Record<string, { inserted: number; updated: number; skipped: number }>
  conflicts: Array<{ table: string; key: string; description: string }>
}

export interface MergePreviewAnalysis {
  tables: Record<string, {
    incomingCount: number
    newCount: number
    conflictCount: number
    orphanCount: number
  }>
  totalNew: number
  totalConflicts: number
  totalOrphans: number
  canMerge: boolean
  orphanDetails: Array<{ table: string; key: string; description: string }>
}

/**
 * 1. Cobertura de Backup: Exportar el 100% de las tablas IndexedDB
 */
export async function createBackupData() {
  const [
    temporadas, alias_jugadora, jugadoras, formulario_respuestas, wellness, sesiones, partidos,
    lesiones, tests_fisicos, rpe_partido, resumen_semanal, alertas,
    sesion_rpe, readiness, historial_importaciones, historial_copias,
    ciclo_menstrual, carga_gps, fuerza_vbt, hidratacion,
    rtp_checklist, test_psicologico,
    protocolos_cmj, pruebas_cmj, ejercicios_fuerza, trabajos_fuerza,
    plantillas_fuerza, sesiones_fuerza_individual, plantillas_importacion
  ] = await Promise.all([
    db.temporadas.toArray(),
    db.alias_jugadora.toArray(),
    db.jugadoras.toArray(),
    db.formulario_respuestas.toArray(),
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
    db.protocolos_cmj.toArray(),
    db.pruebas_cmj.toArray(),
    db.ejercicios_fuerza.toArray(),
    db.trabajos_fuerza.toArray(),
    db.plantillas_fuerza.toArray(),
    db.sesiones_fuerza_individual.toArray(),
    db.plantillas_importacion.toArray()
  ])

  return {
    version: DATABASE_SCHEMA_VERSION,
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    timestamp: new Date().toISOString(),
    data: {
      temporadas,
      alias_jugadora,
      jugadoras,
      formulario_respuestas,
      wellness,
      sesiones,
      partidos,
      lesiones,
      tests_fisicos,
      rpe_partido,
      resumen_semanal,
      alertas,
      sesion_rpe,
      readiness,
      historial_importaciones,
      historial_copias,
      ciclo_menstrual,
      carga_gps,
      fuerza_vbt,
      hidratacion,
      rtp_checklist,
      test_psicologico,
      protocolos_cmj,
      pruebas_cmj,
      ejercicios_fuerza,
      trabajos_fuerza,
      plantillas_fuerza,
      sesiones_fuerza_individual,
      plantillas_importacion
    }
  }
}

export async function forceExternalBackup(tipo: TipoCopia = 'manual'): Promise<string> {
  const backup = await createBackupData()
  const dateStr = getTodayLocalISO()
  const filename = `futsal_backup_${tipo}_${dateStr}_v${DATABASE_SCHEMA_VERSION}.json`

  const jsonStr = JSON.stringify(backup, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  if (typeof document === 'undefined') {
    throw new Error('Entorno de documento no disponible para descarga de archivo')
  }

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)

  localStorage.setItem(LAST_EXTERNAL_BACKUP_KEY, backup.timestamp)

  const recuento: Record<string, number> = {}
  const entidades = Object.keys(backup.data)
  for (const ent of entidades) {
    const len = (backup.data as any)[ent]?.length || 0
    recuento[ent] = len
  }

  const historial: HistorialCopia = {
    fechaHora: backup.timestamp,
    tipo,
    nombreArchivo: filename,
    entidadesIncluidas: entidades.filter(e => recuento[e] > 0),
    recuentoPorEntidad: recuento,
    versionEsquema: backup.databaseSchemaVersion,
    confirmadaExterna: false
  }

  await db.historial_copias.put(historial)
  return filename
}

export function getLastExternalBackupInfo(): { exists: boolean; timestamp: string | null; daysSince: number | null } {
  const raw = localStorage.getItem(LAST_EXTERNAL_BACKUP_KEY)
  if (!raw) return { exists: false, timestamp: null, daysSince: null }

  const ts = new Date(raw)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - ts.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  return { exists: true, timestamp: raw, daysSince: diffDays }
}

export async function parseBackupFile(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const backup = JSON.parse(text)
        resolve(backup)
      } catch {
        reject(new Error("Error al analizar el archivo de backup"))
      }
    }
    reader.onerror = () => reject(new Error("Error de lectura del archivo"))
    reader.readAsText(file)
  })
}

/**
 * 2. Compatibilidad de versiones e integridad
 */
export function validateBackupData(backupData: any): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    canRestore: true,
    warnings: [],
    details: {
      versionBackup: 0,
      backupFormatVersion: 1,
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
      versionApp: DATABASE_SCHEMA_VERSION,
      tablesFound: [],
      tablesMissing: [],
      criticalMissing: [],
      unknownEntities: []
    }
  }

  if (!backupData || typeof backupData !== 'object') {
    result.isValid = false
    result.canRestore = false
    result.error = 'El archivo de copia de seguridad no es un objeto JSON válido.'
    return result
  }

  // 1. Verificación contractual de formato de backup (backupFormatVersion)
  const formatVer = backupData.backupFormatVersion ?? 1
  result.details!.backupFormatVersion = formatVer
  if (formatVer !== BACKUP_FORMAT_VERSION) {
    result.isValid = true
    result.canRestore = false
    result.error = `Formato de copia de seguridad (versión ${formatVer}) no soportado. Se requiere formato versión ${BACKUP_FORMAT_VERSION}.`
    return result
  }

  // 2. Verificación de compatibilidad de esquema (databaseSchemaVersion)
  const backupVersion = backupData.databaseSchemaVersion || backupData.version
  if (typeof backupVersion !== 'number') {
    result.isValid = false
    result.canRestore = false
    result.error = 'No se ha encontrado una versión de esquema válida en la copia de seguridad.'
    return result
  }

  result.details!.versionBackup = backupVersion
  result.details!.databaseSchemaVersion = backupVersion

  if (backupVersion !== DATABASE_SCHEMA_VERSION) {
    result.isValid = true
    result.canRestore = false
    if (backupVersion > DATABASE_SCHEMA_VERSION) {
      result.error = `El archivo de copia de seguridad fue creado con una versión futura de la aplicación (v${backupVersion}). Se requiere una versión más reciente de la aplicación.`
    } else {
      result.error = `Esquema de base de datos (v${backupVersion}) no compatible con la versión v${DATABASE_SCHEMA_VERSION} de la aplicación.`
    }
    return result
  }

  if (!backupData.data || typeof backupData.data !== 'object') {
    result.isValid = false
    result.canRestore = false
    result.error = 'Falta el contenedor de datos "data" en la estructura del backup.'
    return result
  }

  const expectedTables = [
    ...CRITICAL_TABLES,
    ...DERIVED_TABLES,
    ...OPTIONAL_TABLES
  ]

  // Compatibilidad: Mapeo de legacy "tests" a "tests_fisicos"
  if (backupData.data.tests && !backupData.data.tests_fisicos) {
    backupData.data.tests_fisicos = backupData.data.tests
    delete backupData.data.tests
  }

  const dataKeys = Object.keys(backupData.data)
  for (const key of dataKeys) {
    if (!expectedTables.includes(key)) {
      result.details!.unknownEntities.push(key)
    } else {
      result.details!.tablesFound.push(key)
    }
  }

  for (const table of expectedTables) {
    if (!dataKeys.includes(table) && table !== 'historial_copias') {
      result.details!.tablesMissing.push(table)
    }
  }

  // Comprobar ausencia de tablas CRÍTICAS
  const missingCritical = CRITICAL_TABLES.filter(t => !dataKeys.includes(t))
  if (missingCritical.length > 0) {
    result.details!.criticalMissing = missingCritical
    result.isValid = false
    result.canRestore = false
    result.error = `Falta la tabla crítica "${missingCritical.join(', ')}" en la copia de seguridad. Operación de restauración bloqueada.`
    return result
  }

  if (result.details!.tablesMissing.length > 0) {
    result.warnings.push(`Tablas opcionales ausentes en la copia: ${result.details!.tablesMissing.join(', ')}.`)
  }

  // Validaciones clave de integridad para jugadoras
  if (backupData.data.jugadoras) {
    if (!Array.isArray(backupData.data.jugadoras)) {
      result.isValid = false
      result.canRestore = false
      result.error = 'La entidad "jugadoras" debe ser una lista (array).'
      return result
    }
    const setJugadoras = new Set<string>()
    for (const j of backupData.data.jugadoras) {
      if (!j.id_jugadora || typeof j.nombre !== 'string') {
        result.isValid = false
        result.canRestore = false
        result.error = 'Falta id_jugadora o nombre en alguno de los registros de jugadoras.'
        return result
      }
      setJugadoras.add(j.id_jugadora)
    }

    // Validar relaciones huérfanas si jugadoras está presente
    if (backupData.data.sesion_rpe && Array.isArray(backupData.data.sesion_rpe)) {
      for (const rpe of backupData.data.sesion_rpe) {
        if (rpe.id_jugadora && !setJugadoras.has(rpe.id_jugadora)) {
          result.isValid = false
          result.canRestore = false
          result.error = `Relación huérfana detectada: la sesión de RPE referencia a la jugadora inexistente "${rpe.id_jugadora}".`
          return result
        }
      }
    }
  }

  return result
}

// Claves lógicas robustas
export const getLogicalKey = (table: string, item: any): string => {
  switch (table) {
    case 'temporadas': return item.id_temporada || ''
    case 'alias_jugadora': return (item.origen && item.valor) ? `${item.origen}_${item.valor}` : ''
    case 'jugadoras': return item.id_jugadora || ''
    case 'sesiones': return item.id_sesion || ''
    case 'partidos': return item.id_partido || ''
    case 'lesiones': return item.id_lesion || ''
    case 'formulario_respuestas':
    case 'wellness':
    case 'ciclo_menstrual':
    case 'hidratacion':
    case 'test_psicologico':
      return (item.id_jugadora && item.fecha) ? `${item.id_jugadora}_${item.fecha}` : ''
    case 'tests_fisicos':
      return (item.id_jugadora && item.fecha && item.test) ? `${item.id_jugadora}_${item.fecha}_${item.test}_${item.momento || ''}` : ''
    case 'rpe_partido':
      return (item.id_jugadora && item.id_partido) ? `${item.id_jugadora}_${item.id_partido}` : ''
    case 'sesion_rpe':
      return (item.id_jugadora && item.id_sesion) ? `${item.id_jugadora}_${item.id_sesion}` : ''
    case 'carga_gps':
      return (item.id_jugadora && item.fecha) ? `${item.id_jugadora}_${item.fecha}_${item.id_sesion || ''}_${item.id_partido || ''}` : ''
    case 'rtp_checklist':
      return item.id_lesion ? `${item.id_lesion}` : ''
    case 'alertas':
      return (item.id_jugadora && item.fecha && item.tipo) ? `${item.id_jugadora}_${item.fecha}_${item.tipo}` : ''
    case 'historial_importaciones':
    case 'historial_copias':
      return (item.fechaHora && item.nombreArchivo) ? `${item.fechaHora}_${item.nombreArchivo}` : ''
    case 'protocolos_cmj':
      return item.id_protocolo || ''
    case 'pruebas_cmj':
      return item.id_medicion || ''
    case 'ejercicios_fuerza':
      return item.id_ejercicio || ''
    case 'trabajos_fuerza':
      return item.id_trabajo || ''
    case 'plantillas_fuerza':
      return item.id_plantilla || ''
    case 'sesiones_fuerza_individual':
      return item.id_sesion_fuerza || ''
    case 'plantillas_importacion':
      return item.nombre || ''
    case 'fuerza_vbt':
      return ''
    default:
      return ''
  }
}

export async function analyzeBackupMergePreview(backupData: any): Promise<MergePreviewAnalysis> {
  const analysis: MergePreviewAnalysis = {
    tables: {},
    totalNew: 0,
    totalConflicts: 0,
    totalOrphans: 0,
    canMerge: true,
    orphanDetails: []
  }

  const vResult = validateBackupData(backupData)
  if (!vResult.canRestore) {
    analysis.canMerge = false
    return analysis
  }

  const d = backupData.data
  const tablesToAnalyze = [
    'temporadas', 'alias_jugadora', 'jugadoras', 'formulario_respuestas', 'wellness', 'sesiones', 'partidos',
    'lesiones', 'tests_fisicos', 'rpe_partido', 'sesion_rpe', 'alertas',
    'historial_importaciones', 'ciclo_menstrual', 'carga_gps',
    'fuerza_vbt', 'hidratacion', 'rtp_checklist', 'test_psicologico',
    'protocolos_cmj', 'pruebas_cmj', 'ejercicios_fuerza', 'trabajos_fuerza',
    'plantillas_fuerza', 'sesiones_fuerza_individual', 'plantillas_importacion'
  ]

  const parentJugadoras = new Set<string>()
  const parentSesiones = new Set<string>()
  const parentPartidos = new Set<string>()
  const parentLesiones = new Set<string>()
  const parentProtocolos = new Set<string>()

  const [locJ, locS, locP, locL, locProt] = await Promise.all([
    db.jugadoras.toArray(),
    db.sesiones.toArray(),
    db.partidos.toArray(),
    db.lesiones.toArray(),
    db.protocolos_cmj.toArray()
  ])
  locJ.forEach(j => parentJugadoras.add(j.id_jugadora))
  locS.forEach(s => parentSesiones.add(s.id_sesion))
  locP.forEach(p => parentPartidos.add(p.id_partido))
  locL.forEach(l => parentLesiones.add(l.id_lesion))
  locProt.forEach(pr => parentProtocolos.add(pr.id_protocolo))

  if (d.jugadoras) (d.jugadoras as any[]).forEach(j => j.id_jugadora && parentJugadoras.add(j.id_jugadora))
  if (d.sesiones) (d.sesiones as any[]).forEach(s => s.id_sesion && parentSesiones.add(s.id_sesion))
  if (d.partidos) (d.partidos as any[]).forEach(p => p.id_partido && parentPartidos.add(p.id_partido))
  if (d.lesiones) (d.lesiones as any[]).forEach(l => l.id_lesion && parentLesiones.add(l.id_lesion))
  if (d.protocolos_cmj) (d.protocolos_cmj as any[]).forEach(pr => pr.id_protocolo && parentProtocolos.add(pr.id_protocolo))

  for (const table of tablesToAnalyze) {
    if (!Object.prototype.hasOwnProperty.call(d, table)) continue

    const incomingList = (d[table] || []) as any[]
    const localList = await (db as any)[table].toArray()
    let newCount = 0
    let conflictCount = 0
    let orphanCount = 0

    const localMap = new Map<string, any>()
    for (const loc of localList) {
      const lKey = getLogicalKey(table, loc)
      if (lKey) localMap.set(lKey, loc)
    }

    for (const inc of incomingList) {
      let isOrphan = false
      if (['wellness', 'formulario_respuestas', 'ciclo_menstrual', 'hidratacion', 'test_psicologico', 'carga_gps', 'tests_fisicos', 'sesiones_fuerza_individual', 'alertas'].includes(table)) {
        if (inc.id_jugadora && !parentJugadoras.has(inc.id_jugadora)) isOrphan = true
      } else if (table === 'rpe_partido') {
        if (!parentJugadoras.has(inc.id_jugadora) || !parentPartidos.has(inc.id_partido)) isOrphan = true
      } else if (table === 'sesion_rpe') {
        if (!parentJugadoras.has(inc.id_jugadora) || !parentSesiones.has(inc.id_sesion)) isOrphan = true
      } else if (table === 'rtp_checklist') {
        if (!parentLesiones.has(inc.id_lesion)) isOrphan = true
      } else if (table === 'pruebas_cmj') {
        if (!parentJugadoras.has(inc.id_jugadora) || (inc.id_protocolo && !parentProtocolos.has(inc.id_protocolo))) isOrphan = true
      }

      if (isOrphan) {
        orphanCount++
        analysis.orphanDetails.push({
          table,
          key: inc.id_jugadora || inc.id || 'desconocido',
          description: `Registro huérfano en ${table}`
        })
        continue
      }

      const key = getLogicalKey(table, inc)
      if (!key) continue

      const match = localMap.get(key)
      if (match) {
        const isDifferent = JSON.stringify(match) !== JSON.stringify(inc)
        if (isDifferent) {
          conflictCount++
        }
      } else {
        newCount++
      }
    }

    analysis.tables[table] = {
      incomingCount: incomingList.length,
      newCount,
      conflictCount,
      orphanCount
    }
    analysis.totalNew += newCount
    analysis.totalConflicts += conflictCount
    analysis.totalOrphans += orphanCount
  }

  return analysis
}

/**
 * 3. Regeneración de tablas derivadas (Readiness y Resumen Semanal)
 * Nota: Alertas NO se vacían en masa para no perder las decisiones humanas (nota_decision, estado, responsable).
 */
export async function regenerarTablasDerivadas(): Promise<void> {
  await Promise.all([
    db.readiness.clear(),
    db.resumen_semanal.clear()
  ])

  const jugadoras = await db.jugadoras.toArray()
  const wellness = await db.wellness.toArray()
  const sesionesRPE = await db.sesion_rpe.toArray()
  const cicloMenstrual = await db.ciclo_menstrual.toArray()

  for (const j of jugadoras) {
    const jId = j.id_jugadora
    const wellnessJugadora = wellness.filter(w => w.id_jugadora === jId)
    const rpeJugadora = sesionesRPE.filter(r => r.id_jugadora === jId)

    const fechas = Array.from(new Set([
      ...wellnessJugadora.map(w => w.fecha),
      ...rpeJugadora.map(r => r.fecha)
    ])).sort()

    // 1. Readiness
    for (const fecha of fechas) {
      await recalcularReadinessJugadora(jId, fecha)
    }

    // 2. Resumen Semanal (ACWR descriptivo)
    const semanas = Array.from(new Set(fechas.map(f => getWeekId(f))))
    for (const sem of semanas) {
      await recalcularResumenSemanal(jId, sem)
    }

    // 3. Alertas lógicas derivadas de seguimiento (preservando alertas existentes con notas humanas)
    const rs = await db.resumen_semanal.where({ id_jugadora: jId }).toArray()
    const rsSorted = rs.sort((a,b) => b.semana.localeCompare(a.semana))[0]
    const welSorted = wellnessJugadora.sort((a,b) => b.fecha.localeCompare(a.fecha))[0]
    const cicloSorted = cicloMenstrual.filter(c => c.id_jugadora === jId).sort((a,b) => b.fecha.localeCompare(a.fecha))[0]

    if (rsSorted && welSorted && cicloSorted) {
      const isAltaCarga = rsSorted.acwr > 1.5
      const isBajoWellness = welSorted.score_wellness < 50
      const isFaseSensible = cicloSorted.fase === 'Ovulacion' || cicloSorted.fase === 'Lutea'

      if (isAltaCarga && isBajoWellness && isFaseSensible) {
        const fechaHoy = getTodayLocalISO()
        const alertasExistentes = await db.alertas.where({ id_jugadora: jId }).toArray()
        const existeAlertaMismaFechaTipo = alertasExistentes.some(a => a.fecha === fechaHoy && a.tipo === 'carga_alta')

        if (!existeAlertaMismaFechaTipo) {
          await db.alertas.put({
            id_jugadora: jId,
            fecha: fechaHoy,
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
            mensaje: `Revisar hoy (Carga descriptiva ACWR: ${rsSorted.acwr.toFixed(2)}, Wellness: ${welSorted.score_wellness}, Ciclo: ${cicloSorted.fase})`,
            datos_sustento: JSON.stringify({ acwr: rsSorted.acwr, score: welSorted.score_wellness, fase: cicloSorted.fase })
          })
        }
      }
    }
  }
}

/**
 * 2. Restauración Merge & Replace con justificación y prevención de duplicados
 */
export async function restoreFromData(
  backupData: any,
  mode: 'merge' | 'replace' = 'replace',
  mergeStrategy: 'overwrite' | 'skip' | 'error' = 'skip'
): Promise<RestoreResult> {
  const vResult = validateBackupData(backupData)
  if (!vResult.canRestore) {
    return {
      success: false,
      error: vResult.error || 'Validación de restauración fallida',
      mode,
      stats: {},
      conflicts: []
    }
  }

  const d = backupData.data
  const conflicts: Array<{ table: string; key: string; description: string; local: any; incoming: any }> = []
  const stats: Record<string, { inserted: number; updated: number; skipped: number }> = {}

  // Política Opción A para Replace: Bloquear reemplazo total si falta cualquier tabla persistente del contrato
  const persistentTablesContract = [...CRITICAL_TABLES, ...OPTIONAL_TABLES]
  const missingContractTables = persistentTablesContract.filter(t => !Object.prototype.hasOwnProperty.call(d, t) && t !== 'historial_copias')

  if (mode === 'replace' && missingContractTables.length > 0) {
    return {
      success: false,
      error: `Reemplazo total bloqueado: la copia de seguridad no contiene la totalidad de las tablas del contrato (faltan: ${missingContractTables.join(', ')}). Para preservar datos locales use el modo fusión (merge) o proporcione una copia completa.`,
      mode,
      stats: {},
      conflicts: []
    }
  }

  const tablesToRestore = [
    'temporadas', 'alias_jugadora', 'jugadoras', 'formulario_respuestas', 'wellness', 'sesiones', 'partidos',
    'lesiones', 'tests_fisicos', 'rpe_partido', 'sesion_rpe', 'alertas',
    'historial_importaciones', 'ciclo_menstrual', 'carga_gps',
    'fuerza_vbt', 'hidratacion', 'rtp_checklist', 'test_psicologico',
    'protocolos_cmj', 'pruebas_cmj', 'ejercicios_fuerza', 'trabajos_fuerza',
    'plantillas_fuerza', 'sesiones_fuerza_individual', 'plantillas_importacion'
  ]

  const tablesPresentInBackup = tablesToRestore.filter(t => Object.prototype.hasOwnProperty.call(d, t))

  try {
    // 1. Descarga obligatoria antes de vaciar nada
    if (mode === 'replace') {
      try {
        await forceExternalBackup('previo_restauracion')
      } catch {
        throw new Error('No se pudo generar o descargar la copia de seguridad previa obligatoria. Operación cancelada.')
      }
    }

    await db.transaction('rw', [
      db.temporadas, db.alias_jugadora, db.jugadoras, db.formulario_respuestas, db.wellness, db.sesiones, db.partidos,
      db.lesiones, db.tests_fisicos, db.rpe_partido, db.resumen_semanal, db.alertas,
      db.sesion_rpe, db.readiness, db.historial_importaciones, db.historial_copias,
      db.ciclo_menstrual, db.carga_gps, db.fuerza_vbt, db.hidratacion,
      db.rtp_checklist, db.test_psicologico, db.protocolos_cmj, db.pruebas_cmj,
      db.ejercicios_fuerza, db.trabajos_fuerza, db.plantillas_fuerza,
      db.sesiones_fuerza_individual, db.plantillas_importacion
    ], async () => {
      if (mode === 'replace') {
        // En Replace completo (Opción A), vaciar todas las tablas persistentes del contrato
        await Promise.all(
          tablesPresentInBackup.map(t => (db as any)[t].clear())
        )
      }

      // Conjuntos de entidades padre para prevención de huérfanos durante el merge
      const parentJugadoras = new Set<string>()
      const parentSesiones = new Set<string>()
      const parentPartidos = new Set<string>()
      const parentLesiones = new Set<string>()
      const parentProtocolos = new Set<string>()

      const [locJ, locS, locP, locL, locProt] = await Promise.all([
        db.jugadoras.toArray(),
        db.sesiones.toArray(),
        db.partidos.toArray(),
        db.lesiones.toArray(),
        db.protocolos_cmj.toArray()
      ])
      locJ.forEach(j => parentJugadoras.add(j.id_jugadora))
      locS.forEach(s => parentSesiones.add(s.id_sesion))
      locP.forEach(p => parentPartidos.add(p.id_partido))
      locL.forEach(l => parentLesiones.add(l.id_lesion))
      locProt.forEach(pr => parentProtocolos.add(pr.id_protocolo))

      if (d.jugadoras) (d.jugadoras as any[]).forEach(j => j.id_jugadora && parentJugadoras.add(j.id_jugadora))
      if (d.sesiones) (d.sesiones as any[]).forEach(s => s.id_sesion && parentSesiones.add(s.id_sesion))
      if (d.partidos) (d.partidos as any[]).forEach(p => p.id_partido && parentPartidos.add(p.id_partido))
      if (d.lesiones) (d.lesiones as any[]).forEach(l => l.id_lesion && parentLesiones.add(l.id_lesion))
      if (d.protocolos_cmj) (d.protocolos_cmj as any[]).forEach(pr => pr.id_protocolo && parentProtocolos.add(pr.id_protocolo))

      for (const table of tablesPresentInBackup) {
        const incomingList = d[table] || []
        const localList = await (db as any)[table].toArray()
        stats[table] = { inserted: 0, updated: 0, skipped: 0 }

        const localMap = new Map<string, any>()
        for (const loc of localList) {
          const lKey = getLogicalKey(table, loc)
          if (lKey) localMap.set(lKey, loc)
        }

        for (const inc of incomingList) {
          // Prevención de huérfanos en modo merge
          if (mode === 'merge') {
            let orphanReason: string | null = null
            if (['wellness', 'formulario_respuestas', 'ciclo_menstrual', 'hidratacion', 'test_psicologico', 'carga_gps', 'tests_fisicos', 'sesiones_fuerza_individual', 'alertas'].includes(table)) {
              if (inc.id_jugadora && !parentJugadoras.has(inc.id_jugadora)) {
                orphanReason = `La jugadora "${inc.id_jugadora}" no existe.`
              }
            } else if (table === 'rpe_partido') {
              if (!parentJugadoras.has(inc.id_jugadora) || !parentPartidos.has(inc.id_partido)) {
                orphanReason = `La jugadora "${inc.id_jugadora}" o el partido "${inc.id_partido}" no existen.`
              }
            } else if (table === 'sesion_rpe') {
              if (!parentJugadoras.has(inc.id_jugadora) || !parentSesiones.has(inc.id_sesion)) {
                orphanReason = `La jugadora "${inc.id_jugadora}" o la sesión "${inc.id_sesion}" no existen.`
              }
            } else if (table === 'rtp_checklist') {
              if (!parentLesiones.has(inc.id_lesion)) {
                orphanReason = `La lesión "${inc.id_lesion}" no existe.`
              }
            } else if (table === 'pruebas_cmj') {
              if (!parentJugadoras.has(inc.id_jugadora) || (inc.id_protocolo && !parentProtocolos.has(inc.id_protocolo))) {
                orphanReason = `La jugadora "${inc.id_jugadora}" o el protocolo CMJ "${inc.id_protocolo}" no existen.`
              }
            }

            if (orphanReason) {
              conflicts.push({
                table,
                key: 'Huérfano',
                description: `Registro huérfano omitido: ${orphanReason}`,
                local: null,
                incoming: inc
              })
              stats[table].skipped++
              continue
            }
          }

          const key = getLogicalKey(table, inc)
          if (!key) {
            conflicts.push({
              table,
              key: 'Inestable/Desconocido',
              description: `No se dispone de una clave lógica estable para el registro en ${table}. Se omite en fusión segura.`,
              local: null,
              incoming: inc
            })
            stats[table].skipped++
            continue
          }

          const match = localMap.get(key)

          if (!match && inc.id !== undefined && table !== 'jugadoras' && table !== 'sesiones' && table !== 'partidos' && table !== 'lesiones' && table !== 'temporadas') {
            delete inc.id
          }

          if (match) {
            const isDifferent = JSON.stringify(match) !== JSON.stringify(inc)
            if (isDifferent) {
              conflicts.push({
                table,
                key,
                description: `Datos conflictivos para la clave ${key}`,
                local: match,
                incoming: inc
              })

              if (mergeStrategy === 'error') {
                throw new Error(`Conflicto de restauración merge en la tabla ${table} con la clave ${key}`)
              } else if (mergeStrategy === 'overwrite') {
                if (match.id !== undefined) inc.id = match.id
                await (db as any)[table].put(inc)
                stats[table].updated++
              } else {
                stats[table].skipped++
              }
            } else {
              stats[table].skipped++
            }
          } else {
            await (db as any)[table].put(inc)
            stats[table].inserted++
          }
        }
      }

      await regenerarTablasDerivadas()

      // Registrar la restauración realizada
      const logCopia: HistorialCopia = {
        fechaHora: new Date().toISOString(),
        tipo: 'restauracion',
        nombreArchivo: backupData.filename || `restaurado-${mode}.json`,
        entidadesIncluidas: tablesPresentInBackup.filter(t => (d[t] || []).length > 0),
        recuentoPorEntidad: tablesPresentInBackup.reduce((acc, t) => {
          acc[t] = (d[t] || []).length
          return acc
        }, {} as Record<string, number>),
        versionEsquema: backupData.version,
        confirmadaExterna: true
      }
      await db.historial_copias.put(logCopia)
    })

    return {
      success: true,
      mode,
      stats,
      conflicts: conflicts.map(c => ({ table: c.table, key: c.key, description: c.description }))
    }
  } catch (e: any) {
    return {
      success: false,
      error: e.message || 'Error durante la restauración',
      mode,
      stats: {},
      conflicts: conflicts.map(c => ({ table: c.table, key: c.key, description: c.description }))
    }
  }
}

export function getBackupInfo(): { exists: boolean; timestamp: string | null } {
  const raw = localStorage.getItem(BACKUP_KEY)
  if (!raw) return { exists: false, timestamp: null }
  try {
    const backup = JSON.parse(raw)
    return { exists: true, timestamp: backup.timestamp || null }
  } catch {
    return { exists: false, timestamp: null }
  }
}
