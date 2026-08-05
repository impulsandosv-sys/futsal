import { format, parseISO, startOfWeek, addDays, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

export function parseAndNormalizeDate(dateStr: string): Date {
  return parseISO(dateStr)
}

export function compareDateStrings(a: string, b: string, desc = false): number {
  if (!a && !b) return 0
  if (!a) return desc ? 1 : -1
  if (!b) return desc ? -1 : 1
  
  const timeA = parseISO(a).getTime()
  const timeB = parseISO(b).getTime()
  
  if (isNaN(timeA) && isNaN(timeB)) return a.localeCompare(b) * (desc ? -1 : 1)
  if (isNaN(timeA)) return desc ? 1 : -1
  if (isNaN(timeB)) return desc ? -1 : 1

  return desc ? timeB - timeA : timeA - timeB
}

export function getWeekId(fecha: string): string {
  const d = parseISO(fecha)
  return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

export function formatWeek(weekId: string): string {
  const d = parseISO(weekId)
  const end = addDays(d, 6)
  return `${format(d, 'd MMM', { locale: es })} - ${format(end, 'd MMM yyyy', { locale: es })}`
}

export function getWeeksFromActivities(fechas: string[]): string[] {
  const validFechas = fechas.filter(Boolean)
  const unique = new Set(validFechas.map(f => getWeekId(f)))
  return Array.from(unique).sort((a, b) => compareDateStrings(a, b, true))
}

export function obtenerFechasUltimosDias(fechaReferencia: string, numDias: number): string[] {
  const ref = parseISO(fechaReferencia)
  const fechas: string[] = []
  for (let i = 0; i < numDias; i++) {
    const d = subDays(ref, i)
    fechas.push(format(d, 'yyyy-MM-dd'))
  }
  return fechas.reverse()
}

/**
 * Obtiene la fecha operativa local en formato YYYY-MM-DD (sin descalces por UTC).
 */
export function getLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Obtiene la fecha local de hoy en formato YYYY-MM-DD.
 */
export function getTodayLocalISO(): string {
  return getLocalDateString(new Date())
}

/**
 * Convierte un objeto Date o string a formato de fecha ISO local (YYYY-MM-DD).
 */
export function toLocalISODate(date: Date | string | number): string {
  if (typeof date === 'string') {
    if (isFechaLocalISO(date)) return date
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    return getLocalDateString(d)
  }
  if (typeof date === 'number') {
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    return getLocalDateString(d)
  }
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return ''
    return getLocalDateString(date)
  }
  return ''
}

/**
 * Alias para isFechaLocalISO
 */
export function isValidLocalISODate(val: unknown): val is string {
  return isFechaLocalISO(val)
}

/**
 * Valida si un valor dado es una cadena de fecha local estricta con formato YYYY-MM-DD.
 * Rechaza timestamps UTC, horas, formatos españoles, fechas imposibles en calendario (ej. 2026-02-30)
 * y valores no-string o con espacios en blanco.
 */
export function isFechaLocalISO(val: unknown): val is string {
  if (typeof val !== 'string') return false
  if (val !== val.trim()) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false

  const [y, m, d] = val.split('-').map(Number)
  if (m < 1 || m > 12) return false

  const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0)
  const daysInMonth = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  if (d < 1 || d > daysInMonth[m]) return false

  return true
}

/**
 * Retorna un mensaje de error legible si la fecha no cumple el formato YYYY-MM-DD o el calendario real,
 * o null si la fecha es totalmente válida.
 */
export function validateFechaLocalISO(val: unknown, fieldName = 'fecha'): string | null {
  if (val === null || val === undefined || val === '') {
    return `La ${fieldName} es obligatoria`
  }
  if (typeof val !== 'string') {
    return `El campo ${fieldName} debe ser una cadena de texto`
  }
  if (val !== val.trim()) {
    return `El formato de ${fieldName} no debe contener espacios en blanco`
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return `El formato de ${fieldName} debe ser exactamente YYYY-MM-DD`
  }

  const [y, m, d] = val.split('-').map(Number)
  if (m < 1 || m > 12) {
    return `Mes inválido en ${fieldName}`
  }

  const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0)
  const daysInMonth = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  if (d < 1 || d > daysInMonth[m]) {
    return `El día no existe en el calendario para el mes/año de ${fieldName}`
  }

  return null
}

