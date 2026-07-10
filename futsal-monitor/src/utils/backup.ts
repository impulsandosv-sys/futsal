import { db } from '@/db/database'

const BACKUP_KEY = 'futsal_backup'
const BACKUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutos
const AUTO_BACKUP_ENABLED_KEY = 'futsal_autobackup'

let backupTimer: ReturnType<typeof setInterval> | null = null

export async function createBackup(): Promise<void> {
  try {
    const [jugadoras, wellness, sesiones, partidos, lesiones, tests, rpe_entreno, rpe_partido, resumen_semanal, alertas] =
      await Promise.all([
        db.jugadoras.toArray(),
        db.wellness.toArray(),
        db.sesiones.toArray(),
        db.partidos.toArray(),
        db.lesiones.toArray(),
        db.tests_fisicos.toArray(),
        db.rpe_entreno.toArray(),
        db.rpe_partido.toArray(),
        db.resumen_semanal.toArray(),
        db.alertas.toArray(),
      ])

    const backup = {
      version: 1,
      timestamp: new Date().toISOString(),
      data: { jugadoras, wellness, sesiones, partidos, lesiones, tests, rpe_entreno, rpe_partido, resumen_semanal, alertas },
    }

    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup))
  } catch {
    // Backup silencioso, no interrumpir al usuario
  }
}

export async function restoreBackup(): Promise<boolean> {
  const raw = localStorage.getItem(BACKUP_KEY)
  if (!raw) return false

  try {
    const backup = JSON.parse(raw)
    if (!backup?.data) return false

    await db.transaction('rw', [
      db.jugadoras, db.wellness, db.sesiones, db.partidos,
      db.lesiones, db.tests_fisicos, db.rpe_entreno, db.rpe_partido,
      db.resumen_semanal, db.alertas,
    ], async () => {
      await Promise.all([
        db.jugadoras.clear(),
        db.wellness.clear(),
        db.sesiones.clear(),
        db.partidos.clear(),
        db.lesiones.clear(),
        db.tests_fisicos.clear(),
        db.rpe_entreno.clear(),
        db.rpe_partido.clear(),
        db.resumen_semanal.clear(),
        db.alertas.clear(),
      ])

      const d = backup.data
      if (d.jugadoras?.length) await db.jugadoras.bulkPut(d.jugadoras)
      if (d.wellness?.length) await db.wellness.bulkPut(d.wellness)
      if (d.sesiones?.length) await db.sesiones.bulkPut(d.sesiones)
      if (d.partidos?.length) await db.partidos.bulkPut(d.partidos)
      if (d.lesiones?.length) await db.lesiones.bulkPut(d.lesiones)
      if (d.tests?.length) await db.tests_fisicos.bulkPut(d.tests)
      if (d.rpe_entreno?.length) await db.rpe_entreno.bulkPut(d.rpe_entreno)
      if (d.rpe_partido?.length) await db.rpe_partido.bulkPut(d.rpe_partido)
      if (d.resumen_semanal?.length) await db.resumen_semanal.bulkPut(d.resumen_semanal)
      if (d.alertas?.length) await db.alertas.bulkPut(d.alertas)
    })

    return true
  } catch {
    return false
  }
}

export function getBackupInfo(): { exists: boolean; timestamp: string | null } {
  const raw = localStorage.getItem(BACKUP_KEY)
  if (!raw) return { exists: false, timestamp: null }
  try {
    const backup = JSON.parse(raw)
    return { exists: true, timestamp: backup.timestamp || null }
  } catch {
    return { exists: false, timestamp: null }
  }
}

export function exportBackupToFile(): void {
  const raw = localStorage.getItem(BACKUP_KEY)
  if (!raw) return
  const blob = new Blob([raw], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `futsal_backup_${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function isAutoBackupEnabled(): boolean {
  return localStorage.getItem(AUTO_BACKUP_ENABLED_KEY) !== 'false'
}

export function setAutoBackupEnabled(enabled: boolean): void {
  localStorage.setItem(AUTO_BACKUP_ENABLED_KEY, String(enabled))
}

export function startAutoBackup(): void {
  stopAutoBackup()
  if (!isAutoBackupEnabled()) return
  backupTimer = setInterval(() => {
    createBackup()
  }, BACKUP_INTERVAL_MS)
}

export function stopAutoBackup(): void {
  if (backupTimer) {
    clearInterval(backupTimer)
    backupTimer = null
  }
}
