import { describe, it, expect, vi } from 'vitest'
import { construirDecisionDiaria } from './dailyDecisionEngine'
import type {
  Jugadora,
  Wellness,
  Lesion,
  Alerta
} from '@/types'
import { db } from '@/db/database'

describe('dailyDecisionEngine (T-05-VISTA-DECISION-DIARIA & T-05-R)', () => {
  const jugadoras: Jugadora[] = [
    {
      id_jugadora: 'J1',
      nombre: 'Ana Lopez',
      fecha_nacimiento: '2000-01-01',
      posicion: 'Ala',
      altura_cm: 165,
      peso_kg: 58,
      imc: 21.3,
      grasa: 18,
      anos_experiencia_futsal: 5,
      historial_lesional: '',
      notas: 'Nota privada en ficha',
      activa: true
    },
    {
      id_jugadora: 'J2',
      nombre: 'Beatriz Gomez',
      fecha_nacimiento: '2001-02-02',
      posicion: 'Pivot',
      altura_cm: 170,
      peso_kg: 62,
      imc: 21.5,
      grasa: 17,
      anos_experiencia_futsal: 6,
      historial_lesional: '',
      notas: '',
      activa: true
    },
    {
      id_jugadora: 'J3',
      nombre: 'Carla Martinez',
      fecha_nacimiento: '1999-03-03',
      posicion: 'Cierre',
      altura_cm: 168,
      peso_kg: 60,
      imc: 21.2,
      grasa: 19,
      anos_experiencia_futsal: 7,
      historial_lesional: '',
      notas: '',
      activa: true
    },
    {
      id_jugadora: 'J4_INACTIVA',
      nombre: 'Diana Inactiva',
      fecha_nacimiento: '1998-04-04',
      posicion: 'Portera',
      altura_cm: 175,
      peso_kg: 65,
      imc: 21.2,
      grasa: 20,
      anos_experiencia_futsal: 8,
      historial_lesional: '',
      notas: '',
      activa: false
    }
  ]

  // A. Plantilla activa
  it('A. Incluye todas las jugadoras activas y excluye estrictamente las inactivas por el campo activa', () => {
    const jugadorasConIndefinida: Jugadora[] = [
      ...jugadoras,
      {
        id_jugadora: 'J5_ACTIVA_POR_DEFECTO',
        nombre: 'Elena Activa',
        fecha_nacimiento: '2002-05-05',
        posicion: 'Ala',
        altura_cm: 162,
        peso_kg: 55,
        imc: 21.0,
        grasa: 16,
        anos_experiencia_futsal: 4,
        historial_lesional: '',
        notas: ''
        // activa no definida => tratada como activa
      }
    ]

    const res = construirDecisionDiaria(jugadorasConIndefinida, [], [], [], [], [], [], '2026-08-02')

    expect(res.totalActivas).toBe(4)
    const ids = res.jugadoras.map((j) => j.id_jugadora)
    expect(ids).toContain('J1')
    expect(ids).toContain('J2')
    expect(ids).toContain('J3')
    expect(ids).toContain('J5_ACTIVA_POR_DEFECTO')
    expect(ids).not.toContain('J4_INACTIVA')
  })

  // B. Cambio de fecha en el motor
  it('B. Responde correctamente al cambio entre dos fechas distintas sin mezclar datos', () => {
    const wellness: Wellness[] = [
      {
        id_jugadora: 'J1',
        fecha: '2026-08-01',
        score_wellness: 90,
        calidad_sueno: 9,
        fatiga: 2,
        dolor_muscular: 1,
        estres: 1,
        estado_animo: 9,
        dolor_especifico: ''
      },
      {
        id_jugadora: 'J1',
        fecha: '2026-08-02',
        score_wellness: 55,
        calidad_sueno: 5,
        fatiga: 7,
        dolor_muscular: 6,
        estres: 5,
        estado_animo: 6,
        dolor_especifico: ''
      }
    ]

    const pruebasCMJ: any[] = [
      {
        id_medicion: 'cmj1',
        id_jugadora: 'J1',
        fecha: '2026-08-01',
        altura_mejor_cm: 30.0
      },
      {
        id_medicion: 'cmj2',
        id_jugadora: 'J1',
        fecha: '2026-08-02',
        altura_mejor_cm: 32.5
      }
    ]

    const sesionesRPE: any[] = [
      {
        id_sesion: 's1',
        id_jugadora: 'J1',
        fecha: '2026-07-26', // En ventana 7d de 2026-08-01, fuera de 2026-08-02 (2026-07-27 a 2026-08-02)
        rpe: 8,
        duracion_min: 50,
        carga_ua: 400
      },
      {
        id_sesion: 's2',
        id_jugadora: 'J1',
        fecha: '2026-08-02',
        rpe: 6,
        duracion_min: 50,
        carga_ua: 300
      }
    ]

    // Consulta Fecha 1: 2026-08-01
    const resDia1 = construirDecisionDiaria(jugadoras, wellness, [], [], pruebasCMJ, sesionesRPE, [], '2026-08-01')
    const j1Dia1 = resDia1.jugadoras.find((j) => j.id_jugadora === 'J1')!

    expect(j1Dia1.wellnessDia?.score_wellness).toBe(90)
    expect(j1Dia1.cmjReciente).toEqual({ fecha: '2026-08-01', altura_cm: 30.0 })
    expect(j1Dia1.carga7d?.cargaAcumulada7d).toBe(400)

    // Consulta Fecha 2: 2026-08-02
    const resDia2 = construirDecisionDiaria(jugadoras, wellness, [], [], pruebasCMJ, sesionesRPE, [], '2026-08-02')
    const j1Dia2 = resDia2.jugadoras.find((j) => j.id_jugadora === 'J1')!

    expect(j1Dia2.wellnessDia?.score_wellness).toBe(55)
    expect(j1Dia2.cmjReciente).toEqual({ fecha: '2026-08-02', altura_cm: 32.5 })
    expect(j1Dia2.carga7d?.cargaAcumulada7d).toBe(300)
  })

  // C. Ausencia de datos no equivale a cero
  it('C. Distingue la ausencia de dato de un valor deportivo real de cero', () => {
    const res = construirDecisionDiaria(jugadoras, [], [], [], [], [], [], '2026-08-02')
    const j1 = res.jugadoras.find((j) => j.id_jugadora === 'J1')!

    expect(j1.wellnessDia).toBeNull()
    expect(j1.cmjReciente).toBeNull()
    expect(j1.carga7d).toBeNull()
    expect(j1.alertasActivasCount).toBe(0)
    // Se conserva en la lista
    expect(res.jugadoras).toHaveLength(3)
  })

  // D. Error parcial de una fuente
  it('D. Mantiene la consulta funcional ante colecciones nulas o indefinidas de una fuente', () => {
    const res = construirDecisionDiaria(
      jugadoras,
      [],
      [],
      [],
      null as any,
      undefined as any,
      null as any,
      '2026-08-02'
    )

    expect(res.totalActivas).toBe(3)
    expect(res.jugadoras[0].cmjReciente).toBeNull()
    expect(res.jugadoras[0].carga7d).toBeNull()
  })

  // F. Lectura pura contra Dexie / Estructura de datos
  it('F. Garantiza lectura pura sin mutaciones en objetos de entrada ni llamadas de escritura', () => {
    const snapshotJugadoras = JSON.parse(JSON.stringify(jugadoras))
    if (!db.jugadoras.put) (db.jugadoras as any).put = vi.fn()
    const spyPut = vi.spyOn(db.jugadoras, 'put')

    const res = construirDecisionDiaria(jugadoras, [], [], [], [], [], [], '2026-08-02')

    expect(JSON.parse(JSON.stringify(jugadoras))).toEqual(snapshotJugadoras)
    expect(spyPut).not.toHaveBeenCalled()
    expect(res.fechaSeleccionada).toBe('2026-08-02')
    spyPut.mockRestore()
  })

  // G. Privacidad con datos sensibles en objetos de entrada
  it('G. Excluye del DTO cualquier texto libre, notas clínicas o dolor específico', () => {
    const wellnessSensible: Wellness[] = [
      {
        id_jugadora: 'J1',
        fecha: '2026-08-02',
        calidad_sueno: 7,
        fatiga: 4,
        dolor_muscular: 3,
        estres: 2,
        estado_animo: 8,
        dolor_especifico: 'DOLOR_ESPECIFICO_PRIVADO_2026',
        score_wellness: 75
      }
    ]

    const res = construirDecisionDiaria(jugadoras, wellnessSensible, [], [], [], [], [], '2026-08-02')
    const jsonStr = JSON.stringify(res)

    expect(jsonStr).not.toContain('DOLOR_ESPECIFICO_PRIVADO_2026')
    expect(jsonStr).not.toContain('Nota privada en ficha')
  })

  it('Ordena por prioridad transparente: Alertas > Lesion/Readaptacion > Sin Wellness > Alfabético', () => {
    const wellness: Wellness[] = [
      {
        id_jugadora: 'J1',
        fecha: '2026-08-02',
        calidad_sueno: 8,
        fatiga: 3,
        dolor_muscular: 2,
        estres: 2,
        estado_animo: 9,
        dolor_especifico: 'Sin dolor',
        score_wellness: 85
      }
    ]

    const lesiones: Lesion[] = [
      {
        id_lesion: 'les1',
        id_jugadora: 'J2',
        fecha_inicio: '2026-08-01',
        fecha_fin: '',
        tipo: 'Esguince tobillo',
        localizacion: 'Tobillo derecho',
        mecanismo: 'Contacto',
        severidad_dias_baja: 7,
        disponibilidad: 'Readaptacion',
        comentario_fisio_medico: '',
        fase_rtp: 'rtp_1',
        disponible: false
      }
    ]

    const alertas: Alerta[] = [
      {
        id: 101,
        id_jugadora: 'J3',
        tipo: 'wellness_bajo',
        mensaje: 'Score wellness por debajo del umbral',
        prioridad: 'alto',
        nivel: 'alto',
        leida: false,
        creada: '2026-08-02',
        fecha_creacion: '2026-08-02',
        origen: 'system',
        datos_sustento: '',
        estado: 'abierta',
        responsable: '',
        nota_decision: '',
        sugerencia: ''
      }
    ]

    const res = construirDecisionDiaria(jugadoras, wellness, lesiones, alertas, [], [], [], '2026-08-02')

    expect(res.jugadoras[0].id_jugadora).toBe('J3')
    expect(res.jugadoras[1].id_jugadora).toBe('J2')
    expect(res.jugadoras[2].id_jugadora).toBe('J1')
  })
})
