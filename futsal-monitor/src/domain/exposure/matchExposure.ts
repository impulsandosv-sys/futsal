import type { RPE_Partido } from '@/types'
import { isAfter, isBefore, subDays, startOfDay } from 'date-fns'

export interface ExposicionCompetitiva {
  minutos7d: number
  minutos28d: number
  partidosJugados7d: number
  partidosJugados28d: number
  convocatorias7d: number
  convocatorias28d: number
  convocadaSinMinutos7d: number
  convocadaSinMinutos28d: number
  porcentajeExposicion7d: number | null
  referenciaSemanal28d: number | null
  ratioCambioExposicion: number | null
  calidadDato: 'completa' | 'parcial' | 'insuficiente' | 'sin_competicion'
  motivosCalidadDato: string[]
}

/**
 * Calcula la exposición competitiva de una jugadora en ventanas de 7 y 28 días.
 *
 * Reglas:
 * - no_convocada: 0 min, no cuenta como convocatoria ni falta de dato.
 * - convocada_sin_minutos: 0 min, cuenta como convocatoria, no como partido jugado.
 * - parcial/completa/modificada (minutos > 0): cuentan como convocatoria, partido y minutos.
 * - null/inválido: no es 0, degrada la calidad del dato.
 */
export function calcularExposicionCompetitiva(
  registros: RPE_Partido[],
  fechaCorteISO: string
): ExposicionCompetitiva {
  const fechaCorte = startOfDay(new Date(fechaCorteISO))
  const fecha7d = startOfDay(subDays(fechaCorte, 6)) // Ventana inclusiva de 7 días (hoy + 6 atrás)
  const fecha28d = startOfDay(subDays(fechaCorte, 27)) // Ventana inclusiva de 28 días

  const resultado: ExposicionCompetitiva = {
    minutos7d: 0,
    minutos28d: 0,
    partidosJugados7d: 0,
    partidosJugados28d: 0,
    convocatorias7d: 0,
    convocatorias28d: 0,
    convocadaSinMinutos7d: 0,
    convocadaSinMinutos28d: 0,
    porcentajeExposicion7d: null,
    referenciaSemanal28d: null,
    ratioCambioExposicion: null,
    calidadDato: 'completa',
    motivosCalidadDato: []
  }

  // Filtrar registros que caigan en la ventana de 28 días, hasta la fecha de corte inclusiva
  const registros28d = registros.filter(r => {
    const fecha = startOfDay(new Date(r.fecha))
    return (isAfter(fecha, fecha28d) || fecha.getTime() === fecha28d.getTime()) &&
           (isBefore(fecha, fechaCorte) || fecha.getTime() === fechaCorte.getTime())
  })

  let datosIncompletos = false
  let registrosRelevantes = 0 // Partidos donde al menos estaba registrada la jugadora

  for (const r of registros28d) {
    const fecha = startOfDay(new Date(r.fecha))
    const is7d = (isAfter(fecha, fecha7d) || fecha.getTime() === fecha7d.getTime())

    // Evaluar calidad del registro
    const mins = r.minutos_jugados
    let participacion = r.participacion

    registrosRelevantes++

    // Manejo de registros históricos sin participación
    if (!participacion) {
      if (mins === null || mins === undefined) {
        datosIncompletos = true
        resultado.motivosCalidadDato.push(`Partido ${r.id_partido} sin datos de participación ni minutos.`)
        continue
      }

      if (mins === 0) {
        // No inferimos no_convocada ni convocada_sin_minutos
        datosIncompletos = true
        resultado.motivosCalidadDato.push(`Partido ${r.id_partido} con 0 minutos pero sin estado de participación.`)
        continue
      }

      if (mins >= 1 && mins <= 39) {
        participacion = 'parcial' as any
        datosIncompletos = true
        resultado.motivosCalidadDato.push(`Partido ${r.id_partido} inferido como parcial por tener ${mins} minutos.`)
      } else if (mins >= 40) {
        participacion = 'completa' as any
        datosIncompletos = true
        resultado.motivosCalidadDato.push(`Partido ${r.id_partido} inferido como completa por tener ${mins} minutos.`)
      } else {
        datosIncompletos = true
        resultado.motivosCalidadDato.push(`Partido ${r.id_partido} con minutos inválidos (${mins}).`)
        continue
      }
    }

    if (participacion === 'no_convocada') {
      if (mins !== 0) {
        datosIncompletos = true
        resultado.motivosCalidadDato.push(`Registro de partido ${r.id_partido} inconsistente: no_convocada con minutos != 0.`)
      }
      continue // No es convocatoria, no cuenta
    }

    if (participacion === 'convocada_sin_minutos') {
      if (mins !== 0) {
        datosIncompletos = true
        resultado.motivosCalidadDato.push(`Registro de partido ${r.id_partido} inconsistente: convocada_sin_minutos con minutos != 0.`)
        continue
      }

      resultado.convocatorias28d++
      resultado.convocadaSinMinutos28d++
      if (is7d) {
        resultado.convocatorias7d++
        resultado.convocadaSinMinutos7d++
      }
      continue
    }

    // parcial, completa, modificada
    if (
      participacion === 'parcial' ||
      participacion === 'completa' ||
      participacion === 'modificada'
    ) {
      if (mins === null || mins === undefined) {
        datosIncompletos = true
        resultado.motivosCalidadDato.push(`Partido ${r.id_partido} sin datos de minutos.`)
        continue
      }

      resultado.convocatorias28d++
      if (mins > 0) {
        resultado.partidosJugados28d++
        resultado.minutos28d += mins
      } else {
        // Participación modificada con 0 mins o parcial erróneo
        resultado.convocadaSinMinutos28d++
      }

      if (is7d) {
        resultado.convocatorias7d++
        if (mins > 0) {
          resultado.partidosJugados7d++
          resultado.minutos7d += mins
        } else {
          resultado.convocadaSinMinutos7d++
        }
      }
      continue
    }

    // Cualquier otro caso: falta dato
    datosIncompletos = true
    resultado.motivosCalidadDato.push(`Partido ${r.id_partido} con estado inválido o datos ausentes.`)
  }

  // Determinar calidad final
  if (registrosRelevantes === 0 || (resultado.convocatorias28d === 0 && !datosIncompletos)) {
    resultado.calidadDato = 'sin_competicion'
  } else if (datosIncompletos) {
    if (resultado.convocatorias28d > 0) {
      resultado.calidadDato = 'parcial'
    } else {
      resultado.calidadDato = 'insuficiente'
    }
  } else {
    resultado.calidadDato = 'completa'
  }

  // Porcentaje exposición 7d: minutos / (40 * convocatorias) * 100
  if (resultado.convocatorias7d > 0) {
    const minutosPotenciales = resultado.convocatorias7d * 40
    resultado.porcentajeExposicion7d = (resultado.minutos7d / minutosPotenciales) * 100
  }

  // Referencia Semanal 28d
  // Permitir calcular incluso con calidad parcial
  if (resultado.calidadDato === 'completa' || resultado.calidadDato === 'parcial') {
    resultado.referenciaSemanal28d = resultado.minutos28d / 4
  }

  // Ratio de cambio
  if (
    resultado.referenciaSemanal28d !== null &&
    resultado.referenciaSemanal28d > 0
  ) {
    resultado.ratioCambioExposicion = resultado.minutos7d / resultado.referenciaSemanal28d
  }

  return resultado
}
