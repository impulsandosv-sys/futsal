// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.unmock('@/db/database')

import { useStore, reconciliarAlertasMenstruales } from './store'
import { db } from '@/db/database'
import type { Jugadora } from '@/types'


const mockHoy = (fechaISO: string) => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${fechaISO}T10:00:00Z`))
}

describe('Store Menstrual - Acciones y Ciclo de Vida de Alertas', () => {
  const jugadora1: Jugadora = {
    id_jugadora: 'J01',
    nombre: 'Ana López',
    posicion: 'Ala',
    activa: true
  }

  const jugadora2: Jugadora = {
    id_jugadora: 'J02',
    nombre: 'Beatriz Sanz',
    posicion: 'Cierre',
    activa: true
  }

  beforeEach(async () => {
    await db.registro_menstrual.clear()
    await db.alertas.clear()
    await db.jugadoras.clear()
    await db.wellness.clear()
    await db.readiness.clear()
    await db.lesiones.clear()

    await db.jugadoras.bulkAdd([jugadora1, jugadora2])
    await useStore.getState().loadAll()
  })

  it('1. addRegistroMenstrual persiste en Dexie y Zustand y asigna id', async () => {
    const reg = await useStore.getState().addRegistroMenstrual({
      id_jugadora: 'J01',
      fecha_inicio: '2026-05-10',
      impacto_percibido: 3,
      comentario: 'Inicio normal',
      nota_ajuste: 'Carga estándar'
    })

    expect(reg.id).toBeDefined()
    expect(reg.id_jugadora).toBe('J01')

    const enDB = await db.registro_menstrual.toArray()
    expect(enDB).toHaveLength(1)
    expect(enDB[0].fecha_inicio).toBe('2026-05-10')

    const enStore = useStore.getState().registros_menstruales
    expect(enStore).toHaveLength(1)
    expect(enStore[0].fecha_inicio).toBe('2026-05-10')
  })

  it('2. addRegistroMenstrual rechaza datos inválidos sin persistir', async () => {
    // Fecha futura
    await expect(
      useStore.getState().addRegistroMenstrual({
        id_jugadora: 'J01',
        fecha_inicio: '2099-01-01',
        impacto_percibido: 3
      })
    ).rejects.toThrow()

    // Impacto inválido
    await expect(
      useStore.getState().addRegistroMenstrual({
        id_jugadora: 'J01',
        fecha_inicio: '2026-05-10',
        impacto_percibido: 15
      })
    ).rejects.toThrow()

    expect(await db.registro_menstrual.count()).toBe(0)
  })

  it('3. Evita duplicado silencioso para misma jugadora y misma fecha', async () => {
    await useStore.getState().addRegistroMenstrual({
      id_jugadora: 'J01',
      fecha_inicio: '2026-05-10',
      impacto_percibido: 2
    })

    await expect(
      useStore.getState().addRegistroMenstrual({
        id_jugadora: 'J01',
        fecha_inicio: '2026-05-10',
        impacto_percibido: 4
      })
    ).rejects.toThrow(/ya existe/i)

    expect(await db.registro_menstrual.count()).toBe(1)
  })

    it('4. updateRegistroMenstrual preserva creado_en y actualiza actualizado_en sin duplicar', async () => {
    const reg = await useStore.getState().addRegistroMenstrual({
      id_jugadora: 'J01',
      fecha_inicio: '2026-05-10',
      impacto_percibido: 2
    })
    const creadoOriginal = reg.creado_en
    const actualizadoOriginal = reg.actualizado_en

    await new Promise(resolve => setTimeout(resolve, 50)) // delay para que el timestamp cambie

    await useStore.getState().updateRegistroMenstrual(reg.id, {
      fecha_inicio: '2026-05-10',
      impacto_percibido: 6,
      comentario: 'Molestia moderada',
      nota_ajuste: 'Ajuste de gimnasio'
    })

    const enDB = await db.registro_menstrual.toArray()
    expect(enDB).toHaveLength(1)
    expect(enDB[0].impacto_percibido).toBe(6)
    expect(enDB[0].creado_en).toBe(creadoOriginal)
    expect(enDB[0].actualizado_en).not.toBe(actualizadoOriginal)

    const enStore = useStore.getState().registros_menstruales
    expect(enStore[0].creado_en).toBe(creadoOriginal)
  })

  it('4.1. updateRegistroMenstrual falla de forma clara con ID inexistente', async () => {
    await expect(useStore.getState().updateRegistroMenstrual(9999, {
      fecha_inicio: '2026-05-10',
      impacto_percibido: 6
    })).rejects.toThrow('Registro menstrual no encontrado.')

  })

it('5. deleteRegistroMenstrual elimina el registro de una jugadora sin afectar a otras', async () => {
    const r1 = await useStore.getState().addRegistroMenstrual({
      id_jugadora: 'J01',
      fecha_inicio: '2026-05-10',
      impacto_percibido: 2
    })

    await useStore.getState().addRegistroMenstrual({
      id_jugadora: 'J02',
      fecha_inicio: '2026-05-10',
      impacto_percibido: 4
    })

    expect(await db.registro_menstrual.count()).toBe(2)

    await useStore.getState().deleteRegistroMenstrual(r1.id!)

    const enDB = await db.registro_menstrual.toArray()
    expect(enDB).toHaveLength(1)
    expect(enDB[0].id_jugadora).toBe('J02')

    const enStore = useStore.getState().registros_menstruales
    expect(enStore).toHaveLength(1)
    expect(enStore[0].id_jugadora).toBe('J02')
  })

  it('6. Sincronización de alerta: crea alerta estimada e invalida alerta previa al registrar nuevo inicio real', async () => {
    // Registros calculados:
    // Registro 1: 2026-07-01
    // Registro 2: 2026-07-29 (28 días)
    // Estimación: 2026-08-26 (hoy en fecha de tests) -> Ventana activa: 2026-08-23 a 2026-09-02
    await useStore.getState().addRegistroMenstrual({
      id_jugadora: 'J01',
      fecha_inicio: '2026-07-01',
      impacto_percibido: 2
    })

    await useStore.getState().addRegistroMenstrual({
      id_jugadora: 'J01',
      fecha_inicio: '2026-07-29',
      impacto_percibido: 2
    })

    // Se debe haber generado alerta estimada para 2026-08-26
    const alertas = await db.alertas.where('id_jugadora').equals('J01').toArray()
    const alertaEstimada = alertas.find((a) => a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA' && a.estado === 'abierta')
    expect(alertaEstimada).toBeDefined()
    expect(alertaEstimada?.fecha).toBe('2026-08-26')

    // Ahora la jugadora comunica un nuevo inicio real: 2026-08-26
    await useStore.getState().addRegistroMenstrual({
      id_jugadora: 'J01',
      fecha_inicio: '2026-08-26',
      impacto_percibido: 3
    })

    // La alerta estimada anterior para 2026-08-26 debe haberse resuelto/cerrado
    const alertasDespues = await db.alertas.where('id_jugadora').equals('J01').toArray()
    const alertaAnterior = alertasDespues.find((a) => a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA' && a.fecha === '2026-08-26')
    expect(alertaAnterior?.estado).toBe('resuelta')
  })

  it('7. Descartar una alerta no afecta alertas de otras jugadoras ni otros tipos', async () => {
    // Alerta de carga alta para J01
    await db.alertas.add({
      tipo: 'carga_alta',
      prioridad: 'alto',
      id_jugadora: 'J01',
      fecha: '2026-08-26',
      mensaje: 'Carga alta J01',
      nivel: 'alto',
      leida: false,
      creada: new Date().toISOString(),
      fecha_creacion: new Date().toISOString(),
      origen: 'ACWR',
      datos_sustento: '',
      estado: 'abierta',
      responsable: '',
      nota_decision: '',
      sugerencia: ''
    })

    // Alerta menstrual para J02
    await db.alertas.add({
      tipo: 'MENSTRUACION_PROXIMA_ESTIMADA',
      prioridad: 'bajo',
      id_jugadora: 'J02',
      fecha: '2026-08-26',
      mensaje: 'Beatriz Sanz: Recordatorio estimado',
      nivel: 'bajo',
      leida: false,
      creada: new Date().toISOString(),
      fecha_creacion: new Date().toISOString(),
      origen: 'Seguimiento Menstrual Estimado',
      datos_sustento: '',
      estado: 'abierta',
      responsable: '',
      nota_decision: '',
      sugerencia: ''
    })

    await useStore.getState().loadAll()
    const alertas = useStore.getState().alertas
    const alertaJ02 = alertas.find((a) => a.id_jugadora === 'J02' && a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA')!

    await useStore.getState().updateAlertaEstado(alertaJ02.id!, 'descartada')

    const alertasFin = await db.alertas.toArray()
    const alertaJ01Fin = alertasFin.find((a) => a.id_jugadora === 'J01')!
    const alertaJ02Fin = alertasFin.find((a) => a.id_jugadora === 'J02')!

    expect(alertaJ02Fin.estado).toBe('descartada')
    expect(alertaJ01Fin.estado).toBe('abierta')
  })

  it('8. Guardar o recalcular no muta datos de wellness, readiness, lesiones ni carga', async () => {
    await useStore.getState().addRegistroMenstrual({
      id_jugadora: 'J01',
      fecha_inicio: '2026-05-10',
      impacto_percibido: 3
    })

    expect(useStore.getState().wellness).toHaveLength(0)
    expect(useStore.getState().readiness).toHaveLength(0)
    expect(useStore.getState().lesiones).toHaveLength(0)
  })


  describe('Fase 4A.3 - Reconciliación de Alertas', () => {


    beforeEach(async () => {
      // Configuramos dos registros para J01: 01 de abril y 29 de abril (28 días de mediana)
      await db.registro_menstrual.bulkAdd([
        { id_jugadora: 'J01', fecha_inicio: '2026-04-01', impacto_percibido: 3, comentario: '', nota_ajuste: '', creado_en: 'X', actualizado_en: 'X' },
        { id_jugadora: 'J01', fecha_inicio: '2026-04-29', impacto_percibido: 3, comentario: '', nota_ajuste: '', creado_en: 'X', actualizado_en: 'X' }
      ])
      // Prxima fecha estimada = 2026-05-27
      // Ventana: 2026-05-24 a 2026-06-03
    })

    const mockHoy = (fechaISO: string) => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(`${fechaISO}T10:00:00Z`))
    }

    afterEach(() => {
      vi.useRealTimers()
    })

    it('1. App cargada antes de fecha_estimada - 3: No se crea alerta', async () => {
      mockHoy('2026-05-23') // antes del -3
      await reconciliarAlertasMenstruales(useStore.setState)
      const alertas = await db.alertas.toArray()
      expect(alertas.filter(a => a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA')).toHaveLength(0)
    })

    it('2. App cargada en fecha_estimada - 3: Se crea una única alerta abierta', async () => {
      mockHoy('2026-05-24')
      await reconciliarAlertasMenstruales(useStore.setState)
      const alertas = await db.alertas.toArray()
      const estimadas = alertas.filter(a => a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA')
      expect(estimadas).toHaveLength(1)
      expect(estimadas[0].estado).toBe('abierta')
    })

    it('3. App cargada dentro de la ventana: Existe una única alerta abierta', async () => {
      mockHoy('2026-05-29') // Dentro de la ventana
      await reconciliarAlertasMenstruales(useStore.setState)
      await reconciliarAlertasMenstruales(useStore.setState) // Varias veces (Test 9)
      const alertas = await db.alertas.toArray()
      const estimadas = alertas.filter(a => a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA')
      expect(estimadas).toHaveLength(1)
      expect(estimadas[0].estado).toBe('abierta')
    })

    it('4. App cargada en fecha_estimada + 7: La alerta sigue activa', async () => {
      mockHoy('2026-06-03')
      await reconciliarAlertasMenstruales(useStore.setState)
      const alertas = await db.alertas.toArray()
      const estimadas = alertas.filter(a => a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA')
      expect(estimadas).toHaveLength(1)
      expect(estimadas[0].estado).toBe('abierta')
    })

    it('5. App cargada en fecha_estimada + 8: La alerta pasa a resuelta', async () => {
      // Creamos la alerta activa primero
      mockHoy('2026-05-29')
      await reconciliarAlertasMenstruales(useStore.setState)
      let estimadas = (await db.alertas.toArray()).filter(a => a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA')
      expect(estimadas[0].estado).toBe('abierta')

      // Ahora simulamos el da +8
      mockHoy('2026-06-04')
      await reconciliarAlertasMenstruales(useStore.setState)

      estimadas = (await db.alertas.toArray()).filter(a => a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA')
      expect(estimadas[0].estado).toBe('resuelta')
    })

    it('6. Una alerta descartada no se reabre', async () => {
      mockHoy('2026-05-29')
      await reconciliarAlertasMenstruales(useStore.setState)
      let estimadas = (await db.alertas.toArray()).filter(a => a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA')

      await db.alertas.update(estimadas[0].id!, { estado: 'descartada' })

      // Volvemos a reconciliar ese mismo da
      await reconciliarAlertasMenstruales(useStore.setState)

      estimadas = (await db.alertas.toArray()).filter(a => a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA')
      expect(estimadas[0].estado).toBe('descartada')
    })

    it('7 y 8. No toca alertas de otras jugadoras ni otros tipos', async () => {
      mockHoy('2026-05-29')
      await db.alertas.add({
        tipo: 'OTRO_TIPO' as unknown as import('@/types').TipoAlerta,
        id_jugadora: 'J01',
        fecha: '2026-05-29',
        mensaje: 'Otra',
        nivel: 'medio',
        leida: false,
        creada: 'X',
        fecha_creacion: 'X',
        origen: 'Otra',
        estado: 'abierta'
      })
      await db.alertas.add({
        tipo: 'MENSTRUACION_PROXIMA_ESTIMADA',
        id_jugadora: 'J02',
        fecha: '2026-05-29',
        mensaje: 'Otra',
        nivel: 'medio',
        leida: false,
        creada: 'X',
        fecha_creacion: 'X',
        origen: 'Otra',
        estado: 'abierta'
      })

      await reconciliarAlertasMenstruales(useStore.setState)
      const alertas = await db.alertas.toArray()
      expect(alertas.find(a => a.id_jugadora === 'J01' && a.tipo === 'OTRO_TIPO')?.estado).toBe('abierta')
      expect(alertas.find(a => a.id_jugadora === 'J02')?.estado).toBe('abierta')
    })
  })

})

describe('Fase 4A.6 - Integración de loadAll con reconciliación', () => {
  beforeEach(async () => {
    await db.alertas.clear()
    await db.registro_menstrual.clear()
    await db.jugadoras.clear()
    useStore.setState({ hasData: false, registros_menstruales: [], alertas: [], jugadoras: [] })
    await db.jugadoras.add({
      id_jugadora: 'J01',
      nombre: 'Jugadora 1',
      posicion: 'ALA',
      fecha_nacimiento: '2000-01-01',
      dorsal: 10,
      activa: true
    })
  })

  it('1. Dos inicios históricos y aplicación cargada exactamente en fecha_estimada - 3: loadAll() crea una alerta abierta.', async () => {
    await db.registro_menstrual.bulkAdd([
      { id_jugadora: 'J01', fecha_inicio: '2026-04-01', impacto_percibido: 3, creado_en: 'X', actualizado_en: 'X' },
      { id_jugadora: 'J01', fecha_inicio: '2026-05-01', impacto_percibido: 3, creado_en: 'X', actualizado_en: 'X' }
    ])
    mockHoy('2026-05-29')

    await useStore.getState().loadAll()

    const alertas = await db.alertas.toArray()
    const alerta = alertas.find(a => a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA' && a.id_jugadora === 'J01')
    expect(alerta).toBeDefined()
    expect(alerta?.estado).toBe('abierta')
    expect(alerta?.fecha).toBe('2026-05-31')
  })

  it('2. Antes de la ventana: loadAll() no crea alerta.', async () => {
    await db.registro_menstrual.bulkAdd([
      { id_jugadora: 'J01', fecha_inicio: '2026-04-01', impacto_percibido: 3, creado_en: 'X', actualizado_en: 'X' },
      { id_jugadora: 'J01', fecha_inicio: '2026-05-01', impacto_percibido: 3, creado_en: 'X', actualizado_en: 'X' }
    ])
    mockHoy('2026-05-20')

    await useStore.getState().loadAll()

    const alertas = await db.alertas.toArray()
    const alerta = alertas.find(a => a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA' && a.id_jugadora === 'J01')
    expect(alerta).toBeUndefined()
  })

  it('3. En fecha_estimada + 7: loadAll() conserva la alerta abierta.', async () => {
    await db.registro_menstrual.bulkAdd([
      { id_jugadora: 'J01', fecha_inicio: '2026-04-01', impacto_percibido: 3, comentario: '', nota_ajuste: '', creado_en: '', actualizado_en: '' },
      { id_jugadora: 'J01', fecha_inicio: '2026-05-01', impacto_percibido: 3, comentario: '', nota_ajuste: '', creado_en: '', actualizado_en: '' }
    ])
    await db.alertas.add({
      id_jugadora: 'J01', tipo: 'MENSTRUACION_PROXIMA_ESTIMADA', fecha: '2026-05-31', estado: 'abierta', nivel: 'bajo', fecha_creacion: '2026-05-29',
      contexto: { fecha_estimada: '2026-05-31', intervalo_estimado: 30, variabilidad_reciente: false }
    } as import('@/types').Alerta)

    mockHoy('2026-06-07')

    await useStore.getState().loadAll()

    const alertas = useStore.getState().alertas
    expect(alertas.filter(a => a.tipo === "MENSTRUACION_PROXIMA_ESTIMADA" && a.estado === 'abierta')).toHaveLength(1)
  })

  it('4. En fecha_estimada + 8: loadAll() resuelve la alerta.', async () => {
    await db.registro_menstrual.bulkAdd([
      { id_jugadora: 'J01', fecha_inicio: '2026-04-01', impacto_percibido: 3, creado_en: 'X', actualizado_en: 'X' },
      { id_jugadora: 'J01', fecha_inicio: '2026-05-01', impacto_percibido: 3, creado_en: 'X', actualizado_en: 'X' }
    ])
    await db.alertas.add({
      id_jugadora: 'J01',
      tipo: 'MENSTRUACION_PROXIMA_ESTIMADA',
      fecha: '2026-05-31',
      estado: 'abierta',
      creada: 'X',
      mensaje: 'Test'
    } as import('@/types').Alerta)

    mockHoy('2026-06-08')

    await useStore.getState().loadAll()

    const alertas = await db.alertas.toArray()
    const alerta = alertas.find(a => a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA' && a.id_jugadora === 'J01')
    expect(alerta?.estado).toBe('resuelta')
  })

  it('5. Una alerta descartada para misma jugadora y misma fecha: loadAll() no la reabre.', async () => {
    await db.registro_menstrual.bulkAdd([
      { id_jugadora: 'J01', fecha_inicio: '2026-04-01', impacto_percibido: 3, creado_en: 'X', actualizado_en: 'X' },
      { id_jugadora: 'J01', fecha_inicio: '2026-05-01', impacto_percibido: 3, creado_en: 'X', actualizado_en: 'X' }
    ])
    await db.alertas.add({
      id_jugadora: 'J01',
      tipo: 'MENSTRUACION_PROXIMA_ESTIMADA',
      fecha: '2026-05-31',
      estado: 'descartada',
      creada: 'X',
      mensaje: 'Test'
    } as import('@/types').Alerta)

    mockHoy('2026-05-31')

    await useStore.getState().loadAll()

    const alertas = await db.alertas.toArray()
    const alerta = alertas.find(a => a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA' && a.id_jugadora === 'J01')
    expect(alerta?.estado).toBe('descartada')
  })

  it('6. Mock antiguo sin db.registro_menstrual: loadAll() resuelve sin lanzar, mantiene hasData === true, no genera consola.', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const realTable = db.registro_menstrual
    Object.defineProperty(db, 'registro_menstrual', { value: undefined, configurable: true })



    mockHoy('2026-05-31')

    await expect(useStore.getState().loadAll()).resolves.not.toThrow()

    expect(consoleSpy).not.toHaveBeenCalled()
    expect(useStore.getState().hasData).toBe(true)

    Object.defineProperty(db, 'registro_menstrual', { value: realTable, configurable: true })
    consoleSpy.mockRestore()
  })

  it('7. Ejecutar loadAll() repetidamente: No crea alertas menstruales duplicadas.', async () => {
    await db.registro_menstrual.bulkAdd([
      { id_jugadora: 'J01', fecha_inicio: '2026-04-01', impacto_percibido: 3, comentario: '', nota_ajuste: '', creado_en: '', actualizado_en: '' },
      { id_jugadora: 'J01', fecha_inicio: '2026-05-01', impacto_percibido: 3, comentario: '', nota_ajuste: '', creado_en: '', actualizado_en: '' }
    ])
    mockHoy('2026-05-29')

    await useStore.getState().loadAll()
    await useStore.getState().loadAll()
    await useStore.getState().loadAll()

    const alertas = useStore.getState().alertas
    expect(alertas.filter(a => a.tipo === "MENSTRUACION_PROXIMA_ESTIMADA" && a.estado === 'abierta')).toHaveLength(1)
  })
})
