import { 
  compareDateStrings, 
  getWeekId, 
  formatWeek, 
  getWeeksFromActivities, 
  obtenerFechasUltimosDias,
  getLocalDateString,
  getTodayLocalISO,
  toLocalISODate,
  isValidLocalISODate,
  isFechaLocalISO,
  validateFechaLocalISO,
  isValidWeekId,
  getWeekStartDateISO,
  getWeekEndDateISO,
  extraerFechaDeportivaLocal
} from './dates'

describe('compareDateStrings', () => {
  it('compares standard date strings chronologically', () => {
    expect(compareDateStrings('2026-07-10', '2026-07-12')).toBeLessThan(0)
    expect(compareDateStrings('2026-07-12', '2026-07-10')).toBeGreaterThan(0)
    expect(compareDateStrings('2026-07-10', '2026-07-10')).toBe(0)
  })

  it('supports descending order', () => {
    expect(compareDateStrings('2026-07-10', '2026-07-12', true)).toBeGreaterThan(0)
  })

  it('handles inconsistent formats safely', () => {
    expect(compareDateStrings('2026-07-10T12:00:00.000Z', '2026-07-11')).toBeLessThan(0)
    expect(compareDateStrings('2026-07-11T15:30:00.000Z', '2026-07-10')).toBeGreaterThan(0)
  })
})

describe('getWeekId', () => {
  it('returns Monday of the week for any day of that week', () => {
    expect(getWeekId('2026-07-13')).toBe('2026-07-13') // Monday
    expect(getWeekId('2026-07-15')).toBe('2026-07-13') // Wednesday
    expect(getWeekId('2026-07-19')).toBe('2026-07-13') // Sunday
  })
})

describe('formatWeek', () => {
  it('formats week range correctly in Spanish', () => {
    expect(formatWeek('2026-07-13')).toBe('13 jul - 19 jul 2026')
  })
})

describe('getWeeksFromActivities', () => {
  it('returns sorted unique week ids in descending order', () => {
    const dates = ['2026-07-15', '2026-07-14', '2026-07-02', '2026-07-21']
    const result = getWeeksFromActivities(dates)
    expect(result).toEqual(['2026-07-20', '2026-07-13', '2026-06-29'])
  })
})

describe('obtenerFechasUltimosDias', () => {
  it('returns chronological list of dates leading up to reference date', () => {
    const result = obtenerFechasUltimosDias('2026-07-15', 3)
    expect(result).toEqual(['2026-07-13', '2026-07-14', '2026-07-15'])
  })
})

describe('getLocalDateString', () => {
  it('returns YYYY-MM-DD with 2-digit month and day', () => {
    const d = new Date(2026, 4, 5) // 5 May 2026
    const result = getLocalDateString(d)
    expect(result).toBe('2026-05-05')
  })

  it('preserves local calendar day at late night time (23:45 local)', () => {
    // 23:45 local time on 2026-07-28
    const lateNight = new Date(2026, 6, 28, 23, 45, 0)
    const result = getLocalDateString(lateNight)
    expect(result).toBe('2026-07-28')
  })

  it('getTodayLocalISO returns valid local ISO date format', () => {
    const today = getTodayLocalISO()
    expect(isFechaLocalISO(today)).toBe(true)
  })

  it('toLocalISODate converts Date and string correctly', () => {
    expect(toLocalISODate(new Date(2026, 0, 15))).toBe('2026-01-15')
    expect(toLocalISODate('2026-03-20')).toBe('2026-03-20')
  })

  it('isValidLocalISODate acts as alias for isFechaLocalISO', () => {
    expect(isValidLocalISODate('2026-05-10')).toBe(true)
    expect(isValidLocalISODate('invalid')).toBe(false)
  })
})

describe('isFechaLocalISO & validateFechaLocalISO (T-02-DOM-GOV)', () => {
  it('1. Acepta fechas válidas YYYY-MM-DD', () => {
    expect(isFechaLocalISO('2026-08-01')).toBe(true)
    expect(validateFechaLocalISO('2026-08-01')).toBeNull()
  })

  it('2. Acepta bisiesto 29 feb (2024-02-29)', () => {
    expect(isFechaLocalISO('2024-02-29')).toBe(true)
    expect(validateFechaLocalISO('2024-02-29')).toBeNull()
  })

  it('3. Rechaza 29 feb en año no bisiesto (2025-02-29)', () => {
    expect(isFechaLocalISO('2025-02-29')).toBe(false)
    expect(validateFechaLocalISO('2025-02-29')).toContain('El día no existe en el calendario')
  })

  it('4. Rechaza día imposible en febrero (2026-02-30)', () => {
    expect(isFechaLocalISO('2026-02-30')).toBe(false)
    expect(validateFechaLocalISO('2026-02-30')).toContain('El día no existe en el calendario')
  })

  it('5. Rechaza sin ceros a la izquierda (2026-8-1)', () => {
    expect(isFechaLocalISO('2026-8-1')).toBe(false)
    expect(validateFechaLocalISO('2026-8-1')).toContain('debe ser exactamente YYYY-MM-DD')
  })

  it('6. Rechaza formato español (01/08/2026 y 01-08-2026)', () => {
    expect(isFechaLocalISO('01/08/2026')).toBe(false)
    expect(isFechaLocalISO('01-08-2026')).toBe(false)
    expect(validateFechaLocalISO('01/08/2026')).toContain('debe ser exactamente YYYY-MM-DD')
  })

  it('7. Rechaza ISO con UTC o milisegundos (2026-08-01T00:00:00.000Z)', () => {
    expect(isFechaLocalISO('2026-08-01T00:00:00.000Z')).toBe(false)
    expect(validateFechaLocalISO('2026-08-01T00:00:00.000Z')).toContain('debe ser exactamente YYYY-MM-DD')
  })

  it('8. Rechaza ISO con hora (2026-08-01T12:00:00)', () => {
    expect(isFechaLocalISO('2026-08-01T12:00:00')).toBe(false)
    expect(validateFechaLocalISO('2026-08-01T12:00:00')).toContain('debe ser exactamente YYYY-MM-DD')
  })

  it('9. Rechaza espacios en blanco iniciales o finales (" 2026-08-01 ")', () => {
    expect(isFechaLocalISO(' 2026-08-01 ')).toBe(false)
    expect(validateFechaLocalISO(' 2026-08-01 ')).toContain('no debe contener espacios en blanco')
  })

  it('10. Rechaza valores no-string o vacíos', () => {
    expect(isFechaLocalISO(null)).toBe(false)
    expect(isFechaLocalISO(12345)).toBe(false)
    expect(isFechaLocalISO(new Date())).toBe(false)
    expect(validateFechaLocalISO('')).toContain('es obligatoria')
    expect(validateFechaLocalISO(12345)).toContain('debe ser una cadena de texto')
  })

  it('11. No modifica la fecha ni el tipo recibido al validar', () => {
    const input = '2026-08-01'
    expect(validateFechaLocalISO(input)).toBeNull()
    expect(input).toBe('2026-08-01')
  })

  it('12. Emite mensajes diferenciables para formato incorrecto vs fecha calendariamente inexistente', () => {
    const errFormat = validateFechaLocalISO('invalid-format')
    const errCal = validateFechaLocalISO('2026-04-31') // April only has 30 days
    expect(errFormat).toContain('debe ser exactamente YYYY-MM-DD')
    expect(errCal).toContain('El día no existe en el calendario')
  })
  it('13. toLocalISODate con string ISO local YYYY-MM-DD permanece intacta sin parsear via new Date()', () => {
    const input = '2026-08-15'
    expect(toLocalISODate(input)).toBe('2026-08-15')
    expect(toLocalISODate('2026-02-28')).toBe('2026-02-28')
  })
})

describe('Bloque C - Semanas ISO y conversiones seguras', () => {
  it('1. Semana ISO estándar (2026-05-11) calcula inicio (lunes) y fin (domingo)', () => {
    expect(isValidWeekId('2026-05-11')).toBe(true)
    expect(getWeekStartDateISO('2026-05-11')).toBe('2026-05-11')
    expect(getWeekEndDateISO('2026-05-11')).toBe('2026-05-17')
    expect(formatWeek('2026-05-11')).toBe('11 may - 17 may 2026')
  })

  it('2. Primera semana del año (2026-W01)', () => {
    expect(isValidWeekId('2026-W01')).toBe(true)
    expect(getWeekStartDateISO('2026-W01')).toBe('2025-12-29') // ISO W01 2026 starts Dec 29 2025
    expect(getWeekEndDateISO('2026-W01')).toBe('2026-01-04')
  })

  it('3. Última semana del año (2026-W52)', () => {
    expect(isValidWeekId('2026-W52')).toBe(true)
    expect(getWeekStartDateISO('2026-W52')).toBe('2026-12-21')
    expect(getWeekEndDateISO('2026-W52')).toBe('2026-12-27')
  })

  it('4. Semana que cruza año (2026-12-28)', () => {
    expect(getWeekStartDateISO('2026-12-28')).toBe('2026-12-28')
    expect(getWeekEndDateISO('2026-12-28')).toBe('2027-01-03')
  })

  it('5 & 6. Domingo de la semana está incluido y lunes siguiente excluido', () => {
    const start = getWeekStartDateISO('2026-05-11') // 2026-05-11
    const end = getWeekEndDateISO('2026-05-11')     // 2026-05-17 (Domingo)

    const sunday = '2026-05-17'
    const nextMonday = '2026-05-18'

    expect(sunday >= start && sunday <= end).toBe(true)
    expect(nextMonday >= start && nextMonday <= end).toBe(false)
  })

  it('7. Week ID inválido devuelve valores seguros sin lanzar excepción', () => {
    expect(isValidWeekId('invalid-week-id')).toBe(false)
    expect(getWeekStartDateISO('invalid-week-id')).toBe('')
    expect(getWeekEndDateISO('invalid-week-id')).toBe('')
    expect(formatWeek('invalid-week-id')).toBe('invalid-week-id')
  })

  it('8. Validación estricta de W53 según calendario del año ISO', () => {
    expect(isValidWeekId('2026-W53')).toBe(true) // 2026 starts Jan 1 Thu -> 53 weeks
    expect(isValidWeekId('2020-W53')).toBe(true) // 2020 leap year starts Jan 1 Wed -> 53 weeks
    expect(isValidWeekId('2025-W53')).toBe(false) // 2025 has 52 weeks
    expect(isValidWeekId('2024-W53')).toBe(false) // 2024 has 52 weeks
  })
})

describe('extraerFechaDeportivaLocal — Preservación de Sesión Nocturna (Regla 3)', () => {
  it('1. Preserva el día local deportivo para sesión nocturna 2026-08-05T23:30 sin desplazamiento a 2026-08-06', () => {
    const rawTimestamp = '2026-08-05T23:30:00+02:00'
    const fechaDeportiva = extraerFechaDeportivaLocal(rawTimestamp)
    
    expect(fechaDeportiva).toBe('2026-08-05')
    expect(fechaDeportiva).not.toBe('2026-08-06')
  })

  it('2. Sesión simulada guardada y leída conserva la fecha local 2026-08-05', () => {
    const sesion = {
      id_sesion: 'S_NIGHT_01',
      marca_temporal: '2026-08-05T23:30',
      fecha: extraerFechaDeportivaLocal('2026-08-05T23:30')
    }

    expect(sesion.fecha).toBe('2026-08-05')
  })
})

