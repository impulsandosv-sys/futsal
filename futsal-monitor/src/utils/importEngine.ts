import { db } from '@/db/database'
import type { FutsalDB } from '@/db/database'
import { calcularScoreWellness } from '@/utils/calculations'
import { agregarAliasJugadora } from '@/domain/alias/aliasJugadora'
import type {
  RawCellValue,
  RawImportRow,
  ColumnMapping,
  MappedWellnessRow,
  PreviewRow, TipoIncidenciaImportacion,
  ImportStrategy,
  ImportOutcome,
  HistorialImportacion,
  ImportacionEstado,
  Wellness,
  WellnessSemanalImportado,
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
  tipoCuestionario?: 'DIARIO' | 'SEMANAL'
  existingSemanal?: WellnessSemanalImportado[]
}

export interface ValidationResult {
  isValid: boolean
  errorMsg?: string
  normalRow?: MappedWellnessRow
  tipoIncidencia?: TipoIncidenciaImportacion
}

export type TipoCuestionarioWellness = 'DIARIO' | 'SEMANAL'

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
  if (!header) return ''
  return header
    .replace(/^\uFEFF/, '') // Eliminar BOM UTF-8
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[.,/#!$%^&*;:{}=`~()?¿¡]/g, "") // Remove punctuation except - and _
    .replace(/[-_\s]+/g, " ") // Normalize spaces, hyphens and underscores
    .trim();
}

/**
 * Automaps column headers to internal fields.
 */
export function detectarMapeoWellness(headers: string[]): ColumnMapping[] {
  const ALIASES: Record<string, string[]> = {
    id_jugadora: ['id jugadora', 'id', 'codigo jugadora', 'codigo'],
    fecha: ['fecha del entreno', 'fecha de entreno', 'fecha de la sesion', 'fecha', 'dia', 'fecha de registro', 'fecha respuesta', 'marca temporal', 'timestamp'],
    calidad_sueno: ['calidad de sueno', 'calidad sueño', 'sueno', 'sueño', 'calidad_sueño', 'sueño (1-10)', 'sueno (1-10)'],
    fatiga: ['fatiga', 'nivel de fatiga', 'cansancio'],
    dolor_muscular: ['dolor muscular', 'dolor_muscular', 'doms', 'molestias musculares'],
    estres: ['estres', 'estrés', 'nivel de estres', 'nivel de estrés'],
    estado_animo: ['estado de animo', 'estado de ánimo', 'animo', 'ánimo', 'mood'],
    dolor_especifico: ['dolor especifico o nota importante (opcional)', 'dolor especifico', 'dolor específico', '¿tienes dolor?', 'tienes dolor', 'molestia'],
    comentario_sesion: ['comentario sobre la sesion (opcional)', 'comentario sobre la sesión (opcional)', 'comentarios', 'observaciones']
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
    { internalField: 'comentario_sesion', excelHeader: null, required: false, label: 'Comentario' },
    { internalField: 'marca_temporal', excelHeader: null, required: false, label: 'Marca temporal' }
  ]

  const normalizedHeaders = headers.map(h => ({ original: h, normalized: normalizarEncabezado(h) }))

  mapped.forEach(m => {
    // 1. Check exact match
    let match = normalizedHeaders.find(h => h.normalized === normalizarEncabezado(m.internalField))
    if (!match && ALIASES[m.internalField]) {
      // 2. Check aliases in order of priority
      const allowedAliases = ALIASES[m.internalField].map(a => normalizarEncabezado(a))
      for (const alias of allowedAliases) {
        match = normalizedHeaders.find(h => h.normalized === alias)
        if (match) break
      }
    }
    if (match) {
      m.excelHeader = match.original
    }
  })

  return mapped
}

export function detectarMapeoWellnessSemanal(headers: string[]): ColumnMapping[] {
  const ALIASES: Record<string, string[]> = {
    id_jugadora: ['id jugadora', 'id', 'codigo jugadora', 'codigo', 'jugadora', 'nombre'],
    fecha: ['fecha del entreno', 'fecha de entreno', 'fecha', 'dia', 'marca temporal', 'timestamp'],
    recuperacion_semana: ['recuperacion general', 'recuperacion', 'valorarias tu recuperacion general esta semana', 'recuperacion general esta semana'],
    sueno_semana: ['calidad de tu sueno esta semana', 'sueno semana', 'sueno', 'calidad de tu sueño'],
    estres_fuera: ['estres fuera', 'nivel de estres fuera', 'estres', 'nivel de estres'],
    energia_semana: ['energia durante los entrenamientos', 'energia', 'energia esta semana'],
    animo_semana: ['estado de animo esta semana', 'estado de animo', 'animo'],
    dolor_sn: ['has tenido dolor molestia o rigidez', 'has tenido dolor', 'dolor molestia', 'limitacion'],
    dolor_texto_semana: ['indica que dolor', 'que dolor o molestia', 'indica que dolor o molestia has tenido'],
    actividad_sn: ['actividad fisica adicional', 'actividad fisica', 'actividad adicional'],
    actividad_texto_semana: ['tipo de actividad e intensidad', 'indica que tipo de actividad'],
    preparada_semana: ['preparada', 'como de preparada te sientes', 'preparada para la proxima semana'],
    sintomas_menstruales: ['sintomas menstruales', 'sintomas menstruales han afectado']
  }

  const mapped: ColumnMapping[] = [
    { internalField: 'id_jugadora', excelHeader: null, required: true, label: 'ID Jugadora' },
    { internalField: 'fecha', excelHeader: null, required: true, label: 'Fecha' },
    { internalField: 'recuperacion_semana', excelHeader: null, required: false, label: 'Recuperación General (1-10)' },
    { internalField: 'sueno_semana', excelHeader: null, required: false, label: 'Sueño Semana (1-10)' },
    { internalField: 'estres_fuera', excelHeader: null, required: false, label: 'Estrés Fuera (1-10)' },
    { internalField: 'energia_semana', excelHeader: null, required: false, label: 'Energía (1-10)' },
    { internalField: 'animo_semana', excelHeader: null, required: false, label: 'Ánimo (1-10)' },
    { internalField: 'preparada_semana', excelHeader: null, required: false, label: 'Preparada próxima semana (1-10)' },
    { internalField: 'dolor_sn', excelHeader: null, required: false, label: '¿Dolor/Molestia? (Sí/No)' },
    { internalField: 'dolor_texto_semana', excelHeader: null, required: false, label: 'Detalle de Dolor' },
    { internalField: 'actividad_sn', excelHeader: null, required: false, label: '¿Actividad adicional? (Sí/No)' },
    { internalField: 'actividad_texto_semana', excelHeader: null, required: false, label: 'Detalle actividad adicional' },
    { internalField: 'sintomas_menstruales', excelHeader: null, required: false, label: 'Síntomas Menstruales (1-10)' },
    { internalField: 'marca_temporal', excelHeader: null, required: false, label: 'Marca temporal' }
  ]

  const normalizedHeaders = headers.map(h => ({ original: h, normalized: normalizarEncabezado(h) }))

  mapped.forEach(m => {
    let match = normalizedHeaders.find(h => h.normalized === normalizarEncabezado(m.internalField))
    if (!match && ALIASES[m.internalField]) {
      const allowedAliases = ALIASES[m.internalField].map(a => normalizarEncabezado(a))
      for (const alias of allowedAliases) {
        match = normalizedHeaders.find(h => h.normalized.includes(alias))
        if (match) break
      }
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
 * Fetches existing jugadoras, active season, and google_forms aliases directly from Dexie for validation context.
 */
export async function obtenerContextoValidacionWellness(
  dbInstance: FutsalDB = db,
  tipoCuestionario?: 'DIARIO' | 'SEMANAL'
): Promise<ValidationContext> {
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

  let existingSemanal: WellnessSemanalImportado[] | undefined = undefined
  if (tipoCuestionario === 'SEMANAL') {
    existingSemanal = await dbInstance.wellness_semanal_importado.toArray()
  }

  return {
    jugadorasIds,
    jugadorasMap,
    temporadaActiva,
    aliasesGoogleForms,
    tipoCuestionario,
    existingSemanal
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
    return { isValid: false, errorMsg: 'ID_Jugadora ausente', tipoIncidencia: 'formato_invalido' }
  }
  const rawAliasValue = String(idRaw).trim()
  if (!rawAliasValue) {
    return { isValid: false, errorMsg: 'ID_Jugadora vacío', tipoIncidencia: 'formato_invalido' }
  }

  let resolvedIdJugadora: string
    let metodoResolucion: string = ''

  // Priority 1: Exact internal ID (active)
  if (context.jugadorasIds.includes(rawAliasValue)) {
    resolvedIdJugadora = rawAliasValue
    metodoResolucion = 'ID exacto'
  }
  // Priority 2: Active Alias
  else if (context.aliasesGoogleForms && context.aliasesGoogleForms.has(rawAliasValue)) {
    const aliasInfo = context.aliasesGoogleForms.get(rawAliasValue)!
    if (!aliasInfo.activo) {
      return { isValid: false, errorMsg: `Alias '${rawAliasValue}' inactivo para el origen 'google_forms'`, tipoIncidencia: 'jugadora_no_resuelta' }
    }
    resolvedIdJugadora = aliasInfo.id_jugadora
    metodoResolucion = 'Alias activo'
  }
  // Priority 3: Exact Normalized Name Match
  else {
    const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim()
    const aliasNormalizado = normalizar(rawAliasValue)

    const matches: string[] = []
    if (context.jugadorasMap) {
      for (const [id, nombre] of Object.entries(context.jugadorasMap)) {
        if (normalizar(nombre) === aliasNormalizado) {
          matches.push(id)
        }
      }
    }

    if (matches.length === 1) {
      resolvedIdJugadora = matches[0]
      metodoResolucion = 'Nombre normalizado'
    } else if (matches.length > 1) {
      return { isValid: false, errorMsg: `Ambigüedad: Múltiples jugadoras coinciden exactamente con el nombre '${rawAliasValue}'. Corrige el nombre o usa un alias.`, tipoIncidencia: 'alias_ambiguo' }
    } else {
      return { isValid: false, errorMsg: `Jugadora no registrada. Añádela a la plantilla o configura un alias para '${rawAliasValue}'`, tipoIncidencia: 'jugadora_no_resuelta' }
    }
  }

  if (!context.jugadorasIds.includes(resolvedIdJugadora)) {
    return { isValid: false, errorMsg: `La jugadora '${resolvedIdJugadora}' no existe en la base de datos`, tipoIncidencia: 'jugadora_no_resuelta' }
  }

  const fechaNorm = normalizarFecha(row.fecha)
  if (!fechaNorm) {
    return { isValid: false, errorMsg: `Fecha '${row.fecha || ''}' inválida o vacía`, tipoIncidencia: 'fecha_invalida' }
  }

  const errFechaISO = validateFechaLocalISO(fechaNorm, 'fecha')
  if (errFechaISO) {
    return { isValid: false, errorMsg: errFechaISO, tipoIncidencia: 'fecha_invalida' }
  }

  // Prevent future dates
  const todayStr = getTodayLocalISO()
  if (fechaNorm > todayStr) {
    return { isValid: false, errorMsg: `Fecha futura detectada: ${fechaNorm}`, tipoIncidencia: 'fecha_invalida' }
  }

  // Validar Temporada Activa
  if (context.temporadaActiva === null) {
    return { isValid: false, errorMsg: 'No existe una temporada activa. Crea o activa una temporada antes de importar wellness.', tipoIncidencia: 'temporada_no_activa' }
  } else if (context.temporadaActiva) {
    const { fecha_inicio, fecha_fin } = context.temporadaActiva
    if (fechaNorm < fecha_inicio || fechaNorm > fecha_fin) {
      return { isValid: false, errorMsg: `Fecha '${fechaNorm}' fuera del rango de la temporada activa (${fecha_inicio} a ${fecha_fin})`, tipoIncidencia: 'fecha_invalida' }
    }
  }

  const isDiario = context.tipoCuestionario !== 'SEMANAL'
  const fieldsDiario = ['calidad_sueno', 'fatiga', 'dolor_muscular', 'estres', 'estado_animo']
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
    comentario_sesion: row.comentario_sesion ? String(row.comentario_sesion).trim() : null,
    marca_temporal: row.marca_temporal ? String(row.marca_temporal).trim() : null,
    metodo_resolucion_identidad: metodoResolucion
  }

  let hasAnyWellness = false

  if (isDiario) {
    for (const f of fieldsDiario) {
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
      return { isValid: false, errorMsg: 'Fila sin ningún dato de wellness diario' }
    }
  } else {
    // SEMANAL
    const fieldsSemanalScale = [
      'recuperacion_semana', 'sueno_semana', 'estres_fuera', 'energia_semana', 'animo_semana', 'preparada_semana', 'sintomas_menstruales'
    ]
    for (const f of fieldsSemanalScale) {
      const val = row[f]
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        const score = extraerEscala(val)
        if (score === null || score < 1 || score > 10) {
          return { isValid: false, errorMsg: `Valor '${val}' fuera de rango 1-10 o no válido en ${f}` }
        }
        ;(normalRow as any)[f] = score
        hasAnyWellness = true
      }
    }

    const parseBooleanStrict = (v: unknown, fieldName: string) => {
      const valStr = String(v ?? '').trim()
      if (!valStr) return null
      const s = valStr.toLowerCase()
      if (s === 'si' || s === 'sí' || s === 'true') return true
      if (s === 'no' || s === 'false') return false
      return { error: `Valor '${valStr}' no reconocido como Sí/No en ${fieldName}` }
    }

    const dolorParsed = parseBooleanStrict(row.dolor_sn, 'dolor_sn')
    if (dolorParsed && typeof dolorParsed === 'object' && 'error' in dolorParsed) {
      return { isValid: false, errorMsg: dolorParsed.error }
    }
    normalRow.dolor_sn = dolorParsed as boolean | null
    if (normalRow.dolor_sn !== null) hasAnyWellness = true

    normalRow.dolor_texto_semana = row.dolor_texto_semana ? String(row.dolor_texto_semana).trim() : null

    const actividadParsed = parseBooleanStrict(row.actividad_sn, 'actividad_sn')
    if (actividadParsed && typeof actividadParsed === 'object' && 'error' in actividadParsed) {
      return { isValid: false, errorMsg: actividadParsed.error }
    }
    normalRow.actividad_sn = actividadParsed as boolean | null
    if (normalRow.actividad_sn !== null) hasAnyWellness = true

    normalRow.actividad_texto_semana = row.actividad_texto_semana ? String(row.actividad_texto_semana).trim() : null

    if (!hasAnyWellness) {
      return { isValid: false, errorMsg: 'Fila sin ningún dato de wellness semanal válido' }
    }
  }

  return { isValid: true, normalRow }
}

/**
 * Extrae los valores parseados desde el modelo de persistencia semanal.
 */
export function extraerValoresSemanalPersistidos(registro: import('@/types').WellnessSemanalImportado): Pick<MappedWellnessRow, 'recuperacion_semana' | 'sueno_semana' | 'estres_fuera' | 'energia_semana' | 'animo_semana' | 'preparada_semana' | 'sintomas_menstruales' | 'dolor_sn' | 'dolor_texto_semana' | 'actividad_sn' | 'actividad_texto_semana'> {
  const metricas = registro.metricas || {}
  const textos = registro.textos || {}

  const getValue = (key: string) => metricas[key]?.normalizado ?? null

  const dolorSnRaw = getValue('¿Has tenido dolor, molestia o rigidez que haya limitado algo esta semana?') as unknown as boolean | null
  const actividadSnRaw = getValue('¿Has realizado actividad física importante adicional al trabajo con el equipo?') as unknown as boolean | null

  return {
    recuperacion_semana: getValue('¿Cómo valorarías tu recuperación general esta semana?'),
    sueno_semana: getValue('¿Cómo ha sido la calidad de tu sueño esta semana?'),
    estres_fuera: getValue('¿Cómo ha sido tu nivel de estrés fuera del fútbol sala?'),
    energia_semana: getValue('¿Cómo ha sido tu energía durante los entrenamientos y el partido?'),
    animo_semana: getValue('¿Cómo valorarías tu estado de ánimo esta semana?'),
    preparada_semana: getValue('¿Cómo de preparada te sientes para competir la próxima semana?'),
    sintomas_menstruales: getValue('Si eres mujer, ¿los síntomas menstruales han afectado tu rendimiento o bienestar esta semana?'),

    dolor_sn: dolorSnRaw === true ? true : dolorSnRaw === false ? false : null,
    actividad_sn: actividadSnRaw === true ? true : actividadSnRaw === false ? false : null,

    dolor_texto_semana: textos['¿Has tenido dolor, molestia o rigidez que haya limitado algo esta semana?'] || null,
    actividad_texto_semana: textos['Indica qué tipo de actividad e intensidad (si has respondido Sí a la anterior)'] || null,
  }
}

/**
 * Classifies a valid row against the existing Dexie records.
 */
export function clasificarFilaImportacion(
  row: MappedWellnessRow,
  existingWellness: Wellness[],
  context?: ValidationContext
): 'NUEVO' | 'ACTUALIZACION_POSIBLE' | 'DUPLICADO_IDENTICO' {

  if (context?.tipoCuestionario === 'SEMANAL') {
    const semana = getWeekId(row.fecha)
    const match = context.existingSemanal?.find(w => w.id_jugadora === row.id_jugadora && getWeekId(w.fecha) === semana)
    if (!match) return 'NUEVO'

    const fieldsSemanal: (keyof MappedWellnessRow)[] = [
      'recuperacion_semana', 'sueno_semana', 'estres_fuera', 'energia_semana',
      'animo_semana', 'preparada_semana', 'sintomas_menstruales',
      'dolor_sn', 'dolor_texto_semana', 'actividad_sn', 'actividad_texto_semana'
    ]
    const persistedVals = extraerValoresSemanalPersistidos(match)

    const isIdentical = fieldsSemanal.every(f => {
      let incomingVal = row[f]
      let localVal = persistedVals[f as keyof typeof persistedVals]

      const isTexto = f === 'dolor_texto_semana' || f === 'actividad_texto_semana'
      if (isTexto) {
        const incText = incomingVal ? String(incomingVal).trim() : ''
        const locText = localVal ? String(localVal).trim() : ''
        return incText === locText
      }

      if (incomingVal === undefined || incomingVal === '') incomingVal = null
      if (localVal === undefined || localVal === '') localVal = null

      return incomingVal === localVal
    })

    return isIdentical ? 'DUPLICADO_IDENTICO' : 'ACTUALIZACION_POSIBLE'
  }

  const match = existingWellness.find(w => w.id_jugadora === row.id_jugadora && w.fecha === row.fecha)
  if (!match) return 'NUEVO'

  const fields: (keyof MappedWellnessRow)[] = ['calidad_sueno', 'fatiga', 'dolor_muscular', 'estres', 'estado_animo', 'dolor_especifico', 'comentario_sesion']
  const isIdentical = fields.every(f => {
    let incomingVal = row[f]
    let localVal = (match as any)[f]

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

function sonFilasIdenticas(a: MappedWellnessRow, b: MappedWellnessRow, tipoCuestionario?: 'DIARIO' | 'SEMANAL'): boolean {
  const fieldsSemanal: (keyof MappedWellnessRow)[] = [
    'recuperacion_semana', 'sueno_semana', 'estres_fuera', 'energia_semana',
    'animo_semana', 'preparada_semana', 'sintomas_menstruales',
    'dolor_sn', 'dolor_texto_semana', 'actividad_sn', 'actividad_texto_semana'
  ]
  const fieldsDiario: (keyof MappedWellnessRow)[] = [
    'calidad_sueno', 'fatiga', 'dolor_muscular', 'estres', 'estado_animo',
    'dolor_especifico', 'comentario_sesion'
  ]
  const fields = tipoCuestionario === 'SEMANAL' ? fieldsSemanal : fieldsDiario

  return fields.every(f => {
    let valA = a[f]
    let valB = b[f]
    if (valA === undefined || valA === '') valA = null
    if (valB === undefined || valB === '') valB = null
    const isTexto = f === 'dolor_texto_semana' || f === 'actividad_texto_semana' || f === 'dolor_especifico' || f === 'comentario_sesion'
    if (isTexto) {
      return (valA ? String(valA).trim() : '') === (valB ? String(valB).trim() : '')
    }
    return valA === valB
  })
}

export function construirVistaPrevia(
  rawRows: RawImportRow[],
  mapping: ColumnMapping[],
  existingWellness: Wellness[],
  jugadorasMap: Record<string, string>, // id_jugadora -> nombre
  contextOverrides?: ValidationContext,
  omittedRowIndices?: Set<number>
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
  const fileRows = new Map<string, MappedWellnessRow>()

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
      let tipoInc = val.tipoIncidencia || 'formato_invalido'
      const baseEstado = 'ERROR'
      const finalEstado = omittedRowIndices?.has(filaOriginal) ? 'OMITIDA' : baseEstado
      if (finalEstado === 'OMITIDA') { result.omitidos++; tipoInc = 'omitida_manual' }
      else result.errores++
      result.rows.push({
        filaOriginal,
        estado: finalEstado,
        prevEstado: baseEstado,
        id_jugadora: mappedRow.id_jugadora ? String(mappedRow.id_jugadora).trim().toUpperCase() : '',
        alias_origen: mappedRow.id_jugadora ? String(mappedRow.id_jugadora).trim() : undefined,
        id_temporada: context.temporadaActiva?.id_temporada,
        nombreJugadora: 'Jugadora no registrada',
        fecha: normalizarFecha(mappedRow.fecha) || (mappedRow.fecha ? String(mappedRow.fecha) : ''),
        calidad_sueno: extraerEscala(mappedRow.calidad_sueno),
        fatiga: extraerEscala(mappedRow.fatiga),
        dolor_muscular: extraerEscala(mappedRow.dolor_muscular),
        estres: extraerEscala(mappedRow.estres),
        estado_animo: extraerEscala(mappedRow.estado_animo),
        dolor_especifico: mappedRow.dolor_especifico ? String(mappedRow.dolor_especifico) : null,
        comentario_sesion: mappedRow.comentario_sesion ? String(mappedRow.comentario_sesion) : null,
        mensaje: finalEstado === 'OMITIDA' ? 'Excluido manualmente por el usuario' : (val.errorMsg || 'Error de validación'),
        rowOriginal: rawRow
      ,
        tipo_incidencia: tipoInc as TipoIncidenciaImportacion
      })
      return
    }

    const normRow = val.normalRow!
    const fileKey = context.tipoCuestionario === 'SEMANAL'
      ? `${normRow.id_jugadora}::${getWeekId(normRow.fecha)}`
      : `${normRow.id_jugadora}::${normRow.fecha}`

    if (fileRows.has(fileKey)) {
      const existingRow = fileRows.get(fileKey)!
      const sonIdenticas = sonFilasIdenticas(normRow, existingRow, context.tipoCuestionario)

      let tipoInc = sonIdenticas ? 'duplicado_interno_identico' : 'conflicto_interno'
      const baseEstado: 'DUPLICADO_IDENTICO' | 'ERROR' = sonIdenticas ? 'DUPLICADO_IDENTICO' : 'ERROR'
      const finalEstado: PreviewRow['estado'] = omittedRowIndices?.has(filaOriginal) ? 'OMITIDA' : baseEstado

      if (finalEstado === 'OMITIDA') result.omitidos++
      else if (baseEstado === 'ERROR') result.errores++
      else if (baseEstado === 'DUPLICADO_IDENTICO') result.duplicados++

      let mensajeStr = finalEstado === 'OMITIDA' ? 'Excluido manualmente por el usuario' :
                       (sonIdenticas ? 'Duplicado idéntico dentro del archivo' : 'Conflicto interno: Diferentes datos para misma jugadora y fecha')

      result.rows.push({
        filaOriginal,
        estado: finalEstado as 'ERROR' | 'OMITIDA' | 'DUPLICADO_IDENTICO',
        tipo_incidencia: (finalEstado === 'OMITIDA' ? 'omitida_manual' : tipoInc) as TipoIncidenciaImportacion,
        prevEstado: baseEstado,
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
        comentario_sesion: normRow.comentario_sesion,
        recuperacion_semana: normRow.recuperacion_semana,
        sueno_semana: normRow.sueno_semana,
        estres_fuera: normRow.estres_fuera,
        energia_semana: normRow.energia_semana,
        animo_semana: normRow.animo_semana,
        preparada_semana: normRow.preparada_semana,
        sintomas_menstruales: normRow.sintomas_menstruales,
        dolor_sn: normRow.dolor_sn,
        dolor_texto_semana: normRow.dolor_texto_semana,
        actividad_sn: normRow.actividad_sn,
        actividad_texto_semana: normRow.actividad_texto_semana,
        mensaje: mensajeStr,
        rowOriginal: rawRow,
        normalRow: normRow
      })
      return
    }

    fileRows.set(fileKey, normRow)

    const clasificacion = clasificarFilaImportacion(normRow, existingWellness, context)
    const finalEstado = omittedRowIndices?.has(filaOriginal) ? 'OMITIDA' : clasificacion

    let tipoInc: string = 'sin_incidencia'
    if (clasificacion === 'ACTUALIZACION_POSIBLE') tipoInc = 'actualizacion_posible'
    else if (clasificacion === 'DUPLICADO_IDENTICO') tipoInc = 'duplicado_existente'

    if (finalEstado === 'OMITIDA') { result.omitidos++; tipoInc = 'omitida_manual' }
    else if (clasificacion === 'NUEVO') result.nuevos++
    else if (clasificacion === 'ACTUALIZACION_POSIBLE') result.actualizaciones++
    else if (clasificacion === 'DUPLICADO_IDENTICO') result.duplicados++


    result.rows.push({
      filaOriginal,
      estado: finalEstado,
      tipo_incidencia: tipoInc as TipoIncidenciaImportacion,
      prevEstado: clasificacion,
      id_jugadora: normRow.id_jugadora,
      alias_origen: normRow.alias_origen,
      metodo_resolucion_identidad: normRow.metodo_resolucion_identidad,
      id_temporada: normRow.id_temporada,
      nombreJugadora: (context.jugadorasMap && context.jugadorasMap[normRow.id_jugadora]) || jugadorasMap[normRow.id_jugadora] || '',
      fecha: normRow.fecha,
      calidad_sueno: normRow.calidad_sueno,
      fatiga: normRow.fatiga,
      dolor_muscular: normRow.dolor_muscular,
      estres: normRow.estres,
      estado_animo: normRow.estado_animo,
      dolor_especifico: normRow.dolor_especifico,
      comentario_sesion: normRow.comentario_sesion,
      recuperacion_semana: normRow.recuperacion_semana,
      sueno_semana: normRow.sueno_semana,
      estres_fuera: normRow.estres_fuera,
      energia_semana: normRow.energia_semana,
      animo_semana: normRow.animo_semana,
      preparada_semana: normRow.preparada_semana,
      sintomas_menstruales: normRow.sintomas_menstruales,
      dolor_sn: normRow.dolor_sn,
      dolor_texto_semana: normRow.dolor_texto_semana,
      actividad_sn: normRow.actividad_sn,
      actividad_texto_semana: normRow.actividad_texto_semana,
      mensaje: finalEstado === 'OMITIDA' ? 'Excluido manualmente por el usuario' :
               clasificacion === 'NUEVO' ? 'Registro nuevo listo para importar' :
               clasificacion === 'ACTUALIZACION_POSIBLE' ? 'Conflicto: ya existe un registro con datos diferentes' :
               'Duplicado idéntico (se omitirá automáticamente)',
      rowOriginal: rawRow,
      normalRow: normRow
    })
  })

  return result
}

export function detectarTipoCuestionario(headers: string[]): TipoCuestionarioWellness | null {
  const mapeoDiario = detectarMapeoWellness(headers)
  const metricasDiario = mapeoDiario.filter(m => m.excelHeader !== null && !['id_jugadora', 'fecha', 'marca_temporal', 'dolor_especifico', 'comentario_sesion'].includes(m.internalField))
  if (metricasDiario.length >= 3) return 'DIARIO'

  const mapeoSemanal = detectarMapeoWellnessSemanal(headers)
  const metricasSemanal = mapeoSemanal.filter(m => m.excelHeader !== null && !['id_jugadora', 'fecha', 'marca_temporal', 'dolor_molestia', 'actividad_adicional'].includes(m.internalField))
  if (metricasSemanal.length >= 3) return 'SEMANAL'

  return null
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
  tipoCuestionario: 'DIARIO' | 'SEMANAL' = 'DIARIO',
  config?: FiltrosCarga,
  dbInstance: FutsalDB = db,
  aliasesToSave: { alias_origen: string, id_jugadora: string }[] = []
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
  let nuevosAliasesCount = 0

  try {
    // Executing transaction on all affected tables for complete atomicity
    await dbInstance.transaction('rw', [
      dbInstance.wellness,
      dbInstance.wellness_diario_importado,
      dbInstance.historial_importaciones,
      dbInstance.jugadoras,
      dbInstance.temporadas,
      dbInstance.alias_jugadora,
      dbInstance.sesion_rpe,
      dbInstance.readiness,
      dbInstance.sesiones,
      dbInstance.partidos,
      dbInstance.rpe_partido,
      dbInstance.resumen_semanal,
      dbInstance.alertas,
      dbInstance.lesiones
    ], async () => {
      // Persist aliases first so they roll back on error
      for (const alias of aliasesToSave) {
        const result = await agregarAliasJugadora(dbInstance, {
          id_jugadora: alias.id_jugadora,
          origen: 'wellness',
          valor: alias.alias_origen,
          activo: true,
          fecha_alta: new Date().toISOString().split('T')[0]
        })
        if (result.accion === 'creado' || result.accion === 'reactivado') {
          nuevosAliasesCount++
        }
      }

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

          if (tipoCuestionario === 'SEMANAL') {
             const textos: Record<string, string> = {}
             if (norm.dolor_texto_semana) textos['¿Has tenido dolor, molestia o rigidez que haya limitado algo esta semana?'] = norm.dolor_texto_semana
             if (norm.actividad_texto_semana) textos['Indica qué tipo de actividad e intensidad (si has respondido Sí a la anterior)'] = norm.actividad_texto_semana
             if (norm.marca_temporal) textos['Marca temporal'] = norm.marca_temporal

             const metricas: Record<string, any> = {
               '¿Cómo valorarías tu recuperación general esta semana?': { original: norm.recuperacion_semana, normalizado: norm.recuperacion_semana },
               '¿Cómo ha sido la calidad de tu sueño esta semana?': { original: norm.sueno_semana, normalizado: norm.sueno_semana },
               '¿Cómo ha sido tu nivel de estrés fuera del fútbol sala?': { original: norm.estres_fuera, normalizado: norm.estres_fuera },
               '¿Cómo ha sido tu energía durante los entrenamientos y el partido?': { original: norm.energia_semana, normalizado: norm.energia_semana },
               '¿Cómo valorarías tu estado de ánimo esta semana?': { original: norm.animo_semana, normalizado: norm.animo_semana },
               '¿Has tenido dolor, molestia o rigidez que haya limitado algo esta semana?': { original: norm.dolor_sn, normalizado: norm.dolor_sn },
               '¿Has realizado actividad física importante adicional al trabajo con el equipo?': { original: norm.actividad_sn, normalizado: norm.actividad_sn },
               '¿Cómo de preparada te sientes para competir la próxima semana?': { original: norm.preparada_semana, normalizado: norm.preparada_semana },
               'Si eres mujer, ¿los síntomas menstruales han afectado tu rendimiento o bienestar esta semana?': { original: norm.sintomas_menstruales, normalizado: norm.sintomas_menstruales }
             }

             // Semana is implicitly derived from fecha

             await dbInstance.wellness_semanal_importado.put({
               id_jugadora: norm.id_jugadora,
               fecha: norm.fecha,
               id_temporada: temporadaActiva?.id_temporada,
               origen_alias: 'google_forms',
               alias_origen: norm.alias_origen,
               metricas,
               textos,
               indice_semanal: null // Will be recalculated by the derived engine
             })
             inserted++
          } else {
            // DIARIO
            const score = calcularScoreWellness(norm)

            const textos: Record<string, string> = {}
            if (norm.dolor_especifico) textos['Dolor especifico o nota importante (opcional)'] = norm.dolor_especifico
            if (norm.comentario_sesion) textos['Comentario sobre la sesión (opcional)'] = norm.comentario_sesion
            if (norm.marca_temporal) textos['Marca temporal'] = norm.marca_temporal

            const metricas: Record<string, any> = {
              'Calidad de sueño': { original: norm.calidad_sueno, normalizado: norm.calidad_sueno },
              'Fatiga': { original: norm.fatiga, normalizado: norm.fatiga },
              'Dolor muscular': { original: norm.dolor_muscular, normalizado: norm.dolor_muscular },
              'Estrés': { original: norm.estres, normalizado: norm.estres },
              'Estado de ánimo': { original: norm.estado_animo, normalizado: norm.estado_animo }
            }

            await dbInstance.wellness_diario_importado.put({
              id_jugadora: norm.id_jugadora,
              fecha: norm.fecha,
              id_temporada: temporadaActiva?.id_temporada,
              origen_alias: 'google_forms',
              alias_origen: norm.alias_origen,
              metricas,
              textos,
              indice_diario: score
            })

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
        } else if (row.estado === 'ACTUALIZACION_POSIBLE') {
          if (strategy === 'omit') {
            skipped++
          } else if (strategy === 'update') {
            const norm = row.normalRow!

            if (tipoCuestionario === 'SEMANAL') {
              const textos: Record<string, string> = {}
              if (norm.dolor_texto_semana) textos['¿Has tenido dolor, molestia o rigidez que haya limitado algo esta semana?'] = norm.dolor_texto_semana
              if (norm.actividad_texto_semana) textos['Indica qué tipo de actividad e intensidad (si has respondido Sí a la anterior)'] = norm.actividad_texto_semana
              if (norm.marca_temporal) textos['Marca temporal'] = norm.marca_temporal

              const metricas: Record<string, any> = {
                '¿Cómo valorarías tu recuperación general esta semana?': { original: norm.recuperacion_semana, normalizado: norm.recuperacion_semana },
                '¿Cómo ha sido la calidad de tu sueño esta semana?': { original: norm.sueno_semana, normalizado: norm.sueno_semana },
                '¿Cómo ha sido tu nivel de estrés fuera del fútbol sala?': { original: norm.estres_fuera, normalizado: norm.estres_fuera },
                '¿Cómo ha sido tu energía durante los entrenamientos y el partido?': { original: norm.energia_semana, normalizado: norm.energia_semana },
                '¿Cómo valorarías tu estado de ánimo esta semana?': { original: norm.animo_semana, normalizado: norm.animo_semana },
                '¿Has tenido dolor, molestia o rigidez que haya limitado algo esta semana?': { original: norm.dolor_sn, normalizado: norm.dolor_sn },
                '¿Has realizado actividad física importante adicional al trabajo con el equipo?': { original: norm.actividad_sn, normalizado: norm.actividad_sn },
                '¿Cómo de preparada te sientes para competir la próxima semana?': { original: norm.preparada_semana, normalizado: norm.preparada_semana },
                'Si eres mujer, ¿los síntomas menstruales han afectado tu rendimiento o bienestar esta semana?': { original: norm.sintomas_menstruales, normalizado: norm.sintomas_menstruales }
              }

              const semana = getWeekId(norm.fecha)
              // Para encontrar el importado semanal, la primary key de IndexedDB requiere consulta
              // Necesitaríamos buscar el id del semanal que coicide en semana.
              // Como Dexie no tiene index simple por semana_deportiva, buscamos todos los de la jugadora y filtramos
              const allDeJugadora = await dbInstance.wellness_semanal_importado.where({ id_jugadora: norm.id_jugadora }).toArray()
              const existingImportado = allDeJugadora.find(w => getWeekId(w.fecha) === semana)

              await dbInstance.wellness_semanal_importado.put({
                id: existingImportado?.id,
                id_jugadora: norm.id_jugadora,
                fecha: norm.fecha,
                id_temporada: temporadaActiva?.id_temporada,
                origen_alias: 'google_forms',
                alias_origen: norm.alias_origen,
                metricas,
                textos,
                indice_semanal: existingImportado?.indice_semanal ?? null
              })
              updated++
            } else {
              // DIARIO
              const score = calcularScoreWellness(norm)

              const textos: Record<string, string> = {}
              if (norm.dolor_especifico) textos['Dolor especifico o nota importante (opcional)'] = norm.dolor_especifico
              if (norm.comentario_sesion) textos['Comentario sobre la sesión (opcional)'] = norm.comentario_sesion
              if (norm.marca_temporal) textos['Marca temporal'] = norm.marca_temporal

              const metricas: Record<string, any> = {
                'Calidad de sueño': { original: norm.calidad_sueno, normalizado: norm.calidad_sueno },
                'Fatiga': { original: norm.fatiga, normalizado: norm.fatiga },
                'Dolor muscular': { original: norm.dolor_muscular, normalizado: norm.dolor_muscular },
                'Estrés': { original: norm.estres, normalizado: norm.estres },
                'Estado de ánimo': { original: norm.estado_animo, normalizado: norm.estado_animo }
              }

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

                const existingImportado = await dbInstance.wellness_diario_importado.where({ id_jugadora: norm.id_jugadora, fecha: norm.fecha }).first()
                await dbInstance.wellness_diario_importado.put({
                  id: existingImportado?.id,
                  id_jugadora: norm.id_jugadora,
                  fecha: norm.fecha,
                  id_temporada: temporadaActiva?.id_temporada,
                  origen_alias: 'google_forms',
                  alias_origen: norm.alias_origen,
                  metricas,
                  textos,
                  indice_diario: score
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
    nuevos_aliases: nuevosAliasesCount,
    idImportacion,
    recalculoExitoso: true
  }
}

export interface ConfirmImportParams {
  tipoCuestionario: 'DIARIO' | 'SEMANAL'
  downloadedBackupName: string | null
  userConfirmedBackup: boolean
  previewData: PreviewRow[]
  strategy: ImportStrategy
  filename: string
  sheetName: string
  mappingName: string
  aliasesToSave?: { alias_origen: string, id_jugadora: string }[]
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
      params.downloadedBackupName,
      params.tipoCuestionario,
      undefined,
      db,
      params.aliasesToSave
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
