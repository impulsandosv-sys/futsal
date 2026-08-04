/**
 * Test de integración real — Bloque 3A: Integridad referencial de importación avanzada de wellness
 *
 * Usa fake-indexeddb para proveer IndexedDB real al entorno.
 * Verifica persistencia física de la transacción de wellness + historial_importaciones,
 * comprobación de id_jugadora y rollback ante fallos.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.unmock('@/db/database')
vi.unmock('@/utils/importEngine')
vi.unmock('@/services/readiness')
vi.unmock('@/services/resumenSemanal')

import { db } from '@/db/database'
import { aplicarImportacionWellness } from '@/utils/importEngine'
import * as readinessService from '@/services/readiness'
import * as resumenService from '@/services/resumenSemanal'
import type { PreviewRow } from '@/types'

const J1 = 'JUG-REAL-001'
const J2 = 'JUG-REAL-002'

async function limpiarDB() {
  await Promise.all([
    db.jugadoras.clear(),
    db.wellness.clear(),
    db.historial_importaciones.clear(),
    db.readiness.clear(),
    db.resumen_semanal.clear(),
    db.sesiones.clear(),
    db.partidos.clear(),
    db.sesion_rpe.clear(),
    db.rpe_partido.clear()
  ])
}

async function seedJugadoras() {
  await db.jugadoras.put({ id_jugadora: J1, nombre: 'Ana López', posicion: 'ala', activa: true, dorsal: 7 } as any)
  await db.jugadoras.put({ id_jugadora: J2, nombre: 'María García', posicion: 'cierre', activa: false, dorsal: 10 } as any)
}

describe('Bloque 3A - Integridad Referencial e Integración Real Dexie (fake-indexeddb)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await limpiarDB()
    await seedJugadoras()
  })

  it('1. Lote seleccionado 100% válido: persiste todos los wellness y registra historial único', async () => {
    const rows: PreviewRow[] = [
      {
        filaOriginal: 2,
        estado: 'NUEVO',
        id_jugadora: J1,
        nombreJugadora: 'Ana López',
        fecha: '2026-07-20',
        calidad_sueno: 8, fatiga: 4, dolor_muscular: 3, estres: 2, estado_animo: 9, dolor_especifico: null,
        mensaje: 'Registro nuevo listo para importar',
        normalRow: {
          id_jugadora: J1,
          fecha: '2026-07-20',
          calidad_sueno: 8, fatiga: 4, dolor_muscular: 3, estres: 2, estado_animo: 9, dolor_especifico: null, marca_temporal: null
        }
      }
    ]

    const outcome = await aplicarImportacionWellness(rows, 'omit', 'archivo_test.csv', 'Hoja1', 'default', 'backup_previo.json')

    expect(outcome.success).toBe(true)
    expect(outcome.inserted).toBe(1)

    const savedWellness = await db.wellness.toArray()
    expect(savedWellness).toHaveLength(1)
    expect(savedWellness[0].id_jugadora).toBe(J1)

    const savedHistorial = await db.historial_importaciones.toArray()
    expect(savedHistorial).toHaveLength(1)
    expect(savedHistorial[0].nombreArchivo).toBe('archivo_test.csv')
    expect(savedHistorial[0].estado).toBe('completada')
  })

  it('2. Lote con filas ERROR no omitidas: rechaza la importación sin modificar IndexedDB', async () => {
    const rows: PreviewRow[] = [
      {
        filaOriginal: 2,
        estado: 'ERROR',
        id_jugadora: 'JUG-INEXISTENTE',
        nombreJugadora: '',
        fecha: '2026-07-20',
        calidad_sueno: null, fatiga: null, dolor_muscular: null, estres: null, estado_animo: null, dolor_especifico: null,
        mensaje: "ID_Jugadora 'JUG-INEXISTENTE' no existe en la base de datos"
      }
    ]

    await expect(aplicarImportacionWellness(rows, 'omit', 'test_err.csv', 'Hoja1', 'default', 'backup.json')).rejects.toThrow()

    const wellnessCount = await db.wellness.count()
    expect(wellnessCount).toBe(0)

    const historialCount = await db.historial_importaciones.count()
    expect(historialCount).toBe(0)
  })

  it('3. Filas erróneas omitidas explícitamente y filas válidas seleccionadas: persiste únicamente las válidas', async () => {
    const rows: PreviewRow[] = [
      {
        filaOriginal: 2,
        estado: 'OMITIDA',
        id_jugadora: 'JUG-INEXISTENTE',
        nombreJugadora: '',
        fecha: '2026-07-20',
        calidad_sueno: null, fatiga: null, dolor_muscular: null, estres: null, estado_animo: null, dolor_especifico: null,
        mensaje: 'Excluido manualmente por el usuario'
      },
      {
        filaOriginal: 3,
        estado: 'NUEVO',
        id_jugadora: J1,
        nombreJugadora: 'Ana López',
        fecha: '2026-07-20',
        calidad_sueno: 7, fatiga: 5, dolor_muscular: 4, estres: 3, estado_animo: 8, dolor_especifico: null,
        mensaje: 'Registro nuevo listo para importar',
        normalRow: {
          id_jugadora: J1,
          fecha: '2026-07-20',
          calidad_sueno: 7, fatiga: 5, dolor_muscular: 4, estres: 3, estado_animo: 8, dolor_especifico: null, marca_temporal: null
        }
      }
    ]

    const outcome = await aplicarImportacionWellness(rows, 'omit', 'test_parcial.csv', 'Hoja1', 'default', 'backup.json')

    expect(outcome.success).toBe(true)
    expect(outcome.inserted).toBe(1)
    expect(outcome.skipped).toBe(1)

    const savedWellness = await db.wellness.toArray()
    expect(savedWellness).toHaveLength(1)
    expect(savedWellness[0].id_jugadora).toBe(J1)
  })

  it('4. Jugadora eliminada entre vista previa y confirmación: la revalidación en transacción rechaza y ejecuta rollback completo', async () => {
    const rows: PreviewRow[] = [
      {
        filaOriginal: 2,
        estado: 'NUEVO',
        id_jugadora: J1,
        nombreJugadora: 'Ana López',
        fecha: '2026-07-20',
        calidad_sueno: 8, fatiga: 4, dolor_muscular: 3, estres: 2, estado_animo: 9, dolor_especifico: null,
        mensaje: 'Registro nuevo listo para importar',
        normalRow: {
          id_jugadora: J1,
          fecha: '2026-07-20',
          calidad_sueno: 8, fatiga: 4, dolor_muscular: 3, estres: 2, estado_animo: 9, dolor_especifico: null, marca_temporal: null
        }
      }
    ]

    // Simular carrera eliminando físicamente la jugadora de Dexie antes del commit
    await db.jugadoras.delete(J1 as any)

    const outcome = await aplicarImportacionWellness(rows, 'omit', 'carrera.csv', 'Hoja1', 'default', 'backup.json')

    expect(outcome.success).toBe(false)
    expect(outcome.inserted).toBe(0)

    const wellnessCount = await db.wellness.count()
    expect(wellnessCount).toBe(0)

    // Se registra un historial con estado de error
    const historial = await db.historial_importaciones.toArray()
    expect(historial).toHaveLength(1)
    expect(historial[0].estado).toBe('error')
    expect(historial[0].detalleErrores[0]).toContain("La jugadora 'JUG-REAL-001' ya no existe")
  })

  it('5. Error inducido durante persistencia de una fila: rollback físico de wellness y mantenimiento de datos preexistentes', async () => {
    // Seed pre-existing wellness record
    await db.wellness.put({ id_jugadora: J1, fecha: '2026-07-01', calidad_sueno: 9, fatiga: 2, dolor_muscular: 1, estres: 1, estado_animo: 10, dolor_especifico: '', score_wellness: 9 })

    const countBefore = await db.wellness.count()
    expect(countBefore).toBe(1)

    // Force failure during put inside transaction
    const spyPut = vi.spyOn(db.wellness, 'put').mockImplementationOnce(() => Promise.reject(new Error('Simulated Dexie Disk Error')))

    const rows: PreviewRow[] = [
      {
        filaOriginal: 2,
        estado: 'NUEVO',
        id_jugadora: J1,
        nombreJugadora: 'Ana López',
        fecha: '2026-07-20',
        calidad_sueno: 8, fatiga: 4, dolor_muscular: 3, estres: 2, estado_animo: 9, dolor_especifico: null,
        mensaje: 'Registro nuevo listo para importar',
        normalRow: {
          id_jugadora: J1,
          fecha: '2026-07-20',
          calidad_sueno: 8, fatiga: 4, dolor_muscular: 3, estres: 2, estado_animo: 9, dolor_especifico: null, marca_temporal: null
        }
      }
    ]

    const outcome = await aplicarImportacionWellness(rows, 'omit', 'error_disk.csv', 'Hoja1', 'default', 'backup.json')

    expect(outcome.success).toBe(false)
    expect(outcome.inserted).toBe(0)

    // Verify rollback: count remains 1, exact pre-existing record intact
    const countAfter = await db.wellness.count()
    expect(countAfter).toBe(1)
    const existing = await db.wellness.toCollection().first()
    expect(existing?.fecha).toBe('2026-07-01')

    spyPut.mockRestore()
  })

  it('6. Jugadora inactiva (activa: false) pero existente permite completar la importación sin rechazo', async () => {
    const rows: PreviewRow[] = [
      {
        filaOriginal: 2,
        estado: 'NUEVO',
        id_jugadora: J2, // J2 has activa: false
        nombreJugadora: 'María García',
        fecha: '2026-07-20',
        calidad_sueno: 7, fatiga: 6, dolor_muscular: 5, estres: 4, estado_animo: 6, dolor_especifico: null,
        mensaje: 'Registro nuevo listo para importar',
        normalRow: {
          id_jugadora: J2,
          fecha: '2026-07-20',
          calidad_sueno: 7, fatiga: 6, dolor_muscular: 5, estres: 4, estado_animo: 6, dolor_especifico: null, marca_temporal: null
        }
      }
    ]

    const outcome = await aplicarImportacionWellness(rows, 'omit', 'inactiva.csv', 'Hoja1', 'default', 'backup.json')

    expect(outcome.success).toBe(true)
    expect(outcome.inserted).toBe(1)

    const savedWellness = await db.wellness.where({ id_jugadora: J2 }).toArray()
    expect(savedWellness).toHaveLength(1)
  })

  it('7. Importación atómica 3B exitosa: persiste conjuntamente wellness, historial, readiness y resumen_semanal', async () => {
    const rows: PreviewRow[] = [
      {
        filaOriginal: 2,
        estado: 'NUEVO',
        id_jugadora: J1,
        nombreJugadora: 'Ana López',
        fecha: '2026-07-20',
        calidad_sueno: 9, fatiga: 2, dolor_muscular: 2, estres: 1, estado_animo: 10, dolor_especifico: null,
        mensaje: 'OK',
        normalRow: {
          id_jugadora: J1,
          fecha: '2026-07-20',
          calidad_sueno: 9, fatiga: 2, dolor_muscular: 2, estres: 1, estado_animo: 10, dolor_especifico: null, marca_temporal: null
        }
      }
    ]

    const outcome = await aplicarImportacionWellness(rows, 'omit', '3b_exito.csv', 'Hoja1', 'default', 'backup.json')

    expect(outcome.success).toBe(true)
    expect(outcome.recalculoExitoso).toBe(true)

    // Wellness persisted
    const wellness = await db.wellness.where({ id_jugadora: J1 }).toArray()
    expect(wellness).toHaveLength(1)

    // Historial persisted with derivadosPendientes: false
    const historial = await db.historial_importaciones.toArray()
    expect(historial).toHaveLength(1)
    expect(historial[0].estado).toBe('completada')
    expect(historial[0].derivadosPendientes).toBe(false)

    // Readiness persisted for dates in propagation window
    const readiness = await db.readiness.where({ id_jugadora: J1 }).toArray()
    expect(readiness.length).toBeGreaterThan(0)

    // Resumen semanal persisted for affected week
    const resumenes = await db.resumen_semanal.where({ id_jugadora: J1 }).toArray()
    expect(resumenes.length).toBeGreaterThan(0)
  })

  it('8. Error inducido en recálculo de readiness: rollback físico total (0 wellness, 0 historial éxito, 0 readiness)', async () => {
    const spy = vi.spyOn(readinessService, 'recalcularReadinessJugadora').mockRejectedValueOnce(new Error('Fallo provocado en readiness'))

    const rows: PreviewRow[] = [
      {
        filaOriginal: 2,
        estado: 'NUEVO',
        id_jugadora: J1,
        nombreJugadora: 'Ana López',
        fecha: '2026-07-20',
        calidad_sueno: 9, fatiga: 2, dolor_muscular: 2, estres: 1, estado_animo: 10, dolor_especifico: null,
        mensaje: 'OK',
        normalRow: {
          id_jugadora: J1,
          fecha: '2026-07-20',
          calidad_sueno: 9, fatiga: 2, dolor_muscular: 2, estres: 1, estado_animo: 10, dolor_especifico: null, marca_temporal: null
        }
      }
    ]

    const outcome = await aplicarImportacionWellness(rows, 'omit', 'fail_readiness.csv', 'Hoja1', 'default', 'backup.json')

    expect(outcome.success).toBe(false)

    // Wellness rolled back physically
    const wellness = await db.wellness.where({ id_jugadora: J1 }).toArray()
    expect(wellness).toHaveLength(0)

    // Readiness rolled back physically
    const readiness = await db.readiness.where({ id_jugadora: J1 }).toArray()
    expect(readiness).toHaveLength(0)

    // Historial records error (not success)
    const historial = await db.historial_importaciones.toArray()
    expect(historial).toHaveLength(1)
    expect(historial[0].estado).toBe('error')

    spy.mockRestore()
  })

  it('9. Error inducido en resumen semanal: rollback físico total de wellness, readiness y resumen', async () => {
    const spy = vi.spyOn(resumenService, 'recalcularResumenSemanal').mockRejectedValueOnce(new Error('Fallo provocado en resumen semanal'))

    const rows: PreviewRow[] = [
      {
        filaOriginal: 2,
        estado: 'NUEVO',
        id_jugadora: J1,
        nombreJugadora: 'Ana López',
        fecha: '2026-07-20',
        calidad_sueno: 9, fatiga: 2, dolor_muscular: 2, estres: 1, estado_animo: 10, dolor_especifico: null,
        mensaje: 'OK',
        normalRow: {
          id_jugadora: J1,
          fecha: '2026-07-20',
          calidad_sueno: 9, fatiga: 2, dolor_muscular: 2, estres: 1, estado_animo: 10, dolor_especifico: null, marca_temporal: null
        }
      }
    ]

    const outcome = await aplicarImportacionWellness(rows, 'omit', 'fail_resumen.csv', 'Hoja1', 'default', 'backup.json')

    expect(outcome.success).toBe(false)

    // Rollback of all wellness & readiness
    expect(await db.wellness.count()).toBe(0)
    expect(await db.readiness.count()).toBe(0)
    expect(await db.resumen_semanal.count()).toBe(0)

    // Error audit history logged
    const historial = await db.historial_importaciones.toArray()
    expect(historial).toHaveLength(1)
    expect(historial[0].estado).toBe('error')

    spy.mockRestore()
  })
})
