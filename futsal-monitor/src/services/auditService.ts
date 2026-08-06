export type EntidadAuditable = 'sRPE' | 'wellness' | 'disponibilidad' | 'alerta' | 'test_cmj' | 'test_fuerza'

export interface RegistroAuditoriaCambio {
  id: string
  timestamp: string // ISO timestamp
  usuario: string
  entidad: EntidadAuditable
  idEntidad: string
  idJugadora?: string
  campoModificado: string
  valorAnterior: string | number | boolean | null
  valorNuevo: string | number | boolean | null
  motivo: string
}

export interface FiltrosAuditoria {
  entidad?: EntidadAuditable
  idJugadora?: string
  usuario?: string
}

// Almacenamiento desacoplado e inmutable para auditoría de cambios de operativa diaria
const auditoriaMemoria: RegistroAuditoriaCambio[] = []

/**
 * Registra una acción de modificación de datos en el historial de auditoría del sistema.
 * Asigna automáticamente identificador unívoco e hito temporal ISO.
 */
export function registrarCambioAuditoria(
  cambio: Omit<RegistroAuditoriaCambio, 'id' | 'timestamp'>
): RegistroAuditoriaCambio {
  const registro: RegistroAuditoriaCambio = {
    ...cambio,
    id: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    motivo: cambio.motivo && cambio.motivo.trim() !== '' ? cambio.motivo.trim() : 'Sin motivo especificado'
  }

  auditoriaMemoria.unshift(registro)
  return { ...registro }
}

/**
 * Consulta el historial de auditoría de cambios del sistema.
 * Es una consulta de solo lectura que devuelve copias congeladas de los registros.
 */
export function obtenerHistorialAuditoria(filtros?: FiltrosAuditoria): RegistroAuditoriaCambio[] {
  let resultado = [...auditoriaMemoria]

  if (filtros) {
    if (filtros.entidad) {
      resultado = resultado.filter((r) => r.entidad === filtros.entidad)
    }
    if (filtros.idJugadora) {
      resultado = resultado.filter((r) => r.idJugadora === filtros.idJugadora)
    }
    if (filtros.usuario) {
      resultado = resultado.filter((r) => r.usuario.toLowerCase().includes(filtros.usuario!.toLowerCase()))
    }
  }

  // Devolver copias congeladas para evitar mutaciones directas desde la UI
  return resultado.map((r) => Object.freeze({ ...r }))
}

/**
 * Reinicia la memoria de auditoría (exclusivo para aislamiento de entorno de pruebas).
 */
export function limpiarAuditoriaPruebas(): void {
  auditoriaMemoria.length = 0
}
