export type PerfilExportacion = 'staff'

export interface DTOStaffFilaResumenSemanal {
  Semana: string
  Jugadora: string
  'Carga Entreno': number
  'Carga Partido': number
  'Carga Total': number
  'Carga Crónica': number
  ACWR: number
  Wellness: number
  Sesiones: number
  Estado: string
  [key: string]: unknown
}

export interface DTOStaffFilaSeguimientoDiario {
  Jugadora: string
  Posicion: string
  Disponibilidad: string
  EstadoWellness: string
  Prioridad: string
  Motivos: string
  Adherencia7d: string
  Adherencia28d: string
  [key: string]: unknown
}

export interface DatosStaffPDFResumen {
  semana: string
  titulo: string
  filas: DTOStaffFilaResumenSemanal[]
  notaPrivacidad: string
}

/**
 * Constructor puro de DTO staff para filas de Resumen Semanal.
 * Selecciona explícitamente propiedad por propiedad mediante allowlist positiva.
 */
export function construirDTOStaffResumenSemanal(
  rawList: Array<Record<string, unknown>>
): DTOStaffFilaResumenSemanal[] {
  if (!Array.isArray(rawList)) return []

  return rawList.map(item => {
    return {
      Semana: String(item.Semana ?? item.semana ?? ''),
      Jugadora: String(item.Jugadora ?? item.nombre ?? item.id_jugadora ?? ''),
      'Carga Entreno': Number(item['Carga Entreno'] ?? item.carga_entreno ?? 0),
      'Carga Partido': Number(item['Carga Partido'] ?? item.carga_partido ?? 0),
      'Carga Total': Number(item['Carga Total'] ?? item.carga_total ?? 0),
      'Carga Crónica': Number(item['Carga Crónica'] ?? item.carga_cronica ?? 0),
      ACWR: Number(item.ACWR ?? item.acwr ?? 0),
      Wellness: Number(item.Wellness ?? item.wellness_medio ?? item.wellness ?? 0),
      Sesiones: Number(item.Sesiones ?? item.num_sesiones ?? 0),
      Estado: String(item.Estado ?? item.estado ?? '')
    }
  })
}

/**
 * Constructor puro de DTO staff para filas de Seguimiento Diario.
 * Selecciona explícitamente propiedad por propiedad mediante allowlist positiva.
 * Excluye explícitamente dolor_especifico, observaciones libres y comentarios de salud.
 */
export function construirDTOStaffSeguimientoDiario(
  rawList: Array<Record<string, unknown>>
): DTOStaffFilaSeguimientoDiario[] {
  if (!Array.isArray(rawList)) return []

  return rawList.map(item => {
    return {
      Jugadora: String(item.Jugadora ?? item.nombre ?? ''),
      Posicion: String(item.Posicion ?? item.posicion ?? ''),
      Disponibilidad: String(item.Disponibilidad ?? item.disponibilidad ?? ''),
      EstadoWellness: String(item.EstadoWellness ?? item.estadoWellness ?? ''),
      Prioridad: String(item.Prioridad ?? item.prioridad ?? ''),
      Motivos: String(item.Motivos ?? item.motivos ?? ''),
      Adherencia7d: String(item.Adherencia7d ?? item.adherencia7d ?? ''),
      Adherencia28d: String(item.Adherencia28d ?? item.adherencia28d ?? '')
    }
  })
}

/**
 * Constructor puro de DTO staff para generación de PDF de Resumen Semanal.
 */
export function construirDatosStaffPDFResumen(
  semana: string,
  rawList: Array<Record<string, unknown>>
): DatosStaffPDFResumen {
  return {
    semana,
    titulo: `Reporte Semanal Futsal Monitor - ${semana}`,
    filas: construirDTOStaffResumenSemanal(rawList),
    notaPrivacidad: 'Versión staff: se han excluido datos sensibles y clínicos.'
  }
}
