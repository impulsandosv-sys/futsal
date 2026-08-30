import { describe, it, expect, beforeEach, vi } from 'vitest'

const fakeStoreSemanal: any[] = []

vi.mock('@/db/database', () => {
  return {
    db: {
      transaction: async (mode: any, tables: any, cb: () => Promise<any>) => {
        try {
          return await cb()
        } catch (err) {
          console.error("TRANSACTION ERROR:", err)
          throw err
        }
      },
      wellness_semanal_importado: {
        put: async (item: any) => { fakeStoreSemanal.push(item); return 1 },
        where: () => ({
          toArray: async () => fakeStoreSemanal
        }),
        toArray: async () => fakeStoreSemanal,
        clear: async () => { fakeStoreSemanal.length = 0 }
      },
      wellness: {
        put: async () => 1,
        where: () => ({ first: async () => null, toArray: async () => [] }),
        clear: async () => {},
        toArray: async () => []
      },
      wellness_diario_importado: {
        put: async () => 1,
        toArray: async () => []
      },
      historial_importaciones: {
        put: async () => 1
      },
      jugadoras: {
        get: async () => ({ id_jugadora: 'J01', nombre: 'Jugadora 1' })
      },
      temporadas: {
        where: () => ({
          equals: () => ({
            first: () => Promise.resolve(null)
          })
        })
      },
      alias_jugadora: {
        where: () => ({ equals: () => ({ first: async () => null }) })
      },
      sesion_rpe: {
        where: () => ({
          equals: () => ({ toArray: async () => [] }),
          between: () => ({ toArray: async () => [] }),
          toArray: async () => []
        }),
        toArray: async () => []
      },
      partidos: {
        where: () => ({
          equals: () => ({ toArray: async () => [] }),
          between: () => ({ toArray: async () => [] }),
          toArray: async () => []
        }),
        toArray: async () => []
      },
      resumen_semanal: {
        where: () => ({
          equals: () => ({ first: async () => null, toArray: async () => [] }),
          toArray: async () => []
        }),
        put: async () => 1
      },
      readiness: {
        where: () => ({
          equals: () => ({ toArray: async () => [], first: async () => null }),
          toArray: async () => [],
          first: async () => null
        }),
        put: async () => 1
      },
      rpe_partido: {
        where: () => ({
          equals: () => ({ toArray: async () => [] }),
          toArray: async () => []
        }),
        toArray: async () => []
      },
      sesiones: {
        toArray: async () => []
      },
      lesiones: {
        where: () => ({ toArray: async () => [] }),
        toArray: async () => []
      }
    }
  }
})

import { validarFilaWellness, clasificarFilaImportacion, type ValidationContext, aplicarImportacionWellness } from './importEngine'
import type { MappedWellnessRow, WellnessSemanalImportado, PreviewRow } from '@/types'
import { db } from '@/db/database'

describe('Wellness Semanal - Regresión y Deduplicación Real', () => {
  beforeEach(async () => {
    // Limpiar BD antes de cada test para la prueba de integración
    await db.wellness_semanal_importado.clear()
    await db.wellness.clear()
  })

  const mockContextDiario: ValidationContext = {
    jugadorasMap: { 'J01': 'Jugadora 1' },
    jugadorasIds: ['J01'],
    aliasesGoogleForms: new Map(),
    temporadaActiva: { id_temporada: 'TEMP1', nombre: 'Temp', fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', actual: true, creada_en: '', terminada_en: null },
    tipoCuestionario: 'DIARIO',
    existingSemanal: []
  }

  // Registro realista con datos exclusivamente en metricas y textos
  const existingRecordSemanalReal: WellnessSemanalImportado = {
    id: 1,
    id_jugadora: 'J01',
    fecha: '2026-07-22',
    id_temporada: 'TEMP1',
    origen_alias: '',
    alias_origen: '',
    indice_semanal: null,
    metricas: {
      '¿Cómo valorarías tu recuperación general esta semana?': { original: 8, normalizado: 8 },
      '¿Cómo ha sido la calidad de tu sueño esta semana?': { original: 7, normalizado: 7 },
      '¿Cómo ha sido tu nivel de estrés fuera del fútbol sala?': { original: 6, normalizado: 6 },
      '¿Cómo ha sido tu energía durante los entrenamientos y el partido?': { original: 5, normalizado: 5 },
      '¿Cómo valorarías tu estado de ánimo esta semana?': { original: 9, normalizado: 9 },
      '¿Cómo de preparada te sientes para competir la próxima semana?': { original: 8, normalizado: 8 },
      'Si eres mujer, ¿los síntomas menstruales han afectado tu rendimiento o bienestar esta semana?': { original: null, normalizado: null },
      '¿Has tenido dolor, molestia o rigidez que haya limitado algo esta semana?': { original: true, normalizado: true },
      '¿Has realizado actividad física importante adicional al trabajo con el equipo?': { original: false, normalizado: false }
    },
    textos: {
      '¿Has tenido dolor, molestia o rigidez que haya limitado algo esta semana?': 'rodilla'
    }
  }

  const mockContextSemanal: ValidationContext = {
    jugadorasMap: { 'J01': 'Jugadora 1' },
    jugadorasIds: ['J01'],
    aliasesGoogleForms: new Map(),
    temporadaActiva: { id_temporada: 'TEMP1', nombre: 'Temp', fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', actual: true, creada_en: '', terminada_en: null },
    tipoCuestionario: 'SEMANAL',
    existingSemanal: [existingRecordSemanalReal]
  }

  const rawSemanalBase: MappedWellnessRow = {
    id_jugadora: 'J01',
    fecha: '2026-07-24', // Misma semana
    calidad_sueno: null, fatiga: null, dolor_muscular: null, estres: null, estado_animo: null, dolor_especifico: null, comentario_sesion: null,
    recuperacion_semana: 8,
    sueno_semana: 7,
    estres_fuera: 6,
    energia_semana: 5,
    animo_semana: 9,
    preparada_semana: 8,
    sintomas_menstruales: null,
    dolor_sn: true,
    dolor_texto_semana: 'rodilla',
    actividad_sn: false,
    actividad_texto_semana: null
  }

  it('Garantía de no regresión en la importación diaria previa', () => {
    const rawDiario = {
      id_jugadora: 'J01',
      fecha: '2026-07-20',
      calidad_sueno: 8,
      fatiga: 3,
      dolor_muscular: 2,
      estres: 1,
      estado_animo: 9
    }
    const res = validarFilaWellness(rawDiario, mockContextDiario)
    expect(res.isValid).toBe(true)
    expect(res.normalRow?.calidad_sueno).toBe(8)
  })

  // 1. Reimportación idéntica de escala, booleanos y textos -> DUPLICADO_IDENTICO.
  it('1. Reimportación idéntica de escala, booleanos y textos como DUPLICADO_IDENTICO', () => {
    const estado = clasificarFilaImportacion({ ...rawSemanalBase }, [], mockContextSemanal)
    expect(estado).toBe('DUPLICADO_IDENTICO')
  })

  // 2. Cambio de una escala -> ACTUALIZACION_POSIBLE.
  it('2. Cambio de una escala como ACTUALIZACION_POSIBLE', () => {
    const row = { ...rawSemanalBase, energia_semana: 10 }
    const estado = clasificarFilaImportacion(row, [], mockContextSemanal)
    expect(estado).toBe('ACTUALIZACION_POSIBLE')
  })

  // 3. Cambio de dolor_sn: false a true -> ACTUALIZACION_POSIBLE.
  it('3. Cambio de dolor_sn boolean -> ACTUALIZACION_POSIBLE', () => {
    const row = { ...rawSemanalBase, dolor_sn: false } // Original es true
    const estado = clasificarFilaImportacion(row, [], mockContextSemanal)
    expect(estado).toBe('ACTUALIZACION_POSIBLE')
  })

  // 4. Cambio de texto de dolor -> ACTUALIZACION_POSIBLE.
  it('4. Cambio de texto de dolor -> ACTUALIZACION_POSIBLE', () => {
    const row = { ...rawSemanalBase, dolor_texto_semana: 'tobillo' } // Original es rodilla
    const estado = clasificarFilaImportacion(row, [], mockContextSemanal)
    expect(estado).toBe('ACTUALIZACION_POSIBLE')
  })

  // 5. Texto vacío, null y undefined tratados de forma consistente.
  it('5. Texto vacío, null y undefined tratados de forma consistente', () => {
    // actividad_texto_semana es null en persistencia
    const rowUndefined = { ...rawSemanalBase, actividad_texto_semana: undefined }
    expect(clasificarFilaImportacion(rowUndefined, [], mockContextSemanal)).toBe('DUPLICADO_IDENTICO')

    const rowEmpty = { ...rawSemanalBase, actividad_texto_semana: '   ' }
    expect(clasificarFilaImportacion(rowEmpty, [], mockContextSemanal)).toBe('DUPLICADO_IDENTICO')

    const rowNull = { ...rawSemanalBase, actividad_texto_semana: null }
    expect(clasificarFilaImportacion(rowNull, [], mockContextSemanal)).toBe('DUPLICADO_IDENTICO')
  })

  // 6. Dos fechas diferentes de la misma semana siguen comparándose contra el mismo registro semanal.
  it('6. Dos fechas diferentes de la misma semana comparan contra el mismo registro', () => {
    const rawMonday = { ...rawSemanalBase, fecha: '2026-07-20' } // Lunes
    const rawSunday = { ...rawSemanalBase, fecha: '2026-07-26' } // Domingo

    expect(clasificarFilaImportacion(rawMonday, [], mockContextSemanal)).toBe('DUPLICADO_IDENTICO')
    expect(clasificarFilaImportacion(rawSunday, [], mockContextSemanal)).toBe('DUPLICADO_IDENTICO')
  })

  // 7. Prueba de integración: guardar primero un cuestionario semanal y después construir la vista previa.
  it('7. Integración: aplicarImportacionWellness y construirVistaPrevia producen DUPLICADO_IDENTICO', async () => {
    const validRow: PreviewRow = {
      ...rawSemanalBase,
      filaOriginal: 2,
      estado: 'NUEVO',
      mensaje: 'OK',
      normalRow: rawSemanalBase
    }

    // Guardar
    const backupName = 'backup_test'
    const outcome = await aplicarImportacionWellness(
      [validRow],
      'add_new',
      'test.xlsx',
      'Hoja1',
      'Mapeo 1',
      backupName,
      'SEMANAL',
      undefined,
      db
    )
    if (!outcome.success) {
      console.log('OUTCOME ERROR:', outcome)
    }
    expect(outcome.success).toBe(true)

    // Recargar contexto de BD (simulando lo que hace obtenerContextoValidacionWellness)
    const existingDeBD = await db.wellness_semanal_importado.toArray()
    expect(existingDeBD.length).toBe(1)

    const contextRefresh: ValidationContext = {
      ...mockContextSemanal,
      existingSemanal: existingDeBD
    }

    // Para probarlo realmente, usamos clasificarFilaImportacion (que es lo que usa construirVistaPrevia)
    const previewState = clasificarFilaImportacion(rawSemanalBase, [], contextRefresh)
    expect(previewState).toBe('DUPLICADO_IDENTICO')
  })
})
