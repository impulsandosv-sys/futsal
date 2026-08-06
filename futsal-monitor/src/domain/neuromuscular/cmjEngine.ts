import type { IntentoCMJ, MedicionCMJ } from '@/types'
import type { MedicionCMJNormalizada, EstadoValidacionCMJ } from './cmjDomain'
import { BANDA_PLAUSIBILIDAD_CMJ } from './cmjDomain'
import { isFechaLocalISO } from '@/domain/dates/dates'

export function calcularMejorIntentoCMJ(intentos: IntentoCMJ[]): IntentoCMJ | null {
  const validos = intentos.filter(i => i.valido && (i.altura_cm != null || i.tiempo_vuelo_ms != null))
  if (validos.length === 0) return null

  return validos.reduce((mejor, actual) => {
    // Si tenemos altura en ambos, comparar altura
    if (mejor.altura_cm != null && actual.altura_cm != null) {
      return actual.altura_cm > mejor.altura_cm ? actual : mejor
    }
    // Si no hay altura pero hay vuelo, comparar vuelo
    if (mejor.tiempo_vuelo_ms != null && actual.tiempo_vuelo_ms != null) {
      return actual.tiempo_vuelo_ms > mejor.tiempo_vuelo_ms ? actual : mejor
    }
    // Si uno tiene altura y el otro no, priorizar el que tiene altura (métrica primaria)
    if (actual.altura_cm != null && mejor.altura_cm == null) return actual
    return mejor
  }, validos[0])
}

export function procesarMedicionCMJ(medicion: MedicionCMJ): MedicionCMJ {
  const m = { ...medicion }
  const mejor = calcularMejorIntentoCMJ(m.intentos)
  
  if (mejor) {
    m.mejor_intento_valido_id = mejor.id_intento
    m.altura_mejor_cm = mejor.altura_cm ?? null
    m.tiempo_vuelo_mejor_ms = mejor.tiempo_vuelo_ms ?? null
  } else {
    m.mejor_intento_valido_id = null
    m.altura_mejor_cm = null
    m.tiempo_vuelo_mejor_ms = null
  }
  return m
}

export function validarMedicionCMJ(medicion: MedicionCMJ): string[] {
  const errores: string[] = []
  
  if (!medicion.id_jugadora) errores.push('Jugadora requerida')
  if (!medicion.fecha) errores.push('Fecha requerida')
  else {
    const r = /^\d{4}-\d{2}-\d{2}$/
    if (!r.test(medicion.fecha)) errores.push('Formato de fecha inválido (YYYY-MM-DD)')
  }
  if (!medicion.id_protocolo) errores.push('Protocolo requerido')
  if (!medicion.protocolo_nombre_historico || !medicion.protocolo_nombre_historico.trim()) {
    errores.push('Nombre histórico del protocolo requerido para trazabilidad')
  }

  const ordenes = new Set<number>()
  for (const i of medicion.intentos) {
    if (ordenes.has(i.orden)) errores.push(`Orden duplicado: ${i.orden}`)
    ordenes.add(i.orden)

    if (i.altura_cm != null && i.altura_cm < 0) errores.push(`Altura negativa en intento ${i.orden}`)
    if (i.tiempo_vuelo_ms != null && i.tiempo_vuelo_ms <= 0) errores.push(`Tiempo de vuelo inválido en intento ${i.orden}`)
    
    if (i.valido && i.altura_cm == null && i.tiempo_vuelo_ms == null) {
      errores.push(`Intento ${i.orden} marcado como válido pero no tiene métricas`)
    }
  }

  return errores
}

export function normalizarNombreProtocolo(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function validarProtocoloCMJ(nombre: string, activosActuales: string[]): string | null {
  if (!nombre.trim()) return 'El nombre del protocolo es obligatorio'
  
  const norm = normalizarNombreProtocolo(nombre)
  if (activosActuales.some(n => normalizarNombreProtocolo(n) === norm)) {
    return 'Ya existe un protocolo activo funcionalmente equivalente'
  }
  
  return null
}

/**
 * Genera la clave lógica unívoca de una medición CMJ.
 * Permite conservar y diferenciar hasta 3 intentos de la misma jugadora, fecha y protocolo
 * en un mismo día sin colisión ni confusión.
 */
export function generarClaveLogicaCMJ(
  idJugadora: string,
  fecha: string,
  idProtocolo: string,
  intento: number
): string {
  return `${idJugadora}::${fecha}::${idProtocolo}::${intento}`
}

/**
 * Valida técnicamente una medición CMJ individual (plausibilidad de rango y validez de datos).
 * Retorna estado ('valido', 'requiere_revision' o 'error') y motivo opcional.
 */
export function validarPlausibilidadCMJ(medicion: Partial<MedicionCMJNormalizada>): {
  estado: EstadoValidacionCMJ
  motivo?: string
} {
  if (!medicion.fecha || !isFechaLocalISO(medicion.fecha)) {
    return { estado: 'error', motivo: 'Fecha local estricta inválida (debe ser YYYY-MM-DD)' }
  }

  if (
    medicion.intento == null ||
    !Number.isInteger(medicion.intento) ||
    medicion.intento <= 0
  ) {
    return { estado: 'error', motivo: 'El intento debe ser un entero positivo' }
  }

  if (
    medicion.alturaSaltoCm == null ||
    typeof medicion.alturaSaltoCm !== 'number' ||
    !Number.isFinite(medicion.alturaSaltoCm) ||
    medicion.alturaSaltoCm <= 0
  ) {
    return { estado: 'error', motivo: 'La altura de salto debe ser un número finito positivo' }
  }

  if (
    medicion.alturaSaltoCm < BANDA_PLAUSIBILIDAD_CMJ.MIN_CM ||
    medicion.alturaSaltoCm > BANDA_PLAUSIBILIDAD_CMJ.MAX_CM
  ) {
    return {
      estado: 'requiere_revision',
      motivo: `Altura de salto (${medicion.alturaSaltoCm} cm) fuera de la banda técnica provisional de plausibilidad (${BANDA_PLAUSIBILIDAD_CMJ.MIN_CM}-${BANDA_PLAUSIBILIDAD_CMJ.MAX_CM} cm)`,
    }
  }

  return { estado: 'valido' }
}

/**
 * Evalúa la clasificación de reimportación para una medición respecto a una existente.
 * Retorna 'duplicado' si todos los valores relevantes son idénticos,
 * 'conflicto' si existe la misma clave lógica pero con valores distintos,
 * o el estado propio de la medición si es nueva.
 */
export function evaluarClasificacionCMJ(
  nueva: MedicionCMJNormalizada,
  existente?: MedicionCMJNormalizada
): EstadoValidacionCMJ {
  if (!existente) return nueva.estado

  // Si existe pero la nueva tiene un error o requiere_revision sintáctico
  if (nueva.estado === 'error') return 'error'

  const identica =
    nueva.alturaSaltoCm === existente.alturaSaltoCm &&
    (nueva.tiempoVueloMs ?? null) === (existente.tiempoVueloMs ?? null) &&
    nueva.unidadAltura === existente.unidadAltura &&
    nueva.idProtocolo === existente.idProtocolo

  if (identica) return 'duplicado'

  return 'conflicto'
}

/**
 * Selecciona de forma pura e inmutable la mejor marca CMJ por grupo (jugadora + fecha + protocolo).
 * Reglas:
 * 1. Agrupa exclusivamente por misma jugadora + fecha + idProtocolo.
 * 2. Considera únicamente mediciones con estado === 'valido'.
 * 3. Selecciona la mayor alturaSaltoCm.
 * 4. Desempate determinista: en caso de altura idéntica, selecciona el menor número de intento.
 * 5. NO utiliza tiempo de vuelo para desempatar.
 * 6. Marca seleccionadoComoMejor = true exactamente en 1 registro por grupo válido.
 */
export function seleccionarMejoresIntentosCMJ(
  mediciones: MedicionCMJNormalizada[]
): MedicionCMJNormalizada[] {
  // Clonado inmutable
  const resultado: MedicionCMJNormalizada[] = mediciones.map((m) => ({
    ...m,
    seleccionadoComoMejor: false,
  }))

  // Agrupar índices por jugadora + fecha + idProtocolo
  const grupos = new Map<string, number[]>()

  resultado.forEach((m, idx) => {
    if (m.estado === 'valido') {
      const claveGrupo = `${m.idJugadora}::${m.fecha}::${m.idProtocolo}`
      const lista = grupos.get(claveGrupo) || []
      lista.push(idx)
      grupos.set(claveGrupo, lista)
    }
  })

  // Para cada grupo válido, encontrar el mejor intento
  grupos.forEach((indices) => {
    if (indices.length === 0) return

    let mejorIdx = indices[0]

    for (let i = 1; i < indices.length; i++) {
      const actualIdx = indices[i]
      const mejor = resultado[mejorIdx]
      const actual = resultado[actualIdx]

      if (actual.alturaSaltoCm > mejor.alturaSaltoCm) {
        mejorIdx = actualIdx
      } else if (actual.alturaSaltoCm === mejor.alturaSaltoCm) {
        // Desempate determinista: menor número de intento
        if (actual.intento < mejor.intento) {
          mejorIdx = actualIdx
        }
      }
    }

    resultado[mejorIdx].seleccionadoComoMejor = true
  })

  return resultado
}

