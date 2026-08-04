import type { FutsalDB } from '@/db/database'

export type EstadoPreparacionChronojump =
  | 'lista'
  | 'sin_alias'
  | 'alias_inactivo'
  | 'alias_duplicado'

export interface PreparacionChronojumpJugadora {
  idJugadora: string
  nombreVisible: string
  estado: EstadoPreparacionChronojump
  aliasesChronojump: Array<{
    id?: number
    valor: string
    activo: boolean
  }>
  aliasOperativo?: string
  mensaje: string
}

export interface PreparacionChronojumpResumen {
  totalActivas: number
  totalListas: number
  totalRequierenCorreccion: number
  jugadoras: PreparacionChronojumpJugadora[]
}

/**
 * Consulta la base de datos Dexie y calcula el estado de preparación para Chronojump
 * de todas las jugadoras activas.
 *
 * Es una consulta pura de lectura que no muta datos.
 */
export async function obtenerPreparacionChronojump(db: FutsalDB): Promise<PreparacionChronojumpResumen> {
  // Cargar jugadoras activas
  const todasJugadoras = await db.jugadoras.toArray()
  const jugadorasActivas = todasJugadoras.filter((j) => j.activa === true)

  // Cargar todos los aliases con origen exactamente 'chronojump'
  const todosAliases = await db.alias_jugadora.toArray()
  const aliasesChronojump = todosAliases.filter((a) => a.origen === 'chronojump')

  // Agrupar aliases por id_jugadora
  const mapAliases = new Map<string, typeof aliasesChronojump>()
  aliasesChronojump.forEach((a) => {
    const lista = mapAliases.get(a.id_jugadora) || []
    lista.push(a)
    mapAliases.set(a.id_jugadora, lista)
  })

  const listaResultado: PreparacionChronojumpJugadora[] = []
  let totalListas = 0
  let totalRequierenCorreccion = 0

  for (const jugadora of jugadorasActivas) {
    const aliasesSujeto = mapAliases.get(jugadora.id_jugadora) || []
    const aliasesActivos = aliasesSujeto.filter((a) => a.activo)
    const aliasesInactivos = aliasesSujeto.filter((a) => !a.activo)

    let estado: EstadoPreparacionChronojump
    let aliasOperativo: string | undefined
    let mensaje: string

    if (aliasesActivos.length === 1) {
      estado = 'lista'
      aliasOperativo = aliasesActivos[0].valor
      mensaje = `Lista con alias activo "${aliasOperativo}"`
      totalListas++
    } else if (aliasesActivos.length > 1) {
      estado = 'alias_duplicado'
      mensaje = `Múltiples aliases activos detectados (${aliasesActivos.map((a) => a.valor).join(', ')})`
      totalRequierenCorreccion++
    } else if (aliasesInactivos.length > 0) {
      estado = 'alias_inactivo'
      mensaje = `Alias registado está inactivo (${aliasesInactivos.map((a) => a.valor).join(', ')})`
      totalRequierenCorreccion++
    } else {
      estado = 'sin_alias'
      mensaje = 'Sin alias Chronojump registrado'
      totalRequierenCorreccion++
    }

    listaResultado.push({
      idJugadora: jugadora.id_jugadora,
      nombreVisible: jugadora.nombre,
      estado,
      aliasesChronojump: aliasesSujeto.map((a) => ({
        id: a.id_alias,
        valor: a.valor,
        activo: a.activo,
      })),
      aliasOperativo,
      mensaje,
    })
  }

  // Ordenar: jugadoras que requieren corrección primero (sin_alias, alias_inactivo, alias_duplicado), luego listas
  const pesoEstado: Record<EstadoPreparacionChronojump, number> = {
    sin_alias: 1,
    alias_inactivo: 2,
    alias_duplicado: 3,
    lista: 4,
  }

  listaResultado.sort((a, b) => {
    const diffPeso = pesoEstado[a.estado] - pesoEstado[b.estado]
    if (diffPeso !== 0) return diffPeso
    return a.nombreVisible.localeCompare(b.nombreVisible)
  })

  return {
    totalActivas: jugadorasActivas.length,
    totalListas,
    totalRequierenCorreccion,
    jugadoras: listaResultado,
  }
}
