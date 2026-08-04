import type { Temporada } from '@/types'
import type { FutsalDB } from '@/db/database'
import { validateFechaLocalISO } from '@/domain/dates/dates'

/**
 * Valida la consistencia de una entidad Temporada.
 * Retorna lista de errores o un array vacío si la temporada es totalmente válida.
 */
export function validarTemporada(t: Partial<Temporada>): string[] {
  const errors: string[] = []

  if (!t.id_temporada || !t.id_temporada.trim()) {
    errors.push('El ID de temporada es obligatorio')
  }

  if (!t.nombre || !t.nombre.trim()) {
    errors.push('El nombre de temporada es obligatorio')
  }

  const errInicio = validateFechaLocalISO(t.fecha_inicio, 'fecha_inicio')
  if (errInicio) errors.push(errInicio)

  const errFin = validateFechaLocalISO(t.fecha_fin, 'fecha_fin')
  if (errFin) errors.push(errFin)

  if (!errInicio && !errFin && t.fecha_inicio! > t.fecha_fin!) {
    errors.push('La fecha de inicio no puede ser posterior a la fecha de fin')
  }

  return errors
}

/**
 * Crea una nueva temporada en la base de datos de forma atómica.
 * Si la nueva temporada es creada como activa, desactiva cualquier otra temporada previamente activa.
 */
export async function crearTemporada(db: FutsalDB, t: Temporada): Promise<void> {
  const errs = validarTemporada(t)
  if (errs.length > 0) {
    throw new Error(errs.join('. '))
  }

  await db.transaction('rw', db.temporadas, async () => {
    const exist = await db.temporadas.get(t.id_temporada)
    if (exist) {
      throw new Error(`Ya existe una temporada con el ID '${t.id_temporada}'`)
    }

    if (t.activa) {
      const todas = await db.temporadas.toArray()
      for (const s of todas) {
        if (s.activa) {
          await db.temporadas.put({ ...s, activa: false })
        }
      }
    }

    await db.temporadas.put(t)
  })
}

/**
 * Marca la temporada especificada como activa y desactiva de forma atómica cualquier otra temporada activa.
 */
export async function activarTemporada(db: FutsalDB, idTemporada: string): Promise<void> {
  await db.transaction('rw', db.temporadas, async () => {
    const target = await db.temporadas.get(idTemporada)
    if (!target) {
      throw new Error(`La temporada '${idTemporada}' no existe en la base de datos`)
    }

    const todas = await db.temporadas.toArray()
    for (const s of todas) {
      if (s.id_temporada === idTemporada) {
        if (!s.activa) {
          await db.temporadas.put({ ...s, activa: true })
        }
      } else if (s.activa) {
        await db.temporadas.put({ ...s, activa: false })
      }
    }
  })
}

/**
 * Archiva (desactiva) la temporada indicada conservando intactos su registro y datos.
 */
export async function archivarTemporada(db: FutsalDB, idTemporada: string): Promise<void> {
  await db.transaction('rw', db.temporadas, async () => {
    const target = await db.temporadas.get(idTemporada)
    if (!target) {
      throw new Error(`La temporada '${idTemporada}' no existe en la base de datos`)
    }
    if (target.activa) {
      await db.temporadas.put({ ...target, activa: false })
    }
  })
}

/**
 * Obtiene la única temporada actualmente activa, o null si ninguna está marcada como activa.
 */
export async function obtenerTemporadaActiva(db: FutsalDB): Promise<Temporada | null> {
  if (!db || !db.temporadas || typeof db.temporadas.toArray !== 'function') {
    return null
  }
  const todas = await db.temporadas.toArray()
  return todas.find((t) => t.activa === true) || null
}
