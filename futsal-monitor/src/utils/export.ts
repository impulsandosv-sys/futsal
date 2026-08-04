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
