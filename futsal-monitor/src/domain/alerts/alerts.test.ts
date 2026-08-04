import { describe, it, expect } from 'vitest'
import { calcularNuevasAlertas } from './alerts'
import type { Jugadora, Wellness, Alerta } from '@/types'

describe('calcularNuevasAlertas y deduplicación', () => {
  const mockJugadora: Jugadora = {
    id_jugadora: 'J001', nombre: 'Test', fecha_nacimiento: '2000-01-01', posicion: 'Ala',
    altura_cm: 170, peso_kg: 60, imc: 20, grasa: 20, anos_experiencia_futsal: 5, historial_lesional: '', notas: '', activa: true
  }

  // Pre-populate preceding days to avoid "datos_faltantes" alert triggering
  const normalWellnessHistory: Wellness[] = [
    { id_jugadora: 'J001', fecha: '2026-07-12', calidad_sueno: 8, fatiga: 8, dolor_muscular: 8, estres: 8, estado_animo: 8, dolor_especifico: '', score_wellness: 8.0 },
    { id_jugadora: 'J001', fecha: '2026-07-11', calidad_sueno: 8, fatiga: 8, dolor_muscular: 8, estres: 8, estado_animo: 8, dolor_especifico: '', score_wellness: 8.0 },
    { id_jugadora: 'J001', fecha: '2026-07-10', calidad_sueno: 8, fatiga: 8, dolor_muscular: 8, estres: 8, estado_animo: 8, dolor_especifico: '', score_wellness: 8.0 }
  ]

  it('debería generar una alerta con todas las propiedades de revisión requeridas', () => {
    const wellnessList: Wellness[] = [
      { id_jugadora: 'J001', fecha: '2026-07-13', calidad_sueno: 4, fatiga: 4, dolor_muscular: 4, estres: 4, estado_animo: 4, dolor_especifico: '', score_wellness: 4.0 },
      ...normalWellnessHistory
    ]
    const res = calcularNuevasAlertas([mockJugadora], wellnessList, [], [], [], '2026-07-13', '2026-07-13T12:00:00Z')
    const wellnessAlerts = res.filter(a => a.tipo === 'wellness_bajo')
    
    expect(wellnessAlerts).toHaveLength(1)
    expect(wellnessAlerts[0]).toMatchObject({
      tipo: 'wellness_bajo',
      id_jugadora: 'J001',
      prioridad: 'alto',
      estado: 'abierta',
      origen: 'Regla de Bienestar Diario',
      sugerencia: 'Revisar con la jugadora'
    })
    expect(wellnessAlerts[0].datos_sustento).toContain('Score Wellness: 4/10')
    expect(wellnessAlerts[0].fecha_creacion).toBe('2026-07-13T12:00:00Z')
  })

  it('debería evitar alertas duplicadas para la misma jugadora, tipo y fecha/contexto si ya existe una abierta', () => {
    const wellnessList: Wellness[] = [
      { id_jugadora: 'J001', fecha: '2026-07-13', calidad_sueno: 4, fatiga: 4, dolor_muscular: 4, estres: 4, estado_animo: 4, dolor_especifico: '', score_wellness: 4.0 },
      ...normalWellnessHistory
    ]
    const existentes: Alerta[] = [{
      tipo: 'wellness_bajo',
      prioridad: 'alto',
      id_jugadora: 'J001',
      fecha: '2026-07-13',
      mensaje: 'Test: Wellness muy bajo (4/10) el 2026-07-13',
      nivel: 'alto',
      leida: false,
      creada: '2026-07-13T12:00:00Z',
      fecha_creacion: '2026-07-13T12:00:00Z',
      origen: 'Regla de Bienestar Diario',
      datos_sustento: 'Score Wellness: 4/10',
      estado: 'abierta',
      responsable: '',
      nota_decision: '',
      sugerencia: 'Revisar con la jugadora'
    }]
    
    const res = calcularNuevasAlertas([mockJugadora], wellnessList, [], [], existentes, '2026-07-13', '2026-07-13T12:00:00Z')
    // No debería generar otra alerta por ser duplicada de S1 en la misma fecha
    expect(res.filter(a => a.tipo === 'wellness_bajo')).toHaveLength(0)
  })

  it('debería evitar duplicación si la alerta existente está "en_revision"', () => {
    const wellnessList: Wellness[] = [
      { id_jugadora: 'J001', fecha: '2026-07-13', calidad_sueno: 4, fatiga: 4, dolor_muscular: 4, estres: 4, estado_animo: 4, dolor_especifico: '', score_wellness: 4.0 },
      ...normalWellnessHistory
    ]
    const existentes: Alerta[] = [{
      tipo: 'wellness_bajo',
      prioridad: 'alto',
      id_jugadora: 'J001',
      fecha: '2026-07-13',
      mensaje: 'Test: Wellness muy bajo (4/10) el 2026-07-13',
      nivel: 'alto',
      leida: false,
      creada: '2026-07-13T12:00:00Z',
      fecha_creacion: '2026-07-13T12:00:00Z',
      origen: 'Regla de Bienestar Diario',
      datos_sustento: 'Score Wellness: 4/10',
      estado: 'en_revision',
      responsable: 'Preparador Físico',
      nota_decision: 'En revisión clínica',
      sugerencia: 'Revisar con la jugadora'
    }]
    
    const res = calcularNuevasAlertas([mockJugadora], wellnessList, [], [], existentes, '2026-07-13', '2026-07-13T12:00:00Z')
    expect(res.filter(a => a.tipo === 'wellness_bajo')).toHaveLength(0)
  })

  it('debería generar una nueva alerta si la alerta previa existente fue resuelta en una FECHA DIFERENTE', () => {
    const wellnessList: Wellness[] = [
      { id_jugadora: 'J001', fecha: '2026-07-13', calidad_sueno: 4, fatiga: 4, dolor_muscular: 4, estres: 4, estado_animo: 4, dolor_especifico: '', score_wellness: 4.0 },
      ...normalWellnessHistory
    ]
    // Alerta resuelta pero del día anterior (12 de julio)
    const existentes: Alerta[] = [{
      tipo: 'wellness_bajo',
      prioridad: 'alto',
      id_jugadora: 'J001',
      fecha: '2026-07-12',
      mensaje: 'Test: Wellness muy bajo (4/10) el 2026-07-12',
      nivel: 'alto',
      leida: true,
      creada: '2026-07-12T12:00:00Z',
      fecha_creacion: '2026-07-12T12:00:00Z',
      origen: 'Regla de Bienestar Diario',
      datos_sustento: 'Score Wellness: 4/10',
      estado: 'resuelta',
      responsable: 'Staff',
      nota_decision: 'Resuelto ayer',
      sugerencia: 'Revisar con la jugadora'
    }]
    
    const res = calcularNuevasAlertas([mockJugadora], wellnessList, [], [], existentes, '2026-07-13', '2026-07-13T12:00:00Z')
    // Sí debe generar alerta para el día 13
    expect(res.filter(a => a.tipo === 'wellness_bajo')).toHaveLength(1)
  })

  it('debería proponer sugerencias no prescriptivas según el tipo de regla', () => {
    // 1. Datos faltantes -> "Comprobar completitud de datos"
    const resDatos = calcularNuevasAlertas([mockJugadora], [], [], [], [], '2026-07-13', '2026-07-13T12:00:00Z')
    const datosAlert = resDatos.find(a => a.tipo === 'datos_faltantes')
    expect(datosAlert?.sugerencia).toBe('Comprobar completitud de datos')

    // 2. Lesión -> "Consultar estado de disponibilidad con fisio"
    const resLesion = calcularNuevasAlertas(
      [mockJugadora],
      normalWellnessHistory,
      [],
      [{ id_lesion: 'L1', id_jugadora: 'J001', tipo: 'Esguince', localizacion: 'Tobillo', fecha_inicio: '2026-07-13', disponible: false, fase_rtp: 'Fase_2_Movilidad' }],
      [],
      '2026-07-13',
      '2026-07-13T12:00:00Z'
    )
    const lesionAlert = resLesion.find(a => a.tipo === 'lesion')
    expect(lesionAlert?.sugerencia).toBe('Consultar estado de disponibilidad con fisio')
  })
})
