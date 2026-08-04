import { parseISO, subDays, format, differenceInCalendarDays } from 'date-fns'
import type {
  Jugadora,
  Wellness,
  Lesion,
  Alerta,
  NivelSeguimiento,
  EstadoRespuestaWellness,
  EstadoCalidadDatos,
  MotivoSeguimiento,
  ReferenciaIndividual,
  PanelHoyJugadora,
  PanelHoyResumen
} from '@/types'

/**
 * Determina el estado de respuesta de un registro de wellness.
 */
export function construirEstadoWellnessDia(w: Wellness | null): EstadoRespuestaWellness {
  if (!w) return 'pendiente'
  
  const incomplete =
    w.calidad_sueno === null || w.calidad_sueno === undefined || isNaN(w.calidad_sueno) ||
    w.fatiga === null || w.fatiga === undefined || isNaN(w.fatiga) ||
    w.dolor_muscular === null || w.dolor_muscular === undefined || isNaN(w.dolor_muscular) ||
    w.estres === null || w.estres === undefined || isNaN(w.estres) ||
    w.estado_animo === null || w.estado_animo === undefined || isNaN(w.estado_animo)
    
  return incomplete ? 'incompleto' : 'respondió'
}

/**
 * Calcula la adherencia de wellness en una ventana de días.
 */
export function calcularAdherenciaWellness(
  jugadora: Jugadora,
  wellnessList: Wellness[],
  fechaSeleccionada: string,
  diasWindow: number,
  referenceTodayStr?: string
): { fraccion: string; porcentaje: number; nota?: string } {
  const selectedDate = parseISO(fechaSeleccionada)
  const startOfWindow = subDays(selectedDate, diasWindow - 1)
  
  // Limitar fin de cálculo al día de hoy para no incluir días futuros
  const todayStr = referenceTodayStr || new Date().toISOString().split('T')[0]
  const today = parseISO(todayStr)
  const endCalc = selectedDate > today ? today : selectedDate
  
  if (endCalc < startOfWindow) {
    return { fraccion: `0/0`, porcentaje: 0, nota: 'historial parcial' }
  }

  const denominator = differenceInCalendarDays(endCalc, startOfWindow) + 1
  if (denominator <= 0) {
    return { fraccion: `0/0`, porcentaje: 0 }
  }

  const records = wellnessList
    .filter(w => w.id_jugadora === jugadora.id_jugadora)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    
  const earliestDateStr = records[0]?.fecha || null
  let isParcial = false

  if (earliestDateStr) {
    const earliestDate = parseISO(earliestDateStr)
    if (earliestDate > startOfWindow && earliestDate <= endCalc) {
      isParcial = true
    }
  } else {
    isParcial = true
  }

  const startStr = format(startOfWindow, 'yyyy-MM-dd')
  const endStr = format(endCalc, 'yyyy-MM-dd')
  
  const count = records.filter(w => w.fecha >= startStr && w.fecha <= endStr).length

  const porcentaje = Math.round((count / denominator) * 100)
  return {
    fraccion: `${count}/${denominator}`,
    porcentaje,
    nota: isParcial ? 'historial parcial' : undefined
  }
}

/**
 * Calcula las referencias individuales basadas en los últimos 28 días calendario anteriores a la fecha seleccionada.
 */
export function calcularReferenciaIndividual(
  jugadoraId: string,
  wellnessList: Wellness[],
  fechaSeleccionada: string
): ReferenciaIndividual | null {
  const selectedDate = parseISO(fechaSeleccionada)
  const startRef = subDays(selectedDate, 28)
  const endRef = subDays(selectedDate, 1)
  
  const startStr = format(startRef, 'yyyy-MM-dd')
  const endStr = format(endRef, 'yyyy-MM-dd')

  const validRecords = wellnessList.filter(w => {
    if (w.id_jugadora !== jugadoraId) return false
    if (w.fecha < startStr || w.fecha > endStr) return false
    return construirEstadoWellnessDia(w) === 'respondió'
  })

  if (validRecords.length < 10) {
    return null
  }

  const metrics: (keyof ReferenciaIndividual['valoresReferencia'])[] = [
    'calidad_sueno', 'fatiga', 'dolor_muscular', 'estres', 'estado_animo', 'score_wellness'
  ]

  const valoresReferencia = {} as ReferenciaIndividual['valoresReferencia']
  const desviacionesEstandar = {} as ReferenciaIndividual['desviacionesEstandar']

  const count = validRecords.length

  metrics.forEach(metric => {
    const sum = validRecords.reduce((s, w) => s + (w[metric] as number), 0)
    const avg = Math.round((sum / count) * 10) / 10
    valoresReferencia[metric] = avg

    const varianza = validRecords.reduce((s, w) => s + Math.pow((w[metric] as number) - avg, 2), 0) / count
    const stdDev = Math.round(Math.sqrt(varianza) * 100) / 100
    desviacionesEstandar[metric] = stdDev
  })

  // Si la desviación estándar del score es muy baja, se cataloga como variabilidad baja
  const variabilidadBaja = desviacionesEstandar.score_wellness <= 0.2

  return {
    jugadoraId,
    registrosValidos: count,
    valoresReferencia,
    desviacionesEstandar,
    variabilidadBaja
  }
}

/**
 * Evalúa las desviaciones individuales para cada componente de wellness.
 */
export function evaluarDesviacionesIndividuales(
  w: Wellness,
  ref: ReferenciaIndividual
): MotivoSeguimiento[] {
  const motivos: MotivoSeguimiento[] = []
  
  const checkMetric = (
    metricName: keyof ReferenciaIndividual['valoresReferencia'],
    label: string,
    worseIsLower: boolean
  ) => {
    const val = w[metricName] as number
    if (val === null || val === undefined || isNaN(val)) return

    const refVal = ref.valoresReferencia[metricName]
    const std = ref.desviacionesEstandar[metricName]
    const diff = val - refVal
    const absDiff = Math.abs(diff)

    // Evaluar si es desfavorable
    const isWorse = worseIsLower ? diff < 0 : diff > 0

    if (isWorse) {
      const diffFormatted = diff > 0 ? `+${diff.toFixed(1)}` : `${diff.toFixed(1)}`
      
      if (ref.variabilidadBaja || std <= 0.1) {
        if (absDiff >= 1.5) {
          motivos.push({
            categoria: metricName === 'dolor_muscular' ? 'revisar_hoy' : 'revision_prioritaria',
            mensaje: `${label} actual ${val}/10 (ref: ${refVal.toFixed(1)}, variabilidad histórica muy baja, dif: ${diffFormatted})`
          })
        } else if (absDiff >= 1.0) {
          motivos.push({
            categoria: 'revisar_hoy',
            mensaje: `${label} actual ${val}/10 (ref: ${refVal.toFixed(1)}, variabilidad histórica muy baja, dif: ${diffFormatted})`
          })
        }
      } else {
        const zScore = absDiff / std
        if (zScore >= 1.5) {
          motivos.push({
            categoria: metricName === 'dolor_muscular' ? 'revisar_hoy' : 'revision_prioritaria',
            mensaje: `${label} actual ${val}/10 (ref: ${refVal.toFixed(1)}, dif: ${diffFormatted}, desv: ${zScore.toFixed(1)}σ)`
          })
        } else if (zScore >= 1.0) {
          motivos.push({
            categoria: 'revisar_hoy',
            mensaje: `${label} actual ${val}/10 (ref: ${refVal.toFixed(1)}, dif: ${diffFormatted}, desv: ${zScore.toFixed(1)}σ)`
          })
        } else if (zScore >= 0.5) {
          motivos.push({
            categoria: 'seguimiento_semana',
            mensaje: `${label} actual ${val}/10 (ref: ${refVal.toFixed(1)}, dif: ${diffFormatted}, desv: ${zScore.toFixed(1)}σ)`
          })
        }
      }
    }
  }

  checkMetric('calidad_sueno', 'Sueño', true)
  checkMetric('fatiga', 'Fatiga', false)
  checkMetric('dolor_muscular', 'Dolor muscular', false)
  checkMetric('estres', 'Estrés', false)
  checkMetric('estado_animo', 'Ánimo', true)

  return motivos
}

/**
 * Calcula tendencias desfavorables en los últimos 3 registros válidos ordenados temporalmente.
 */
export function calcularTendenciaIndividual(
  jugadoraId: string,
  wellnessList: Wellness[],
  fechaSeleccionada: string
): MotivoSeguimiento[] {
  const validRecords = wellnessList
    .filter(w => w.id_jugadora === jugadoraId && w.fecha <= fechaSeleccionada && construirEstadoWellnessDia(w) === 'respondió')
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    
  if (validRecords.length < 3) {
    return []
  }

  // Tomamos los últimos 3 registros
  const w3 = validRecords[validRecords.length - 1] // más reciente (día D)
  const w2 = validRecords[validRecords.length - 2] // D-1
  const w1 = validRecords[validRecords.length - 3] // D-2

  const motivos: MotivoSeguimiento[] = []

  const checkTrend = (
    key: keyof Wellness,
    label: string,
    worseIsLower: boolean
  ) => {
    const v1 = w1[key] as number
    const v2 = w2[key] as number
    const v3 = w3[key] as number

    if (v1 === null || v1 === undefined || isNaN(v1)) return
    if (v2 === null || v2 === undefined || isNaN(v2)) return
    if (v3 === null || v3 === undefined || isNaN(v3)) return

    if (worseIsLower) {
      // Empeora = va bajando
      if (v1 >= v2 && v2 >= v3 && v1 > v3 && (v1 - v3) >= 1.0) {
        motivos.push({
          categoria: 'revisar_hoy',
          mensaje: `Tendencia desfavorable en ${label}: ${v1} → ${v2} → ${v3}`
        })
      }
    } else {
      // Empeora = va subiendo
      if (v1 <= v2 && v2 <= v3 && v3 > v1 && (v3 - v1) >= 1.0) {
        motivos.push({
          categoria: 'revisar_hoy',
          mensaje: `Tendencia desfavorable en ${label}: ${v1} → ${v2} → ${v3}`
        })
      }
    }
  }

  checkTrend('calidad_sueno', 'Sueño', true)
  checkTrend('fatiga', 'Fatiga', false)
  checkTrend('dolor_muscular', 'Dolor muscular', false)
  checkTrend('estres', 'Estrés', false)
  checkTrend('estado_animo', 'Ánimo', true)

  return motivos
}

/**
 * Determina la prioridad global basada en la precedencia de sus motivos.
 */
export function clasificarPrioridadSeguimiento(motivos: MotivoSeguimiento[]): NivelSeguimiento {
  if (motivos.some(m => m.categoria === 'revision_prioritaria')) return 'revision_prioritaria'
  if (motivos.some(m => m.categoria === 'revisar_hoy')) return 'revisar_hoy'
  if (motivos.some(m => m.categoria === 'seguimiento_semana')) return 'seguimiento_semana'
  return 'rutinario'
}

/**
 * Construye el estado completo del Panel Hoy para una jugadora individual en una fecha específica.
 */
export function construirPanelHoyJugadora(
  j: Jugadora,
  wellnessList: Wellness[],
  lesionesList: Lesion[],
  alertasList: Alerta[],
  fechaSeleccionada: string,
  historialImportaciones: { derivadosPendientes?: boolean }[] = [],
  referenceTodayStr?: string,
  rpePendiente: boolean = false
): PanelHoyJugadora {
  const wHoy = wellnessList.find(w => w.id_jugadora === j.id_jugadora && w.fecha === fechaSeleccionada) || null
  const estadoWellness = construirEstadoWellnessDia(wHoy)
  
  // Disponibilidad y Lesiones
  const lesionActiva = lesionesList.find(l => l.id_jugadora === j.id_jugadora && !l.disponible) || null
  let disponibilidad = 'Disponible'
  if (lesionActiva) {
    disponibilidad = lesionActiva.disponibilidad || 'No disponible / lesión activa'
  }

  // Calidad de Datos
  const calidadDatos: EstadoCalidadDatos[] = []
  if (estadoWellness === 'pendiente') calidadDatos.push('wellness_pendiente')
  else if (estadoWellness === 'incompleto') calidadDatos.push('wellness_incompleto')

  const ref = calcularReferenciaIndividual(j.id_jugadora, wellnessList, fechaSeleccionada)
  if (!ref) {
    calidadDatos.push('historial_insuficiente')
  }

  const derivadosPendientes = historialImportaciones.some(h => h.derivadosPendientes)
  if (derivadosPendientes) {
    calidadDatos.push('derivados_pendientes')
  }

  if (rpePendiente) {
    calidadDatos.push('rpe_pendiente')
  }

  if (calidadDatos.length === 0) {
    calidadDatos.push('suficiente')
  }

  // Motivos y Prioridades
  const motivos: MotivoSeguimiento[] = []

  // 1. Lesión activa (Siempre revisión prioritaria)
  if (lesionActiva) {
    motivos.push({
      categoria: 'revision_prioritaria',
      mensaje: `Lesión activa (${lesionActiva.tipo}). RTP: ${lesionActiva.fase_rtp || 'N/A'}`
    })
  }

  // 2. Dolor específico hoy (Siempre revisión prioritaria)
  if (wHoy && wHoy.dolor_especifico && wHoy.dolor_especifico.trim() !== '') {
    motivos.push({
      categoria: 'revision_prioritaria',
      mensaje: `Dolor específico reportado: "${wHoy.dolor_especifico}"`
    })
  }

  // 3. Wellness incompleto con dolor específico (Siempre revisión prioritaria)
  if (estadoWellness === 'incompleto' && wHoy && wHoy.dolor_especifico && wHoy.dolor_especifico.trim() !== '') {
    motivos.push({
      categoria: 'revision_prioritaria',
      mensaje: `Cuestionario incompleto acompañado de dolor específico: "${wHoy.dolor_especifico}"`
    })
  } else if (estadoWellness === 'incompleto') {
    motivos.push({
      categoria: 'seguimiento_semana',
      mensaje: `Cuestionario diario incompleto.`
    })
  }

  // 4. Alertas de seguimiento abiertas (Sin llamarlo riesgo ni nivel de lesión)
  const alertasJug = alertasList.filter(a => a.id_jugadora === j.id_jugadora && a.estado === 'abierta')
  alertasJug.forEach(a => {
    const isAlto = a.prioridad === 'alto' || a.nivel === 'alto'
    motivos.push({
      categoria: isAlto ? 'revision_prioritaria' : 'revisar_hoy',
      mensaje: `Alerta abierta: ${a.mensaje}`
    })
  })

  // 5. Historial suficiente -> Evaluar desviaciones y tendencias
  if (ref && wHoy && estadoWellness === 'respondió') {
    const desviaciones = evaluarDesviacionesIndividuales(wHoy, ref)
    motivos.push(...desviaciones)

    const tendencias = calcularTendenciaIndividual(j.id_jugadora, wellnessList, fechaSeleccionada)
    motivos.push(...tendencias)
  }

  // 6. Adherencia y calidad de seguimiento
  const adherencia7d = calcularAdherenciaWellness(j, wellnessList, fechaSeleccionada, 7, referenceTodayStr)
  const adherencia28d = calcularAdherenciaWellness(j, wellnessList, fechaSeleccionada, 28, referenceTodayStr)

  if (estadoWellness !== 'pendiente' && adherencia7d.porcentaje < 75) {
    motivos.push({
      categoria: 'seguimiento_semana',
      mensaje: `Baja adherencia de wellness en 7d (${adherencia7d.fraccion}).`
    })
  }

  const prioridad = clasificarPrioridadSeguimiento(motivos)

  return {
    id_jugadora: j.id_jugadora,
    nombre: j.nombre,
    posicion: j.posicion,
    disponibilidad,
    estadoWellness,
    wellnessActual: wHoy,
    referencia: ref,
    prioridad,
    calidadDatos,
    motivos,
    adherencia7d,
    adherencia28d,
    datosPendientes: calidadDatos.some(c => c !== 'suficiente' && c !== 'historial_insuficiente'),
    derivadosPendientes
  }
}

/**
 * Agrupa y genera el resumen completo del Panel Hoy.
 */
export function construirPanelHoy(
  jugadoras: Jugadora[],
  wellnessList: Wellness[],
  lesionesList: Lesion[],
  alertasList: Alerta[],
  fechaSeleccionada: string,
  historialImportaciones: { derivadosPendientes?: boolean }[] = [],
  referenceTodayStr?: string,
  rpePendientesMap: Record<string, boolean> = {}
): { resumen: PanelHoyResumen; jugadorasPanel: PanelHoyJugadora[] } {
  const activas = jugadoras.filter(j => j.activa !== false)
  
  const jugadorasPanel = activas.map(j =>
    construirPanelHoyJugadora(j, wellnessList, lesionesList, alertasList, fechaSeleccionada, historialImportaciones, referenceTodayStr, rpePendientesMap[j.id_jugadora] || false)
  )

  const pendientesWellness = jugadorasPanel.filter(jp => jp.estadoWellness === 'pendiente').length
  const revisionPrioritariaCount = jugadorasPanel.filter(jp => jp.prioridad === 'revision_prioritaria').length
  const revisarHoyCount = jugadorasPanel.filter(jp => jp.prioridad === 'revisar_hoy').length
  const datosPendientesCount = jugadorasPanel.filter(jp => jp.datosPendientes).length

  const resumen: PanelHoyResumen = {
    fechaOperativa: fechaSeleccionada,
    totalJugadoras: activas.length,
    pendientesWellness,
    revisionPrioritariaCount,
    revisarHoyCount,
    datosPendientesCount
  }

  return {
    resumen,
    jugadorasPanel
  }
}
