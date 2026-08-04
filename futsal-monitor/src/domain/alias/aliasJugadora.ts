import type { AliasJugadora, OrigenAlias } from '@/types'
import type { FutsalDB } from '@/db/database'
import { validateFechaLocalISO, getLocalDateString } from '@/domain/dates/dates'

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

/**
 * Registra un alias externo para una jugadora de forma atómica.
 * Verifica que la jugadora exista y previene que el mismo par (origen, valor) esté asignado
 * a otra jugadora con estado activo.
 */
export async function agregarAliasJugadora(db: FutsalDB, alias: AliasJugadora): Promise<number> {
  const errs = validarAliasJugadora(alias)
  if (errs.length > 0) {
    throw new Error(errs.join('. '))
  }

  return await db.transaction('rw', [db.alias_jugadora, db.jugadoras], async () => {
    const jugadora = await db.jugadoras.get(alias.id_jugadora)
    if (!jugadora) {
      throw new Error(`La jugadora '${alias.id_jugadora}' no existe en la base de datos`)
    }

    const valorNormalizado = alias.valor.trim()
    const candidatos = await db.alias_jugadora
      .where({ origen: alias.origen, valor: valorNormalizado })
      .toArray()

    const colision = candidatos.find(
      (a) => a.id_jugadora !== alias.id_jugadora && a.activo === true,
    )

    if (colision) {
      throw new Error(
        `El alias (origen: '${alias.origen}', valor: '${valorNormalizado}') ya está registrado para otra jugadora ('${colision.id_jugadora}')`,
      )
    }

    const id = await db.alias_jugadora.put({
      ...alias,
      valor: valorNormalizado,
    })

    return id
  })
}

/**
 * Resuelve el ID interno de jugadora a partir del par (origen, valor).
 * Solamente retorna el id_jugadora si existe un alias coincidente con activo === true.
 * Retorna null si el alias no existe o está inactivo.
 */
export async function resolverAliasActivo(
  db: FutsalDB,
  origen: OrigenAlias,
  valor: string,
): Promise<string | null> {
  if (!valor || !valor.trim()) return null

  const valorNormalizado = valor.trim()
  const candidatos = await db.alias_jugadora
    .where({ origen, valor: valorNormalizado })
    .toArray()

  const activoMatch = candidatos.find((a) => a.activo === true)
  return activoMatch ? activoMatch.id_jugadora : null
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
