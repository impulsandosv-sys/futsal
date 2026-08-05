import { db } from '@/db/database'
import type { FutsalDB } from '@/db/database'
import { calcularScoreWellness } from '@/utils/calculations'
import type {
  RawCellValue,
  RawImportRow,
  ColumnMapping,
  MappedWellnessRow,
  PreviewRow,
  ImportStrategy,
  ImportOutcome,
  HistorialImportacion,
  ImportacionEstado,
  Wellness,
  Temporada,
  Jugadora,
  AliasJugadora
} from '@/types'
import { parseISO, addDays, format } from 'date-fns'
import * as readinessService from '@/services/readiness'
import * as resumenSemanalService from '@/services/resumenSemanal'
import { getWeekId, validateFechaLocalISO, getTodayLocalISO } from '@/domain/dates/dates'
import { obtenerTemporadaActiva } from '@/domain/temporadas/temporadas'
import type { FiltrosCarga } from '@/domain/monitoring/monitoring'

export interface ValidationContext {
  jugadorasIds: string[]
  jugadorasMap?: Record<string, string>
  temporadaActiva?: Temporada | null
  aliasesGoogleForms?: Map<string, { id_jugadora: string; activo: boolean }>
}

export interface ValidationResult {
  isValid: boolean
  errorMsg?: string
  normalRow?: MappedWellnessRow
}

/**
 * Parses raw CSV content with auto-detected or specified separators.
 */
export function parseCSVString(csvContent: string, delimiter?: string): RawImportRow[] {
  let sep = delimiter
  if (!sep) {
    const firstLine = csvContent.split('\n')[0] || ''
    if (firstLine.includes('\t')) sep = '\t'
    else if (firstLine.includes(';')) sep = ';'
    else sep = ','
  }

  const lines = csvContent.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0)
  if (lines.length === 0) return []

  const parseLine = (line: string, separator: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === separator && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result.map(val => val.replace(/^"|"$/g, ''))
  }

  const headers = parseLine(lines[0], sep)
  const rawRows: RawImportRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i], sep)
    const row: RawImportRow = {}
    headers.forEach((h, idx) => {
      row[h] = vals[idx] !== undefined ? vals[idx] : null
    })
    rawRows.push(row)
  }

  return rawRows
}



/**
 * Propagates affected dates up to 28 days forward (rolling window chronic load).
 */
export function calcularVentanaPropagacion(affectedDates: string[], referenceTodayStr?: string): string[] {
  const propagatedDates = new Set<string>()
  const todayStr = referenceTodayStr || new Date().toISOString().split('T')[0]
  
  affectedDates.forEach(dateStr => {
    try {
      const startDate = parseISO(dateStr)
      if (isNaN(startDate.getTime())) return
      for (let i = 0; i < 28; i++) {
        const currentDate = addDays(startDate, i)
        const curDateStr = format(currentDate, 'yyyy-MM-dd')
        if (curDateStr <= todayStr) {
          propagatedDates.add(curDateStr)
        }
      }
    } catch {
      // Ignore
    }
  })
  return Array.from(propagatedDates).sort()
}

/**
 * Idempotent initialization of default template.
 */
export async function ensureDefaultImportTemplate(): Promise<void> {
  const count = await db.plantillas_importacion.where({ nombre: 'Google Forms Wellness 2026-27' }).count()
  if (count === 0) {
    await db.plantillas_importacion.put({
      nombre: 'Google Forms Wellness 2026-27',
      tipoImportacion: 'wellness',
      mapeoColumnas: [
        { internalField: 'id_jugadora', excelHeader: 'ID_Jugadora', required: true, label: 'ID Jugadora' },
        { internalField: 'fecha', excelHeader: 'Fecha', required: true, label: 'Fecha de Registro' },
        { internalField: 'calidad_sueno', excelHeader: 'Calidad de sueño', required: true, label: 'Calidad de Sueño (1-10)' },
        { internalField: 'fatiga', excelHeader: 'Fatiga', required: true, label: 'Fatiga (1-10)' },
        { internalField: 'dolor_muscular', excelHeader: 'Dolor muscular', required: true, label: 'Dolor Muscular (1-10)' },
        { internalField: 'estres', excelHeader: 'Estrés', required: true, label: 'Estrés (1-10)' },
        { internalField: 'estado_animo', excelHeader: 'Estado de ánimo', required: true, label: 'Estado de Ánimo (1-10)' },
        { internalField: 'dolor_especifico', excelHeader: 'Dolor específico', required: false, label: 'Dolor Específico / Observaciones' },
        { internalField: 'marca_temporal', excelHeader: 'Marca temporal', required: false, label: 'Marca Temporal (Google Forms)' }
      ],
      creadaEn: new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
      esPredeterminada: true
    })
  }
}

/**
 * Normalizes header names for robust matching (accents, spaces, casing).
 */
export function normalizarEncabezado(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[_\s]+/g, " ")
    .trim();
}

/**
 * Automaps column headers to internal fields.
 */
export function detectarMapeoWellness(headers: string[]): ColumnMapping[] {
  const ALIASES: Record<string, string[]> = {
    id_jugadora: ['id jugadora', 'id', 'codigo jugadora', 'codigo'],
    fecha: ['fecha', 'dia', 'fecha de registro', 'fecha respuesta', 'marca temporal', 'timestamp'],
    calidad_sueno: ['calidad de sueno', 'calidad sueño', 'sueno', 'sueño', 'calidad_sueño', 'sueño (1-10)', 'sueno (1-10)'],
    fatiga: ['fatiga', 'nivel de fatiga', 'cansancio'],
    dolor_muscular: ['dolor muscular', 'dolor_muscular', 'doms', 'molestias musculares'],
    estres: ['estres', 'estrés', 'nivel de estres', 'nivel de estrés'],
    estado_animo: ['estado de animo', 'estado de ánimo', 'animo', 'ánimo', 'mood'],
    dolor_especifico: ['dolor especifico', 'dolor específico', '¿tienes dolor?', 'tienes dolor', 'molestia', 'comentarios', 'observaciones']
  }

  const mapped: ColumnMapping[] = [
    { internalField: 'id_jugadora', excelHeader: null, required: true, label: 'ID Jugadora' },
    { internalField: 'fecha', excelHeader: null, required: true, label: 'Fecha' },
    { internalField: 'calidad_sueno', excelHeader: null, required: true, label: 'Calidad de Sueño (1-10)' },
    { internalField: 'fatiga', excelHeader: null, required: true, label: 'Fatiga (1-10)' },
    { internalField: 'dolor_muscular', excelHeader: null, required: true, label: 'Dolor Muscular (1-10)' },
    { internalField: 'estres', excelHeader: null, required: true, label: 'Estrés (1-10)' },
    { internalField: 'estado_animo', excelHeader: null, required: true, label: 'Estado de Ánimo (1-10)' },
    { internalField: 'dolor_especifico', excelHeader: null, required: false, label: 'Dolor Específico' },
    { internalField: 'marca_temporal', excelHeader: null, required: false, label: 'Marca temporal' }
  ]

  const normalizedHeaders = headers.map(h => ({ original: h, normalized: normalizarEncabezado(h) }))

  mapped.forEach(m => {
    // 1. Check exact match
    let match = normalizedHeaders.find(h => h.normalized === normalizarEncabezado(m.internalField))
    if (!match && ALIASES[m.internalField]) {
      // 2. Check aliases
      const allowedAliases = ALIASES[m.internalField].map(a => normalizarEncabezado(a))
      match = normalizedHeaders.find(h => allowedAliases.includes(h.normalized))
    }
    if (match) {
      m.excelHeader = match.original
    }
  })

  return mapped
}

/**
 * Normalizes input date value to YYYY-MM-DD.
 * Google Forms timestamp is parsed preserving local calendar date (no UTC shift).
 */
export function normalizarFecha(value: RawCellValue): string | null {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    // Extract local date fields directly to avoid timezone shift
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (typeof value === 'number') {
    // Treat as Excel date code fallback
    const date = new Date((value - 25569) * 86400 * 1000)
    if (!isNaN(date.getTime())) {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
    return null
  }

  const str = String(value).trim()
  if (!str) return null

  // Reject ISO timestamps with T or Z (must be strict local date YYYY-MM-DD or DD/MM/YYYY)
  if (str.includes('T') || str.includes('Z')) {
    return null
  }

  // Check format YYYY-MM-DD
  const yyyymmdd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(str)
  if (yyyymmdd) {
    const y = yyyymmdd[1]
    const m = yyyymmdd[2].padStart(2, '0')
    const d = yyyymmdd[3].padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // Check format DD/MM/YYYY or DD-MM-YYYY (also with timestamps like Google Forms: DD/MM/YYYY HH:mm:ss)
  // We parse the date part manually to preserve local day correctly without UTC timezone shift.
  const ddmmyyyy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(str)
  if (ddmmyyyy) {
    const d = ddmmyyyy[1].padStart(2, '0')
    const m = ddmmyyyy[2].padStart(2, '0')
    const y = ddmmyyyy[3]
    return `${y}-${m}-${d}`
  }

  // Fallback try standard Date parsing
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const d = String(parsed.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return null
}

/**
 * Extracts a numeric value (integer 1-10) from a cell.
 * Handles strings like "1 - Muy bajo", "7/10", etc.
 */
export function extraerEscala(value: RawCellValue): number | null {
  if (value === null || value === undefined || value === '') return null
  const str = String(value).trim()
  if (str === '') return null

  // Check direct number
  const directNum = Number(str)
  if (!isNaN(directNum)) {
    return Number.isInteger(directNum) ? directNum : Math.round(directNum)
  }

  // Check "7/10"
  const fractionMatch = /^(\d+)\s*\/\s*10$/.exec(str)
  if (fractionMatch) {
    return parseInt(fractionMatch[1], 10)
  }

  // Check "7 - Muy bueno"
  const leadMatch = /^(\d+)(?:\s*[-.]\s*.*)?$/.exec(str)
  if (leadMatch) {
    return parseInt(leadMatch[1], 10)
  }

  return null
}

/**
 * Fetches existing jugadoras directly from Dexie for validation context.
 */
/**
 * Fetches existing jugadoras, active season, and google_forms aliases directly from Dexie for validation context.
 */
export async function obtenerContextoValidacionWellness(dbInstance: FutsalDB = db): Promise<ValidationContext> {
  const jugadoras = await dbInstance.jugadoras.toArray()
  const jugadorasIds = jugadoras.map((j: Jugadora) => j.id_jugadora)
  const jugadorasMap: Record<string, string> = {}
  jugadoras.forEach((j: Jugadora) => {
    jugadorasMap[j.id_jugadora] = j.nombre
  })

  const temporadaActiva = await obtenerTemporadaActiva(dbInstance)

  const aliasRecords = (dbInstance && dbInstance.alias_jugadora && typeof dbInstance.alias_jugadora.where === 'function')
    ? await dbInstance.alias_jugadora.where('origen').equals('google_forms').toArray()
    : []
  const aliasesGoogleForms = new Map<string, { id_jugadora: string; activo: boolean }>()
  aliasRecords.forEach((a: AliasJugadora) => {
    aliasesGoogleForms.set(a.valor.trim(), { id_jugadora: a.id_jugadora, activo: a.activo })
  })

  return {
    jugadorasIds,
    jugadorasMap,
    temporadaActiva,
    aliasesGoogleForms
  }
}

/**
 * Fetches jugadoras ID -> Nombre map directly from Dexie.
 */
export async function obtenerMapaJugadorasDexie(): Promise<Record<string, string>> {
  const jugadoras = await db.jugadoras.toArray()
  const map: Record<string, string> = {}
  jugadoras.forEach(j => {
    map[j.id_jugadora] = j.nombre
  })
  return map
}

/**
 * Validates a single wellness row based on logical constraints (Alias resolution & Active Season enforcement).
 */
export function validarFilaWellness(row: RawImportRow, context: ValidationContext): ValidationResult {
  const idRaw = row.id_jugadora
  if (idRaw === null || idRaw === undefined) {
    return { isValid: false, errorMsg: 'ID_Jugadora ausente' }
  }
  const rawAliasValue = String(idRaw).trim()
  if (!rawAliasValue) {
    return { isValid: false, errorMsg: 'ID_Jugadora vacío' }
  }

  let resolvedIdJugadora: string

  if (context.aliasesGoogleForms && context.aliasesGoogleForms.size > 0) {
    const aliasInfo = context.aliasesGoogleForms.get(rawAliasValue)
    if (!aliasInfo) {
      return { isValid: false, errorMsg: `ID externo '${rawAliasValue}' no reconocido para el origen 'google_forms'` }
    }
    if (!aliasInfo.activo) {
      return { isValid: false, errorMsg: `Alias '${rawAliasValue}' inactivo para el origen 'google_forms'` }
    }
    resolvedIdJugadora = aliasInfo.id_jugadora
  } else {
    // Fallback if aliases map is not provided in context (e.g. legacy test contexts)
    resolvedIdJugadora = rawAliasValue.toUpperCase()
  }

  if (!context.jugadorasIds.includes(resolvedIdJugadora)) {
    return { isValid: false, errorMsg: `La jugadora '${resolvedIdJugadora}' no existe en la base de datos` }
  }

  const fechaNorm = normalizarFecha(row.fecha)
  if (!fechaNorm) {
    return { isValid: false, errorMsg: `Fecha '${row.fecha || ''}' inválida o vacía` }
  }

  const errFechaISO = validateFechaLocalISO(fechaNorm, 'fecha')
  if (errFechaISO) {
    return { isValid: false, errorMsg: errFechaISO }
  }

  // Prevent future dates
  const todayStr = getTodayLocalISO()
  if (fechaNorm > todayStr) {
    return { isValid: false, errorMsg: `Fecha futura detectada: ${fechaNorm}` }
  }

  // Validar Temporada Activa
  if (context.temporadaActiva === null) {
    return { isValid: false, errorMsg: 'No existe una temporada activa. Crea o activa una temporada antes de importar wellness.' }
  } else if (context.temporadaActiva) {
    const { fecha_inicio, fecha_fin } = context.temporadaActiva
    if (fechaNorm < fecha_inicio || fechaNorm > fecha_fin) {
      return { isValid: false, errorMsg: `Fecha '${fechaNorm}' fuera del rango de la temporada activa (${fecha_inicio} a ${fecha_fin})` }
    }
  }

  const fields = ['calidad_sueno', 'fatiga', 'dolor_muscular', 'estres', 'estado_animo']
  const normalRow: MappedWellnessRow = {
    id_jugadora: resolvedIdJugadora,
    alias_origen: rawAliasValue,
    id_temporada: context.temporadaActiva?.id_temporada,
    fecha: fechaNorm,
    calidad_sueno: null,
    fatiga: null,
    dolor_muscular: null,
    estres: null,
    estado_animo: null,
    dolor_especifico: row.dolor_especifico ? String(row.dolor_especifico).trim() : null,
    marca_temporal: row.marca_temporal ? String(row.marca_temporal).trim() : null
  }

  let hasAnyWellness = false
  for (const f of fields) {
    const val = row[f]
    if (val !== null && val !== undefined && String(val).trim() !== '') {
      const score = extraerEscala(val)
      if (score === null || score < 1 || score > 10) {
        return { isValid: false, errorMsg: `Valor '${val}' fuera de rango 1-10 en ${f}` }
      }
      ;(normalRow as any)[f] = score
      hasAnyWellness = true
    }
  }

  if (!hasAnyWellness) {
    return { isValid: false, errorMsg: 'Fila sin ningún dato de wellness' }
  }

  return { isValid: true, normalRow }
}

/**
 * Classifies a valid row against the existing Dexie records.
 */
export function clasificarFilaImportacion(row: MappedWellnessRow, existingWellness: Wellness[]): 'NUEVO' | 'ACTUALIZACION_POSIBLE' | 'DUPLICADO_IDENTICO' {
  const match = existingWellness.find(w => w.id_jugadora === row.id_jugadora && w.fecha === row.fecha)
  if (!match) return 'NUEVO'

  const fields: (keyof MappedWellnessRow)[] = ['calidad_sueno', 'fatiga', 'dolor_muscular', 'estres', 'estado_animo', 'dolor_especifico']
  const isIdentical = fields.every(f => {
    let incomingVal = row[f]
    let localVal = match[f as keyof Wellness]

    // Normalizar nulos, undefined y cadenas vacías a vacío
    if (incomingVal === null || incomingVal === undefined) incomingVal = ''
    if (localVal === null || localVal === undefined) localVal = ''

    return String(incomingVal).trim() === String(localVal).trim()
  })

  return isIdentical ? 'DUPLICADO_IDENTICO' : 'ACTUALIZACION_POSIBLE'
}

export interface PreviewResult {
  total: number
  nuevos: number
  actualizaciones: number
  duplicados: number
  errores: number
  omitidos: number
  rows: PreviewRow[]
}

/**
 * Builds validation preview for UI, checks duplicates inside file.
 */
export function construirVistaPrevia(
  rawRows: RawImportRow[],
  mapping: ColumnMapping[],
  existingWellness: Wellness[],
  jugadorasMap: Record<string, string>, // id_jugadora -> nombre
  contextOverrides?: ValidationContext
): PreviewResult {
  const result: PreviewResult = {
    total: rawRows.length,
    nuevos: 0,
    actualizaciones: 0,
    duplicados: 0,
    errores: 0,
    omitidos: 0,
    rows: []
  }

  const context: ValidationContext = contextOverrides || {
    jugadorasIds: Object.keys(jugadorasMap),
    jugadorasMap
  }
  const fileKeys = new Set<string>()

  rawRows.forEach((rawRow, idx) => {
    const filaOriginal = idx + 2 // Assuming header is row 1
    
    // Map raw row fields
    const mappedRow: RawImportRow = {}
    mapping.forEach(m => {
      if (m.excelHeader) {
        mappedRow[m.internalField] = rawRow[m.excelHeader]
      } else {
        mappedRow[m.internalField] = null
      }
    })

    const val = validarFilaWellness(mappedRow, context)
    
    if (!val.isValid) {
      result.errores++
      result.rows.push({
        filaOriginal,
        estado: 'ERROR',
        id_jugadora: mappedRow.id_jugadora ? String(mappedRow.id_jugadora).trim().toUpperCase() : '',
        alias_origen: mappedRow.id_jugadora ? String(mappedRow.id_jugadora).trim() : undefined,
        id_temporada: context.temporadaActiva?.id_temporada,
        nombreJugadora: 'Jugadora no registrada',
        fecha: mappedRow.fecha ? String(mappedRow.fecha) : '',
        calidad_sueno: null,
        fatiga: null,
        dolor_muscular: null,
        estres: null,
        estado_animo: null,
        dolor_especifico: mappedRow.dolor_especifico ? String(mappedRow.dolor_especifico) : null,
        mensaje: val.errorMsg || 'Error de validación',
        rowOriginal: rawRow
      })
      return
    }

    const normRow = val.normalRow!
    const fileKey = `${normRow.id_jugadora}_${normRow.fecha}`

    if (fileKeys.has(fileKey)) {
      result.errores++
      result.rows.push({
        filaOriginal,
        estado: 'ERROR',
        id_jugadora: normRow.id_jugadora,
        alias_origen: normRow.alias_origen,
        id_temporada: normRow.id_temporada,
        nombreJugadora: (context.jugadorasMap && context.jugadorasMap[normRow.id_jugadora]) || jugadorasMap[normRow.id_jugadora] || '',
        fecha: normRow.fecha,
        calidad_sueno: normRow.calidad_sueno,
        fatiga: normRow.fatiga,
        dolor_muscular: normRow.dolor_muscular,
        estres: normRow.estres,
        estado_animo: normRow.estado_animo,
        dolor_especifico: normRow.dolor_especifico,
        mensaje: 'Duplicado dentro del archivo (misma fecha y jugadora)',
        rowOriginal: rawRow,
        normalRow: normRow
      })
      return
    }

    fileKeys.add(fileKey)

    const clasificacion = clasificarFilaImportacion(normRow, existingWellness)
    if (clasificacion === 'NUEVO') result.nuevos++
    else if (clasificacion === 'ACTUALIZACION_POSIBLE') result.actualizaciones++
    else if (clasificacion === 'DUPLICADO_IDENTICO') result.duplicados++

    result.rows.push({
      filaOriginal,
      estado: clasificacion,
      id_jugadora: normRow.id_jugadora,
      alias_origen: normRow.alias_origen,
      id_temporada: normRow.id_temporada,
      nombreJugadora: (context.jugadorasMap && context.jugadorasMap[normRow.id_jugadora]) || jugadorasMap[normRow.id_jugadora] || '',
      fecha: normRow.fecha,
      calidad_sueno: normRow.calidad_sueno,
      fatiga: normRow.fatiga,
      dolor_muscular: normRow.dolor_muscular,
      estres: normRow.estres,
      estado_animo: normRow.estado_animo,
      dolor_especifico: normRow.dolor_especifico,
      mensaje: clasificacion === 'NUEVO' ? 'Registro nuevo listo para importar' :
               clasificacion === 'ACTUALIZACION_POSIBLE' ? 'Conflicto: ya existe un registro con datos diferentes' :
               'Duplicado idéntico (se omitirá automáticamente)',
      rowOriginal: rawRow,
      normalRow: normRow
    })
  })

  return result
}

/**
 * Generates verification report CSV.
 */
export function crearInformeValidacion(rows: PreviewRow[]): string {
  const headers = ['Fila Original', 'ID Jugadora', 'Nombre Jugadora', 'Fecha', 'Estado', 'Mensaje de Validacion']
  const csvLines = [headers.join(',')]

  rows.forEach(r => {
    const line = [
      r.filaOriginal,
      `"${r.id_jugadora}"`,
      `"${r.nombreJugadora}"`,
      `"${r.fecha}"`,
      `"${r.estado}"`,
      `"${r.mensaje}"`
    ]
    csvLines.push(line.join(','))
  })

  return csvLines.join('\n')
}

/**
 * Applies the import into IndexedDB in a strict atomic transaction.
 * Includes db.wellness, db.historial_importaciones, db.jugadoras, db.temporadas, db.alias_jugadora.
 */
export async function aplicarImportacionWellness(
  rows: PreviewRow[],
  strategy: ImportStrategy,
  filename: string,
  sheetName: string,
  mappingName: string,
  backupName: string,
  config?: FiltrosCarga,
  dbInstance: FutsalDB = db
): Promise<ImportOutcome> {
  if (!backupName || backupName.trim() === '') {
    throw new Error('No se puede aplicar la importación sin una copia de seguridad previa de seguridad registrada.')
  }

  if (rows.some(r => r.estado === 'ERROR')) {
    throw new Error('No se puede aplicar la importación porque existen filas con errores no omitidas.')
  }

  if (strategy === 'cancel' && rows.some(r => r.estado === 'ACTUALIZACION_POSIBLE')) {
    return {
      success: false,
      inserted: 0,
      updated: 0,
      skipped: rows.length,
      errors: 0,
      recalculoExitoso: false
    }
  }

  let inserted = 0
  let updated = 0
  let skipped = 0
  let errors = 0
  let idImportacion: number | undefined

  try {
    // Executing transaction on all affected tables for complete atomicity
    await dbInstance.transaction('rw', [
      dbInstance.wellness,
      dbInstance.historial_importaciones,
      dbInstance.jugadoras,
      dbInstance.temporadas,
      dbInstance.alias_jugadora,
      dbInstance.sesion_rpe,
      dbInstance.readiness,
      dbInstance.sesiones,
      dbInstance.partidos,
      dbInstance.rpe_partido,
      dbInstance.resumen_semanal
    ], async () => {
      // Re-query active season inside transaction
      const temporadaActiva = await obtenerTemporadaActiva(dbInstance)

      // 1. Identify selected rows for writing
      const selectedRows = rows.filter(r => (
        r.estado === 'NUEVO' ||
        (r.estado === 'ACTUALIZACION_POSIBLE' && strategy === 'update')
      ))

      // Re-validate date range and active alias inside transaction for each selected row
      for (const row of selectedRows) {
        const norm = row.normalRow!
        if (temporadaActiva && (norm.fecha < temporadaActiva.fecha_inicio || norm.fecha > temporadaActiva.fecha_fin)) {
          throw new Error(`Fecha '${norm.fecha}' fuera del rango de la temporada activa (${temporadaActiva.fecha_inicio} a ${temporadaActiva.fecha_fin})`)
        }

        if (norm.alias_origen && dbInstance.alias_jugadora && typeof dbInstance.alias_jugadora.where === 'function') {
          const todosAlias = await dbInstance.alias_jugadora.where('origen').equals('google_forms').toArray()
          const candidatos = todosAlias.filter((a: AliasJugadora) => a.valor.trim() === norm.alias_origen!.trim())
          const aliasActivo = candidatos.find((a: AliasJugadora) => a.activo === true)
          if (!aliasActivo) {
            throw new Error(`El alias '${norm.alias_origen}' ya no está activo o no existe`)
          }
          if (aliasActivo.id_jugadora !== norm.id_jugadora) {
            throw new Error(`Inconsistencia: El alias '${norm.alias_origen}' pertenece a '${aliasActivo.id_jugadora}', no a '${norm.id_jugadora}'`)
          }
        }
      }

      // 2. Extract unique jugadora IDs from selected rows and revalidate
      const uniqueJugadoras = Array.from(new Set(selectedRows.map(r => r.normalRow!.id_jugadora)))
      for (const jugId of uniqueJugadoras) {
        const jugadora = await dbInstance.jugadoras.get(jugId as any)
        if (!jugadora) {
          throw new Error(`La jugadora '${jugId}' ya no existe en la base de datos`)
        }
      }

      // 3. Build deduplicated maps for readiness (by player & date) and weekly summary (by player & week)
      const paresReadiness = new Map<string, { idJugadora: string; fecha: string }>()
      const paresResumen = new Map<string, { idJugadora: string; semana: string }>()

      for (const row of selectedRows) {
        const idJugadora = row.normalRow!.id_jugadora
        const fechaOrigen = row.normalRow!.fecha
        const fechasPropagadas = calcularVentanaPropagacion([fechaOrigen])

        for (const fPropagada of fechasPropagadas) {
          const keyR = `${idJugadora}|${fPropagada}`
          if (!paresReadiness.has(keyR)) {
            paresReadiness.set(keyR, { idJugadora, fecha: fPropagada })
          }

          const semana = getWeekId(fPropagada)
          const keyS = `${idJugadora}|${semana}`
          if (!paresResumen.has(keyS)) {
            paresResumen.set(keyS, { idJugadora, semana })
          }
        }
      }

      // 4. Persist selected rows
      for (const row of rows) {
        if (row.estado === 'ERROR') {
          errors++
          continue
        }
        if (row.estado === 'OMITIDA') {
          skipped++
          continue
        }
        if (row.estado === 'DUPLICADO_IDENTICO') {
          skipped++
          continue
        }

        if (row.estado === 'NUEVO') {
          const norm = row.normalRow!
          const score = calcularScoreWellness(norm)
          await dbInstance.wellness.put({
            id_jugadora: norm.id_jugadora,
            fecha: norm.fecha,
            calidad_sueno: norm.calidad_sueno as number,
            fatiga: norm.fatiga as number,
            dolor_muscular: norm.dolor_muscular as number,
            estres: norm.estres as number,
            estado_animo: norm.estado_animo as number,
            dolor_especifico: norm.dolor_especifico || '',
            score_wellness: score,
            id_temporada: temporadaActiva?.id_temporada,
            origen_alias: 'google_forms',
            alias_origen: norm.alias_origen
          })
          inserted++
        } else if (row.estado === 'ACTUALIZACION_POSIBLE') {
          if (strategy === 'omit') {
            skipped++
          } else if (strategy === 'update') {
            const norm = row.normalRow!
            const score = calcularScoreWellness(norm)
            const existing = await dbInstance.wellness.where({ id_jugadora: norm.id_jugadora, fecha: norm.fecha }).first()
            if (existing) {
              await dbInstance.wellness.put({
                id: existing.id,
                id_jugadora: norm.id_jugadora,
                fecha: norm.fecha,
                calidad_sueno: norm.calidad_sueno as number,
                fatiga: norm.fatiga as number,
                dolor_muscular: norm.dolor_muscular as number,
                estres: norm.estres as number,
                estado_animo: norm.estado_animo as number,
                dolor_especifico: norm.dolor_especifico || '',
                score_wellness: score,
                id_temporada: temporadaActiva?.id_temporada,
                origen_alias: 'google_forms',
                alias_origen: norm.alias_origen
              })
              updated++
            } else {
              // fallback put if missing
              await dbInstance.wellness.put({
                id_jugadora: norm.id_jugadora,
                fecha: norm.fecha,
                calidad_sueno: norm.calidad_sueno as number,
                fatiga: norm.fatiga as number,
                dolor_muscular: norm.dolor_muscular as number,
                estres: norm.estres as number,
                estado_animo: norm.estado_animo as number,
                dolor_especifico: norm.dolor_especifico || '',
                score_wellness: score,
                id_temporada: temporadaActiva?.id_temporada,
                origen_alias: 'google_forms',
                alias_origen: norm.alias_origen
              })
              inserted++
            }
          }
        }
      }

      // 5. Execute readiness recalculations
      for (const { idJugadora, fecha } of paresReadiness.values()) {
        await readinessService.recalcularReadinessJugadora(idJugadora, fecha, dbInstance)
      }

      // 6. Execute weekly summary recalculations
      for (const { idJugadora, semana } of paresResumen.values()) {
        await resumenSemanalService.recalcularResumenSemanal(idJugadora, semana, config, dbInstance)
      }

      // 7. Persist success history entry
      const totalFilas = rows.length
      const estadoImport: ImportacionEstado = errors > 0 ? 'parcial' : 'completada'
      const detailErrors = rows.filter(r => r.estado === 'ERROR').map(r => `Fila ${r.filaOriginal}: ${r.mensaje}`)

      const histEntry: Omit<HistorialImportacion, 'id'> = {
        fechaHora: new Date().toISOString(),
        nombreArchivo: filename,
        tipoImportacion: 'wellness',
        hojaSeleccionada: sheetName || undefined,
        plantillaMapeo: mappingName || undefined,
        totalFilas,
        registrosNuevos: inserted,
        registrosActualizados: updated,
        registrosOmitidos: skipped,
        registrosErroneos: errors,
        detalleErrores: detailErrors,
        estrategiaDuplicadosElegida: strategy,
        nombreBackupPrevio: backupName,
        versionEsquema: 11,
        estado: estadoImport,
        derivadosPendientes: false
      }

      idImportacion = await dbInstance.historial_importaciones.put(histEntry as any)
    })
  } catch (transError: any) {
    try {
      const errorEntry: Omit<HistorialImportacion, 'id'> = {
        fechaHora: new Date().toISOString(),
        nombreArchivo: filename,
        tipoImportacion: 'wellness',
        hojaSeleccionada: sheetName || undefined,
        plantillaMapeo: mappingName || undefined,
        totalFilas: rows.length,
        registrosNuevos: 0,
        registrosActualizados: 0,
        registrosOmitidos: rows.length,
        registrosErroneos: rows.length,
        detalleErrores: [`Fallo crítico: ${transError.message || 'Error de base de datos'}`],
        estrategiaDuplicadosElegida: strategy,
        nombreBackupPrevio: backupName,
        versionEsquema: 11,
        estado: 'error',
        derivadosPendientes: false
      }
      await dbInstance.historial_importaciones.put(errorEntry as any)
    } catch {
      // Ignore secondary error logging failure
    }
    return {
      success: false,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: rows.length,
      idImportacion: undefined,
      recalculoExitoso: false
    }
  }

  return {
    success: true,
    inserted,
    updated,
    skipped,
    errors,
    idImportacion,
    recalculoExitoso: true
  }
}

export interface ConfirmImportParams {
  downloadedBackupName: string | null
  userConfirmedBackup: boolean
  previewData: PreviewRow[]
  strategy: ImportStrategy
  filename: string
  sheetName: string
  mappingName: string
  onStart: () => void
  onSuccess: (outcome: ImportOutcome) => void
  onFailure: (errorMsg: string) => void
  onRecalculateTrigger: (idImportacion: number) => Promise<void>
}

export async function confirmarYEjecutarImportacion(params: ConfirmImportParams): Promise<void> {
  if (!params.downloadedBackupName || params.downloadedBackupName.trim() === '') {
    params.onFailure('Debes descargar el backup de seguridad previo obligatoriamente.')
    return
  }
  if (!params.userConfirmedBackup) {
    params.onFailure('Debes confirmar haber guardado la copia de seguridad.')
    return
  }

  params.onStart()

  try {
    const outcome = await aplicarImportacionWellness(
      params.previewData,
      params.strategy,
      params.filename,
      params.sheetName,
      params.mappingName,
      params.downloadedBackupName
    )

    if (!outcome.success) {
      params.onFailure('Importación cancelada por detección de conflictos o fallo en la transacción.')
      return
    }

    params.onSuccess(outcome)

    if (outcome.idImportacion) {
      await params.onRecalculateTrigger(outcome.idImportacion)
    }
  } catch (err: any) {
    params.onFailure('Fallo en la importación: ' + err.message)
  }
}

export interface DiagnosticoEscalaWellness {
  totalRegistrosEvaluados: number
  totalIncompatibles: number
  incompatibles: Array<{
    id?: number
    id_jugadora: string
    fecha: string
    score_wellness: number
  }>
}

/**
 * Función de diagnóstico de solo lectura que detecta registros de wellness con score_wellness > 10
 * sin modificar la base de datos Dexie.
 */
export async function diagnosticarRegistrosWellnessFueraDeEscala(dbInstance: FutsalDB = db): Promise<DiagnosticoEscalaWellness> {
  const todos = await dbInstance.wellness.toArray()
  const incompatibles = todos.filter(w => typeof w.score_wellness === 'number' && w.score_wellness > 10)
  return {
    totalRegistrosEvaluados: todos.length,
    totalIncompatibles: incompatibles.length,
    incompatibles: incompatibles.map(w => ({
      id: w.id,
      id_jugadora: w.id_jugadora,
      fecha: w.fecha,
      score_wellness: w.score_wellness
    }))
  }
}
