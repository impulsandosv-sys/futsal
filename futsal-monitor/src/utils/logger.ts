export interface LogEntry {
  id: string
  timestamp: string
  nivel: 'info' | 'warning' | 'error'
  contexto: string
  mensaje: string
  datos?: Record<string, any>
}

const logBuffer: LogEntry[] = []
const MAX_LOG_ENTRIES = 1000

export function logInfo(contexto: string, mensaje: string, datosOpcionales?: Record<string, any>): LogEntry {
  const entry: LogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    nivel: 'info',
    contexto,
    mensaje,
    datos: datosOpcionales,
  }
  appendLog(entry)
  return entry
}

export function logError(contexto: string, error: unknown, datosOpcionales?: Record<string, any>): LogEntry {
  const mensaje = error instanceof Error ? error.message : String(error)
  const entry: LogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    nivel: 'error',
    contexto,
    mensaje,
    datos: {
      ...datosOpcionales,
      stack: error instanceof Error ? error.stack : undefined,
    },
  }
  appendLog(entry)
  return entry
}

function appendLog(entry: LogEntry): void {
  logBuffer.push(entry)
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift()
  }
}

export function getLogs(filtro?: { contexto?: string; nivel?: 'info' | 'warning' | 'error' }): LogEntry[] {
  return logBuffer.filter((l) => {
    if (filtro?.contexto && l.contexto !== filtro.contexto) return false
    if (filtro?.nivel && l.nivel !== filtro.nivel) return false
    return true
  })
}

export function clearLogs(): void {
  logBuffer.length = 0
}

export function exportLogs(): void {
  const dataStr = JSON.stringify(logBuffer, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `futsal_monitor_logs_${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
