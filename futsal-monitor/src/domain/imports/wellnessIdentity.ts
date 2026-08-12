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
 * Resuelve la identidad de una fila de importación mediante una estrategia de prioridad:
 * 1. ID interno exacto.
 * 2. Alias activo de origen especificado (ej: 'google_forms').
 * 3. Nombre normalizado no ambiguo (ignorando mayúsculas, tildes y espacios).
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

  // 1. Prioridad 1: ID interno exacto
  const jugadoraPorId = await db.jugadoras.get(aliasValor)
  if (jugadoraPorId && jugadoraPorId.activa) {
    return {
      exito: true,
      id_jugadora: jugadoraPorId.id_jugadora,
      alias_origen: aliasValor
    }
  }

  // 2. Prioridad 2: Alias explícito activo
  const candidatos = await db.alias_jugadora
    .where('origen')
    .equals(origen)
    .toArray()

  const candidatosValor = candidatos.filter((a) => a.valor.trim() === aliasValor)
  
  if (candidatosValor.length > 0) {
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

  // 3. Prioridad 3: Nombre normalizado no ambiguo
  const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim()
  const aliasNormalizado = normalizar(aliasValor)
  
  const jugadorasActivas = await db.jugadoras.filter(j => j.activa === true).toArray()
  const jugadorasCoincidentes = jugadorasActivas.filter(j => {
    const n = normalizar(j.nombre)
    return n === aliasNormalizado || n.startsWith(aliasNormalizado + ' ') || n.includes(' ' + aliasNormalizado)
  })

  if (jugadorasCoincidentes.length === 1) {
    return {
      exito: true,
      id_jugadora: jugadorasCoincidentes[0].id_jugadora,
      alias_origen: aliasValor
    }
  } else if (jugadorasCoincidentes.length > 1) {
    return {
      exito: false,
      mensajeError: `Ambigüedad: Múltiples jugadoras coinciden con el nombre '${aliasValor}'. Corrige el nombre o usa un alias.`
    }
  }

  // Fallback final
  return {
    exito: false,
    mensajeError: `Jugadora no registrada. Añádela a la plantilla o configura un alias para '${aliasValor}'`
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
