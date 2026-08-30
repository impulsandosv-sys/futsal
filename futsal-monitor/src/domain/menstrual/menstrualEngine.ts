import type { RegistroMenstrual, Jugadora, Alerta } from '@/types'
import { isFechaLocalISO, getTodayLocalISO } from '@/domain/dates/dates'

/**
 * Valida la integridad de un RegistroMenstrual antes de persistir.
 */
export function validarRegistroMenstrual(
  reg: Partial<RegistroMenstrual>,
  existentes: RegistroMenstrual[] = [],
  hoyStr: string = getTodayLocalISO()
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!reg.id_jugadora || typeof reg.id_jugadora !== 'string' || !reg.id_jugadora.trim()) {
    errors.push('El ID de jugadora es obligatorio')
  }

  if (!reg.fecha_inicio || !isFechaLocalISO(reg.fecha_inicio)) {
    errors.push('La fecha de inicio debe ser una fecha ISO válida (YYYY-MM-DD)')
  } else if (reg.fecha_inicio > hoyStr) {
    errors.push('No se permiten fechas de inicio futuras')
  }

  if (
    reg.impacto_percibido === undefined ||
    reg.impacto_percibido === null ||
    typeof reg.impacto_percibido !== 'number' ||
    !Number.isInteger(reg.impacto_percibido) ||
    reg.impacto_percibido < 0 ||
    reg.impacto_percibido > 10
  ) {
    errors.push('El impacto percibido debe ser un número entero entre 0 y 10')
  }

  if (reg.fecha_decision && !isFechaLocalISO(reg.fecha_decision)) {
    errors.push('La fecha de decisión debe ser una fecha ISO válida (YYYY-MM-DD)')
  } else if (reg.fecha_decision && reg.fecha_decision > hoyStr) {
    errors.push('No se permiten fechas de decisión futuras')
  }

  // Deduplicación estricta por id_jugadora + fecha_inicio
  if (reg.id_jugadora && reg.fecha_inicio && isFechaLocalISO(reg.fecha_inicio)) {
    const duplicado = existentes.find(
      (e) =>
        e.id_jugadora === reg.id_jugadora &&
        e.fecha_inicio === reg.fecha_inicio &&
        (reg.id === undefined || String(e.id) !== String(reg.id))
    )
    if (duplicado) {
      errors.push(
        `Ya existe un registro de inicio de menstruación para esta jugadora en la fecha ${reg.fecha_inicio}. Edita el registro existente.`
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Calcula la diferencia en días naturales exactos entre dos fechas ISO locales (fechaB - fechaA).
 */
export function calcularDiferenciaDias(fechaA: string, fechaB: string): number {
  const [y1, m1, d1] = fechaA.split('-').map(Number)
  const [y2, m2, d2] = fechaB.split('-').map(Number)
  const utc1 = Date.UTC(y1, m1 - 1, d1)
  const utc2 = Date.UTC(y2, m2 - 1, d2)
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24))
}

/**
 * Suma días naturales exactos a una fecha ISO local (YYYY-MM-DD).
 */
export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d) + dias * 86400000
  const res = new Date(utc)
  const year = res.getUTCFullYear()
  const month = String(res.getUTCMonth() + 1).padStart(2, '0')
  const day = String(res.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calcula los intervalos en días entre inicios menstruales consecutivos ordenados por fecha ascendente.
 */
export function calcularIntervalosMenstruales(registros: RegistroMenstrual[]): number[] {
  const ordenados = [...registros]
    .filter((r) => r && isFechaLocalISO(r.fecha_inicio))
    .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))

  // Eliminar fechas duplicadas si las hubiera
  const fechasUnicas: string[] = []
  for (const r of ordenados) {
    if (!fechasUnicas.includes(r.fecha_inicio)) {
      fechasUnicas.push(r.fecha_inicio)
    }
  }

  const intervalos: number[] = []
  for (let i = 0; i < fechasUnicas.length - 1; i++) {
    const diff = calcularDiferenciaDias(fechasUnicas[i], fechasUnicas[i + 1])
    if (diff > 0) {
      intervalos.push(diff)
    }
  }

  return intervalos
}

/**
 * Calcula la mediana matemática de una lista de números enteros.
 */
export function calcularMediana(numeros: number[]): number {
  if (numeros.length === 0) return 0
  const sorted = [...numeros].sort((a, b) => a - b)
  const len = sorted.length
  if (len % 2 !== 0) {
    return sorted[Math.floor(len / 2)]
  }
  return Math.round((sorted[len / 2 - 1] + sorted[len / 2]) / 2)
}

/**
 * Evalúa si existe variabilidad reciente a partir exclusivamente del rango de los intervalos utilizados.
 * Regla:
 * const rango = Math.max(...intervalosUsados) - Math.min(...intervalosUsados)
 * const variabilidad_reciente = rango > 7
 */
export function evaluarVariabilidadIntervalos(intervalosUsados: number[]): boolean {
  if (intervalosUsados.length === 0) return false
  const rango = Math.max(...intervalosUsados) - Math.min(...intervalosUsados)
  return rango > 7
}

export interface EstimacionMenstrual {
  fecha_estimada: string
  mediana_intervalos: number
  variabilidad_reciente: boolean
  intervalos_usados: number[]
  ultimo_inicio: string
}

/**
 * Estima prudentemente la fecha del próximo inicio menstrual a partir del historial real.
 * Reglas:
 * - < 2 inicios: null
 * - 2 inicios: 1 intervalo
 * - 3 inicios: mediana de 2 intervalos
 * - 4+ inicios: mediana de los últimos 3 intervalos
 */
export function calcularProximoInicioEstimado(registros: RegistroMenstrual[], hoyStr: string = getTodayLocalISO()): EstimacionMenstrual | null {
  const validos = [...registros]
    .filter((r) => r && isFechaLocalISO(r.fecha_inicio) && r.fecha_inicio <= hoyStr)
    .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))

  if (validos.length < 2) {
    return null
  }

  const intervalos = calcularIntervalosMenstruales(validos)
  if (intervalos.length === 0) {
    return null
  }

  let intervalosUsados: number[] = []

  if (intervalos.length === 1) {
    intervalosUsados = [intervalos[0]]
  } else if (intervalos.length === 2) {
    intervalosUsados = [intervalos[0], intervalos[1]]
  } else {
    intervalosUsados = intervalos.slice(-3)
  }

  const mediana = calcularMediana(intervalosUsados)
  const variabilidad = evaluarVariabilidadIntervalos(intervalosUsados)
  const ultimoInicio = validos[validos.length - 1].fecha_inicio
  const fechaEstimada = sumarDias(ultimoInicio, mediana)

  return {
    fecha_estimada: fechaEstimada,
    mediana_intervalos: mediana,
    variabilidad_reciente: variabilidad,
    intervalos_usados: intervalosUsados,
    ultimo_inicio: ultimoInicio
  }
}

/**
 * Calcula la ventana de activación (-3 días) y caducidad (+7 días) de la alerta estimada.
 */
export function calcularVentanaAlertaMenstrual(fechaEstimada: string): {
  fecha_activacion: string
  fecha_caducidad: string
} {
  return {
    fecha_activacion: sumarDias(fechaEstimada, -3),
    fecha_caducidad: sumarDias(fechaEstimada, 7)
  }
}

/**
 * Evalúa si procede generar un recordatorio estimado para una jugadora y construye la Alerta.
 */
export function evaluarAlertaMenstrualJugadora(
  registrosJugadora: RegistroMenstrual[],
  jugadora: Jugadora,
  hoyStr: string = getTodayLocalISO(),
  ahoraStr: string = new Date().toISOString()
): Alerta | null {
  const estimacion = calcularProximoInicioEstimado(registrosJugadora, hoyStr)
  if (!estimacion) return null

  const { fecha_activacion, fecha_caducidad } = calcularVentanaAlertaMenstrual(estimacion.fecha_estimada)

  if (hoyStr < fecha_activacion || hoyStr > fecha_caducidad) {
    return null
  }

  const mensaje = estimacion.variabilidad_reciente
    ? 'Estimación con variabilidad reciente en los intervalos registrados. Confirmar contexto con la jugadora si procede.'
    : 'Recordatorio estimado a partir de los inicios comunicados. Confirmar contexto con la jugadora si procede.'

  return {
    tipo: 'MENSTRUACION_PROXIMA_ESTIMADA',
    prioridad: 'bajo',
    id_jugadora: jugadora.id_jugadora,
    fecha: estimacion.fecha_estimada,
    mensaje: `${jugadora.nombre}: ${mensaje}`,
    nivel: 'bajo',
    leida: false,
    creada: ahoraStr,
    fecha_creacion: ahoraStr,
    origen: 'Seguimiento Menstrual Estimado',
    datos_sustento: JSON.stringify({
      fecha_estimada: estimacion.fecha_estimada,
      ultimo_inicio: estimacion.ultimo_inicio,
      mediana_intervalos: estimacion.mediana_intervalos,
      intervalos_usados: estimacion.intervalos_usados,
      variabilidad_reciente: estimacion.variabilidad_reciente,
      fecha_activacion,
      fecha_caducidad
    }),
    estado: 'abierta',
    responsable: '',
    nota_decision: '',
    sugerencia: 'Confirmar contexto individual con la jugadora si procede'
  }
}
