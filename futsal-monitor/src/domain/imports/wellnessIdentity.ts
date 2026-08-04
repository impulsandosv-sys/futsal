import type { FutsalDB } from '@/db/database'
import type { OrigenAlias, Temporada } from '@/types'
import { validateFechaLocalISO } from '@/domain/dates/dates'

export interface ResolucionIdentidadWellness {
  exito: boolean
  id_jugadora?: string
  alias_origen?: string
  mensajeError?: string
}

export interface ValidacionTemporadaWellness {
  exito: boolean
  id_temporada?: string
  mensajeError?: string
}

/**
 * Resuelve la identidad de una fila de importación exclusivamente por alias activo de origen 'google_forms'.
 * Rechaza IDs vacíos, alias inexistentes, alias inactivos y jugadoras borradas de la DB.
 * NO realiza coincidencia por nombre ni fallbacks por texto.
 */
export async function resolverIdentidadFilaWellness(
  db: FutsalDB,
  valorExternalRaw: unknown,
  origen: OrigenAlias = 'google_forms'
): Promise<ResolucionIdentidadWellness> {
  if (valorExternalRaw === null || valorExternalRaw === undefined) {
    return { exito: false, mensajeError: 'ID_Jugadora ausente' }
  }

  const aliasValor = String(valorExternalRaw).trim()
  if (!aliasValor) {
    return { exito: false, mensajeError: 'ID_Jugadora vacío' }
  }

  const candidatos = await db.alias_jugadora
    .where('origen')
    .equals(origen)
    .toArray()

  const candidatosValor = candidatos.filter((a) => a.valor.trim() === aliasValor)

  if (candidatosValor.length === 0) {
    return {
      exito: false,
      mensajeError: `ID externo '${aliasValor}' no reconocido para el origen '${origen}'`
    }
  }

  const aliasActivo = candidatosValor.find((a) => a.activo === true)
  if (!aliasActivo) {
    return {
      exito: false,
      mensajeError: `Alias '${aliasValor}' inactivo para el origen '${origen}'`
    }
  }

  const jugadora = await db.jugadoras.get(aliasActivo.id_jugadora)
  if (!jugadora) {
    return {
      exito: false,
      mensajeError: `La jugadora '${aliasActivo.id_jugadora}' no existe en la base de datos`
    }
  }

  return {
    exito: true,
    id_jugadora: aliasActivo.id_jugadora,
    alias_origen: aliasValor
  }
}

/**
 * Valida que una fecha local ISO pertenezca al rango inclusivo de la temporada activa especificada.
 */
export function validarRangoTemporadaWellness(
  fechaLocal: string,
  temporadaActiva: Temporada | null
): ValidacionTemporadaWellness {
  if (!temporadaActiva) {
    return {
      exito: false,
      mensajeError: 'No existe una temporada activa. Crea o activa una temporada antes de importar wellness.'
    }
  }

  const errFecha = validateFechaLocalISO(fechaLocal, 'fecha')
  if (errFecha) {
    return { exito: false, mensajeError: errFecha }
  }

  if (fechaLocal < temporadaActiva.fecha_inicio || fechaLocal > temporadaActiva.fecha_fin) {
    return {
      exito: false,
      mensajeError: `Fecha '${fechaLocal}' fuera del rango de la temporada activa (${temporadaActiva.fecha_inicio} a ${temporadaActiva.fecha_fin})`
    }
  }

  return {
    exito: true,
    id_temporada: temporadaActiva.id_temporada
  }
}
