import { db } from '@/db/database'
import { compararReadinessDeterminista } from '@/domain/monitoring/monitoring'
import { recalcularReadinessJugadora } from './readiness'
import { useStore } from '@/store/store'
import type { Readiness } from '@/types'

export interface DetalleGrupoDuplicado {
  id_jugadora: string
  fecha: string
  cantidad: number
  ids: (number | undefined)[]
  fechas_creacion: (string | undefined)[]
  id_seleccionado_actual: number | undefined
}

export interface DiagnosticoDuplicadosReadiness {
  totalGruposDuplicados: number
  totalFilasDuplicadas: number
  detalles: DetalleGrupoDuplicado[]
}

export interface ResultadoReparacionReadiness {
  timestamp: string
  gruposDetectados: number
  gruposReparados: number
  gruposOmitidos: number
  filasEliminadas: number
  errores: string[]
}

/**
 * Diagnóstico de lectura de duplicados históricos de readiness en Dexie.
 * No realiza ninguna modificación o borrado de datos.
 */
export async function diagnosticarDuplicadosReadiness(): Promise<DiagnosticoDuplicadosReadiness> {
  const todos = await db.readiness.toArray()
  const grupos = new Map<string, Readiness[]>()

  for (const r of todos) {
    const key = `${r.id_jugadora}___${r.fecha}`
    const list = grupos.get(key) || []
    list.push(r)
    grupos.set(key, list)
  }

  const detalles: DetalleGrupoDuplicado[] = []
  let totalFilasDuplicadas = 0

  for (const list of grupos.values()) {
    if (list.length > 1) {
      const best = [...list].sort(compararReadinessDeterminista)[0]
      const first = list[0]
      totalFilasDuplicadas += list.length - 1

      detalles.push({
        id_jugadora: first.id_jugadora,
        fecha: first.fecha,
        cantidad: list.length,
        ids: list.map(r => r.id),
        fechas_creacion: list.map(r => r.creada),
        id_seleccionado_actual: best?.id
      })
    }
  }

  return {
    totalGruposDuplicados: detalles.length,
    totalFilasDuplicadas,
    detalles
  }
}

/**
 * Reparación explícita y protegida de duplicados históricos de readiness.
 * Requiere confirmación explícita (confirmado === true).
 */
export async function repararDuplicadosReadiness(
  confirmado: boolean
): Promise<ResultadoReparacionReadiness> {
  if (!confirmado) {
    throw new Error('La reparación de readiness requiere confirmación explícita del usuario.')
  }

  const diagnostico = await diagnosticarDuplicadosReadiness()
  const timestamp = new Date().toISOString()

  if (diagnostico.totalGruposDuplicados === 0) {
    return {
      timestamp,
      gruposDetectados: 0,
      gruposReparados: 0,
      gruposOmitidos: 0,
      filasEliminadas: 0,
      errores: []
    }
  }

  let gruposReparados = 0
  let gruposOmitidos = 0
  let filasEliminadas = 0
  const errores: string[] = []

  for (const grupo of diagnostico.detalles) {
    try {
      await db.transaction('rw', [db.readiness, db.sesion_rpe, db.rpe_partido, db.sesiones, db.wellness, db.jugadoras], async () => {
        // 1. Recalcular readiness desde las fuentes originales
        await recalcularReadinessJugadora(grupo.id_jugadora, grupo.fecha)

        // 2. Obtener todas las filas de este grupo
        const filasActuales = await db.readiness
          .where({ id_jugadora: grupo.id_jugadora, fecha: grupo.fecha })
          .toArray()

        if (filasActuales.length > 1) {
          // 3. Determinar el registro principal
          const conservado = [...filasActuales].sort(compararReadinessDeterminista)[0]

          // 4. Eliminar exclusivamente las filas duplicadas secundarias
          for (const fila of filasActuales) {
            if (fila.id !== conservado.id && fila.id !== undefined) {
              await db.readiness.delete(fila.id)
              filasEliminadas++
            }
          }
        }
      })
      gruposReparados++
    } catch (err: any) {
      gruposOmitidos++
      errores.push(`Error en grupo ${grupo.id_jugadora}/${grupo.fecha}: ${err?.message || String(err)}`)
    }
  }

  // Recargar el estado Zustand tras completar la reparación
  if (gruposReparados > 0) {
    await useStore.getState().loadAll()
  }

  return {
    timestamp,
    gruposDetectados: diagnostico.totalGruposDuplicados,
    gruposReparados,
    gruposOmitidos,
    filasEliminadas,
    errores
  }
}
