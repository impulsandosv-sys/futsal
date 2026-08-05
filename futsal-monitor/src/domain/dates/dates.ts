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

export function isValidWeekId(weekId: string): boolean {
  if (!weekId || typeof weekId !== 'string') return false
  const trimmed = weekId.trim()
  if (isFechaLocalISO(trimmed)) return true
  const isoWeekRegex = /^(\d{4})-W(\d{2})$/
  const match = isoWeekRegex.exec(trimmed)
  if (!match) return false
  const weekNum = parseInt(match[2], 10)
  return weekNum >= 1 && weekNum <= 53
}

export function getWeekStartDateISO(weekId: string): string {
  if (!isValidWeekId(weekId)) return ''
  const trimmed = weekId.trim()

  const isoWeekMatch = /^(\d{4})-W(\d{2})$/.exec(trimmed)
  if (isoWeekMatch) {
    const year = parseInt(isoWeekMatch[1], 10)
    const week = parseInt(isoWeekMatch[2], 10)

    const jan4 = new Date(year, 0, 4)
    const dayOfWeek = jan4.getDay() || 7
    const week1Monday = new Date(year, 0, 4 - (dayOfWeek - 1))

    const targetMonday = new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000)
    return getLocalDateString(targetMonday)
  }

  const d = parseISO(trimmed)
  if (isNaN(d.getTime())) return ''
  const mon = startOfWeek(d, { weekStartsOn: 1 })
  return getLocalDateString(mon)
}

export function getWeekEndDateISO(weekId: string): string {
  const startISO = getWeekStartDateISO(weekId)
  if (!startISO) return ''
  const mon = parseISO(startISO)
  const sun = addDays(mon, 6)
  return getLocalDateString(sun)
}

export function getWeekId(fecha: string): string {
  if (!fecha || !isFechaLocalISO(fecha)) return ''
  const d = parseISO(fecha)
  if (isNaN(d.getTime())) return ''
  return getLocalDateString(startOfWeek(d, { weekStartsOn: 1 }))
}

export function formatWeek(weekId: string): string {
  const startStr = getWeekStartDateISO(weekId)
  if (!startStr) return weekId || 'Semana no válida'
  const mon = parseISO(startStr)
  const sun = addDays(mon, 6)
  return `${format(mon, 'd MMM', { locale: es })} - ${format(sun, 'd MMM yyyy', { locale: es })}`
}

export function getWeeksFromActivities(fechas: string[]): string[] {
  const validFechas = fechas.filter(f => f && isFechaLocalISO(f))
  const unique = new Set(validFechas.map(f => getWeekId(f)).filter(Boolean))
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

