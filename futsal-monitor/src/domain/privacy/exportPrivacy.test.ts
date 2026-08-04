import { describe, it, expect } from 'vitest'
import {
  construirDTOStaffResumenSemanal,
  construirDTOStaffSeguimientoDiario,
  construirDatosStaffPDFResumen
} from './exportPrivacy'

describe('T-03 — Dominio exportPrivacy: DTOs Staff con Allowlist Positiva', () => {
  const fixtureEntidadInterna = Object.freeze({
    id_jugadora: 'JUG-001',
    nombre: 'Ana López',
    posicion: 'Ala',
    semana: '2026-W28',
    carga_entreno: 500,
    carga_partido: 200,
    carga_total: 700,
    carga_cronica: 650,
    acwr: 1.08,
    wellness_medio: 78,
    num_sesiones: 4,
    estado: 'Óptimo',
    disponibilidad: 'disponible',
    estadoWellness: 'normal',
    prioridad: 'baja',
    motivos: 'RPE acumulado',
    adherencia7d: '7/7',
    adherencia28d: '28/28',
    // DATOS SENSIBLES PROHIBIDOS
    dolor_especifico: 'Dolor punzante en cuádriceps derecho',
    comentario_wellness: 'Siento mucha ansiedad antes del partido',
    ciclo_menstrual: { fase: 'Lútea', dia: 22, sintomas: ['cólicos'] },
    fase_ciclo: 'Lútea',
    test_psicologico: { POMS_score: 45, estado: 'Estrés elevado' },
    diagnostico: 'Microtrauma en recto anterior',
    comentario_fisio_medico: 'Reposo relativo 48h',
    nota_nueva_no_clasificada: 'Texto libre confidencial no autorizado'
  })

  it('1. construirDTOStaffResumenSemanal retorna un array con solo las propiedades permitidas', () => {
    const rawList = [fixtureEntidadInterna]
    const dtos = construirDTOStaffResumenSemanal(rawList as any)

    expect(dtos).toHaveLength(1)
    const dto = dtos[0]

    expect(dto).toEqual({
      Semana: '2026-W28',
      Jugadora: 'Ana López',
      'Carga Entreno': 500,
      'Carga Partido': 200,
      'Carga Total': 700,
      'Carga Crónica': 650,
      ACWR: 1.08,
      Wellness: 78,
      Sesiones: 4,
      Estado: 'Óptimo'
    })
  })

  it('2. construirDTOStaffSeguimientoDiario excluye dolor_especifico y observaciones libres', () => {
    const rawList = [fixtureEntidadInterna]
    const dtos = construirDTOStaffSeguimientoDiario(rawList as any)

    expect(dtos).toHaveLength(1)
    const dto = dtos[0]

    expect(dto).toEqual({
      Jugadora: 'Ana López',
      Posicion: 'Ala',
      Disponibilidad: 'disponible',
      EstadoWellness: 'normal',
      Prioridad: 'baja',
      Motivos: 'RPE acumulado',
      Adherencia7d: '7/7',
      Adherencia28d: '28/28'
    })

    // Verificar que NINGUNA propiedad prohibida exista en el DTO
    expect(dto).not.toHaveProperty('dolor_especifico')
    expect(dto).not.toHaveProperty('comentario_wellness')
    expect(dto).not.toHaveProperty('ciclo_menstrual')
    expect(dto).not.toHaveProperty('diagnostico')
    expect(dto).not.toHaveProperty('nota_nueva_no_clasificada')
  })

  it('3. JSON.stringify(dtoStaff) no contiene ninguna clave ni valor sensible', () => {
    const dtosResumen = construirDTOStaffResumenSemanal([fixtureEntidadInterna] as any)
    const dtosSeguimiento = construirDTOStaffSeguimientoDiario([fixtureEntidadInterna] as any)

    const jsonResumen = JSON.stringify(dtosResumen)
    const jsonSeguimiento = JSON.stringify(dtosSeguimiento)

    const cadenasProhibidas = [
      'Dolor punzante',
      'ansiedad',
      'Lútea',
      'POMS_score',
      'Microtrauma',
      'Reposo relativo',
      'confidencial',
      'dolor_especifico',
      'comentario_wellness',
      'ciclo_menstrual',
      'test_psicologico',
      'diagnostico',
      'nota_nueva_no_clasificada'
    ]

    for (const cadena of cadenasProhibidas) {
      expect(jsonResumen).not.toContain(cadena)
      expect(jsonSeguimiento).not.toContain(cadena)
    }
  })

  it('4. construirDatosStaffPDFResumen genera el objeto estructurado para el reporte PDF', () => {
    const pdfData = construirDatosStaffPDFResumen('2026-W28', [fixtureEntidadInterna] as any)

    expect(pdfData.semana).toBe('2026-W28')
    expect(pdfData.titulo).toContain('2026-W28')
    expect(pdfData.notaPrivacidad).toContain('Versión staff')
    expect(pdfData.filas).toHaveLength(1)
    expect(pdfData.filas[0].Jugadora).toBe('Ana López')
  })
})
