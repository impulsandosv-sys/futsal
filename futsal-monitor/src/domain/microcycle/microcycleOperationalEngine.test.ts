import { describe, it, expect } from 'vitest'
import { buildMicrocycleDashboardData } from './microcycleOperationalEngine'
import type { Jugadora, Alerta } from '@/types'

describe('microcycleOperationalEngine', () => {
  const j1: Jugadora = { id_jugadora: '1', nombre: 'A', activa: true, posicion: 'Ala', fecha_nacimiento: '2000-01-01', altura_cm: 160, peso_kg: 60, imc: 20, grasa: 15, anos_experiencia_futsal: 5, historial_lesional: '', notas: '' }
  const j2: Jugadora = { id_jugadora: '2', nombre: 'B', activa: true, posicion: 'Ala', fecha_nacimiento: '2000-01-01', altura_cm: 160, peso_kg: 60, imc: 20, grasa: 15, anos_experiencia_futsal: 5, historial_lesional: '', notas: '' }

  // A. Límites inclusivos
  it('A. Limites inclusivos', () => {
    // 2026-08-03 (Monday) to 2026-08-09 (Sunday)
    const data = buildMicrocycleDashboardData(
      '2026-08-03',
      [j1],
      [{ id_sesion: 's1', fecha: '2026-08-03', tipo_dia: 'Entreno', tipo_sesion: 'Fisico', objetivo_principal: '', observaciones_grupo: '', estado: 'realizada' },
       { id_sesion: 's2', fecha: '2026-08-09', tipo_dia: 'Entreno', tipo_sesion: 'Fisico', objetivo_principal: '', observaciones_grupo: '', estado: 'realizada' },
       { id_sesion: 's3', fecha: '2026-08-02', tipo_dia: 'Entreno', tipo_sesion: 'Fisico', objetivo_principal: '', observaciones_grupo: '', estado: 'realizada' }, // Sunday before
       { id_sesion: 's4', fecha: '2026-08-10', tipo_dia: 'Entreno', tipo_sesion: 'Fisico', objetivo_principal: '', observaciones_grupo: '', estado: 'realizada' } // Monday after
      ],
      [{ id_partido: 'p1', fecha: '2026-08-03', rival: 'X', competicion: 'L', resultado: '', lugar: 'Local' },
       { id_partido: 'p2', fecha: '2026-08-09', rival: 'Y', competicion: 'L', resultado: '', lugar: 'Local' },
       { id_partido: 'p3', fecha: '2026-08-02', rival: 'Z', competicion: 'L', resultado: '', lugar: 'Local' },
       { id_partido: 'p4', fecha: '2026-08-10', rival: 'W', competicion: 'L', resultado: '', lugar: 'Local' }],
      [{ id_jugadora: '1', fecha: '2026-08-03', calidad_sueno: 3, fatiga: 3, dolor_muscular: 3, estres: 3, estado_animo: 3, dolor_especifico: '', score_wellness: 15 },
       { id_jugadora: '1', fecha: '2026-08-09', calidad_sueno: 3, fatiga: 3, dolor_muscular: 3, estres: 3, estado_animo: 3, dolor_especifico: '', score_wellness: 15 },
       { id_jugadora: '1', fecha: '2026-08-02', calidad_sueno: 3, fatiga: 3, dolor_muscular: 3, estres: 3, estado_animo: 3, dolor_especifico: '', score_wellness: 15 },
       { id_jugadora: '1', fecha: '2026-08-10', calidad_sueno: 3, fatiga: 3, dolor_muscular: 3, estres: 3, estado_animo: 3, dolor_especifico: '', score_wellness: 15 }],
      [], [], [], []
    )

    expect(data.startDate).toBe('2026-08-03')
    expect(data.endDate).toBe('2026-08-09')
    expect(data.resumenColectivo.scheduledSessions).toBe(2) // s1, s2
    expect(data.resumenColectivo.matches).toBe(2) // p1, p2
    expect(data.filasJugadoras[0].wellnessRegistrosValidos).toBe(2)
  })

  // B. No contaminación de calidad por otra semana
  it('B. No contaminacion de calidad por otra semana', () => {
    // 2026-08-03 to 2026-08-09
    const data = buildMicrocycleDashboardData(
      '2026-08-03',
      [j1],
      [{ id_sesion: 's1', fecha: '2026-08-20', tipo_dia: 'Entreno', tipo_sesion: 'Fisico', objetivo_principal: '', observaciones_grupo: '', estado: 'realizada' }],
      [{ id_partido: 'p1', fecha: '2026-08-20', rival: 'X', competicion: 'L', resultado: '', lugar: 'Local' }],
      [{ id_jugadora: '1', fecha: '2026-08-20', calidad_sueno: 3, fatiga: 3, dolor_muscular: 3, estres: 3, estado_animo: 3, dolor_especifico: '', score_wellness: 15 }],
      [], [], [], []
    )

    expect(data.resumenColectivo.pendingQualityIssues).toBe(0)
    const row = data.filasJugadoras[0]
    expect(row.qualityIssues).toBe(0)
    expect(row.prioridadRazon).not.toBe('Datos pendientes')
    expect(row.wellnessRegistrosValidos).toBe(0)
  })

  // C. No contaminación histórica
  it('C. No contaminacion historica', () => {
    // Partido is in week 2026-07-27 to 2026-08-02
    // We check week 2026-08-03 to 2026-08-09
    const data = buildMicrocycleDashboardData(
      '2026-08-03',
      [j1],
      [],
      [{ id_partido: 'p1', fecha: '2026-07-28', rival: 'X', competicion: 'L', resultado: '', lugar: 'Local' }], // Pending minutes historically
      [], [], [], [], []
    )
    expect(data.resumenColectivo.pendingQualityIssues).toBe(0)
  })

  // D. Semana futura
  it('D. Semana futura', () => {
    // A week in the far future
    const futureWeek = '2030-01-07'
    const data = buildMicrocycleDashboardData(
      futureWeek,
      [j1],
      [{ id_sesion: 's1', fecha: '2030-01-08', tipo_dia: 'Entreno', tipo_sesion: 'Fisico', objetivo_principal: '', observaciones_grupo: '', estado: 'realizada' }],
      [{ id_partido: 'p1', fecha: '2030-01-09', rival: 'X', competicion: 'L', resultado: '', lugar: 'Local' }],
      [], [], [], [], []
    )
    expect(data.resumenColectivo.pendingQualityIssues).toBe(0)
    expect(data.filasJugadoras[0].qualityIssues).toBe(0)
  })

  // E. Alertas por semana
  it('E. Alertas por semana y privacidad menstrual', () => {
    const alertaValida: Alerta = { id: 1, tipo: 'lesion', id_jugadora: '1', estado: 'abierta', prioridad: 'alto', fecha: '2026-08-05', mensaje: '', nivel: 'alto', leida: false, creada: '', fecha_creacion: '', origen: '', datos_sustento: '', responsable: '', nota_decision: '', sugerencia: '' }
    const alertaFuera: Alerta = { id: 2, tipo: 'lesion', id_jugadora: '1', estado: 'abierta', prioridad: 'alto', fecha: '2026-08-20', mensaje: '', nivel: 'alto', leida: false, creada: '', fecha_creacion: '', origen: '', datos_sustento: '', responsable: '', nota_decision: '', sugerencia: '' }
    const alertaMenstrual: Alerta = { id: 3, tipo: 'MENSTRUACION_PROXIMA_ESTIMADA', id_jugadora: '1', estado: 'abierta', prioridad: 'alto', fecha: '2026-08-06', mensaje: '', nivel: 'alto', leida: false, creada: '', fecha_creacion: '', origen: '', datos_sustento: '', responsable: '', nota_decision: '', sugerencia: '' }

    const data = buildMicrocycleDashboardData(
      '2026-08-03',
      [j1],
      [], [], [], [], [],
      [alertaValida, alertaFuera, alertaMenstrual],
      []
    )

    expect(data.resumenColectivo.openNonMenstrualAlerts).toBe(1) // Only alertaValida
    expect(data.filasJugadoras[0].prioridadRazon).toBe('Alerta abierta no menstrual')
  })

  // F. Aislamiento entre jugadoras
  it('F. Aislamiento entre jugadoras', () => {
    const data = buildMicrocycleDashboardData(
      '2026-08-03',
      [j1, j2],
      [],
      [{ id_partido: 'p1', fecha: '2026-08-05', rival: 'X', competicion: 'L', resultado: '', lugar: 'Local' }],
      [], [],
      // J1 has RPE for match (completed), J2 does not (pending)
      [{ id_partido: 'p1', id_jugadora: '1', fecha: '2026-08-05', minutos_jugados: 20, participacion: 'parcial', rpe: 5 }],
      [], []
    )

    const row1 = data.filasJugadoras.find(f => f.jugadora.id_jugadora === '1')!
    const row2 = data.filasJugadoras.find(f => f.jugadora.id_jugadora === '2')!

    expect(row2.qualityIssues).toBeGreaterThan(0) // pending for p1
    expect(row1.qualityIssues).toBe(0) // complete for p1

    // J1 has "Sin wellness" as highest priority, but NOT "Datos pendientes"
    expect(row1.prioridadRazon).toBe('Sin wellness esta semana')
    expect(row2.prioridadRazon).toBe('Datos pendientes')
  })

  // G. Exposición
  it('G. Exposicion - convocada sin minutos retiene 0', () => {
    const data = buildMicrocycleDashboardData(
      '2026-08-03',
      [j1],
      [], [], [], [],
      [{ id_partido: 'p1', id_jugadora: '1', fecha: '2026-08-05', minutos_jugados: 0, participacion: 'convocada_sin_minutos' }],
      [], []
    )
    const exp = data.filasJugadoras[0].exposicion
    expect(exp.minutos7d).toBe(0)
    expect(exp.calidadDato).toBe('completa') // It's valid zero
  })

  // H. Side effects
  it('H. Side effects', () => {
    const jugadorasIn = [j1]
    const arr = [...jugadorasIn]
    buildMicrocycleDashboardData('2026-08-03', arr, [], [], [], [], [], [], [])
    // Ensure array order or content wasn't mutated
    expect(arr.length).toBe(1)
    expect(arr[0]).toEqual(j1)
  })

  // I. Pruebas obligatorias de validación ISO y Fallback en alertas
  it('I. Fallback de fecha operativa de alertas', () => {
    // Caso A: fecha válida directa
    const alertaDirecta: Alerta = { id: 1, tipo: 'lesion', id_jugadora: '1', estado: 'abierta', prioridad: 'alto', fecha: '2026-08-05', mensaje: '', nivel: 'alto', leida: false, creada: '', fecha_creacion: '2026-09-01T00:00:00.000Z', origen: '', datos_sustento: '', responsable: '', nota_decision: '', sugerencia: '' }

    // Caso B: fecha ausente + fecha_creacion válida
    const alertaFallback: Alerta = { id: 2, tipo: 'rendimiento', id_jugadora: '1', estado: 'abierta', prioridad: 'alto', fecha: '', mensaje: '', nivel: 'alto', leida: false, creada: '', fecha_creacion: '2026-08-06T09:30:00.000Z', origen: '', datos_sustento: '', responsable: '', nota_decision: '', sugerencia: '' }

    // Caso C: fecha inválida + fecha_creacion válida
    const alertaRota: Alerta = { id: 3, tipo: 'wellness', id_jugadora: '1', estado: 'abierta', prioridad: 'alto', fecha: '05/08/2026', mensaje: '', nivel: 'alto', leida: false, creada: '', fecha_creacion: '2026-08-07T09:30:00.000Z', origen: '', datos_sustento: '', responsable: '', nota_decision: '', sugerencia: '' }

    // Caso D: fecha inválida + fecha_creacion inválida
    const alertaBasura: Alerta = { id: 4, tipo: 'carga', id_jugadora: '1', estado: 'abierta', prioridad: 'alto', fecha: 'Hola mundo', mensaje: '', nivel: 'alto', leida: false, creada: '', fecha_creacion: 'fecha-no-valida', origen: '', datos_sustento: '', responsable: '', nota_decision: '', sugerencia: '' }

    // Ejecución en la semana 2026-08-03
    const data = buildMicrocycleDashboardData(
      '2026-08-03',
      [j1],
      [], [], [], [], [],
      [alertaDirecta, alertaFallback, alertaRota, alertaBasura],
      []
    )

    // Deben entrar la Directa, la Fallback y la Rota. (3 alertas)
    expect(data.resumenColectivo.openNonMenstrualAlerts).toBe(3)
    expect(data.filasJugadoras[0].prioridadRazon).toBe('Alerta abierta no menstrual')
  })
})
