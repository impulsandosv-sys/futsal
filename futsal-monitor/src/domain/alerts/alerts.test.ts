import { describe, it, expect } from 'vitest'
import { calcularNuevasAlertas } from './alerts'
import type { Jugadora, Wellness, Alerta } from '@/types'

describe('Bloque B - calcularNuevasAlertas, idempotencia y reglas de actividad', () => {
  const jugActiva: Jugadora = {
    id_jugadora: 'J001', nombre: 'Ana Activa', fecha_nacimiento: '2000-01-01', posicion: 'Ala',
    altura_cm: 170, peso_kg: 60, imc: 20, grasa: 20, anos_experiencia_futsal: 5, historial_lesional: '', notas: '', activa: true
  }

  const jugInactiva: Jugadora = {
    id_jugadora: 'J002', nombre: 'Bea Inactiva', fecha_nacimiento: '2000-01-01', posicion: 'Pivot',
    altura_cm: 168, peso_kg: 58, imc: 20.5, grasa: 18, anos_experiencia_futsal: 4, historial_lesional: '', notas: '', activa: false
  }

  const jugSinCampoActiva: Jugadora = {
    id_jugadora: 'J003', nombre: 'Clara SinCampo', fecha_nacimiento: '2000-01-01', posicion: 'Cierre',
    altura_cm: 165, peso_kg: 55, imc: 20.2, grasa: 19, anos_experiencia_futsal: 3, historial_lesional: '', notas: ''
    // activa: undefined
  }

  const normalWellnessHistory = (id: string): Wellness[] => [
    { id_jugadora: id, fecha: '2026-07-12', calidad_sueno: 8, fatiga: 8, dolor_muscular: 8, estres: 8, estado_animo: 8, dolor_especifico: '', score_wellness: 8.0 },
    { id_jugadora: id, fecha: '2026-07-11', calidad_sueno: 8, fatiga: 8, dolor_muscular: 8, estres: 8, estado_animo: 8, dolor_especifico: '', score_wellness: 8.0 },
    { id_jugadora: id, fecha: '2026-07-10', calidad_sueno: 8, fatiga: 8, dolor_muscular: 8, estres: 8, estado_animo: 8, dolor_especifico: '', score_wellness: 8.0 }
  ]

  it('1. Jugadora activa: true es incluida en la generación de alertas', () => {
    const wellnessList: Wellness[] = [
      { id_jugadora: 'J001', fecha: '2026-07-13', calidad_sueno: 3, fatiga: 3, dolor_muscular: 3, estres: 3, estado_animo: 3, dolor_especifico: '', score_wellness: 3.0 },
      ...normalWellnessHistory('J001')
    ]
    const res = calcularNuevasAlertas([jugActiva], wellnessList, [], [], [], '2026-07-13', '2026-07-13T12:00:00Z')
    expect(res.some(a => a.id_jugadora === 'J001')).toBe(true)
  })

  it('2. Jugadora activa: false es excluida de la generación de alertas', () => {
    const wellnessList: Wellness[] = [
      { id_jugadora: 'J002', fecha: '2026-07-13', calidad_sueno: 3, fatiga: 3, dolor_muscular: 3, estres: 3, estado_animo: 3, dolor_especifico: '', score_wellness: 3.0 },
      ...normalWellnessHistory('J002')
    ]
    const res = calcularNuevasAlertas([jugInactiva], wellnessList, [], [], [], '2026-07-13', '2026-07-13T12:00:00Z')
    expect(res.some(a => a.id_jugadora === 'J002')).toBe(false)
  })

  it('3. Jugadora sin campo activa (undefined) es incluida por compatibilidad', () => {
    const wellnessList: Wellness[] = [
      { id_jugadora: 'J003', fecha: '2026-07-13', calidad_sueno: 3, fatiga: 3, dolor_muscular: 3, estres: 3, estado_animo: 3, dolor_especifico: '', score_wellness: 3.0 },
      ...normalWellnessHistory('J003')
    ]
    const res = calcularNuevasAlertas([jugSinCampoActiva], wellnessList, [], [], [], '2026-07-13', '2026-07-13T12:00:00Z')
    expect(res.some(a => a.id_jugadora === 'J003')).toBe(true)
  })

  it('4. Dos escaneos consecutivos no duplican una alerta abierta equivalente', () => {
    const wellnessList: Wellness[] = [
      { id_jugadora: 'J001', fecha: '2026-07-13', calidad_sueno: 3, fatiga: 3, dolor_muscular: 3, estres: 3, estado_animo: 3, dolor_especifico: '', score_wellness: 3.0 },
      ...normalWellnessHistory('J001')
    ]

    const primerEscaneo = calcularNuevasAlertas([jugActiva], wellnessList, [], [], [], '2026-07-13', '2026-07-13T12:00:00Z')
    expect(primerEscaneo).toHaveLength(1)

    const segundoEscaneo = calcularNuevasAlertas([jugActiva], wellnessList, [], [], primerEscaneo, '2026-07-13', '2026-07-13T12:05:00Z')
    expect(segundoEscaneo).toHaveLength(0)
  })

  it('5. Alerta resuelta: no se reabre para la misma fecha y contexto', () => {
    const wellnessList: Wellness[] = [
      { id_jugadora: 'J001', fecha: '2026-07-13', calidad_sueno: 3, fatiga: 3, dolor_muscular: 3, estres: 3, estado_animo: 3, dolor_especifico: '', score_wellness: 3.0 },
      ...normalWellnessHistory('J001')
    ]
    const existentes: Alerta[] = [{
      tipo: 'wellness_bajo',
      prioridad: 'alto',
      id_jugadora: 'J001',
      fecha: '2026-07-13',
      mensaje: 'Wellness bajo el 2026-07-13',
      nivel: 'alto',
      leida: true,
      creada: '2026-07-13T12:00:00Z',
      fecha_creacion: '2026-07-13T12:00:00Z',
      origen: 'Regla de Bienestar Diario',
      datos_sustento: 'Score: 3/10',
      estado: 'resuelta',
      responsable: 'PF',
      nota_decision: 'Hablado con la jugadora',
      sugerencia: 'Revisar con la jugadora'
    }]

    const res = calcularNuevasAlertas([jugActiva], wellnessList, [], [], existentes, '2026-07-13', '2026-07-13T12:10:00Z')
    expect(res).toHaveLength(0)
  })

  it('6. Alerta descartada: no se reabre para la misma fecha y contexto', () => {
    const wellnessList: Wellness[] = [
      { id_jugadora: 'J001', fecha: '2026-07-13', calidad_sueno: 3, fatiga: 3, dolor_muscular: 3, estres: 3, estado_animo: 3, dolor_especifico: '', score_wellness: 3.0 },
      ...normalWellnessHistory('J001')
    ]
    const existentes: Alerta[] = [{
      tipo: 'wellness_bajo',
      prioridad: 'alto',
      id_jugadora: 'J001',
      fecha: '2026-07-13',
      mensaje: 'Wellness bajo el 2026-07-13',
      nivel: 'alto',
      leida: false,
      creada: '2026-07-13T12:00:00Z',
      fecha_creacion: '2026-07-13T12:00:00Z',
      origen: 'Regla de Bienestar Diario',
      datos_sustento: 'Score: 3/10',
      estado: 'descartada',
      responsable: 'PF',
      nota_decision: 'Falso positivo',
      sugerencia: 'Revisar con la jugadora'
    }]

    const res = calcularNuevasAlertas([jugActiva], wellnessList, [], [], existentes, '2026-07-13', '2026-07-13T12:10:00Z')
    expect(res).toHaveLength(0)
  })

  it('7. Datos de fechas futuras: no generan alerta', () => {
    const wellnessFuturo: Wellness[] = [
      { id_jugadora: 'J001', fecha: '2099-01-01', calidad_sueno: 1, fatiga: 1, dolor_muscular: 1, estres: 1, estado_animo: 1, dolor_especifico: '', score_wellness: 1.0 }
    ]

    const res = calcularNuevasAlertas([jugActiva], wellnessFuturo, [], [], [], '2026-07-13', '2026-07-13T12:00:00Z')
    const alertasFuturas = res.filter(a => a.fecha > '2026-07-13')
    expect(alertasFuturas).toHaveLength(0)
  })

  it('8. Datos de otra jugadora: no contaminan alertas individuales', () => {
    const wellnessJ1: Wellness[] = [
      { id_jugadora: 'J001', fecha: '2026-07-13', calidad_sueno: 3, fatiga: 3, dolor_muscular: 3, estres: 3, estado_animo: 3, dolor_especifico: '', score_wellness: 3.0 },
      ...normalWellnessHistory('J001')
    ]
    const wellnessJ3: Wellness[] = [
      { id_jugadora: 'J003', fecha: '2026-07-13', calidad_sueno: 9, fatiga: 9, dolor_muscular: 9, estres: 9, estado_animo: 9, dolor_especifico: '', score_wellness: 9.0 },
      ...normalWellnessHistory('J003')
    ]

    const res = calcularNuevasAlertas([jugActiva, jugSinCampoActiva], [...wellnessJ1, ...wellnessJ3], [], [], [], '2026-07-13', '2026-07-13T12:00:00Z')
    const alertasJ3 = res.filter(a => a.id_jugadora === 'J003' && a.tipo === 'wellness_bajo')
    expect(alertasJ3).toHaveLength(0)
  })

  it('5b. Una alerta abierta de un día anterior (2026-07-01) NO bloquea una alerta nueva del día actual (2026-08-05)', () => {
    const wellnessList: Wellness[] = [
      { id_jugadora: 'J001', fecha: '2026-08-05', calidad_sueno: 3, fatiga: 3, dolor_muscular: 3, estres: 3, estado_animo: 3, dolor_especifico: '', score_wellness: 3.0 },
      { id_jugadora: 'J001', fecha: '2026-08-04', calidad_sueno: 8, fatiga: 8, dolor_muscular: 8, estres: 8, estado_animo: 8, dolor_especifico: '', score_wellness: 8.0 },
      { id_jugadora: 'J001', fecha: '2026-08-03', calidad_sueno: 8, fatiga: 8, dolor_muscular: 8, estres: 8, estado_animo: 8, dolor_especifico: '', score_wellness: 8.0 }
    ]
    const existentes: Alerta[] = [{
      tipo: 'wellness_bajo',
      prioridad: 'alto',
      id_jugadora: 'J001',
      fecha: '2026-07-01',
      mensaje: 'Wellness bajo el 2026-07-01',
      nivel: 'alto',
      leida: false,
      creada: '2026-07-01T12:00:00Z',
      fecha_creacion: '2026-07-01T12:00:00Z',
      origen: 'Regla de Bienestar Diario',
      datos_sustento: 'Score: 3/10',
      estado: 'abierta',
      responsable: '',
      nota_decision: '',
      sugerencia: 'Revisar con la jugadora'
    }]

    const res = calcularNuevasAlertas([jugActiva], wellnessList, [], [], existentes, '2026-08-05', '2026-08-05T12:00:00Z')
    const alertasNuevas = res.filter(a => a.tipo === 'wellness_bajo' && a.fecha === '2026-08-05')
    expect(alertasNuevas).toHaveLength(1)
  })

  it('Bloque B: Resumen semanal con YYYY-Www (2026-W30 Lunes=2026-07-20 <= 2026-08-05) genera alerta', () => {
    const resumenes = [
      { id_jugadora: 'J001', semana: '2026-W30', acwr: 1.8, carga_total: 1000, carga_cronica: 550 } as any
    ]
    const res = calcularNuevasAlertas([jugActiva], normalWellnessHistory('J001'), resumenes, [], [], '2026-08-05', '2026-08-05T12:00:00Z')
    const alertasCarga = res.filter(a => a.tipo === 'carga_alta')
    expect(alertasCarga).toHaveLength(1)
  })

  it('Bloque B: Resumen semanal con YYYY-Www futuro (2026-W50 Lunes=2026-12-07 > 2026-08-05) es excluido', () => {
    const resumenes = [
      { id_jugadora: 'J001', semana: '2026-W50', acwr: 1.8, carga_total: 1000, carga_cronica: 550 } as any
    ]
    const res = calcularNuevasAlertas([jugActiva], normalWellnessHistory('J001'), resumenes, [], [], '2026-08-05', '2026-08-05T12:00:00Z')
    const alertasCarga = res.filter(a => a.tipo === 'carga_alta')
    expect(alertasCarga).toHaveLength(0)
  })
})
