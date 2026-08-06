import { describe, it, expect, beforeEach, vi } from 'vitest'
import { logError, logInfo, getLogs, clearLogs, exportLogs } from './logger'

describe('Logger Module (src/utils/logger.ts)', () => {
  beforeEach(() => {
    clearLogs()
  })

  it('registra correctamente mensajes de info', () => {
    logInfo('IMPORT_SERVICE', 'Importación de CSV completada con éxito', { totalFilas: 15 })
    const logs = getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].nivel).toBe('info')
    expect(logs[0].contexto).toBe('IMPORT_SERVICE')
    expect(logs[0].mensaje).toBe('Importación de CSV completada con éxito')
    expect(logs[0].datos).toEqual({ totalFilas: 15 })
    expect(logs[0].timestamp).toBeDefined()
  })

  it('registra correctamente errores y excepciones', () => {
    const err = new Error('Conexión fallida con DB')
    logError('STORE_ACTION', err, { accion: 'addWellness' })
    const logs = getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].nivel).toBe('error')
    expect(logs[0].contexto).toBe('STORE_ACTION')
    expect(logs[0].mensaje).toBe('Conexión fallida con DB')
    expect(logs[0].datos).toMatchObject({ accion: 'addWellness' })
  })

  it('filtra los logs por contexto', () => {
    logInfo('CALCULATIONS', 'Recálculo de readiness')
    logError('IMPORT_SERVICE', 'Fila corrupta en CSV')
    logInfo('CALCULATIONS', 'Recálculo de carga semanal')

    const calcLogs = getLogs({ contexto: 'CALCULATIONS' })
    expect(calcLogs).toHaveLength(2)
    expect(calcLogs.every(l => l.contexto === 'CALCULATIONS')).toBe(true)

    const errorLogs = getLogs({ nivel: 'error' })
    expect(errorLogs).toHaveLength(1)
    expect(errorLogs[0].contexto).toBe('IMPORT_SERVICE')
  })

  it('exporta logs en formato JSON estructurado sin arrojar excepción', () => {
    logInfo('SYSTEM', 'Inicio de aplicación')
    logError('SYSTEM', 'Warning simulado')

    const createObjectURLSpy = vi.fn().mockReturnValue('blob:test-url')
    const revokeObjectURLSpy = vi.fn()
    global.URL.createObjectURL = createObjectURLSpy
    global.URL.revokeObjectURL = revokeObjectURLSpy

    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
    }
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any)

    exportLogs()

    expect(createObjectURLSpy).toHaveBeenCalled()
    expect(mockAnchor.click).toHaveBeenCalled()

    createElementSpy.mockRestore()
  })
})
