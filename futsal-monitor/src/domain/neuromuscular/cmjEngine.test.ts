import { describe, it, expect } from 'vitest'
import {
  calcularMejorIntentoCMJ,
  procesarMedicionCMJ,
  validarMedicionCMJ,
  generarClaveLogicaCMJ,
  validarPlausibilidadCMJ,
  evaluarClasificacionCMJ,
  seleccionarMejoresIntentosCMJ,
} from './cmjEngine'
import type { MedicionCMJ, IntentoCMJ } from '@/types'
import type { MedicionCMJNormalizada } from './cmjDomain'

describe('Motor CMJ', () => {
  it('1. Extraer mejor resultado CMJ entre 3 intentos válidos (prioriza altura)', () => {
    const intentos: IntentoCMJ[] = [
      { id_intento: '1', orden: 1, valido: true, altura_cm: 30, tiempo_vuelo_ms: 200 },
      { id_intento: '2', orden: 2, valido: true, altura_cm: 35, tiempo_vuelo_ms: 220 },
      { id_intento: '3', orden: 3, valido: true, altura_cm: 32, tiempo_vuelo_ms: 250 }
    ]
    const mejor = calcularMejorIntentoCMJ(intentos)
    expect(mejor?.id_intento).toBe('2')
  })

  it('2. Intentos no válidos nunca son el mejor resultado', () => {
    const intentos: IntentoCMJ[] = [
      { id_intento: '1', orden: 1, valido: false, altura_cm: 40, tiempo_vuelo_ms: 300 }, // No válido pero es el más alto
      { id_intento: '2', orden: 2, valido: true, altura_cm: 30, tiempo_vuelo_ms: 200 }
    ]
    const mejor = calcularMejorIntentoCMJ(intentos)
    expect(mejor?.id_intento).toBe('2')
  })

  it('3. Medición sin intentos válidos se conserva, pero no asigna altura_mejor', () => {
    const intentos: IntentoCMJ[] = [
      { id_intento: '1', orden: 1, valido: false, altura_cm: 30, tiempo_vuelo_ms: 200 }
    ]
    const mejor = calcularMejorIntentoCMJ(intentos)
    expect(mejor).toBeNull()

    const medicion = procesarMedicionCMJ({
      id_medicion: 'M1', id_jugadora: 'J1', fecha: '2024-01-01', tipo_prueba: 'cmj_bilateral',
      id_protocolo: 'P1', protocolo_nombre_historico: 'P1', intentos, fuente: 'manual', createdAt: '', updatedAt: ''
    })
    expect(medicion.altura_mejor_cm).toBeNull()
    expect(medicion.mejor_intento_valido_id).toBeNull()
  })

  it('4. Recalcular tras editar un intento de válido a no válido (y viceversa)', () => {
    let intentos: IntentoCMJ[] = [
      { id_intento: '1', orden: 1, valido: true, altura_cm: 35 },
      { id_intento: '2', orden: 2, valido: true, altura_cm: 30 }
    ]
    expect(calcularMejorIntentoCMJ(intentos)?.id_intento).toBe('1')

    // Editar intento 1 a no válido
    intentos[0].valido = false
    expect(calcularMejorIntentoCMJ(intentos)?.id_intento).toBe('2')
  })

  it('5. Invalidar el actual "mejor intento" lo reemplaza por el 2º mejor (cubierto en 4)', () => {
    // Es idéntico a 4 en la práctica.
  })

  it('6. Rechazar altura negativa', () => {
    const m: MedicionCMJ = {
      id_medicion: 'M1', id_jugadora: 'J1', fecha: '2024-01-01', tipo_prueba: 'cmj_bilateral',
      id_protocolo: 'P1', protocolo_nombre_historico: 'P1', fuente: 'manual', createdAt: '', updatedAt: '',
      intentos: [{ id_intento: '1', orden: 1, valido: true, altura_cm: -5 }]
    }
    const errores = validarMedicionCMJ(m)
    expect(errores).toContain('Altura negativa en intento 1')
  })

  it('7. Rechazar tiempo de vuelo 0/negativo', () => {
    const m: MedicionCMJ = {
      id_medicion: 'M1', id_jugadora: 'J1', fecha: '2024-01-01', tipo_prueba: 'cmj_bilateral',
      id_protocolo: 'P1', protocolo_nombre_historico: 'P1', fuente: 'manual', createdAt: '', updatedAt: '',
      intentos: [{ id_intento: '1', orden: 1, valido: true, tiempo_vuelo_ms: 0 }]
    }
    const errores = validarMedicionCMJ(m)
    expect(errores).toContain('Tiempo de vuelo inválido en intento 1')
  })

  it('8. Validar existencia de id_protocolo', () => {
    const m: MedicionCMJ = {
      id_medicion: 'M1', id_jugadora: 'J1', fecha: '2024-01-01', tipo_prueba: 'cmj_bilateral',
      id_protocolo: '', protocolo_nombre_historico: 'P1', fuente: 'manual', createdAt: '', updatedAt: '',
      intentos: []
    }
    const errores = validarMedicionCMJ(m)
    expect(errores).toContain('Protocolo requerido')
  })

  it('9. Validar fecha formato YYYY-MM-DD', () => {
    const m: MedicionCMJ = {
      id_medicion: 'M1', id_jugadora: 'J1', fecha: '01/01/2024', tipo_prueba: 'cmj_bilateral',
      id_protocolo: 'P1', protocolo_nombre_historico: 'P1', fuente: 'manual', createdAt: '', updatedAt: '',
      intentos: []
    }
    const errores = validarMedicionCMJ(m)
    expect(errores).toContain('Formato de fecha inválido (YYYY-MM-DD)')
  })

  it('10. Prevenir duplicidad de orden (ej. dos intentos "1")', () => {
    const m: MedicionCMJ = {
      id_medicion: 'M1', id_jugadora: 'J1', fecha: '2024-01-01', tipo_prueba: 'cmj_bilateral',
      id_protocolo: 'P1', protocolo_nombre_historico: 'P1', fuente: 'manual', createdAt: '', updatedAt: '',
      intentos: [
        { id_intento: '1', orden: 1, valido: true, altura_cm: 30 },
        { id_intento: '2', orden: 1, valido: true, altura_cm: 35 } // Mismo orden
      ]
    }
    const errores = validarMedicionCMJ(m)
    expect(errores).toContain('Orden duplicado: 1')
  })

  it('11. No inferir altura a partir de tiempo_vuelo en blanco', () => {
    const intentos: IntentoCMJ[] = [
      { id_intento: '1', orden: 1, valido: true, tiempo_vuelo_ms: 200 }
    ]
    const m = procesarMedicionCMJ({
      id_medicion: 'M1', id_jugadora: 'J1', fecha: '2024-01-01', tipo_prueba: 'cmj_bilateral',
      id_protocolo: 'P1', protocolo_nombre_historico: 'P1', intentos, fuente: 'manual', createdAt: '', updatedAt: ''
    })
    // Debe tener el tiempo de vuelo pero no inventar altura
    expect(m.altura_mejor_cm).toBeNull()
    expect(m.tiempo_vuelo_mejor_ms).toBe(200)
  })
})

describe('T-04A — Dominio y Reglas Puras CMJ (Chronojump)', () => {
  it('1. Tres intentos válidos de misma jugadora, fecha y protocolo: selecciona solo la mayor altura', () => {
    const mediciones: MedicionCMJNormalizada[] = [
      { idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P_CMJ', fecha: '2026-05-10', intento: 1, alturaSaltoCm: 32.5, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'valido', fuente: 'chronojump' },
      { idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P_CMJ', fecha: '2026-05-10', intento: 2, alturaSaltoCm: 38.0, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'valido', fuente: 'chronojump' },
      { idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P_CMJ', fecha: '2026-05-10', intento: 3, alturaSaltoCm: 35.1, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'valido', fuente: 'chronojump' },
    ]

    const resultado = seleccionarMejoresIntentosCMJ(mediciones)

    expect(resultado[0].seleccionadoComoMejor).toBe(false)
    expect(resultado[1].seleccionadoComoMejor).toBe(true) // 38.0 cm
    expect(resultado[2].seleccionadoComoMejor).toBe(false)
  })

  it('2. Empate exacto de altura: gana el intento con número más bajo', () => {
    const mediciones: MedicionCMJNormalizada[] = [
      { idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P_CMJ', fecha: '2026-05-10', intento: 1, alturaSaltoCm: 35.0, tiempoVueloMs: 300, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'valido', fuente: 'chronojump' },
      { idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P_CMJ', fecha: '2026-05-10', intento: 2, alturaSaltoCm: 35.0, tiempoVueloMs: 400, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'valido', fuente: 'chronojump' },
    ]

    const resultado = seleccionarMejoresIntentosCMJ(mediciones)

    // Gana intento 1 por ser el número más bajo a pesar de que el intento 2 tenga mayor tiempo de vuelo
    expect(resultado[0].seleccionadoComoMejor).toBe(true)
    expect(resultado[1].seleccionadoComoMejor).toBe(false)
  })

  it('3. Dos jugadoras en misma fecha: no hay contaminación ni selección cruzada', () => {
    const mediciones: MedicionCMJNormalizada[] = [
      { idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P_CMJ', fecha: '2026-05-10', intento: 1, alturaSaltoCm: 30.0, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'valido', fuente: 'chronojump' },
      { idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P_CMJ', fecha: '2026-05-10', intento: 2, alturaSaltoCm: 32.0, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'valido', fuente: 'chronojump' },
      { idJugadora: 'J2', aliasOrigen: 'CJ-02', origenAlias: 'chronojump', idProtocolo: 'P_CMJ', fecha: '2026-05-10', intento: 1, alturaSaltoCm: 45.0, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'valido', fuente: 'chronojump' },
      { idJugadora: 'J2', aliasOrigen: 'CJ-02', origenAlias: 'chronojump', idProtocolo: 'P_CMJ', fecha: '2026-05-10', intento: 2, alturaSaltoCm: 40.0, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'valido', fuente: 'chronojump' },
    ]

    const resultado = seleccionarMejoresIntentosCMJ(mediciones)

    expect(resultado[0].seleccionadoComoMejor).toBe(false)
    expect(resultado[1].seleccionadoComoMejor).toBe(true) // J1 mejor (32 cm)
    expect(resultado[2].seleccionadoComoMejor).toBe(true) // J2 mejor (45 cm)
    expect(resultado[3].seleccionadoComoMejor).toBe(false)
  })

  it('4. Dos protocolos de misma jugadora y fecha: se agrupan e identifican como grupos independientes', () => {
    const mediciones: MedicionCMJNormalizada[] = [
      { idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P_BILATERAL', fecha: '2026-05-10', intento: 1, alturaSaltoCm: 30.0, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'valido', fuente: 'chronojump' },
      { idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P_UNILATERAL', fecha: '2026-05-10', intento: 1, alturaSaltoCm: 18.0, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'valido', fuente: 'chronojump' },
    ]

    const resultado = seleccionarMejoresIntentosCMJ(mediciones)

    expect(resultado[0].seleccionadoComoMejor).toBe(true) // P_BILATERAL mejor
    expect(resultado[1].seleccionadoComoMejor).toBe(true) // P_UNILATERAL mejor
  })

  it('5. Registros duplicado, conflicto, requiere_revision o error no pueden ser seleccionados como mejor intento', () => {
    const mediciones: MedicionCMJNormalizada[] = [
      { idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P_CMJ', fecha: '2026-05-10', intento: 1, alturaSaltoCm: 85.0, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'requiere_revision', fuente: 'chronojump' },
      { idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P_CMJ', fecha: '2026-05-10', intento: 2, alturaSaltoCm: -5.0, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'error', fuente: 'chronojump' },
      { idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P_CMJ', fecha: '2026-05-10', intento: 3, alturaSaltoCm: 31.0, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'valido', fuente: 'chronojump' },
    ]

    const resultado = seleccionarMejoresIntentosCMJ(mediciones)

    expect(resultado[0].seleccionadoComoMejor).toBe(false)
    expect(resultado[1].seleccionadoComoMejor).toBe(false)
    expect(resultado[2].seleccionadoComoMejor).toBe(true) // 31.0 cm (único válido)
  })

  it('6. Grupo sin registros válidos: ningún registro queda seleccionado como mejor', () => {
    const mediciones: MedicionCMJNormalizada[] = [
      { idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P_CMJ', fecha: '2026-05-10', intento: 1, alturaSaltoCm: 85.0, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'requiere_revision', fuente: 'chronojump' },
      { idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P_CMJ', fecha: '2026-05-10', intento: 2, alturaSaltoCm: -10.0, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'error', fuente: 'chronojump' },
    ]

    const resultado = seleccionarMejoresIntentosCMJ(mediciones)

    expect(resultado.every(m => !m.seleccionadoComoMejor)).toBe(true)
  })

  it('7. La selección no muta el array de entrada ni sus objetos', () => {
    const original: MedicionCMJNormalizada[] = [
      { idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P_CMJ', fecha: '2026-05-10', intento: 1, alturaSaltoCm: 32.0, unidadAltura: 'cm', seleccionadoComoMejor: false, estado: 'valido', fuente: 'chronojump' }
    ]

    const resultado = seleccionarMejoresIntentosCMJ(original)

    expect(original[0].seleccionadoComoMejor).toBe(false)
    expect(resultado[0].seleccionadoComoMejor).toBe(true)
    expect(resultado).not.toBe(original)
    expect(resultado[0]).not.toBe(original[0])
  })

  it('8. Fecha local estricta: valida YYYY-MM-DD y rechaza horas, UTC, espacios o fechas inexistentes', () => {
    const v1 = validarPlausibilidadCMJ({ fecha: '2026-05-10', intento: 1, alturaSaltoCm: 30 })
    expect(v1.estado).toBe('valido')

    const invalidas = ['2026-05-10T10:00:00Z', '2026-05-10 ', '10/05/2026', '2026-02-30', '']
    invalidas.forEach(f => {
      const v = validarPlausibilidadCMJ({ fecha: f, intento: 1, alturaSaltoCm: 30 })
      expect(v.estado).toBe('error')
    })
  })

  it('9. Intento debe ser un entero positivo', () => {
    expect(validarPlausibilidadCMJ({ fecha: '2026-05-10', intento: 1, alturaSaltoCm: 30 }).estado).toBe('valido')

    const invalidos = [0, -1, 1.5, null as unknown as number]
    invalidos.forEach(i => {
      const v = validarPlausibilidadCMJ({ fecha: '2026-05-10', intento: i, alturaSaltoCm: 30 })
      expect(v.estado).toBe('error')
    })
  })

  it('10. Altura debe ser finita y positiva, y fuera de banda técnica marca requiere_revision', () => {
    expect(validarPlausibilidadCMJ({ fecha: '2026-05-10', intento: 1, alturaSaltoCm: 32.5 }).estado).toBe('valido')

    // Error por <= 0 o no finita
    expect(validarPlausibilidadCMJ({ fecha: '2026-05-10', intento: 1, alturaSaltoCm: 0 }).estado).toBe('error')
    expect(validarPlausibilidadCMJ({ fecha: '2026-05-10', intento: 1, alturaSaltoCm: -5 }).estado).toBe('error')
    expect(validarPlausibilidadCMJ({ fecha: '2026-05-10', intento: 1, alturaSaltoCm: Infinity }).estado).toBe('error')

    // Requiere revisión si es implausible (ej: 5 cm o 80 cm)
    expect(validarPlausibilidadCMJ({ fecha: '2026-05-10', intento: 1, alturaSaltoCm: 5 }).estado).toBe('requiere_revision')
    expect(validarPlausibilidadCMJ({ fecha: '2026-05-10', intento: 1, alturaSaltoCm: 80 }).estado).toBe('requiere_revision')
  })

  it('11. Clave lógica estable y diferenciada por intento', () => {
    const key1 = generarClaveLogicaCMJ('J1', '2026-05-10', 'P1', 1)
    const key2 = generarClaveLogicaCMJ('J1', '2026-05-10', 'P1', 2)
    const key3 = generarClaveLogicaCMJ('J1', '2026-05-10', 'P1', 3)

    expect(key1).toBe('J1::2026-05-10::P1::1')
    expect(key2).toBe('J1::2026-05-10::P1::2')
    expect(key3).toBe('J1::2026-05-10::P1::3')
    expect(new Set([key1, key2, key3]).size).toBe(3)
  })

  it('12. Duplicado idéntico correctamente detectado', () => {
    const base: MedicionCMJNormalizada = {
      idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P1',
      fecha: '2026-05-10', intento: 1, alturaSaltoCm: 32.5, tiempoVueloMs: 250, unidadAltura: 'cm',
      seleccionadoComoMejor: false, estado: 'valido', fuente: 'chronojump'
    }

    const nueva = { ...base }
    expect(evaluarClasificacionCMJ(nueva, base)).toBe('duplicado')
  })

  it('13. Conflicto con misma clave y altura, tiempo de vuelo o unidad diferente', () => {
    const base: MedicionCMJNormalizada = {
      idJugadora: 'J1', aliasOrigen: 'CJ-01', origenAlias: 'chronojump', idProtocolo: 'P1',
      fecha: '2026-05-10', intento: 1, alturaSaltoCm: 32.5, tiempoVueloMs: 250, unidadAltura: 'cm',
      seleccionadoComoMejor: false, estado: 'valido', fuente: 'chronojump'
    }

    const conDiferenteAltura: MedicionCMJNormalizada = { ...base, alturaSaltoCm: 35.0 }
    expect(evaluarClasificacionCMJ(conDiferenteAltura, base)).toBe('conflicto')

    const conDiferenteTiempo: MedicionCMJNormalizada = { ...base, tiempoVueloMs: 280 }
    expect(evaluarClasificacionCMJ(conDiferenteTiempo, base)).toBe('conflicto')
  })
})

