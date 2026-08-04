import type { FormularioRespuesta } from '@/types'
import { getTodayLocalISO } from '@/domain/dates/dates'

export interface ImportResult {
  importadas: number
  omitidas: number
  errores: string[]
}

export async function parseCSV(file: File): Promise<FormularioRespuesta[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
        if (lines.length < 2) {
          reject(new Error('El archivo CSV debe tener al menos un encabezado y una fila de datos'))
          return
        }

        const headers = parseCSVLine(lines[0])
        const results: FormularioRespuesta[] = []

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i])
          const row: Record<string, string> = {}
          headers.forEach((h, idx) => {
            row[h.trim()] = (values[idx] || '').trim()
          })

          const r = mapRowToFormulario(row)
          if (r) results.push(r)
        }

        resolve(results)
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsText(file)
  })
}

export async function parseExcel(file: File): Promise<FormularioRespuesta[]> {
  const XLSX = await import('xlsx')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })

        const results: FormularioRespuesta[] = []
        for (const row of rows) {
          const r = mapRowToFormulario(row)
          if (r) results.push(r)
        }
        resolve(results)
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsArrayBuffer(file)
  })
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function normalizeHeader(h: string): string {
  const map: Record<string, string> = {
    'marca temporal': 'marca_temporal',
    'marca de tiempo': 'marca_temporal',
    'timestamp': 'marca_temporal',
    'fecha de respuesta': 'marca_temporal',
    'id jugadora': 'id_jugadora',
    'id_jugadora': 'id_jugadora',
    'id': 'id_jugadora',
    'id jugador': 'id_jugadora',
    'código jugadora': 'id_jugadora',
    'nombre jugadora': 'id_jugadora',
    'fecha': 'fecha',
    'calidad de sueño': 'calidad_sueno',
    'calidad sueño': 'calidad_sueno',
    'sueño': 'calidad_sueno',
    'sueño (1-10)': 'calidad_sueno',
    'fatiga': 'fatiga',
    'fatiga (1-10)': 'fatiga',
    'dolor muscular': 'dolor_muscular',
    'dolor muscular (1-10)': 'dolor_muscular',
    'dolor': 'dolor_muscular',
    'estrés': 'estres',
    'estres': 'estres',
    'estrés (1-10)': 'estres',
    'estado de ánimo': 'estado_animo',
    'estado ánimo': 'estado_animo',
    'ánimo': 'estado_animo',
    'estado de animo': 'estado_animo',
    'dolor específico': 'dolor_especifico',
    'dolor especifico': 'dolor_especifico',
    'notas dolor': 'dolor_especifico',
    'dolor/especifico': 'dolor_especifico',
  }
  return map[h.toLowerCase().trim()] || h.toLowerCase().trim().replace(/\s+/g, '_')
}

function mapRowToFormulario(row: Record<string, string>): FormularioRespuesta | null {
  const normalized: Record<string, string> = {}
  for (const [k, v] of Object.entries(row)) {
    normalized[normalizeHeader(k)] = v
  }

  if (!normalized.id_jugadora) return null

  return {
    marca_temporal: normalized.marca_temporal || new Date().toISOString(),
    id_jugadora: normalized.id_jugadora.trim().toUpperCase(),
    fecha: normalized.fecha || normalized.marca_temporal?.split(' ')[0] || getTodayLocalISO(),
    calidad_sueno: parseNum(normalized.calidad_sueno, 5),
    fatiga: parseNum(normalized.fatiga, 5),
    dolor_muscular: parseNum(normalized.dolor_muscular, 5),
    estres: parseNum(normalized.estres, 5),
    estado_animo: parseNum(normalized.estado_animo, 5),
    dolor_especifico: normalized.dolor_especifico || '',
  }
}

function parseNum(v: string, fallback: number): number {
  if (!v) return fallback
  const n = Number(v.toString().replace(',', '.').trim())
  return isNaN(n) ? fallback : n
}
