import type { AliasJugadora, OrigenAlias } from '@/types'
import type { FutsalDB } from '@/db/database'
import { validateFechaLocalISO, getLocalDateString } from '@/domain/dates/dates'

/**
 * Normaliza un texto para comparación segura de alias:
 * - Elimina espacios al inicio y final.
 * - Convierte múltiples espacios internos en uno solo.
 * - Convierte a minúsculas.
 * - Elimina diacríticos (tildes).
 */
export function normalizarAlias(s: string): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Valida la consistencia de una entidad AliasJugadora.
 * Retorna una lista de errores o un array vacío si el alias es totalmente válido.
 */
export function validarAliasJugadora(alias: Partial<AliasJugadora>): string[] {
  const errors: string[] = []

  if (!alias.id_jugadora || !alias.id_jugadora.trim()) {
    errors.push('El ID de jugadora es obligatorio')
  }

  if (!alias.origen) {
    errors.push('El origen del alias es obligatorio')
  }

  if (!alias.valor || !alias.valor.trim()) {
    errors.push('El valor del alias es obligatorio')
  }

  const errAlta = validateFechaLocalISO(alias.fecha_alta, 'fecha_alta')
  if (errAlta) errors.push(errAlta)

  if (alias.fecha_baja) {
    const errBaja = validateFechaLocalISO(alias.fecha_baja, 'fecha_baja')
    if (errBaja) errors.push(errBaja)
    if (!errAlta && !errBaja && alias.fecha_alta! > alias.fecha_baja) {
      errors.push('La fecha de alta no puede ser posterior a la fecha de baja')
    }
  }

  return errors
}

export type ResultadoPersistenciaAlias =
  | { accion: 'creado'; id_alias: number }
  | { accion: 'reactivado'; id_alias: number }
  | { accion: 'existente'; id_alias: number }

/**
 * Registra un alias externo para una jugadora de forma atómica.
 * Verifica que la jugadora exista y previene que el mismo par (origen, valor) esté asignado
 * a otra jugadora con estado activo.
 */
export async function agregarAliasJugadora(db: FutsalDB, alias: AliasJugadora): Promise<ResultadoPersistenciaAlias> {
  const errs = validarAliasJugadora(alias)
  if (errs.length > 0) {
    throw new Error(errs.join('. '))
  }

  return await db.transaction('rw', [db.alias_jugadora, db.jugadoras], async () => {
    const jugadora = await db.jugadoras.get(alias.id_jugadora)
    if (!jugadora) {
      throw new Error(`La jugadora '${alias.id_jugadora}' no existe en la base de datos`)
    }

    const valorNormalizado = normalizarAlias(alias.valor)
    const orígenesAComprobar = alias.origen === 'wellness' ? ['wellness', 'google_forms'] : [alias.origen]
    const candidatosTotales = await db.alias_jugadora
      .where('origen').anyOf(orígenesAComprobar)
      .toArray()
    const candidatos = candidatosTotales.filter(a => normalizarAlias(a.valor) === valorNormalizado)

    // 1. Colisiones activas con otras jugadoras (Prioridad absoluta)
    const colision = candidatos.find(
      (a) => a.id_jugadora !== alias.id_jugadora && a.activo === true,
    )
    if (colision) {
      throw new Error(
        `El alias '${alias.valor}' ya está registrado para otra jugadora (ID: ${colision.id_jugadora}).`
      )
    }

    // 2. Reactivación / Idempotencia misma jugadora
    const existenteMismaJugadora = candidatos.find(a => a.id_jugadora === alias.id_jugadora)
    if (existenteMismaJugadora) {
      if (!existenteMismaJugadora.activo) {
        // Reactivar alias inactivo para la misma jugadora
        await db.alias_jugadora.update(existenteMismaJugadora.id_alias!, { activo: true, fecha_baja: undefined })
        return { accion: 'reactivado', id_alias: existenteMismaJugadora.id_alias! }
      }
      // Ya existe y está activo para la misma jugadora: idempotente
      return { accion: 'existente', id_alias: existenteMismaJugadora.id_alias! }
    }

    // 3. Alta nueva
    const newAlias = { ...alias, valor: alias.valor.trim() }
    const id = await db.alias_jugadora.add(newAlias)
    return { accion: 'creado', id_alias: id }
  })
}

export class AmbiguousAliasError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmbiguousAliasError';
  }
}

/**
 * Resuelve un alias a una id_jugadora si existe y está activo.
 * Si detecta múltiples IDs activos para el mismo alias normalizado, lanza AmbiguousAliasError.
 */
export async function resolverAliasActivo(
  db: FutsalDB,
  origen: OrigenAlias,
  valor: string
): Promise<string | null> {
  if (!valor || !valor.trim()) return null

  const valorNormalizado = normalizarAlias(valor)
  const orígenesAComprobar = origen === 'wellness' ? ['wellness', 'google_forms'] : [origen]
  const candidatosTotales = await db.alias_jugadora
    .where('origen').anyOf(orígenesAComprobar)
    .toArray()

  const candidatos = candidatosTotales.filter(a => normalizarAlias(a.valor) === valorNormalizado)
  const candidatosActivos = candidatos.filter(a => a.activo === true)

  if (candidatosActivos.length === 0) return null

  const idsUnicos = Array.from(new Set(candidatosActivos.map(a => a.id_jugadora)))
  if (idsUnicos.length > 1) {
    throw new AmbiguousAliasError(`Resolución ambigua: el alias '${valor}' apunta simultáneamente a las jugadoras: ${idsUnicos.join(', ')}`)
  }

  return idsUnicos[0]
}

/**
 * Desactiva un alias de jugadora y registra opcionalmente su fecha de baja.
 */
export async function desactivarAliasJugadora(
  db: FutsalDB,
  idAlias: number,
  fechaBaja?: string,
): Promise<void> {
  await db.transaction('rw', db.alias_jugadora, async () => {
    const alias = await db.alias_jugadora.get(idAlias)
    if (!alias) {
      throw new Error(`No existe el alias con ID '${idAlias}'`)
    }

    const fb = fechaBaja || getLocalDateString()
    const errB = validateFechaLocalISO(fb, 'fecha_baja')
    if (errB) throw new Error(errB)

    await db.alias_jugadora.put({
      ...alias,
      activo: false,
      fecha_baja: fb,
    })
  })
}
