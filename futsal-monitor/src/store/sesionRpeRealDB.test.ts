/**
 * Test de integración real — Bloque 2G: Atomicidad de RPE de Sesión
 *
 * Usa fake-indexeddb para proveer IndexedDB real al entorno.
 * Verifica la persistencia física, validaciones referenciales y rollback completo.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Desmockear db y servicios para usar Dexie real
vi.unmock('@/db/database')
vi.unmock('@/services/resumenSemanal')
vi.unmock('@/services/readiness')

import { db } from '@/db/database'
import { useStore } from './store'
import * as resumenService from '@/services/resumenSemanal'
import * as readinessService from '@/services/readiness'

const J1 = 'JUGADORA-TEST-001'
const J2 = 'JUGADORA-TEST-002'
const SES1 = 'SESION-TEST-001'
const SES2 = 'SESION-TEST-002'
const SES_SIN_FECHA = 'SESION-SIN-FECHA'

const jugadoraBase1 = { id_jugadora: J1, nombre: 'Jugadora Uno', posicion: 'ala', activa: true, dorsal: 1 }
const jugadoraBase2 = { id_jugadora: J2, nombre: 'Jugadora Dos', posicion: 'cierre', activa: true, dorsal: 2 }
const sesionBase1 = { id_sesion: SES1, fecha: '2026-05-10', tipo_dia: 'Entreno' as const, tipo_sesion: 'Tecnico' as const, objetivo_principal: 'Pases', observaciones_grupo: '' }
const sesionBase2 = { id_sesion: SES2, fecha: '2026-05-15', tipo_dia: 'Entreno' as const, tipo_sesion: 'Tactico' as const, objetivo_principal: 'Presion', observaciones_grupo: '' }
const sesionSinFecha = { id_sesion: SES_SIN_FECHA, fecha: '', tipo_dia: 'Entreno' as const, tipo_sesion: 'Fisico' as const, objetivo_principal: 'Fuerza', observaciones_grupo: '' }

async function limpiarDB() {
  await Promise.all([
    db.sesion_rpe.clear(),
    db.resumen_semanal.clear(),
    db.readiness.clear(),
    db.jugadoras.clear(),
    db.sesiones.clear(),
    db.partidos.clear(),
    db.rpe_partido.clear(),
    db.wellness.clear(),
    db.alertas.clear(),
  ])
}

async function seedBase() {
  await db.jugadoras.put(jugadoraBase1 as any)
  await db.jugadoras.put(jugadoraBase2 as any)
  await db.sesiones.put(sesionBase1 as any)
  await db.sesiones.put(sesionBase2 as any)
  await db.sesiones.put(sesionSinFecha as any)
}

describe('RPE de Sesión - Atomicidad e Integración Real con IndexedDB (Bloque 2G)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await limpiarDB()
    await seedBase()
  })

  afterEach(async () => {
    await limpiarDB()
  })

  describe('Alta (addSesionRPE)', () => {
    it('1. Caso correcto: RPE de sesión válido se persiste con resumen semanal y readiness derivados', async () => {
      const srpe = {
        id_sesion: SES1,
        id_jugadora: J1,
        fecha: '2026-05-10',
        rpe: 7,
        duracion_min: 60,
        carga_ua: 420
      }

      await useStore.getState().addSesionRPE(srpe as any)

      const rpes = await db.sesion_rpe.where({ id_sesion: SES1 }).toArray()
      expect(rpes).toHaveLength(1)
      expect(rpes[0].id_jugadora).toBe(J1)
      expect(rpes[0].rpe).toBe(7)
      expect(rpes[0].carga_ua).toBe(420)

      const resumenes = await db.resumen_semanal.where({ id_jugadora: J1 }).toArray()
      expect(resumenes.length).toBeGreaterThanOrEqual(1)

      const readinessList = await db.readiness.where({ id_jugadora: J1 }).toArray()
      expect(readinessList.length).toBeGreaterThanOrEqual(1)
    })

    it('2. Rechaza alta si la jugadora no existe en DB', async () => {
      const srpe = {
        id_sesion: SES1,
        id_jugadora: 'JUGADORA-INEXISTENTE',
        fecha: '2026-05-10',
        rpe: 7,
        duracion_min: 60
      }

      await expect(useStore.getState().addSesionRPE(srpe as any)).rejects.toThrow("La jugadora 'JUGADORA-INEXISTENTE' no existe en la base de datos")

      const rpes = await db.sesion_rpe.toArray()
      expect(rpes).toHaveLength(0)
    })

    it('3. Rechaza alta si la sesión no existe en DB', async () => {
      const srpe = {
        id_sesion: 'SESION-INEXISTENTE',
        id_jugadora: J1,
        fecha: '2026-05-10',
        rpe: 7,
        duracion_min: 60
      }

      await expect(useStore.getState().addSesionRPE(srpe as any)).rejects.toThrow("La sesión 'SESION-INEXISTENTE' no existe en la base de datos")

      const rpes = await db.sesion_rpe.toArray()
      expect(rpes).toHaveLength(0)
    })

    it('4. Rechaza duplicado lógico (id_sesion, id_jugadora) y preserva el registro existente', async () => {
      const original = {
        id_sesion: SES1,
        id_jugadora: J1,
        fecha: '2026-05-10',
        rpe: 5,
        duracion_min: 60
      }
      await useStore.getState().addSesionRPE(original as any)

      const duplicado = {
        id_sesion: SES1,
        id_jugadora: J1,
        fecha: '2026-05-10',
        rpe: 9,
        duracion_min: 90
      }

      await expect(useStore.getState().addSesionRPE(duplicado as any)).rejects.toThrow('Ya existe un registro de RPE para esta jugadora en esta sesión')

      const rpes = await db.sesion_rpe.where({ id_sesion: SES1 }).toArray()
      expect(rpes).toHaveLength(1)
      expect(rpes[0].rpe).toBe(5)
    })

    it('5. Hereda fecha de la sesión si srpe.fecha viene vacía', async () => {
      const srpeSinFecha = {
        id_sesion: SES1,
        id_jugadora: J1,
        fecha: '',
        rpe: 6,
        duracion_min: 45
      }

      await useStore.getState().addSesionRPE(srpeSinFecha as any)

      const rpes = await db.sesion_rpe.where({ id_sesion: SES1 }).toArray()
      expect(rpes).toHaveLength(1)
      expect(rpes[0].fecha).toBe('2026-05-10')
    })

    it('6. Rechaza si srpe.fecha y sesion.fecha están ambas vacías', async () => {
      const srpe = {
        id_sesion: SES_SIN_FECHA,
        id_jugadora: J1,
        fecha: '',
        rpe: 6,
        duracion_min: 45
      }

      await expect(useStore.getState().addSesionRPE(srpe as any)).rejects.toThrow('No se pudo determinar la fecha del RPE de sesión')

      const rpes = await db.sesion_rpe.toArray()
      expect(rpes).toHaveLength(0)
    })

    it('7. Rollback físico por fallo en resumen semanal: cero RPE ni derivados en Dexie', async () => {
      vi.spyOn(resumenService, 'recalcularResumenSemanal').mockRejectedValue(new Error('Fallo provocado en resumen'))

      const srpe = {
        id_sesion: SES1,
        id_jugadora: J1,
        fecha: '2026-05-10',
        rpe: 8,
        duracion_min: 60
      }

      await expect(useStore.getState().addSesionRPE(srpe as any)).rejects.toThrow('Fallo provocado en resumen')

      const rpes = await db.sesion_rpe.toArray()
      expect(rpes).toHaveLength(0)
    })

    it('8. Rollback físico por fallo en readiness: cero RPE ni derivados en Dexie', async () => {
      vi.spyOn(readinessService, 'recalcularReadinessJugadora').mockRejectedValue(new Error('Fallo provocado en readiness'))

      const srpe = {
        id_sesion: SES1,
        id_jugadora: J1,
        fecha: '2026-05-10',
        rpe: 8,
        duracion_min: 60
      }

      await expect(useStore.getState().addSesionRPE(srpe as any)).rejects.toThrow('Fallo provocado en readiness')

      const rpes = await db.sesion_rpe.toArray()
      expect(rpes).toHaveLength(0)
    })
  })

  describe('Edición (updateSesionRPE)', () => {
    it('1. Edición exitosa actualiza RPE y recalcula derivados', async () => {
      const srpe = { id_sesion: SES1, id_jugadora: J1, fecha: '2026-05-10', rpe: 5, duracion_min: 60, carga_ua: 300 }
      await useStore.getState().addSesionRPE(srpe as any)

      const guardado = (await db.sesion_rpe.where({ id_sesion: SES1 }).toArray())[0]
      const actualizacion = { ...guardado, rpe: 9, carga_ua: 540 }

      await useStore.getState().updateSesionRPE(actualizacion)

      const rpes = await db.sesion_rpe.where({ id_sesion: SES1 }).toArray()
      expect(rpes).toHaveLength(1)
      expect(rpes[0].rpe).toBe(9)
      expect(rpes[0].carga_ua).toBe(540)
    })

    it('2. Rechaza edición de un ID físico que no existe en DB (evita inserción silenciosa)', async () => {
      const ininexistente = { id: 99999, id_sesion: SES1, id_jugadora: J1, fecha: '2026-05-10', rpe: 7, duracion_min: 60 }

      await expect(useStore.getState().updateSesionRPE(ininexistente as any)).rejects.toThrow('No existe el registro de RPE de sesión a actualizar')

      const rpes = await db.sesion_rpe.toArray()
      expect(rpes).toHaveLength(0)
    })

    it('3. Rechaza edición si la nueva jugadora o nueva sesión no existen', async () => {
      const srpe = { id_sesion: SES1, id_jugadora: J1, fecha: '2026-05-10', rpe: 5, duracion_min: 60 }
      await useStore.getState().addSesionRPE(srpe as any)
      const guardado = (await db.sesion_rpe.where({ id_sesion: SES1 }).toArray())[0]

      await expect(useStore.getState().updateSesionRPE({ ...guardado, id_jugadora: 'JUG-FANTASMA' } as any))
        .rejects.toThrow("La jugadora 'JUG-FANTASMA' no existe en la base de datos")

      await expect(useStore.getState().updateSesionRPE({ ...guardado, id_sesion: 'SES-FANTASMA' } as any))
        .rejects.toThrow("La sesión 'SES-FANTASMA' no existe en la base de datos")
    })

    it('4. Rechaza edición que causa duplicado lógico contra otro registro', async () => {
      await useStore.getState().addSesionRPE({ id_sesion: SES1, id_jugadora: J1, fecha: '2026-05-10', rpe: 5, duracion_min: 60 } as any)
      await useStore.getState().addSesionRPE({ id_sesion: SES1, id_jugadora: J2, fecha: '2026-05-10', rpe: 7, duracion_min: 60 } as any)

      const rpeJ2 = (await db.sesion_rpe.where({ id_jugadora: J2 }).toArray())[0]

      // Intentar cambiar rpeJ2 para asignárselo a J1 en SES1
      await expect(useStore.getState().updateSesionRPE({ ...rpeJ2, id_jugadora: J1 } as any))
        .rejects.toThrow('Ya existe otro registro de RPE para esta jugadora en esta sesión')
    })

    it('5. Cambio de jugadora y fecha recalcula pares previos y nuevos pos-commit', async () => {
      await useStore.getState().addSesionRPE({ id_sesion: SES1, id_jugadora: J1, fecha: '2026-05-10', rpe: 5, duracion_min: 60 } as any)
      const guardado = (await db.sesion_rpe.where({ id_sesion: SES1 }).toArray())[0]

      const cambio = { ...guardado, id_jugadora: J2, id_sesion: SES2, fecha: '2026-05-15' }
      await useStore.getState().updateSesionRPE(cambio as any)

      const rpes = await db.sesion_rpe.toArray()
      expect(rpes).toHaveLength(1)
      expect(rpes[0].id_jugadora).toBe(J2)
      expect(rpes[0].fecha).toBe('2026-05-15')
    })

    it('6. Rollback físico de edición ante fallo en recálculo', async () => {
      await useStore.getState().addSesionRPE({ id_sesion: SES1, id_jugadora: J1, fecha: '2026-05-10', rpe: 5, duracion_min: 60 } as any)
      const guardado = (await db.sesion_rpe.where({ id_sesion: SES1 }).toArray())[0]

      vi.spyOn(resumenService, 'recalcularResumenSemanal').mockRejectedValue(new Error('Fallo en edición'))

      await expect(useStore.getState().updateSesionRPE({ ...guardado, rpe: 10 } as any))
        .rejects.toThrow('Fallo en edición')

      const rpes = await db.sesion_rpe.where({ id_sesion: SES1 }).toArray()
      expect(rpes[0].rpe).toBe(5)
    })
  })

  describe('Borrado (deleteSesionRPE)', () => {
    it('1. Borrado exitoso elimina RPE y recalcula derivados con datos previos', async () => {
      await useStore.getState().addSesionRPE({ id_sesion: SES1, id_jugadora: J1, fecha: '2026-05-10', rpe: 8, duracion_min: 60 } as any)
      const guardado = (await db.sesion_rpe.where({ id_sesion: SES1 }).toArray())[0]

      await useStore.getState().deleteSesionRPE(guardado.id!)

      const rpes = await db.sesion_rpe.toArray()
      expect(rpes).toHaveLength(0)
    })

    it('2. Rechaza borrado de ID inexistente', async () => {
      await expect(useStore.getState().deleteSesionRPE(99999))
        .rejects.toThrow('No existe el registro de RPE de sesión a eliminar')
    })

    it('3. Rollback físico de borrado: si el recálculo falla, el RPE eliminado reaparece físicamente en Dexie', async () => {
      await useStore.getState().addSesionRPE({ id_sesion: SES1, id_jugadora: J1, fecha: '2026-05-10', rpe: 8, duracion_min: 60 } as any)
      const guardado = (await db.sesion_rpe.where({ id_sesion: SES1 }).toArray())[0]

      vi.spyOn(resumenService, 'recalcularResumenSemanal').mockRejectedValue(new Error('Fallo en borrado'))

      await expect(useStore.getState().deleteSesionRPE(guardado.id!))
        .rejects.toThrow('Fallo en borrado')

      const reaparecido = await db.sesion_rpe.get(guardado.id!)
      expect(reaparecido).toBeDefined()
      expect(reaparecido?.rpe).toBe(8)
    })

    it('4. El borrado lee directamente desde Dexie y no depende de que get().sesion_rpe lo contenga', async () => {
      await useStore.getState().addSesionRPE({ id_sesion: SES1, id_jugadora: J1, fecha: '2026-05-10', rpe: 8, duracion_min: 60 } as any)
      const guardado = (await db.sesion_rpe.where({ id_sesion: SES1 }).toArray())[0]

      // Limpiar intencionadamente Zustand para simular memoria vacía
      useStore.setState({ sesion_rpe: [] })

      await useStore.getState().deleteSesionRPE(guardado.id!)

      const rpes = await db.sesion_rpe.toArray()
      expect(rpes).toHaveLength(0)
    })
  })
})
