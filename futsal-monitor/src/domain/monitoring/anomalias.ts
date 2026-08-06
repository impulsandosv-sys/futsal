import { getTodayLocalISO } from '@/domain/dates/dates'

export type ReglaAnomalia =
  | 'rpe_fuera_de_rango'
  | 'minutos_excesivos'
  | 'minutos_negativos'
  | 'wellness_salto_drastico'
  | 'carga_multiplicador_excesivo'
  | 'fecha_futura'

export interface AnomaliaDetectada {
  regla: ReglaAnomalia
  severidad: 'advertencia' | 'critica'
  mensaje: string
  campoAfectado?: string
  valorRecibido?: any
}

export function detectarAnomalias(datos: Record<string, any>): AnomaliaDetectada[] {
  const anomalias: AnomaliaDetectada[] = []
  const hoyISO = getTodayLocalISO()

  // 1. Fecha futura
  if (datos.fecha && typeof datos.fecha === 'string' && datos.fecha > hoyISO) {
    anomalias.push({
      regla: 'fecha_futura',
      severidad: 'advertencia',
      mensaje: `La fecha ${datos.fecha} es futura respecto a hoy (${hoyISO}).`,
      campoAfectado: 'fecha',
      valorRecibido: datos.fecha,
    })
  }

  // 2. RPE fuera de rango (0-10)
  if (datos.rpe !== undefined && datos.rpe !== null && datos.rpe !== '') {
    const rpeNum = Number(datos.rpe)
    if (isNaN(rpeNum) || rpeNum < 0 || rpeNum > 10) {
      anomalias.push({
        regla: 'rpe_fuera_de_rango',
        severidad: 'critica',
        mensaje: `El valor de RPE (${datos.rpe}) se encuentra fuera del rango válido [0 - 10].`,
        campoAfectado: 'rpe',
        valorRecibido: datos.rpe,
      })
    }
  }

  // 3. Minutos excesivos (>120 en futsal) o negativos (<0)
  if (datos.minutos !== undefined && datos.minutos !== null && datos.minutos !== '') {
    const minNum = Number(datos.minutos)
    if (minNum < 0) {
      anomalias.push({
        regla: 'minutos_negativos',
        severidad: 'critica',
        mensaje: `Los minutos (${datos.minutos}) no pueden ser negativos.`,
        campoAfectado: 'minutos',
        valorRecibido: datos.minutos,
      })
    } else if (minNum > 120) {
      anomalias.push({
        regla: 'minutos_excesivos',
        severidad: 'advertencia',
        mensaje: `La duración de ${datos.minutos} min supera el límite habitual de fútbol sala (120 min).`,
        campoAfectado: 'minutos',
        valorRecibido: datos.minutos,
      })
    }
  }

  // 4. Salto drástico en Wellness (>4 puntos)
  if (datos.score !== undefined && datos.scoreAyer !== undefined) {
    const scoreHoy = Number(datos.score)
    const scoreAyer = Number(datos.scoreAyer)
    if (!isNaN(scoreHoy) && !isNaN(scoreAyer) && Math.abs(scoreHoy - scoreAyer) > 4) {
      anomalias.push({
        regla: 'wellness_salto_drastico',
        severidad: 'advertencia',
        mensaje: `El score de Wellness varía en ${Math.abs(scoreHoy - scoreAyer)} puntos respecto a ayer.`,
        campoAfectado: 'score',
        valorRecibido: datos.score,
      })
    }
  }

  // 5. Pico de carga semanal (>3 veces la semana anterior)
  if (datos.cargaActual !== undefined && datos.cargaAnterior !== undefined) {
    const cAct = Number(datos.cargaActual)
    const cAnt = Number(datos.cargaAnterior)
    if (!isNaN(cAct) && !isNaN(cAnt) && cAnt > 0 && cAct > 3 * cAnt) {
      anomalias.push({
        regla: 'carga_multiplicador_excesivo',
        severidad: 'advertencia',
        mensaje: `La carga semanal (${cAct} UA) triplica la carga de la semana previa (${cAnt} UA).`,
        campoAfectado: 'cargaActual',
        valorRecibido: datos.cargaActual,
      })
    }
  }

  return anomalias
}
