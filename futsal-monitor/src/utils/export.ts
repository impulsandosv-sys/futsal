import { saveAs } from 'file-saver'

export function exportToCSV<T extends Record<string, any>>(data: T[], filename: string): void {
  const header = Object.keys(data[0] || {}).join(',')
  const rows = data.map((row) =>
    Object.values(row)
      .map((v) => `"${v ?? ''}"`)
      .join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, `${filename}.csv`)
}

export async function exportToExcel<T extends Record<string, any>>(data: T[], filename: string, sheetName = 'Datos'): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })
  saveAs(blob, `${filename}.xlsx`)
}

export function exportToJSON(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  saveAs(blob, `${filename}.json`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Plantilla Estable de Exportación Semanal CSV para Reunión de Staff
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportSemanalStaffRow {
  jugadora: string
  fecha: string
  cargaUA: number | null
  minutosJugados: number | null
  disponibilidad: string
  scoreWellness: number | null
  dolorEspecifico?: string | null
  alertasActivas?: string | null
  comentariosStaff?: string | null
}

/**
 * Genera una cadena CSV estandarizada para reuniones del cuerpo técnico.
 * Utiliza 9 columnas fijas sin exponer datos personales sensibles ni identificadores de BD.
 */
export function generarCSVReunionStaff(rows: ExportSemanalStaffRow[]): string {
  const headers = [
    'Jugadora',
    'Fecha',
    'Carga_UA',
    'Minutos_Jugados',
    'Disponibilidad',
    'Score_Wellness',
    'Dolor_Especifico',
    'Alertas_Activas',
    'Comentarios_Staff'
  ]

  const lines = [headers.join(',')]

  rows.forEach((r) => {
    const line = [
      `"${(r.jugadora || '').replace(/"/g, '""')}"`,
      `"${r.fecha || ''}"`,
      `"${r.cargaUA !== null && r.cargaUA !== undefined ? r.cargaUA : ''}"`,
      `"${r.minutosJugados !== null && r.minutosJugados !== undefined ? r.minutosJugados : ''}"`,
      `"${(r.disponibilidad || 'Disponible').replace(/"/g, '""')}"`,
      `"${r.scoreWellness !== null && r.scoreWellness !== undefined ? r.scoreWellness : ''}"`,
      `"${(r.dolorEspecifico || '').replace(/"/g, '""')}"`,
      `"${(r.alertasActivas || '').replace(/"/g, '""')}"`,
      `"${(r.comentariosStaff || '').replace(/"/g, '""')}"`
    ]
    lines.push(line.join(','))
  })

  return lines.join('\n')
}

/**
 * Descarga el CSV para reuniones de staff en el navegador con codificación UTF-8 BOM.
 */
export function exportarCSVReunionStaff(rows: ExportSemanalStaffRow[], filename = 'reunion_staff_semanal'): void {
  const csvContent = generarCSVReunionStaff(rows)
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, `${filename}.csv`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Plantilla de Exportación Específica para Partidos
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportPartidoRow {
  idPartido: string
  fecha: string
  rival: string
  jugadora: string
  minutosJugados: number | null
  rpe: number | null
  cargaUA: number | null
  participacion: string | null
  participacionInferida: string | null
  motivoParticipacionReducida: string | null
}

export function generarCSVPartidos(rows: ExportPartidoRow[]): string {
  const headers = [
    'ID_Partido',
    'Fecha',
    'Rival',
    'Jugadora',
    'Minutos_Jugados',
    'RPE',
    'Carga_UA',
    'Participacion',
    'Participacion_Inferida',
    'Motivo_Participacion_Reducida'
  ]

  const lines = [headers.join(',')]

  rows.forEach((r) => {
    const line = [
      `"${(r.idPartido || '').replace(/"/g, '""')}"`,
      `"${r.fecha || ''}"`,
      `"${(r.rival || '').replace(/"/g, '""')}"`,
      `"${(r.jugadora || '').replace(/"/g, '""')}"`,
      `"${r.minutosJugados !== null && r.minutosJugados !== undefined ? r.minutosJugados : ''}"`,
      `"${r.rpe !== null && r.rpe !== undefined ? r.rpe : ''}"`,
      `"${r.cargaUA !== null && r.cargaUA !== undefined ? r.cargaUA : ''}"`,
      `"${(r.participacion || '').replace(/"/g, '""')}"`,
      `"${(r.participacionInferida || '').replace(/"/g, '""')}"`,
      `"${(r.motivoParticipacionReducida || '').replace(/"/g, '""')}"`
    ]
    lines.push(line.join(','))
  })

  return lines.join('\n')
}

export function exportarCSVPartidos(rows: ExportPartidoRow[], filename = 'export_partidos'): void {
  const csvContent = generarCSVPartidos(rows)
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, `${filename}.csv`)
}

