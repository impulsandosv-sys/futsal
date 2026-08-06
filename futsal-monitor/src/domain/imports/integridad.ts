import { registrarCambioAuditoria } from '@/services/auditService'

export interface RegistroHuerfano {
  entidad: string
  idRegistro: string | number
  idJugadora: string
  fecha?: string
}

export interface InconsistenciaFecha {
  entidad: string
  idRegistro: string | number
  idJugadora: string
  fecha: string
  motivo: 'formato_invalido' | 'anterior_a_fecha_alta'
}

export interface ReporteConsistenciaRelacional {
  tieneInconsistencias: boolean
  huerfanos: RegistroHuerfano[]
  fechasInconsistentes: InconsistenciaFecha[]
}

export interface DatasetIntegridad {
  jugadoras?: Array<{ id_jugadora: string; fecha_alta?: string }>
  sesion_rpe?: Array<{ id?: number | string; id_jugadora: string; fecha?: string }>
  wellness?: Array<{ id?: number | string; id_jugadora: string; fecha?: string }>
  tests_fisicos?: Array<{ id?: number | string; id_jugadora: string; fecha?: string }>
  pruebas_cmj?: Array<{ id_medicion?: string; id_jugadora: string; fecha?: string }>
  trabajos_fuerza?: Array<{ id_trabajo?: string; id_jugadora: string; fecha?: string }>
}

export function verificarConsistenciaRelacional(data: DatasetIntegridad): ReporteConsistenciaRelacional {
  const jugadorasSet = new Set((data.jugadoras || []).map((j) => j.id_jugadora))
  const fechaAltaMap = new Map((data.jugadoras || []).map((j) => [j.id_jugadora, j.fecha_alta]))

  const huerfanos: RegistroHuerfano[] = []
  const fechasInconsistentes: InconsistenciaFecha[] = []

  const verificarColeccion = (coleccion: any[] | undefined, nombreEntidad: string, idKey: string) => {
    if (!coleccion) return
    for (const item of coleccion) {
      const idJug = item.id_jugadora
      const idReg = item[idKey] ?? item.id
      const fecha = item.fecha

      if (!idJug || !jugadorasSet.has(idJug)) {
        huerfanos.push({
          entidad: nombreEntidad,
          idRegistro: idReg,
          idJugadora: idJug,
          fecha,
        })
      } else if (fecha) {
        const fechaAlta = fechaAltaMap.get(idJug)
        if (fechaAlta && fecha < fechaAlta) {
          fechasInconsistentes.push({
            entidad: nombreEntidad,
            idRegistro: idReg,
            idJugadora: idJug,
            fecha,
            motivo: 'anterior_a_fecha_alta',
          })
        }
      }
    }
  }

  verificarColeccion(data.sesion_rpe, 'sesion_rpe', 'id')
  verificarColeccion(data.wellness, 'wellness', 'id')
  verificarColeccion(data.tests_fisicos, 'tests_fisicos', 'id')
  verificarColeccion(data.pruebas_cmj, 'pruebas_cmj', 'id_medicion')
  verificarColeccion(data.trabajos_fuerza, 'trabajos_fuerza', 'id_trabajo')

  return {
    tieneInconsistencias: huerfanos.length > 0 || fechasInconsistentes.length > 0,
    huerfanos,
    fechasInconsistentes,
  }
}

export function corregirInconsistenciasRelacionales(
  data: DatasetIntegridad,
  _modo: 'eliminar_huerfanos'
): { dataLimpia: DatasetIntegridad; registrosEliminadosCount: number } {
  const reporte = verificarConsistenciaRelacional(data)
  if (!reporte.tieneInconsistencias) {
    return { dataLimpia: data, registrosEliminadosCount: 0 }
  }

  const huerfanosIdsByEntidad = new Map<string, Set<string | number>>()
  for (const h of reporte.huerfanos) {
    if (!huerfanosIdsByEntidad.has(h.entidad)) {
      huerfanosIdsByEntidad.set(h.entidad, new Set())
    }
    huerfanosIdsByEntidad.get(h.entidad)!.add(h.idRegistro)
  }

  const dataLimpia: DatasetIntegridad = { ...data }
  let eliminados = 0

  const filtrarColeccion = (coleccion: any[] | undefined, entidadName: string, idKey: string) => {
    if (!coleccion) return coleccion
    const setHuerfanos = huerfanosIdsByEntidad.get(entidadName)
    if (!setHuerfanos) return coleccion

    return coleccion.filter((item) => {
      const idReg = item[idKey] ?? item.id
      if (setHuerfanos.has(idReg)) {
        eliminados++
        registrarCambioAuditoria({
          usuario: 'Sistema',
          entidad: entidadName as any,
          idEntidad: String(idReg),
          idJugadora: item.id_jugadora,
          campoModificado: 'integridad_relacional',
          valorAnterior: 'huerfano',
          valorNuevo: 'eliminado',
          motivo: 'Limpieza automática de inconsistencia relacional (registro huérfano)',
        })
        return false
      }
      return true
    })
  }

  dataLimpia.sesion_rpe = filtrarColeccion(data.sesion_rpe, 'sesion_rpe', 'id')
  dataLimpia.wellness = filtrarColeccion(data.wellness, 'wellness', 'id')
  dataLimpia.tests_fisicos = filtrarColeccion(data.tests_fisicos, 'tests_fisicos', 'id')
  dataLimpia.pruebas_cmj = filtrarColeccion(data.pruebas_cmj, 'pruebas_cmj', 'id_medicion')
  dataLimpia.trabajos_fuerza = filtrarColeccion(data.trabajos_fuerza, 'trabajos_fuerza', 'id_trabajo')

  return { dataLimpia, registrosEliminadosCount: eliminados }
}
