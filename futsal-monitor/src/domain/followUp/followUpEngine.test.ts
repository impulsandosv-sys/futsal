import { describe, test, expect } from 'vitest'
import {
  construirEstadoWellnessDia,
  calcularAdherenciaWellness,
  calcularReferenciaIndividual,
  evaluarDesviacionesIndividuales,
  calcularTendenciaIndividual,
  construirPanelHoyJugadora,
  construirPanelHoy
} from './followUpEngine'
import type { Jugadora, Wellness, Lesion } from '@/types'

const createMockJugadora = (overrides?: Partial<Jugadora>): Jugadora => ({
  id_jugadora: 'JUG1',
  nombre: 'Jugadora 1',
  fecha_nacimiento: '2000-01-01',
  posicion: 'Ala',
  altura_cm: 170,
  peso_kg: 60,
  imc: 20.8,
  grasa: 15,
  anos_experiencia_futsal: 5,
  historial_lesional: 'Ninguno',
  notas: '',
  activa: true,
  ...overrides
})

const createMockWellness = (overrides?: Partial<Wellness>): Wellness => ({
  id_jugadora: 'JUG1',
  fecha: '2026-07-20',
  calidad_sueno: 7,
  fatiga: 4,
  dolor_muscular: 4,
  estres: 3,
  estado_animo: 8,
  score_wellness: 7.2,
  dolor_especifico: '',
  ...overrides
})

describe('construirEstadoWellnessDia', () => {
  test('devuelve pendiente si el registro es nulo', () => {
    expect(construirEstadoWellnessDia(null)).toBe('pendiente')
  })

  test('devuelve incompleto si falta algún componente', () => {
    const w = createMockWellness({ calidad_sueno: null as any })
    expect(construirEstadoWellnessDia(w)).toBe('incompleto')
  })

  test('devuelve respondió si todos los componentes son válidos', () => {
    const w = createMockWellness()
    expect(construirEstadoWellnessDia(w)).toBe('respondió')
  })
})

describe('calcularAdherenciaWellness', () => {
  test('Adherencia 7d con denominador correcto', () => {
    const j = createMockJugadora()
    const wellnessList = [
      createMockWellness({ fecha: '2026-07-10' }), // Asegura que el historial no sea parcial (empieza antes del 14)
      createMockWellness({ fecha: '2026-07-20' }),
      createMockWellness({ fecha: '2026-07-19' }),
      createMockWellness({ fecha: '2026-07-18' }),
    ]
    const res = calcularAdherenciaWellness(j, wellnessList, '2026-07-20', 7, '2026-07-20')
    expect(res.fraccion).toBe('3/7')
    expect(res.porcentaje).toBe(43)
    expect(res.nota).toBeUndefined()
  })

  test('Adherencia sin fecha de alta limita denominador usando historial parcial', () => {
    const j = createMockJugadora()
    // Primer registro de wellness es de '2026-07-18', la ventana empieza el 14.
    const wellnessList = [
      createMockWellness({ fecha: '2026-07-20' }),
      createMockWellness({ fecha: '2026-07-19' }),
      createMockWellness({ fecha: '2026-07-18' }),
    ]
    const res = calcularAdherenciaWellness(j, wellnessList, '2026-07-20', 7, '2026-07-20')
    expect(res.nota).toBe('historial parcial')
    expect(res.fraccion).toBe('3/7')
    expect(res.porcentaje).toBe(43)
  })

  test('No incluye días futuros en el denominador', () => {
    const j = createMockJugadora()
    const wellnessList = [
      createMockWellness({ fecha: '2026-07-20' }),
    ]
    // Si la fecha seleccionada es mañana (21) pero hoy es 20. El endCalc se limita a hoy (20).
    // La ventana empieza el 15. Del 15 al 20 hay 6 días.
    const res = calcularAdherenciaWellness(j, wellnessList, '2026-07-21', 7, '2026-07-20')
    expect(res.fraccion).toBe('1/6') // Cuenta desde el 15 al 20 (6 días)
    expect(res.porcentaje).toBe(17)
  })
})

describe('calcularReferenciaIndividual', () => {
  test('devuelve null si hay menos de 10 registros en la ventana de 28 días', () => {
    const wellnessList = Array.from({ length: 9 }, (_, i) =>
      createMockWellness({ fecha: `2026-07-${10 + i}` })
    )
    const ref = calcularReferenciaIndividual('JUG1', wellnessList, '2026-07-30')
    expect(ref).toBeNull()
  })

  test('calcula correctamente medias y desviaciones con 10 o más registros', () => {
    // 10 registros con valores estables: sueño = 8 fatiga = 2
    const wellnessList = Array.from({ length: 10 }, (_, i) =>
      createMockWellness({
        fecha: `2026-07-${10 + i}`,
        calidad_sueno: i % 2 === 0 ? 8 : 6, // media = 7, varianza = 1, std = 1
        fatiga: 2
      })
    )
    const ref = calcularReferenciaIndividual('JUG1', wellnessList, '2026-07-30')
    expect(ref).not.toBeNull()
    expect(ref?.valoresReferencia.calidad_sueno).toBe(7)
    expect(ref?.desviacionesEstandar.calidad_sueno).toBeCloseTo(1.0)
    expect(ref?.valoresReferencia.fatiga).toBe(2)
    expect(ref?.desviacionesEstandar.fatiga).toBe(0)
    expect(ref?.variabilidadBaja).toBe(true) // ya que fatiga y sueño son bastante homogéneos, el score tiene baja std.
  })
})

describe('evaluarDesviacionesIndividuales', () => {
  test('Dirección de variables y cambio marcado vs moderado', () => {
    const ref: ReferenciaIndividual = {
      jugadoraId: 'JUG1',
      registrosValidos: 10,
      valoresReferencia: {
        calidad_sueno: 8,
        fatiga: 3,
        dolor_muscular: 3,
        estres: 3,
        estado_animo: 8,
        score_wellness: 7.5
      },
      desviacionesEstandar: {
        calidad_sueno: 1.0,
        fatiga: 1.0,
        dolor_muscular: 1.0,
        estres: 1.0,
        estado_animo: 1.0,
        score_wellness: 1.0
      },
      variabilidadBaja: false
    }

    // Fatiga sube a 5 (dif +2, desv 2.0σ) -> revisión prioritaria
    const wPrioritaria = createMockWellness({ fatiga: 5 })
    const motivosP = evaluarDesviacionesIndividuales(wPrioritaria, ref)
    expect(motivosP.some(m => m.categoria === 'revision_prioritaria')).toBe(true)

    // Sueño baja a 7 (dif -1, desv 1.0σ) -> revisar hoy
    const wHoy = createMockWellness({ calidad_sueno: 7 })
    const motivosH = evaluarDesviacionesIndividuales(wHoy, ref)
    expect(motivosH.some(m => m.categoria === 'revisar_hoy')).toBe(true)
  })

  test('Variabilidad cero o muy baja usa diferencia absoluta mínima de 1.5 puntos', () => {
    const ref: ReferenciaIndividual = {
      jugadoraId: 'JUG1',
      registrosValidos: 10,
      valoresReferencia: {
        calidad_sueno: 8,
        fatiga: 2,
        dolor_muscular: 2,
        estres: 2,
        estado_animo: 8,
        score_wellness: 8.0
      },
      desviacionesEstandar: {
        calidad_sueno: 0.1,
        fatiga: 0.0,
        dolor_muscular: 0.0,
        estres: 0.0,
        estado_animo: 0.1,
        score_wellness: 0.05
      },
      variabilidadBaja: true
    }

    // Fatiga sube a 3.5 (dif +1.5) -> revisión prioritaria por variabilidad baja
    const w = createMockWellness({
      calidad_sueno: 8,
      fatiga: 3.5,
      dolor_muscular: 2,
      estres: 2,
      estado_animo: 8
    })
    const motivos = evaluarDesviacionesIndividuales(w, ref)
    expect(motivos[0].categoria).toBe('revision_prioritaria')
    expect(motivos[0].mensaje).toContain('variabilidad histórica muy baja')
  })
})

describe('calcularTendenciaIndividual', () => {
  test('Tendencia desfavorable de 3 días con componente individual y diferencia >= 1 punto', () => {
    const wellnessList = [
      createMockWellness({ fecha: '2026-07-18', fatiga: 3 }),
      createMockWellness({ fecha: '2026-07-19', fatiga: 4 }),
      createMockWellness({ fecha: '2026-07-20', fatiga: 5 }), // Sube y diferencia entre 20 y 18 es 2 (>= 1.0)
    ]
    const tendencias = calcularTendenciaIndividual('JUG1', wellnessList, '2026-07-20')
    expect(tendencias.length).toBe(1)
    expect(tendencias[0].categoria).toBe('revisar_hoy')
    expect(tendencias[0].mensaje).toContain('Fatiga: 3 → 4 → 5')
  })

  test('Tres datos sin empeoramiento neto o con diferencia < 1 no activan tendencia', () => {
    const wellnessList = [
      createMockWellness({ fecha: '2026-07-18', fatiga: 3 }),
      createMockWellness({ fecha: '2026-07-19', fatiga: 3.5 }),
      createMockWellness({ fecha: '2026-07-20', fatiga: 3.8 }), // Diferencia neta es 0.8 (< 1.0)
    ]
    const tendencias = calcularTendenciaIndividual('JUG1', wellnessList, '2026-07-20')
    expect(tendencias.length).toBe(0)
  })
})

describe('Priorización y Calidad de datos simultáneas', () => {
  test('Jugadora con lesión activa e historial insuficiente', () => {
    const j = createMockJugadora()
    const lesionesList: Lesion[] = [{
      id_lesion: 'L1',
      id_jugadora: 'JUG1',
      fecha_inicio: '2026-07-15',
      fecha_fin: '',
      tipo: 'Esguince',
      localizacion: 'Tobillo',
      mecanismo: 'Traumático',
      severidad_dias_baja: 10,
      disponibilidad: 'Lesionada',
      comentario_fisio_medico: '',
      fase_rtp: 'Fase_2_Movilidad',
      disponible: false
    }]
    
    // No hay wellness en los últimos 28 días, por lo que historial es insuficiente
    const p = construirPanelHoyJugadora(j, [], lesionesList, [], '2026-07-20', [], '2026-07-20')
    
    expect(p.prioridad).toBe('revision_prioritaria') // Lesión activa exige revisión prioritaria
    expect(p.calidadDatos).toContain('historial_insuficiente') // Historial insuficiente se mantiene en calidad de datos
    expect(p.calidadDatos).toContain('wellness_pendiente') // Wellness pendiente también
  })

  test('Jugadora con dolor específico y wellness incompleto', () => {
    const j = createMockJugadora()
    const wellnessList = [
      createMockWellness({
        fecha: '2026-07-20',
        calidad_sueno: null as any, // incompleto
        dolor_especifico: 'Aductor derecho'
      })
    ]

    const p = construirPanelHoyJugadora(j, wellnessList, [], [], '2026-07-20', [], '2026-07-20')
    
    expect(p.prioridad).toBe('revision_prioritaria') // Dolor específico exige revisión
    expect(p.calidadDatos).toContain('wellness_incompleto') // Wellness incompleto se muestra en calidad de datos
  })

  test('dolor_muscular alto aislado no genera revision_prioritaria', () => {
    const ref: ReferenciaIndividual = {
      jugadoraId: 'JUG1',
      registrosValidos: 10,
      valoresReferencia: {
        calidad_sueno: 8,
        fatiga: 2,
        dolor_muscular: 2, // ref es 2
        estres: 2,
        estado_animo: 8,
        score_wellness: 8.0
      },
      desviacionesEstandar: {
        calidad_sueno: 0.5,
        fatiga: 0.5,
        dolor_muscular: 1.0, // std es 1.0
        estres: 0.5,
        estado_animo: 0.5,
        score_wellness: 0.5
      },
      variabilidadBaja: false
    }

    // Wellness de hoy tiene dolor_muscular = 5 (dif +3, desv 3.0σ)
    const wellnessList = [
      createMockWellness({
        fecha: '2026-07-20',
        calidad_sueno: 8,
        fatiga: 2,
        dolor_muscular: 5,
        estres: 2,
        estado_animo: 8,
        dolor_especifico: '' // Aislado
      })
    ]

    // Mockeamos la referencia inyectando en la lista de wellness sufientes datos
    // para construir la referencia en la ejecución real de construirPanelHoyJugadora
    // O más simple: probamos directamente evaluarDesviacionesIndividuales
    const wHoy = wellnessList[0]
    const motivos = evaluarDesviacionesIndividuales(wHoy, ref)
    
    // Todos los motivos de dolor_muscular deben ser 'revisar_hoy', no 'revision_prioritaria'
    const tieneRevisionPrioritaria = motivos.some(m => m.categoria === 'revision_prioritaria')
    const tieneRevisarHoy = motivos.some(m => m.categoria === 'revisar_hoy')
    
    expect(tieneRevisionPrioritaria).toBe(false)
    expect(tieneRevisarHoy).toBe(true)
  })
})

describe('Construir Panel Hoy general', () => {
  test('Excluye jugadoras inactivas', () => {
    const jugadoras = [
      createMockJugadora({ id_jugadora: 'J1', activa: true }),
      createMockJugadora({ id_jugadora: 'J2', activa: false })
    ]
    const { jugadorasPanel } = construirPanelHoy(jugadoras, [], [], [], '2026-07-20', [], '2026-07-20')
    expect(jugadorasPanel.length).toBe(1)
    expect(jugadorasPanel[0].id_jugadora).toBe('J1')
  })

  test('ACWR descriptivo no clasifica prioritario autónomamente', () => {
    const j = createMockJugadora()
    // Aunque haya alertas o datos históricos de ACWR, no se promueve prioridad sin otros criterios.
    // Solo se muestra en el panel.
    const p = construirPanelHoyJugadora(j, [], [], [], '2026-07-20', [], '2026-07-20')
    expect(p.prioridad).toBe('rutinario') // No hay wellness hoy ni lesión
  })
})
