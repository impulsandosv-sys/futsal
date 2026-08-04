import { describe, it, expect } from 'vitest'
import { esSesionFuerza, calcularVolumenTrabajoFuerza, calcularResumenSesionFuerza, validarTrabajoFuerza, normalizarNombreEjercicio, validarEjercicioFuerza, validarSesionFuerzaIndividual, validarNuevoTrabajoFuerzaV13, plantillaToBorrador, esNumeroFinitoValido, normalizarTextoObservacion } from './fuerzaEngine'
import type { Sesion, TrabajoFuerzaIndividual, PlantillaFuerza, EjercicioFuerza } from '@/types'

describe('Motor Fuerza', () => {
  it('Helper esSesionFuerza', () => {
    expect(esSesionFuerza({ tipo_sesion: 'Gimnasio' } as Sesion)).toBe(true)
    expect(esSesionFuerza({ tipo_sesion: 'Fisico' } as Sesion)).toBe(false)
  })

  it('19. Validar cálculo matemático de tonelaje (repeticiones * kg)', () => {
    const trabajo: TrabajoFuerzaIndividual = {
      id_trabajo: '1', id_sesion: 'S1', id_jugadora: 'J1', id_ejercicio: 'E1', ejercicio_nombre_historico: 'E1',
      estado: 'completado', updatedAt: '',
      realizado: [
        { id_serie: 's1', orden: 1, repeticiones: 10, carga_kg: 50 }, // 500
        { id_serie: 's2', orden: 2, repeticiones: 8, carga_kg: 60 }   // 480
      ]
    }
    expect(calcularVolumenTrabajoFuerza(trabajo)).toBe(980)
  })

  it('Calcular resumen de sesión de fuerza (ejercicios, series, tonelaje total, parcial y ausente)', () => {
    const trabajos: TrabajoFuerzaIndividual[] = [
      {
        id_trabajo: '1', id_sesion_fuerza: 'SF1', id_jugadora: 'J1', id_ejercicio: 'E1', ejercicio_nombre_historico: 'Sentadilla',
        estado: 'completado', updatedAt: '',
        realizado: [{ id_serie: 's1', orden: 1, repeticiones: 10, carga_kg: 50 }]
      },
      {
        id_trabajo: '2', id_sesion_fuerza: 'SF1', id_jugadora: 'J1', id_ejercicio: 'E2', ejercicio_nombre_historico: 'Plancha',
        estado: 'completado', updatedAt: '',
        realizado: [{ id_serie: 's2', orden: 1, repeticiones: null, carga_kg: null }]
      }
    ]

    const res = calcularResumenSesionFuerza(trabajos)
    expect(res.ejerciciosCount).toBe(2)
    expect(res.seriesCount).toBe(2)
    expect(res.totalTonelaje).toBe(500)
    expect(res.hayCuantificable).toBe(true)
    expect(res.hayNoCuantificable).toBe(true)
    expect(res.tonelajeLabel).toContain('Tonelaje parcial')

    // Solo no cuantificable -> etiqueta '—'
    const resSinCuant = calcularResumenSesionFuerza([trabajos[1]])
    expect(resSinCuant.tonelajeLabel).toBe('—')
    expect(resSinCuant.hayCuantificable).toBe(false)
  })

  it('20. Tonelaje es null si faltan reps o kg, o si trabajo es no_realizado', () => {
    const trabajoVacio: TrabajoFuerzaIndividual = {
      id_trabajo: '1', id_sesion: 'S1', id_jugadora: 'J1', id_ejercicio: 'E1', ejercicio_nombre_historico: 'E1',
      estado: 'completado', updatedAt: '',
      realizado: [
        { id_serie: 's1', orden: 1, repeticiones: 10, carga_kg: null } // Falta kg
      ]
    }
    expect(calcularVolumenTrabajoFuerza(trabajoVacio)).toBeNull()

    const trabajoNoRealizado: TrabajoFuerzaIndividual = {
      id_trabajo: '1', id_sesion: 'S1', id_jugadora: 'J1', id_ejercicio: 'E1', ejercicio_nombre_historico: 'E1',
      estado: 'no_realizado', updatedAt: '',
      realizado: [
        { id_serie: 's1', orden: 1, repeticiones: 10, carga_kg: 50 } // Aunque tenga datos, si no_realizado, null
      ]
    }
    expect(calcularVolumenTrabajoFuerza(trabajoNoRealizado)).toBeNull()
  })

  it('21. Tonelaje 0 es válido explícitamente (reps > 0 y kg = 0)', () => {
    const trabajo: TrabajoFuerzaIndividual = {
      id_trabajo: '1', id_sesion: 'S1', id_jugadora: 'J1', id_ejercicio: 'E1', ejercicio_nombre_historico: 'E1',
      estado: 'completado', updatedAt: '',
      realizado: [
        { id_serie: 's1', orden: 1, repeticiones: 10, carga_kg: 0 } // 0
      ]
    }
    expect(calcularVolumenTrabajoFuerza(trabajo)).toBe(0)
  })

  it('22. Una serie real no contiene campo `series` agregado (verificado por tipado en types/index.ts)', () => {
    // Test estático, si pusieramos `series` typescript daría error.
  })

  it('23. Completado sin observación ni datos es inválido', () => {
    const trabajo: TrabajoFuerzaIndividual = {
      id_trabajo: '1', id_sesion: 'S1', id_jugadora: 'J1', id_ejercicio: 'E1', ejercicio_nombre_historico: 'E1',
      estado: 'completado', updatedAt: '',
      realizado: []
    }
    const errores = validarTrabajoFuerza(trabajo)
    expect(errores).toContain('Trabajo completado requiere datos realizados o una observación')
  })

  it('24. Normalizar nombre de ejercicio (sin tildes, minúsculas, alfanumérico)', () => {
    expect(normalizarNombreEjercicio('Sentadilla Búlgara')).toBe('sentadillabulgara')
    expect(normalizarNombreEjercicio('Press Banca (Plano)')).toBe('pressbancaplano')
  })

  it('25. Validar ejercicio duplicado por nombre normalizado', () => {
    const existentes = [
      { id_ejercicio: '1', nombre: 'Sentadilla', nombre_normalizado: 'sentadilla', categoria: 'sentadilla' as any, activo: true, createdAt: '', updatedAt: '' }
    ]
    const nuevo = { nombre: ' Senta dilla ', nombre_normalizado: 'sentadilla', categoria: 'sentadilla' as any, activo: true }
    const errores = validarEjercicioFuerza(nuevo, existentes)
    expect(errores).toContain('Ya existe un ejercicio activo similar: Sentadilla')
  })

  it('Validar Sesión Fuerza Individual (v13)', () => {
    
    // Válido
    expect(validarSesionFuerzaIndividual({
      id_jugadora: 'J1',
      fecha: '2023-10-15',
      rpe_sesion: 5,
      duracion_min: 60
    })).toHaveLength(0)

    // Faltan campos obligatorios
    expect(validarSesionFuerzaIndividual({
      id_jugadora: '',
      fecha: '2023-10-15'
    })).toContain('El identificador de la jugadora es obligatorio')

    expect(validarSesionFuerzaIndividual({
      id_jugadora: 'J1',
      fecha: '2023-10-15T00:00:00.000Z'
    })).toContain('La fecha debe estar en formato YYYY-MM-DD local')

    // RPE inválido
    expect(validarSesionFuerzaIndividual({
      id_jugadora: 'J1',
      fecha: '2023-10-15',
      rpe_sesion: 11
    })).toContain('El sRPE debe estar entre 0 y 10')

    // Duración inválida
    expect(validarSesionFuerzaIndividual({
      id_jugadora: 'J1',
      fecha: '2023-10-15',
      duracion_min: 0
    })).toContain('La duración en minutos debe ser mayor que 0')
  })

  it('Nuevo trabajo vinculado con id_sesion_fuerza y asigna ejercicio_nombre_historico', () => {
    const trabajoValido: TrabajoFuerzaIndividual = {
      id_trabajo: 't1',
      id_sesion_fuerza: 'sf1',
      id_jugadora: 'j1',
      id_ejercicio: 'e1',
      ejercicio_nombre_historico: 'Sentadilla Trasera',
      estado: 'completado',
      realizado: [{ id_serie: 's1', orden: 1, repeticiones: 10, carga_kg: 50 }],
      updatedAt: '2023-10-15T10:00:00Z'
    }
    expect(validarNuevoTrabajoFuerzaV13(trabajoValido)).toHaveLength(0)
  })

  it('Rechazo de escritura nueva sin id_sesion_fuerza', () => {
    const trabajoSinSesionFuerza: TrabajoFuerzaIndividual = {
      id_trabajo: 't1',
      id_jugadora: 'j1',
      id_ejercicio: 'e1',
      ejercicio_nombre_historico: 'Sentadilla Trasera',
      estado: 'completado',
      realizado: [{ id_serie: 's1', orden: 1, repeticiones: 10, carga_kg: 50 }],
      updatedAt: '2023-10-15T10:00:00Z'
    }
    const errores = validarNuevoTrabajoFuerzaV13(trabajoSinSesionFuerza)
    expect(errores).toContain('Toda nueva escritura de trabajo de fuerza requiere id_sesion_fuerza')
  })

  it('Validación conserva fecha local YYYY-MM-DD sin conversión UTC', () => {
    const res = validarSesionFuerzaIndividual({
      id_jugadora: 'J1',
      fecha: '2026-07-21'
    })
    expect(res).toHaveLength(0)

    const resErr = validarSesionFuerzaIndividual({
      id_jugadora: 'J1',
      fecha: '2026/07/21'
    })
    expect(resErr).toContain('La fecha debe estar en formato YYYY-MM-DD local')
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Bloque 5.1 — plantillaToBorrador (T1, T2, T3, T20, T22, T26)
  // ───────────────────────────────────────────────────────────────────────────

  const makePlantilla = (overrides: Partial<PlantillaFuerza> = {}): PlantillaFuerza => ({
    id_plantilla: 'p1',
    nombre: 'Rutina Hipertrofia A',
    finalidad: 'hipertrofia',
    descripcion: null,
    activa: true,
    ejercicios: [
      {
        id_ejercicio: 'e1',
        ejercicio_nombre_historico: 'Sentadilla Trasera',
        series_propuestas: 4,
        repeticiones_propuestas: 8,
        carga_kg_propuesta: 80,
        rpe_objetivo: 8,
        observacion_propuesta: 'Velocidad controlada',
      },
      {
        id_ejercicio: 'e2',
        ejercicio_nombre_historico: 'Press Banca',
        series_propuestas: 3,
        repeticiones_propuestas: 10,
        carga_kg_propuesta: 60,
        rpe_objetivo: 7,
        observacion_propuesta: null,
      },
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  })

  const makeCatalogo = (): EjercicioFuerza[] => [
    {
      id_ejercicio: 'e1',
      nombre: 'Sentadilla Trasera Actualizada',
      nombre_normalizado: 'sentadillatrasera',
      categoria: 'sentadilla',
      activo: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      id_ejercicio: 'e2',
      nombre: 'Press Banca',
      nombre_normalizado: 'pressbanca',
      categoria: 'empuje',
      activo: false,
      createdAt: '',
      updatedAt: '',
    },
  ]

  it('T1. plantillaToBorrador crea exactamente N filas vacías según series_propuestas', () => {
    const borrador = plantillaToBorrador(makePlantilla(), makeCatalogo())
    expect(borrador.trabajos).toHaveLength(2)
    expect(borrador.trabajos[0].series).toHaveLength(4) // series_propuestas = 4
    expect(borrador.trabajos[1].series).toHaveLength(3) // series_propuestas = 3
    borrador.trabajos[0].series.forEach((s, i) => {
      expect(s.orden).toBe(i + 1)
    })
  })

  it('T1b. series_propuestas null, undefined o 0 produce exactamente 1 fila vacía', () => {
    const plantillaEdge = makePlantilla({
      ejercicios: [
        { id_ejercicio: 'e1', series_propuestas: null },
        { id_ejercicio: 'e2', series_propuestas: 0 },
      ],
    })
    const borrador = plantillaToBorrador(plantillaEdge, makeCatalogo())
    expect(borrador.trabajos[0].series).toHaveLength(1)
    expect(borrador.trabajos[1].series).toHaveLength(1)
  })

  it('T2. plantillaToBorrador no copia ningún objetivo a campo de ejecución real', () => {
    const borrador = plantillaToBorrador(makePlantilla(), makeCatalogo())

    // Sesión: todos los campos de ejecución vacíos
    expect(borrador.sesion.id_jugadora).toBe('')
    expect(borrador.sesion.fecha).toBe('')
    expect(borrador.sesion.rpe_sesion).toBeNull()
    expect(borrador.sesion.duracion_min).toBeNull()
    expect(borrador.sesion.observacion_staff).toBeNull()

    // Trabajos: observacion_staff vacío
    borrador.trabajos.forEach((t) => {
      expect(t.observacion_staff).toBe('')
      // Series: todos los campos ejecutables vacíos
      t.series.forEach((s) => {
        expect(s.repeticiones).toBe('')
        expect(s.carga_kg).toBe('')
        expect(s.rpe_serie).toBe('')
        expect(s.observacion).toBe('')
      })
    })
  })

  it('T3. plantillaToBorrador incluye id_plantilla_fuerza_origen y snapshot de nombre histórico', () => {
    const borrador = plantillaToBorrador(makePlantilla(), makeCatalogo())
    expect(borrador.origen.id_plantilla_fuerza_origen).toBe('p1')
    expect(borrador.origen.nombre_plantilla).toBe('Rutina Hipertrofia A')
    // Usa el nombre actual del catálogo para e1
    expect(borrador.trabajos[0].ejercicio_nombre_historico).toBe('Sentadilla Trasera Actualizada')
    // La referencia también captura el mismo snapshot
    expect(borrador.referenciaPlantilla[0].ejercicio_nombre_historico).toBe('Sentadilla Trasera Actualizada')
    // La finalidad se copia como sugerencia editable
    expect(borrador.sesion.finalidad).toBe('hipertrofia')
  })

  it('T20. plantillaToBorrador separa trabajos ejecutables vacíos y referenciaPlantilla', () => {
    const borrador = plantillaToBorrador(makePlantilla(), makeCatalogo())

    // trabajos: sin objetivos propuestos en las series
    borrador.trabajos.forEach((t) => {
      expect(t).not.toHaveProperty('repeticiones_propuestas')
      expect(t).not.toHaveProperty('carga_kg_propuesta')
      expect(t).not.toHaveProperty('rpe_objetivo')
      expect(t).not.toHaveProperty('series_propuestas')
      t.series.forEach((s) => {
        expect(s).not.toHaveProperty('repeticiones_propuestas')
        expect(s).not.toHaveProperty('carga_kg_propuesta')
        expect(s).not.toHaveProperty('rpe_objetivo')
      })
    })

    // referenciaPlantilla: contiene los objetivos propuestos
    expect(borrador.referenciaPlantilla[0].repeticiones_propuestas).toBe(8)
    expect(borrador.referenciaPlantilla[0].carga_kg_propuesta).toBe(80)
    expect(borrador.referenciaPlantilla[0].rpe_objetivo).toBe(8)
    expect(borrador.referenciaPlantilla[0].observacion_propuesta).toBe('Velocidad controlada')
    expect(borrador.referenciaPlantilla[0].series_propuestas).toBe(4)
    // e2 inactivo en catálogo
    expect(borrador.referenciaPlantilla[1].ejercicio_inactivo).toBe(true)
  })

  it('T22. plantillaToBorrador conserva nombre histórico si el catálogo no resuelve el ejercicio', () => {
    // Ejercicio e3 no existe en catálogo
    const plantillaSinCat = makePlantilla({
      ejercicios: [
        {
          id_ejercicio: 'e3',
          ejercicio_nombre_historico: 'Jalón al pecho',
          series_propuestas: 2,
        },
        {
          id_ejercicio: 'e4',
          // Sin nombre histórico en plantilla
          series_propuestas: 1,
        },
      ],
    })
    const borrador = plantillaToBorrador(plantillaSinCat, makeCatalogo())

    // e3: usa el nombre de plantilla
    expect(borrador.trabajos[0].ejercicio_nombre_historico).toBe('Jalón al pecho')
    expect(borrador.referenciaPlantilla[0].ejercicio_inactivo).toBe(true) // conservador

    // e4: sin nombre en catálogo ni en plantilla → fallback
    expect(borrador.trabajos[1].ejercicio_nombre_historico).toBe('[Ejercicio eliminado]')
    expect(borrador.referenciaPlantilla[1].ejercicio_inactivo).toBe(true)
  })

  it('T26. plantillaToBorrador no genera IDs persistibles ni timestamps', () => {
    const borrador = plantillaToBorrador(makePlantilla(), makeCatalogo())

    // sesion no tiene campos de entidad persistida
    expect(borrador.sesion).not.toHaveProperty('id_sesion_fuerza')
    expect(borrador.sesion).not.toHaveProperty('createdAt')
    expect(borrador.sesion).not.toHaveProperty('updatedAt')

    // trabajos no tienen campos de entidad persistida
    borrador.trabajos.forEach((t) => {
      expect(t).not.toHaveProperty('id_trabajo')
      expect(t).not.toHaveProperty('id_sesion_fuerza')
      expect(t).not.toHaveProperty('id_jugadora')
      expect(t).not.toHaveProperty('updatedAt')
      expect(t).not.toHaveProperty('estado')
      expect(t).not.toHaveProperty('planificado')
      t.series.forEach((s) => {
        expect(s).not.toHaveProperty('id_serie')
        expect(s).not.toHaveProperty('createdAt')
        expect(s).not.toHaveProperty('updatedAt')
      })
    })
  })

  it('T26b. plantillaToBorrador no muta los objetos de entrada', () => {
    const plantilla = makePlantilla()
    const catalogo = makeCatalogo()
    const plantillaSnapshot = JSON.stringify(plantilla)
    const catalogoSnapshot = JSON.stringify(catalogo)

    plantillaToBorrador(plantilla, catalogo)

    expect(JSON.stringify(plantilla)).toBe(plantillaSnapshot)
    expect(JSON.stringify(catalogo)).toBe(catalogoSnapshot)
  })

  it('T27. esNumeroFinitoValido rechaza NaN, Infinity, -Infinity y valores no numéricos', () => {
    expect(esNumeroFinitoValido(10)).toBe(true)
    expect(esNumeroFinitoValido(0)).toBe(true)
    expect(esNumeroFinitoValido(3.14)).toBe(true)

    expect(esNumeroFinitoValido(NaN)).toBe(false)
    expect(esNumeroFinitoValido(Infinity)).toBe(false)
    expect(esNumeroFinitoValido(-Infinity)).toBe(false)
    expect(esNumeroFinitoValido('10')).toBe(false)
    expect(esNumeroFinitoValido(null)).toBe(false)
    expect(esNumeroFinitoValido(undefined)).toBe(false)
  })

  it('T28. normalizarTextoObservacion convierte cadenas compuestas solo de espacios a null', () => {
    expect(normalizarTextoObservacion('  buena sesión  ')).toBe('buena sesión')
    expect(normalizarTextoObservacion('   ')).toBeNull()
    expect(normalizarTextoObservacion('')).toBeNull()
    expect(normalizarTextoObservacion(null)).toBeNull()
    expect(normalizarTextoObservacion(undefined)).toBeNull()
  })

  it('T29. validarSesionFuerzaIndividual rechaza valores sRPE y duración no finitos', () => {
    const baseSesion = {
      id_jugadora: 'J1',
      fecha: '2026-07-28',
      finalidad: null,
      observacion_staff: null,
      id_plantilla_fuerza_origen: null,
    }

    const errsNaN = validarSesionFuerzaIndividual({ ...baseSesion, rpe_sesion: NaN })
    expect(errsNaN).toContain('El sRPE debe ser un número finito válido')

    const errsInf = validarSesionFuerzaIndividual({ ...baseSesion, rpe_sesion: Infinity })
    expect(errsInf).toContain('El sRPE debe ser un número finito válido')

    const errsDur = validarSesionFuerzaIndividual({ ...baseSesion, duracion_min: -5 })
    expect(errsDur).toContain('La duración en minutos debe ser mayor que 0')
  })

  it('T30. validarTrabajoFuerza rechaza series con repeticiones, cargas o RPE no finitos o fuera de rango', () => {
    const trabajo: TrabajoFuerzaIndividual = {
      id_trabajo: 'tr1',
      id_sesion_fuerza: 'sf1',
      id_jugadora: 'J1',
      id_ejercicio: 'e1',
      ejercicio_nombre_historico: 'Press',
      estado: 'completado',
      updatedAt: '',
      realizado: [
        { id_serie: 's1', orden: 1, repeticiones: NaN, carga_kg: -10, rpe_serie: 12 }
      ]
    }

    const errores = validarTrabajoFuerza(trabajo)
    expect(errores).toContain('Las repeticiones de la serie #1 deben ser un número finito válido')
    expect(errores).toContain('La carga de la serie #1 no puede ser negativa')
    expect(errores).toContain('El RPE de la serie #1 debe estar entre 0 y 10')
  })
})

