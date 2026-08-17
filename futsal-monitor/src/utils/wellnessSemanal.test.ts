import { describe, it, expect } from 'vitest'
import { validarFilaWellness, clasificarFilaImportacion, construirVistaPrevia, type ValidationContext } from './importEngine'
import type { MappedWellnessRow, Wellness, WellnessSemanalImportado, RawImportRow, ColumnMapping } from '@/types'

describe('Wellness Semanal - Regresión y Deduplicación', () => {
  const mockContextDiario: ValidationContext = {
    jugadorasMap: { 'J01': 'Jugadora 1' },
    jugadorasIds: ['J01'],
    aliasesGoogleForms: new Map(),
    temporadaActiva: { id_temporada: 'TEMP1', nombre: 'Temp', fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', actual: true, creada_en: '', terminada_en: null },
    tipoCuestionario: 'DIARIO',
    existingSemanal: []
  }

  const existingRecordSemanal: WellnessSemanalImportado = {
    id: 1, 
    id_jugadora: 'J01', 
    fecha: '2026-07-22', 
    id_temporada: 'TEMP1', 
    origen_alias: '', 
    alias_origen: '', 
    metricas: {}, 
    textos: {}, 
    indice_semanal: null,
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

  const mockContextSemanal: ValidationContext = {
    jugadorasMap: { 'J01': 'Jugadora 1' },
    jugadorasIds: ['J01'],
    aliasesGoogleForms: new Map(),
    temporadaActiva: { id_temporada: 'TEMP1', nombre: 'Temp', fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', actual: true, creada_en: '', terminada_en: null },
    tipoCuestionario: 'SEMANAL',
    existingSemanal: [existingRecordSemanal]
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

  it('Actualización semanal real como ACTUALIZACION_POSIBLE', () => {
    const rawSemanalCambiada: MappedWellnessRow = {
      id_jugadora: 'J01',
      fecha: '2026-07-24', // Misma semana que 2026-07-22
      calidad_sueno: null, fatiga: null, dolor_muscular: null, estres: null, estado_animo: null, dolor_especifico: null, comentario_sesion: null,
      recuperacion_semana: 8,
      sueno_semana: 7,
      estres_fuera: 6,
      energia_semana: 10, // Cambio aquí (5 a 10)
      animo_semana: 9,
      preparada_semana: 8,
      sintomas_menstruales: null,
      dolor_sn: true,
      dolor_texto_semana: 'rodilla',
      actividad_sn: false,
      actividad_texto_semana: null
    }
    
    const estado = clasificarFilaImportacion(rawSemanalCambiada, [], mockContextSemanal)
    expect(estado).toBe('ACTUALIZACION_POSIBLE')
  })

  it('Reimportación idéntica como DUPLICADO_IDENTICO', () => {
    const rawSemanalIdentica: MappedWellnessRow = {
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
    const estado = clasificarFilaImportacion(rawSemanalIdentica, [], mockContextSemanal)
    expect(estado).toBe('DUPLICADO_IDENTICO')
  })

  it('Duplicado semanal dentro del mismo archivo usando dos fechas de la misma semana', () => {
    const rawRows: RawImportRow[] = [
      { id_jugadora: 'J01', fecha: '2026-07-22', recuperacion: 8, dolor: 'Sí' },
      { id_jugadora: 'J01', fecha: '2026-07-24', recuperacion: 9, dolor: 'No' } // Misma semana
    ]
    const mapping: ColumnMapping[] = [
      { internalField: 'id_jugadora', excelHeader: 'id_jugadora', tipo: 'TEXTO' },
      { internalField: 'fecha', excelHeader: 'fecha', tipo: 'FECHA' },
      { internalField: 'recuperacion_semana', excelHeader: 'recuperacion', tipo: 'NUMERO' },
      { internalField: 'dolor_sn', excelHeader: 'dolor', tipo: 'TEXTO' }
    ]

    const result = construirVistaPrevia(rawRows, mapping, [], { 'J01': 'Jugadora 1' }, mockContextSemanal)
    
    // Fila 1 es válida, Fila 2 es ERROR (Duplicado dentro del archivo)
    expect(result.rows[0].estado).not.toBe('ERROR')
    expect(result.rows[1].estado).toBe('ERROR')
    expect(result.rows[1].mensaje).toContain('Duplicado dentro del archivo')
  })

  it('Valor 0, 12 y texto no numérico como errores', () => {
    const testCases = [
      { recuperacion_semana: 0, desc: 'Cero es inválido' },
      { recuperacion_semana: 12, desc: 'Mayor a 10 es inválido' },
      { recuperacion_semana: 'abc', desc: 'Texto es inválido' }
    ]

    for (const tc of testCases) {
      const row = { id_jugadora: 'J01', fecha: '2026-07-20', recuperacion_semana: tc.recuperacion_semana }
      const res = validarFilaWellness(row, mockContextSemanal)
      expect(res.isValid).toBe(false)
      expect(res.errorMsg).toContain('fuera de rango 1-10 o no válido en recuperacion_semana')
    }
  })

  it('Booleano no reconocido como error y parseo resistente', () => {
    // Parseo resistente
    const rowSi = { id_jugadora: 'J01', fecha: '2026-07-20', recuperacion_semana: 5, dolor_sn: 'sí' }
    let res = validarFilaWellness(rowSi, mockContextSemanal)
    expect(res.isValid).toBe(true)
    expect(res.normalRow?.dolor_sn).toBe(true)

    const rowNo = { id_jugadora: 'J01', fecha: '2026-07-20', recuperacion_semana: 5, dolor_sn: 'NO' }
    res = validarFilaWellness(rowNo, mockContextSemanal)
    expect(res.isValid).toBe(true)
    expect(res.normalRow?.dolor_sn).toBe(false)

    // No reconocido
    const rowError = { id_jugadora: 'J01', fecha: '2026-07-20', recuperacion_semana: 5, dolor_sn: 'tal vez' }
    res = validarFilaWellness(rowError, mockContextSemanal)
    expect(res.isValid).toBe(false)
    expect(res.errorMsg).toContain("no reconocido como Sí/No en dolor_sn")
  })

  it('Edición semanal que revalida y reclasifica', () => {
    // Simulando el ciclo: Fila original inválida (0), se edita (8)
    const rowInv = { id_jugadora: 'J01', fecha: '2026-07-20', recuperacion_semana: 0 }
    let res = validarFilaWellness(rowInv, mockContextSemanal)
    expect(res.isValid).toBe(false) // Primero es inválido

    const rowValida = { ...rowInv, recuperacion_semana: 8 }
    res = validarFilaWellness(rowValida, mockContextSemanal)
    expect(res.isValid).toBe(true) // Revalida correctamente
  })
})
