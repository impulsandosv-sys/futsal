import { db } from '@/db/database'
import type { FutsalDB } from '@/db/database'
import type { RawCellValue, RawImportRow, WellnessDiarioImportado, WellnessSemanalImportado } from '@/types'
import {
  DAILY_TEXT_FIELDS,
  DAILY_WELLNESS_FIELDS,
  WEEKLY_MENSTRUAL_FIELD,
  WEEKLY_TEXT_FIELDS,
  WELLNESS_WEEKLY_FIELD_MAP,
  calcularIndiceDiario,
  calcularIndiceSemanal,
  normalizarSintomasMenstruales,
  normalizarValor,
  normalizarCabecera
} from '@/domain/monitoring/wellnessScale'
import { getWeekId } from '@/domain/dates/dates'
import { resolverIdentidadFilaWellness, validarRangoTemporadaWellness } from '@/domain/imports/wellnessIdentity'
import { obtenerTemporadaActiva } from '@/domain/temporadas/temporadas'
import { normalizarFecha, parseCSVString, extraerEscala } from '@/utils/importEngine'
import * as readinessService from '@/services/readiness'
import * as resumenSemanalService from '@/services/resumenSemanal'

export type TipoCuestionarioWellness = 'DIARIO' | 'SEMANAL'

export interface FilaWellnessProcesada {
  tipo: TipoCuestionarioWellness
  id_jugadora: string
  fecha: string
  id_temporada?: string
  alias_origen?: string
  metricas: Record<string, { original: number | null; normalizado: number | null }>
  textos: Record<string, string>
  indice: number | null
}

export interface ImportacionCSVWellnessResultado {
  tipo: TipoCuestionarioWellness
  totalFilas: number
  importadas: number
  errores: number
  detallesErrores: string[]
}

function parsearNumeroRaw(valorRaw: unknown): number | null {
  if (valorRaw === null || valorRaw === undefined || String(valorRaw).trim() === '') return null
  const comoEscala = extraerEscala(valorRaw as RawCellValue)
  if (typeof comoEscala === 'number' && Number.isFinite(comoEscala)) return comoEscala
  const num = Number(String(valorRaw).replace(',', '.').trim())
  return Number.isFinite(num) ? num : null
}

function leerCampo(row: RawImportRow, candidatos: string[]): RawCellValue {
  for (const key of candidatos) {
    if (row[key] !== undefined) return row[key] as RawCellValue
  }
  return undefined
}

export function detectarTipoCuestionario(headers: string[]): TipoCuestionarioWellness {
  const normHeaders = headers.map(normalizarCabecera)
  
  const dailyHeaders = Object.keys(DAILY_WELLNESS_FIELDS).map(normalizarCabecera)
  const weeklyHeaders = Object.keys(WELLNESS_WEEKLY_FIELD_MAP).map(normalizarCabecera)
  
  const tieneDiario = dailyHeaders.every((k) => normHeaders.includes(k))
  const tieneSemanal = weeklyHeaders.some((k) => normHeaders.includes(k))
  
  if (tieneDiario && tieneSemanal) {
    throw new Error('CSV ambiguo: mezcla cabeceras de cuestionario diario y semanal')
  }
  
  if (tieneDiario) return 'DIARIO'
  if (tieneSemanal) return 'SEMANAL'
  
  throw new Error('Formato de cuestionario no reconocido (cabeceras: ' + headers.join(', ') + ')')
}

export function procesarFilaWellness(
  tipo: TipoCuestionarioWellness,
  row: RawImportRow,
  id_jugadora: string,
  fecha: string,
  id_temporada?: string,
  alias_origen?: string
): FilaWellnessProcesada {
  const metricas: Record<string, { original: number | null; normalizado: number | null }> = {}
  const textos: Record<string, string> = {}

  if (tipo === 'DIARIO') {
    for (const [header, tipoEscala] of Object.entries(DAILY_WELLNESS_FIELDS)) {
      const original = parsearNumeroRaw(row[header])
      metricas[header] = {
        original,
        normalizado: original === null ? null : normalizarValor(original, tipoEscala)
      }
    }
    for (const texto of DAILY_TEXT_FIELDS) {
      const raw = row[texto]
      if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
        textos[texto] = String(raw).trim()
      }
    }
    return {
      tipo,
      id_jugadora,
      fecha,
      id_temporada,
      alias_origen,
      metricas,
      textos,
      indice: calcularIndiceDiario(metricas)
    }
  }

  for (const [header, tipoEscala] of Object.entries(WELLNESS_WEEKLY_FIELD_MAP)) {
    const original = parsearNumeroRaw(row[header])
    let normalizado: number | null = null
    if (original !== null) {
      normalizado = header === WEEKLY_MENSTRUAL_FIELD
        ? normalizarSintomasMenstruales(original)
        : normalizarValor(original, tipoEscala)
    }
    metricas[header] = { original, normalizado }
  }

  for (const texto of WEEKLY_TEXT_FIELDS) {
    const raw = row[texto]
    if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
      textos[texto] = String(raw).trim()
    }
  }

  return {
    tipo,
    id_jugadora,
    fecha,
    id_temporada,
    alias_origen,
    metricas,
    textos,
    indice: calcularIndiceSemanal(metricas)
  }
}

export async function importarCSVWellnessGoogleForms(
  csvContent: string,
  dbInstance: FutsalDB = db
): Promise<ImportacionCSVWellnessResultado> {
  const rows = parseCSVString(csvContent)
  if (rows.length === 0) {
    throw new Error('El CSV no contiene filas para importar')
  }

  const headers = Object.keys(rows[0])
  const tipo = detectarTipoCuestionario(headers)

  const detallesErrores: string[] = []
  let importadas = 0

  try {
    await dbInstance.transaction(
      'rw',
      [
        dbInstance.jugadoras,
        dbInstance.alias_jugadora,
        dbInstance.temporadas,
        dbInstance.wellness_diario_importado,
        dbInstance.wellness_semanal_importado,
        dbInstance.wellness,
        dbInstance.readiness,
        dbInstance.resumen_semanal,
        dbInstance.alertas,
        dbInstance.lesiones,
        dbInstance.partidos,
        dbInstance.sesiones,
        dbInstance.rpe_partido,
        dbInstance.sesion_rpe,
        dbInstance.tests_fisicos,
        dbInstance.carga_gps,
        dbInstance.fuerza_vbt,
        dbInstance.ciclo_menstrual,
        dbInstance.hidratacion
      ],
      async () => {
        for (let idx = 0; idx < rows.length; idx++) {
          const row = rows[idx]
          const fila = idx + 2
          try {
            const idRaw = leerCampo(row, ['ID jugadora', 'ID_Jugadora', 'id_jugadora'])
            const identidad = await resolverIdentidadFilaWellness(dbInstance, idRaw, 'google_forms')
            if (!identidad.exito || !identidad.id_jugadora) {
              throw new Error(identidad.mensajeError || 'No se pudo resolver la identidad de la jugadora')
            }

            const fechaRaw = leerCampo(row, ['Fecha', 'fecha', 'Marca temporal', 'marca_temporal'])
            const fecha = normalizarFecha(fechaRaw)
            if (!fecha) {
              throw new Error(`Fecha inválida en fila ${fila}`)
            }

            const temporadaActiva = await obtenerTemporadaActiva(dbInstance)
            const validacionTemporada = validarRangoTemporadaWellness(fecha, temporadaActiva || null)
            if (!validacionTemporada.exito) {
              throw new Error(validacionTemporada.mensajeError || 'Fecha fuera de temporada')
            }

            const procesada = procesarFilaWellness(
              tipo,
              row,
              identidad.id_jugadora,
              fecha,
              validacionTemporada.id_temporada,
              identidad.alias_origen
            )

            if (tipo === 'DIARIO') {
              const diario: WellnessDiarioImportado = {
                id_jugadora: procesada.id_jugadora,
                fecha: procesada.fecha,
                id_temporada: procesada.id_temporada,
                origen_alias: 'google_forms',
                alias_origen: procesada.alias_origen,
                metricas: procesada.metricas,
                textos: procesada.textos,
                indice_diario: procesada.indice
              }
              await dbInstance.wellness_diario_importado.put(diario)

              const calidadSueno = procesada.metricas['Calidad de sueño']?.original
              const fatiga = procesada.metricas['Fatiga']?.original
              const dolorMuscular = procesada.metricas['Dolor muscular']?.original
              const estres = procesada.metricas['Estrés']?.original
              const estadoAnimo = procesada.metricas['Estado de ánimo']?.original

              if (
                calidadSueno !== null &&
                fatiga !== null &&
                dolorMuscular !== null &&
                estres !== null &&
                estadoAnimo !== null &&
                procesada.indice !== null
              ) {
                await dbInstance.wellness.put({
                  id_jugadora: procesada.id_jugadora,
                  fecha: procesada.fecha,
                  calidad_sueno: calidadSueno,
                  fatiga,
                  dolor_muscular: dolorMuscular,
                  estres,
                  estado_animo: estadoAnimo,
                  dolor_especifico: procesada.textos['Dolor especifico o nota importante (opcional)'] || '',
                  score_wellness: procesada.indice,
                  id_temporada: procesada.id_temporada,
                  origen_alias: 'google_forms',
                  alias_origen: procesada.alias_origen
                })

                await readinessService.recalcularReadinessJugadora(procesada.id_jugadora, procesada.fecha, dbInstance)
                await resumenSemanalService.recalcularResumenSemanal(
                  procesada.id_jugadora,
                  getWeekId(procesada.fecha),
                  undefined,
                  dbInstance
                )
              }
            } else {
              const semanal: WellnessSemanalImportado = {
                id_jugadora: procesada.id_jugadora,
                fecha: procesada.fecha,
                id_temporada: procesada.id_temporada,
                origen_alias: 'google_forms',
                alias_origen: procesada.alias_origen,
                metricas: procesada.metricas,
                textos: procesada.textos,
                indice_semanal: procesada.indice
              }
              await dbInstance.wellness_semanal_importado.put(semanal)
            }

            importadas++
          } catch (error: any) {
            detallesErrores.push(`Fila ${fila}: ${error?.message || 'Error no identificado'}`)
          }
        }
        
        if (detallesErrores.length > 0) {
          importadas = 0 // Rollback occurs
          throw new Error('ROLLBACK_DUE_TO_ERRORS')
        }
      }
    )
  } catch (err: any) {
    if (err.message !== 'ROLLBACK_DUE_TO_ERRORS' && detallesErrores.length === 0) {
      throw err
    }
    // Si fue ROLLBACK_DUE_TO_ERRORS, los errores ya están en detallesErrores y se devuelve el resultado normal
  }

  return {
    tipo,
    totalFilas: rows.length,
    importadas,
    errores: detallesErrores.length,
    detallesErrores
  }
}
