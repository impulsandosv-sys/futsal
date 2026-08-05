import type { Alerta, Jugadora, Wellness, ResumenSemanal, Lesion, AlertaPrioridad } from '@/types'
import { UMBRALES } from '@/config/monitoringThresholds'
import { parseISO, subDays, format } from 'date-fns'
import { obtenerDetallesWellnessBajo } from '../monitoring/monitoring'

export function calcularNuevasAlertas(
  jugadorasActivas: Jugadora[],
  wellness: Wellness[],
  resumenes: ResumenSemanal[],
  lesiones: Lesion[],
  existentesAlertas: Alerta[],
  hoyStr: string,
  ahoraStr: string
): Alerta[] {
  const alertas: Alerta[] = []

  const activas = jugadorasActivas.filter((j) => j.activa !== false)

  for (const jug of activas) {
    // 1. Alertas de wellness bajo
    const wellnessReciente = wellness
      .filter((w) => w.id_jugadora === jug.id_jugadora && w.fecha <= hoyStr)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))

    if (wellnessReciente.length > 0) {
      const ultimo = wellnessReciente[0]
      if (ultimo.score_wellness < UMBRALES.ALERTAS.WELLNESS_CRITICO) {
        const detalles = obtenerDetallesWellnessBajo(ultimo)
        const descDetalles = detalles ? `. Detalles: ${detalles}` : ''
        alertas.push({
          tipo: 'wellness_bajo',
          prioridad: 'alto',
          id_jugadora: jug.id_jugadora,
          fecha: ultimo.fecha,
          mensaje: `${jug.nombre}: Wellness muy bajo (${ultimo.score_wellness}/10) el ${ultimo.fecha}`,
          nivel: 'alto',
          leida: false,
          creada: ahoraStr,
          fecha_creacion: ahoraStr,
          origen: 'Regla de Bienestar Diario',
          datos_sustento: `Score Wellness: ${ultimo.score_wellness}/10${descDetalles}`,
          estado: 'abierta',
          responsable: '',
          nota_decision: '',
          sugerencia: 'Revisar con la jugadora'
        })
      } else if (ultimo.score_wellness < UMBRALES.ALERTAS.WELLNESS_BAJO) {
        const detalles = obtenerDetallesWellnessBajo(ultimo)
        const descDetalles = detalles ? `. Detalles: ${detalles}` : ''
        alertas.push({
          tipo: 'wellness_bajo',
          prioridad: 'medio',
          id_jugadora: jug.id_jugadora,
          fecha: ultimo.fecha,
          mensaje: `${jug.nombre}: Wellness bajo (${ultimo.score_wellness}/10) el ${ultimo.fecha}`,
          nivel: 'medio',
          leida: false,
          creada: ahoraStr,
          fecha_creacion: ahoraStr,
          origen: 'Regla de Bienestar Diario',
          datos_sustento: `Score Wellness: ${ultimo.score_wellness}/10${descDetalles}`,
          estado: 'abierta',
          responsable: '',
          nota_decision: '',
          sugerencia: 'Revisar con la jugadora'
        })
      }
    }

    // 2. ACWR alto/elevado
    const rsReciente = resumenes
      .filter((rs) => rs.id_jugadora === jug.id_jugadora && (!rs.semana || rs.semana <= hoyStr))
      .sort((a, b) => b.semana.localeCompare(a.semana))

    if (rsReciente.length > 0) {
      const ultimoRS = rsReciente[0]
      if (ultimoRS.acwr >= UMBRALES.ALERTAS.ACWR_ALTO) {
        alertas.push({
          tipo: 'carga_alta',
          prioridad: 'alto',
          id_jugadora: jug.id_jugadora,
          fecha: hoyStr,
          mensaje: `${jug.nombre}: ACWR descriptivo alto (${ultimoRS.acwr.toFixed(2)}) - revisión prioritaria`,
          nivel: 'alto',
          leida: false,
          creada: ahoraStr,
          fecha_creacion: ahoraStr,
          origen: 'Regla de Carga Aguda/Crónica (ACWR)',
          datos_sustento: `ACWR: ${ultimoRS.acwr}, Carga Semanal: ${Math.round(ultimoRS.carga_total)} UA, Crónica: ${Math.round(ultimoRS.carga_cronica)} UA`,
          estado: 'abierta',
          responsable: '',
          nota_decision: '',
          sugerencia: 'Revisar con la jugadora'
        })
      } else if (ultimoRS.acwr >= UMBRALES.ALERTAS.ACWR_ELEVADO) {
        alertas.push({
          tipo: 'carga_alta',
          prioridad: 'medio',
          id_jugadora: jug.id_jugadora,
          fecha: hoyStr,
          mensaje: `${jug.nombre}: ACWR elevado (${ultimoRS.acwr}) - monitorizar carga`,
          nivel: 'medio',
          leida: false,
          creada: ahoraStr,
          fecha_creacion: ahoraStr,
          origen: 'Regla de Carga Aguda/Crónica (ACWR)',
          datos_sustento: `ACWR: ${ultimoRS.acwr}, Carga Semanal: ${Math.round(ultimoRS.carga_total)} UA, Crónica: ${Math.round(ultimoRS.carga_cronica)} UA`,
          estado: 'abierta',
          responsable: '',
          nota_decision: '',
          sugerencia: 'Revisar con la jugadora'
        })
      }
    }

    // 3. Datos faltantes (últimos 3 días sin wellness)
    const todasFechasWellness = new Set(wellnessReciente.map((w) => w.fecha))
    const faltan = []
    const refDate = parseISO(hoyStr)
    for (let i = 1; i <= UMBRALES.ALERTAS.DIAS_FALTANTES_WELLNESS; i++) {
      const d = subDays(refDate, i)
      const fechaStr = format(d, 'yyyy-MM-dd')
      if (!todasFechasWellness.has(fechaStr)) {
        faltan.push(fechaStr)
      }
    }
    if (faltan.length > 0) {
      const pr: AlertaPrioridad = faltan.length >= 3 ? 'alto' : 'medio'
      alertas.push({
        tipo: 'datos_faltantes',
        prioridad: pr,
        id_jugadora: jug.id_jugadora,
        fecha: hoyStr,
        mensaje: `${jug.nombre}: Faltan datos de wellness (${faltan.join(', ')})`,
        nivel: pr,
        leida: false,
        creada: ahoraStr,
        fecha_creacion: ahoraStr,
        origen: 'Regla de Completitud de Wellness',
        datos_sustento: `Faltan registros de wellness para: ${faltan.join(', ')}`,
        estado: 'abierta',
        responsable: '',
        nota_decision: '',
        sugerencia: 'Comprobar completitud de datos'
      })
    }
  }

  // 4. Lesiones activas
  const lesionesActivas = lesiones.filter((l) => !l.disponible)
  for (const les of lesionesActivas) {
    const jug = activas.find((j) => j.id_jugadora === les.id_jugadora)
    if (!jug) continue
    alertas.push({
      tipo: 'lesion',
      prioridad: 'alto',
      id_jugadora: les.id_jugadora,
      fecha: hoyStr,
      mensaje: `${jug.nombre}: Lesionada - ${les.tipo} (${les.localizacion}) - Fase: ${les.fase_rtp}`,
      nivel: 'alto',
      leida: false,
      creada: ahoraStr,
      fecha_creacion: ahoraStr,
      origen: 'Ficha de Lesión',
      datos_sustento: `Tipo: ${les.tipo}, Localización: ${les.localizacion}, Fase RTP: ${les.fase_rtp}`,
      estado: 'abierta',
      responsable: '',
      nota_decision: '',
      sugerencia: 'Consultar estado de disponibilidad con fisio'
    })
  }

  // Deduplicar contra existentes:
  // - No crear alertas si la fecha es futura.
  // - No crear alertas abiertas si ya existe una alerta equivalente abierta o en_revision.
  // - No reabrir alertas resueltas/descartadas para la misma fecha y contexto.
  return alertas.filter((a) => {
    if (a.fecha > hoyStr) return false

    const duplicado = existentesAlertas.some((e) => {
      if (e.id_jugadora !== a.id_jugadora || e.tipo !== a.tipo) return false

      const eEstado = e.estado || (e.leida ? 'resuelta' : 'abierta')
      if (eEstado === 'abierta' || eEstado === 'en_revision') {
        return true
      }
      if ((eEstado === 'resuelta' || eEstado === 'descartada') && e.fecha === a.fecha) {
        return true
      }
      return false
    })

    return !duplicado
  })
}
