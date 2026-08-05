import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.unmock('@/db/database')
vi.unmock('@/utils/backup')
vi.unmock('@/services/resumenSemanal')
vi.unmock('@/services/readiness')

import { db } from '@/db/database'
import {
  createBackupData,
  validateBackupData,
  restoreFromData,
  regenerarTablasDerivadas
} from '@/utils/backup'
import type { BackupFile } from '@/types'

describe('Bloque E — Integración real Dexie de Backups y Restauración (Merge, Replace, Rollback, Derivados)', () => {
  const baseValidData = {
    jugadoras: [],
    sesiones: [],
    partidos: [],
    lesiones: [],
    temporadas: []
  }

  beforeEach(async () => {
    // Setup DOM and localStorage mocks for forceExternalBackup
    const storage: Record<string, string> = {}
    global.localStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => { storage[key] = value },
      removeItem: (key: string) => { delete storage[key] },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
      length: 0,
      key: () => null
    } as any

    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()
    HTMLAnchorElement.prototype.click = vi.fn()

    await db.jugadoras.clear()
    await db.temporadas.clear()
    await db.alias_jugadora.clear()
    await db.wellness.clear()
    await db.sesiones.clear()
    await db.partidos.clear()
    await db.lesiones.clear()
    await db.sesion_rpe.clear()
    await db.rpe_partido.clear()
    await db.readiness.clear()
    await db.resumen_semanal.clear()
    await db.alertas.clear()
    await db.historial_importaciones.clear()
    await db.historial_copias.clear()
  })

  it('1. Backup completo incluye las 29 tablas del esquema actual', async () => {
    await db.jugadoras.add({
      id_jugadora: 'J001',
      nombre: 'Ana Lopez',
      posicion: 'Ala',
      activa: true
    })

    const backup = await createBackupData()
    expect(backup).toBeDefined()
    expect(backup.version).toBeDefined()
    expect(backup.data.jugadoras).toHaveLength(1)
    expect(backup.data.jugadoras[0].id_jugadora).toBe('J001')
    expect(Object.keys(backup.data).length).toBe(29)
  })

  it('2. Validación de backup: rechaza JSON inválido, versión no soportada y ausencia de tablas críticas', () => {
    expect(validateBackupData(null).canRestore).toBe(false)
    expect(validateBackupData({ version: 999, data: {} }).canRestore).toBe(false)
    expect(validateBackupData({ backupFormatVersion: 1, databaseSchemaVersion: 15, data: { wellness: [] } }).canRestore).toBe(false) // Falta jugadoras/sesiones/etc
  })

  it('3. Restore merge sin conflictos: inserta nuevos datos de jugadora y wellness sin tocar datos locales ajenos', async () => {
    // Local
    await db.jugadoras.add({ id_jugadora: 'J001', nombre: 'Ana Local', posicion: 'Ala', activa: true })

    // Incoming
    const backup: BackupFile = {
      version: 15,
      backupFormatVersion: 1,
      databaseSchemaVersion: 15,
      timestamp: new Date().toISOString(),
      data: {
        ...baseValidData,
        jugadoras: [{ id_jugadora: 'J002', nombre: 'Maria Entrante', posicion: 'Pivot', activa: true }],
        wellness: [{ id_jugadora: 'J002', fecha: '2026-02-01', calidad_sueno: 8, fatiga: 3, dolor_muscular: 2, estres: 2, estado_animo: 8, score_wellness: 8.0 }]
      }
    }

    const res = await restoreFromData(backup, 'merge', 'skip')
    expect(res.success).toBe(true)

    const jugadoras = await db.jugadoras.toArray()
    expect(jugadoras.length).toBe(2)
    expect(jugadoras.map(j => j.id_jugadora)).toContain('J001')
    expect(jugadoras.map(j => j.id_jugadora)).toContain('J002')
  })

  it('4. Restore merge con conflicto y estrategia skip: conserva la versión local', async () => {
    await db.jugadoras.add({ id_jugadora: 'J001', nombre: 'Ana Nombre Local', posicion: 'Ala', activa: true })

    const backup: BackupFile = {
      version: 15,
      backupFormatVersion: 1,
      databaseSchemaVersion: 15,
      timestamp: new Date().toISOString(),
      data: {
        ...baseValidData,
        jugadoras: [{ id_jugadora: 'J001', nombre: 'Ana Nombre Entrante', posicion: 'Ala', activa: true }]
      }
    }

    const res = await restoreFromData(backup, 'merge', 'skip')
    expect(res.success).toBe(true)
    expect(res.stats.jugadoras.skipped).toBe(1)

    const j = await db.jugadoras.get('J001')
    expect(j?.nombre).toBe('Ana Nombre Local')
  })

  it('5. Restore merge con conflicto y estrategia overwrite: actualiza con el dato entrante', async () => {
    await db.jugadoras.add({ id_jugadora: 'J001', nombre: 'Ana Nombre Local', posicion: 'Ala', activa: true })

    const backup: BackupFile = {
      version: 15,
      backupFormatVersion: 1,
      databaseSchemaVersion: 15,
      timestamp: new Date().toISOString(),
      data: {
        ...baseValidData,
        jugadoras: [{ id_jugadora: 'J001', nombre: 'Ana Nombre Actualizado', posicion: 'Ala', activa: true }]
      }
    }

    const res = await restoreFromData(backup, 'merge', 'overwrite')
    expect(res.success).toBe(true)
    expect(res.stats.jugadoras.updated).toBe(1)

    const j = await db.jugadoras.get('J001')
    expect(j?.nombre).toBe('Ana Nombre Actualizado')
  })

  it('6. Restore merge con huérfano: ignora wellness de jugadora inexistente y registra conflicto', async () => {
    const backup: BackupFile = {
      version: 15,
      backupFormatVersion: 1,
      databaseSchemaVersion: 15,
      timestamp: new Date().toISOString(),
      data: {
        ...baseValidData,
        wellness: [{ id_jugadora: 'J_INEXISTENTE', fecha: '2026-02-01', calidad_sueno: 8, fatiga: 3, dolor_muscular: 2, estres: 2, estado_animo: 8, score_wellness: 8.0 }]
      }
    }

    const res = await restoreFromData(backup, 'merge', 'skip')
    expect(res.success).toBe(true)
    expect(res.stats.wellness.skipped).toBe(1)
    expect(res.conflicts.length).toBeGreaterThan(0)
    expect(await db.wellness.count()).toBe(0)
  })

  it('7. Restore replace con backup previo exitoso: reemplaza completamente los datos', async () => {
    await db.jugadoras.add({ id_jugadora: 'J_ANTIGUA', nombre: 'Vieja Jugadora', posicion: 'Ala', activa: true })

    const fullBackup = await createBackupData()
    fullBackup.data.jugadoras = [{ id_jugadora: 'J_NUEVA', nombre: 'Nueva Jugadora Replace', posicion: 'Ala', activa: true } as any]

    const res = await restoreFromData(fullBackup, 'replace')
    expect(res.success).toBe(true)

    const jugadoras = await db.jugadoras.toArray()
    expect(jugadoras.length).toBe(1)
    expect(jugadoras[0].id_jugadora).toBe('J_NUEVA')
  })

  it('8. Restore replace con fallo por tablas ausentes del contrato: cancela la operación sin borrar nada', async () => {
    await db.jugadoras.add({ id_jugadora: 'J_SAFE', nombre: 'Jugadora Segura', posicion: 'Ala', activa: true })

    const badBackup: BackupFile = {
      version: 15,
      backupFormatVersion: 1,
      databaseSchemaVersion: 15,
      timestamp: new Date().toISOString(),
      data: {
        jugadoras: [{ id_jugadora: 'J_INCOMPLETA', nombre: 'Incompleta', posicion: 'Ala', activa: true }]
        // Falta el resto de tablas del contrato
      }
    }

    const res = await restoreFromData(badBackup, 'replace')
    expect(res.success).toBe(false)

    // Verificar que los datos originales siguen intactos
    const jugadoras = await db.jugadoras.toArray()
    expect(jugadoras.length).toBe(1)
    expect(jugadoras[0].id_jugadora).toBe('J_SAFE')
  })

  it('9. Regeneración de tablas derivadas (readiness y resumen_semanal)', async () => {
    await db.jugadoras.add({ id_jugadora: 'J001', nombre: 'Ana Lopez', posicion: 'Ala', activa: true })
    await db.wellness.add({
      id_jugadora: 'J001',
      fecha: '2026-02-01',
      calidad_sueno: 8,
      fatiga: 3,
      dolor_muscular: 2,
      estres: 2,
      estado_animo: 8,
      score_wellness: 8.0,
      dolor_especifico: ''
    })

    await regenerarTablasDerivadas()

    const readinessList = await db.readiness.toArray()
    expect(readinessList.length).toBeGreaterThan(0)
    expect(readinessList[0].id_jugadora).toBe('J001')

    const resumenesList = await db.resumen_semanal.toArray()
    expect(resumenesList.length).toBeGreaterThan(0)
    expect(resumenesList[0].id_jugadora).toBe('J001')
  })
})
