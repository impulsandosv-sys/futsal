// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  validarRegistroMenstrual,
  calcularDiferenciaDias,
  sumarDias,
  calcularMediana,
  evaluarVariabilidadIntervalos,
  calcularProximoInicioEstimado,
  calcularVentanaAlertaMenstrual,
  evaluarAlertaMenstrualJugadora
} from './menstrualEngine'
import type { RegistroMenstrual, Jugadora } from '@/types'

describe('Dominio Menstrual — menstrualEngine', () => {
  const hoyStr = '2026-05-15'

  describe('1. Validación de RegistroMenstrual', () => {
    it('1. Crear registro válido', () => {
      const reg: Partial<RegistroMenstrual> = {
        id_jugadora: 'J01',
        fecha_inicio: '2026-05-10',
        impacto_percibido: 4,
        comentario: 'Molestia leve primer día',
        nota_ajuste: 'Charla con PF, entreno normal'
      }

      const res = validarRegistroMenstrual(reg, [], hoyStr)
      expect(res.valid).toBe(true)
      expect(res.errors).toHaveLength(0)
    })

    it('2. Rechazar fecha inválida o futura', () => {
      // Fecha no ISO
      const resInvalida = validarRegistroMenstrual({
        id_jugadora: 'J01',
        fecha_inicio: '10/05/2026',
        impacto_percibido: 2
      }, [], hoyStr)
      expect(resInvalida.valid).toBe(false)
      expect(resInvalida.errors.some(e => e.toLowerCase().includes('fecha'))).toBe(true)

      // Fecha futura
      const resFutura = validarRegistroMenstrual({
        id_jugadora: 'J01',
        fecha_inicio: '2026-05-20',
        impacto_percibido: 2
      }, [], hoyStr)
      expect(resFutura.valid).toBe(false)
      expect(resFutura.errors.some(e => e.toLowerCase().includes('futura'))).toBe(true)
    })

    it('3. Rechazar impacto no entero, menor que 0 o mayor que 10', () => {
      expect(validarRegistroMenstrual({
        id_jugadora: 'J01',
        fecha_inicio: '2026-05-10',
        impacto_percibido: 3.5
      }, [], hoyStr).valid).toBe(false)

      expect(validarRegistroMenstrual({
        id_jugadora: 'J01',
        fecha_inicio: '2026-05-10',
        impacto_percibido: -1
      }, [], hoyStr).valid).toBe(false)

      expect(validarRegistroMenstrual({
        id_jugadora: 'J01',
        fecha_inicio: '2026-05-10',
        impacto_percibido: 11
      }, [], hoyStr).valid).toBe(false)
    })

    it('4. Comentario y nota de ajuste son opcionales', () => {
      const regSinOpcionales: Partial<RegistroMenstrual> = {
        id_jugadora: 'J01',
        fecha_inicio: '2026-05-10',
        impacto_percibido: 0
      }

      const res = validarRegistroMenstrual(regSinOpcionales, [], hoyStr)
      expect(res.valid).toBe(true)
    })

    it('5. Evitar duplicado silencioso para misma jugadora y fecha', () => {
      const existentes: RegistroMenstrual[] = [
        {
          id: 1,
          id_jugadora: 'J01',
          fecha_inicio: '2026-05-10',
          impacto_percibido: 3,
          creado_en: '2026-05-10T10:00:00Z',
          actualizado_en: '2026-05-10T10:00:00Z'
        }
      ]

      const nuevoDuplicado: Partial<RegistroMenstrual> = {
        id_jugadora: 'J01',
        fecha_inicio: '2026-05-10',
        impacto_percibido: 5
      }

      const res = validarRegistroMenstrual(nuevoDuplicado, existentes, hoyStr)
      expect(res.valid).toBe(false)
      expect(res.errors.some(e => e.toLowerCase().includes('ya existe') || e.toLowerCase().includes('duplicad'))).toBe(true)
    })

    it('6. Editar registro propio sin considerarlo duplicado consigo mismo', () => {
      const existentes: RegistroMenstrual[] = [
        {
          id: 1,
          id_jugadora: 'J01',
          fecha_inicio: '2026-05-10',
          impacto_percibido: 3,
          creado_en: '2026-05-10T10:00:00Z',
          actualizado_en: '2026-05-10T10:00:00Z'
        }
      ]

      const edicionPropia: Partial<RegistroMenstrual> = {
        id: 1,
        id_jugadora: 'J01',
        fecha_inicio: '2026-05-10',
        impacto_percibido: 5,
        nota_ajuste: 'Actualizado impacto'
      }

      const res = validarRegistroMenstrual(edicionPropia, existentes, hoyStr)
      expect(res.valid).toBe(true)
    })
  })

  describe('2. Cálculos matemáticos puros e intervalos', () => {
    it('Cálculo exacto de días naturales entre fechas y suma de días', () => {
      expect(calcularDiferenciaDias('2026-01-01', '2026-01-29')).toBe(28)
      expect(calcularDiferenciaDias('2026-02-01', '2026-03-01')).toBe(28) // 2026 no bisiesto
      expect(sumarDias('2026-01-29', 28)).toBe('2026-02-26')
      expect(sumarDias('2026-12-25', 10)).toBe('2027-01-04') // Cambio de año
    })

    it('Cálculo de mediana para arrays impares y pares', () => {
      expect(calcularMediana([28])).toBe(28)
      expect(calcularMediana([26, 30])).toBe(28)
      expect(calcularMediana([26, 29, 31])).toBe(29)
      expect(calcularMediana([24, 28, 30, 36])).toBe(29)
    })

    it('9. Cero o un registro: sin estimación', () => {
      expect(calcularProximoInicioEstimado([])).toBeNull()

      const unRegistro: RegistroMenstrual[] = [
        { id: 1, id_jugadora: 'J01', fecha_inicio: '2026-01-01', impacto_percibido: 3, creado_en: '', actualizado_en: '' }
      ]
      expect(calcularProximoInicioEstimado(unRegistro)).toBeNull()
    })

    it('10. Dos inicios: cálculo usando el único intervalo disponible', () => {
      const registros: RegistroMenstrual[] = [
        { id: 1, id_jugadora: 'J01', fecha_inicio: '2026-01-01', impacto_percibido: 3, creado_en: '', actualizado_en: '' },
        { id: 2, id_jugadora: 'J01', fecha_inicio: '2026-01-29', impacto_percibido: 2, creado_en: '', actualizado_en: '' }
      ]

      const est = calcularProximoInicioEstimado(registros)
      expect(est).not.toBeNull()
      expect(est?.mediana_intervalos).toBe(28)
      expect(est?.fecha_estimada).toBe('2026-02-26')
      expect(est?.variabilidad_reciente).toBe(false)
      expect(est?.intervalos_usados).toEqual([28])
    })

    it('11. Tres inicios: mediana de dos intervalos disponibles', () => {
      const registros: RegistroMenstrual[] = [
        { id: 1, id_jugadora: 'J01', fecha_inicio: '2026-01-01', impacto_percibido: 2, creado_en: '', actualizado_en: '' },
        { id: 2, id_jugadora: 'J01', fecha_inicio: '2026-01-29', impacto_percibido: 2, creado_en: '', actualizado_en: '' }, // 28d
        { id: 3, id_jugadora: 'J01', fecha_inicio: '2026-02-28', impacto_percibido: 2, creado_en: '', actualizado_en: '' }  // 30d
      ]

      const est = calcularProximoInicioEstimado(registros)
      expect(est).not.toBeNull()
      expect(est?.intervalos_usados).toEqual([28, 30])
      expect(est?.mediana_intervalos).toBe(29)
      expect(est?.fecha_estimada).toBe('2026-03-29')
      expect(est?.variabilidad_reciente).toBe(false)
    })

    it('12. Cuatro o más inicios: mediana de los últimos tres intervalos', () => {
      const registros: RegistroMenstrual[] = [
        { id: 1, id_jugadora: 'J01', fecha_inicio: '2025-10-01', impacto_percibido: 2, creado_en: '', actualizado_en: '' },
        { id: 2, id_jugadora: 'J01', fecha_inicio: '2025-11-01', impacto_percibido: 2, creado_en: '', actualizado_en: '' }, // 31d (antiguo, descartado)
        { id: 3, id_jugadora: 'J01', fecha_inicio: '2025-11-29', impacto_percibido: 2, creado_en: '', actualizado_en: '' }, // 28d
        { id: 4, id_jugadora: 'J01', fecha_inicio: '2025-12-29', impacto_percibido: 2, creado_en: '', actualizado_en: '' }, // 30d
        { id: 5, id_jugadora: 'J01', fecha_inicio: '2026-01-25', impacto_percibido: 2, creado_en: '', actualizado_en: '' }  // 27d
      ]

      const est = calcularProximoInicioEstimado(registros)
      expect(est).not.toBeNull()
      // Últimos 3 intervalos son [28, 30, 27]
      expect(est?.intervalos_usados).toEqual([28, 30, 27])
      // Mediana de [27, 28, 30] es 28
      expect(est?.mediana_intervalos).toBe(28)
      expect(est?.ultimo_inicio).toBe('2026-01-25')
      expect(est?.fecha_estimada).toBe('2026-02-22')
      expect(est?.variabilidad_reciente).toBe(false)
    })

    it('14. Variabilidad reciente depende exclusivamente de rango > 7 sobre intervalos usados', () => {
      // Caso 1: [26, 30, 32] -> rango 6 (32 - 26) -> variabilidad_reciente === false
      expect(evaluarVariabilidadIntervalos([26, 30, 32])).toBe(false)

      // Caso 2: [24, 29, 32] -> rango 8 (32 - 24) -> variabilidad_reciente === true
      expect(evaluarVariabilidadIntervalos([24, 29, 32])).toBe(true)

      // Caso 3: [28] -> rango 0 (28 - 28) -> variabilidad_reciente === false
      expect(evaluarVariabilidadIntervalos([28])).toBe(false)

      // Casos límite de frontera
      expect(evaluarVariabilidadIntervalos([20, 27])).toBe(false) // rango 7 -> false
      expect(evaluarVariabilidadIntervalos([20, 28])).toBe(true)  // rango 8 -> true
      expect(evaluarVariabilidadIntervalos([])).toBe(false)
    })

    it('15. Cálculos correctos en cambios de mes, año y años bisiestos', () => {
      // Leap year 2024 (febrero tiene 29 días)
      const reg2024: RegistroMenstrual[] = [
        { id: 1, id_jugadora: 'J01', fecha_inicio: '2024-02-01', impacto_percibido: 2, creado_en: '', actualizado_en: '' },
        { id: 2, id_jugadora: 'J01', fecha_inicio: '2024-03-01', impacto_percibido: 2, creado_en: '', actualizado_en: '' } // 29 días en 2024
      ]
      const est2024 = calcularProximoInicioEstimado(reg2024)
      expect(est2024?.mediana_intervalos).toBe(29)
      expect(est2024?.fecha_estimada).toBe('2024-03-30')
    })
  })

  describe('3. Recordatorio estimado y reglas de alerta', () => {
    const jugadora: Jugadora = {
      id_jugadora: 'J01',
      nombre: 'Elena Ruiz',
      posicion: 'Ala',
      activa: true
    }

    const registros: RegistroMenstrual[] = [
      { id: 1, id_jugadora: 'J01', fecha_inicio: '2026-04-01', impacto_percibido: 2, creado_en: '', actualizado_en: '' },
      { id: 2, id_jugadora: 'J01', fecha_inicio: '2026-04-29', impacto_percibido: 3, creado_en: '', actualizado_en: '' } // 28d -> Estimada: 2026-05-27
    ]
    // Estimada: 2026-05-27
    // Activacion (-3d): 2026-05-24
    // Caducidad (+7d): 2026-06-03

    it('16. Se crea alerta dentro de la ventana de activación (fecha_estimada - 3 días)', () => {
      const ventana = calcularVentanaAlertaMenstrual('2026-05-27')
      expect(ventana.fecha_activacion).toBe('2026-05-24')
      expect(ventana.fecha_caducidad).toBe('2026-06-03')

      // Exactamente el día de activación
      const alerta = evaluarAlertaMenstrualJugadora(registros, jugadora, '2026-05-24', '2026-05-24T08:00:00Z')
      expect(alerta).not.toBeNull()
      expect(alerta?.tipo).toBe('MENSTRUACION_PROXIMA_ESTIMADA')
      expect(alerta?.fecha).toBe('2026-05-27')
      expect(alerta?.mensaje).toContain('Recordatorio estimado a partir de los inicios comunicados')
    })

        it('17. No se crea alerta antes de la fecha de activaci�n', () => {
      // 4 d�as antes de la fecha estimada
      const alerta = evaluarAlertaMenstrualJugadora(registros, jugadora, '2026-05-23', '2026-05-23T08:00:00Z')
      expect(alerta).toBeNull()
    })

    it('20. Alerta caduca después de fecha_estimada + 7 días', () => {
      // 8 días después de la fecha estimada
      const alerta = evaluarAlertaMenstrualJugadora(registros, jugadora, '2026-06-04', '2026-06-04T08:00:00Z')
      expect(alerta).toBeNull()
    })

    it('Mensaje incluye aviso de variabilidad solo cuando rango > 7', () => {
      // Caso 1: Rango <= 7 ([26, 30, 32] -> rango 6) -> NO incluye aviso
      const regSinVariabilidad: RegistroMenstrual[] = [
        { id: 1, id_jugadora: 'J01', fecha_inicio: '2026-01-01', impacto_percibido: 2, creado_en: '', actualizado_en: '' },
        { id: 2, id_jugadora: 'J01', fecha_inicio: '2026-01-27', impacto_percibido: 2, creado_en: '', actualizado_en: '' }, // 26d
        { id: 3, id_jugadora: 'J01', fecha_inicio: '2026-02-26', impacto_percibido: 2, creado_en: '', actualizado_en: '' }, // 30d
        { id: 4, id_jugadora: 'J01', fecha_inicio: '2026-03-30', impacto_percibido: 2, creado_en: '', actualizado_en: '' }  // 32d
      ] // Mediana: 30d -> Estimada: 2026-04-29. Activación: 2026-04-26

      const alertaSinVar = evaluarAlertaMenstrualJugadora(regSinVariabilidad, jugadora, '2026-04-27', '2026-04-27T08:00:00Z')
      expect(alertaSinVar).not.toBeNull()
      expect(alertaSinVar?.mensaje).not.toContain('Estimación con variabilidad reciente')

      // Caso 2: Rango > 7 ([24, 29, 32] -> rango 8) -> SÍ incluye aviso
      const regConVariabilidad: RegistroMenstrual[] = [
        { id: 1, id_jugadora: 'J01', fecha_inicio: '2026-01-01', impacto_percibido: 2, creado_en: '', actualizado_en: '' },
        { id: 2, id_jugadora: 'J01', fecha_inicio: '2026-01-25', impacto_percibido: 2, creado_en: '', actualizado_en: '' }, // 24d
        { id: 3, id_jugadora: 'J01', fecha_inicio: '2026-02-23', impacto_percibido: 2, creado_en: '', actualizado_en: '' }, // 29d
        { id: 4, id_jugadora: 'J01', fecha_inicio: '2026-03-27', impacto_percibido: 2, creado_en: '', actualizado_en: '' }  // 32d
      ] // Mediana: 29d -> Estimada: 2026-04-25. Activación: 2026-04-22

      const alertaConVar = evaluarAlertaMenstrualJugadora(regConVariabilidad, jugadora, '2026-04-23', '2026-04-23T08:00:00Z')
      expect(alertaConVar).not.toBeNull()
      expect(alertaConVar?.mensaje).toContain('Estimación con variabilidad reciente en los intervalos registrados')
    })
  })

  describe('4. Separación estricta de dominios: RegistroMenstrual vs CicloMenstrual legado', () => {
    const jugadora: Jugadora = {
      id_jugadora: 'J01',
      nombre: 'Elena Ruiz',
      posicion: 'Ala',
      activa: true
    }

    it('1. RegistroMenstrual.id numérico opcional', () => {
      const reg: RegistroMenstrual = {
        id: 42,
        id_jugadora: 'J01',
        fecha_inicio: '2026-05-01',
        impacto_percibido: 3,
        creado_en: '2026-05-01T10:00:00Z',
        actualizado_en: '2026-05-01T10:00:00Z'
      }
      expect(typeof reg.id).toBe('number')
    })

    it('2. Dos inicios válidos en registro_menstrual generan estimación correcta', () => {
      const registros: RegistroMenstrual[] = [
        { id: 1, id_jugadora: 'J01', fecha_inicio: '2026-04-01', impacto_percibido: 2, creado_en: '', actualizado_en: '' },
        { id: 2, id_jugadora: 'J01', fecha_inicio: '2026-04-29', impacto_percibido: 3, creado_en: '', actualizado_en: '' }
      ]
      const est = calcularProximoInicioEstimado(registros)
      expect(est).not.toBeNull()
      expect(est?.fecha_estimada).toBe('2026-05-27')
      expect(est?.mediana_intervalos).toBe(28)
    })

    it('3. Registros únicamente en ciclo_menstrual legado no generan estimación', () => {
      // El nuevo motor solo acepta RegistroMenstrual[] (no CicloMenstrual)
      const registrosNuevosVacios: RegistroMenstrual[] = []
      const est = calcularProximoInicioEstimado(registrosNuevosVacios)
      expect(est).toBeNull()
    })

    it('4. Registros únicamente en ciclo_menstrual no generan alerta menstrual estimada', () => {
      const registrosNuevosVacios: RegistroMenstrual[] = []
      const alerta = evaluarAlertaMenstrualJugadora(registrosNuevosVacios, jugadora, '2026-05-27', '2026-05-27T08:00:00Z')
      expect(alerta).toBeNull()
    })

    it('5. La presencia de ambos modelos calcula exclusivamente a partir de registro_menstrual', () => {
      // Registros nuevos: 28 días entre 2026-04-01 y 2026-04-29 -> estimada 2026-05-27
      const registrosNuevos: RegistroMenstrual[] = [
        { id: 1, id_jugadora: 'J01', fecha_inicio: '2026-04-01', impacto_percibido: 2, creado_en: '', actualizado_en: '' },
        { id: 2, id_jugadora: 'J01', fecha_inicio: '2026-04-29', impacto_percibido: 3, creado_en: '', actualizado_en: '' }
      ]

      const est = calcularProximoInicioEstimado(registrosNuevos)
      expect(est?.fecha_estimada).toBe('2026-05-27')
      expect(est?.mediana_intervalos).toBe(28)
      expect(est?.intervalos_usados).toEqual([28])
    })
  })

  it('23. El modelo legacy ciclo_menstrual es completamente ignorado en las estimaciones y alertas', () => {
    const p1 = evaluarAlertaMenstrualJugadora([], {} as unknown as import('@/types').Jugadora, '2026-05-15', '2026-05-15')
    expect(p1).toBeNull()
  })

  describe('Fase 4A.3 � Futuras fechas defensivas', () => {
    const hoyStr = '2026-08-26'

    it('24. Un registro futuro no participa en intervalos ni estimaci�n', () => {
      const regPasados = [
        { fecha_inicio: '2026-07-01' } as RegistroMenstrual,
        { fecha_inicio: '2026-07-29' } as RegistroMenstrual,
      ]
      const regFuturo = { fecha_inicio: '2026-09-01' } as RegistroMenstrual

      const estSinFuturo = calcularProximoInicioEstimado(regPasados, hoyStr)
      expect(estSinFuturo?.fecha_estimada).toBe('2026-08-26')

      const estConFuturo = calcularProximoInicioEstimado([...regPasados, regFuturo], hoyStr)
      expect(estConFuturo?.fecha_estimada).toBe('2026-08-26')
    })

    it('25. Un registro futuro no crea ni prolonga alertas', () => {
      const regPasados = [
        { fecha_inicio: '2026-07-01' } as RegistroMenstrual,
        { fecha_inicio: '2026-07-29' } as RegistroMenstrual,
      ]
      const regFuturo = { fecha_inicio: '2026-09-01' } as RegistroMenstrual

      const alerta = evaluarAlertaMenstrualJugadora([...regPasados, regFuturo], { id_jugadora: 'J1', nombre: 'Test' } as unknown as import('@/types').Jugadora, hoyStr, hoyStr)
      expect(alerta).not.toBeNull()
      expect(alerta?.fecha).toBe('2026-08-26')
    })

    it('26. Los registros v�lidos pasados o de hoy mantienen el c�lculo existente', () => {
      const registros = [
        { fecha_inicio: '2026-06-01' } as RegistroMenstrual,
        { fecha_inicio: '2026-07-01' } as RegistroMenstrual,
        { fecha_inicio: '2026-08-01' } as RegistroMenstrual,
        { fecha_inicio: hoyStr } as RegistroMenstrual,
      ]
      const est = calcularProximoInicioEstimado(registros, hoyStr)
      expect(est?.ultimo_inicio).toBe(hoyStr)
    })
  })
})
