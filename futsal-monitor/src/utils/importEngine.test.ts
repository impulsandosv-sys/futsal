// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/db/database'
import {
  normalizarEncabezado,
  detectarMapeoWellness,
  normalizarFecha,
  extraerEscala,
  validarFilaWellness,
  clasificarFilaImportacion,
  construirVistaPrevia,
  aplicarImportacionWellness,
  ensureDefaultImportTemplate,
  parseCSVString,
  calcularVentanaPropagacion,
  confirmarYEjecutarImportacion
} from './importEngine'

vi.unmock('./importEngine')
vi.unmock('@/utils/importEngine')

// Mocking Dexie database
vi.mock('@/db/database', () => {
  const mockTable = () => ({
    toArray: vi.fn(() => Promise.resolve([])),
    get: vi.fn((id: string) => Promise.resolve({ id_jugadora: id, nombre: 'Test' })),
    put: vi.fn(() => Promise.resolve(1)),
    delete: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
    count: vi.fn(() => Promise.resolve(0)),
    where: vi.fn(() => ({
      first: vi.fn(() => Promise.resolve(null)),
      count: vi.fn(() => Promise.resolve(0)),
      toArray: vi.fn(() => Promise.resolve([]))
    }))
  })

  const dbMock = {
    transaction: vi.fn((mode, tables, callback) => callback()),
    jugadoras: mockTable(),
    wellness: {
      toArray: vi.fn(() => Promise.resolve([])),
      put: vi.fn(() => Promise.resolve(1)),
      where: vi.fn(() => ({
        first: vi.fn(() => Promise.resolve((global as any).__mockExistingWellnessRecord || null)),
        count: vi.fn(() => Promise.resolve(0)),
        toArray: vi.fn(() => Promise.resolve([]))
      }))
    },
    historial_importaciones: mockTable(),
    sesion_rpe: mockTable(),
    readiness: mockTable(),
    sesiones: mockTable(),
    partidos: mockTable(),
    rpe_partido: mockTable(),
    resumen_semanal: mockTable(),
    plantillas_importacion: {
      toArray: vi.fn(() => Promise.resolve([])),
      put: vi.fn(() => {
        ;(global as any).__templateCount = 1
        return Promise.resolve(1)
      }),
      delete: vi.fn(() => Promise.resolve()),
      clear: vi.fn(() => Promise.resolve()),
      count: vi.fn(() => Promise.resolve((global as any).__templateCount || 0)),
      where: vi.fn(() => ({
        first: vi.fn(() => Promise.resolve(null)),
        count: vi.fn(() => Promise.resolve((global as any).__templateCount || 0)),
        toArray: vi.fn(() => Promise.resolve([]))
      }))
    }
  }

  return { db: dbMock }
})

describe('importEngine - professional validation, mappings & transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global as any).__templateCount = 0
    ;(global as any).__mockExistingWellnessRecord = null
  })

  // 1. Detección de alias de encabezados
  it('1. normalizarEncabezado limpia mayúsculas, espacios y acentos', () => {
    expect(normalizarEncabezado('  Sueño (1-10)  ')).toBe('sueno (1-10)')
    expect(normalizarEncabezado('Código_Jugadora')).toBe('codigo jugadora')
    expect(normalizarEncabezado('Estrés')).toBe('estres')
  })

  it('2. detectarMapeoWellness realiza asignaciones correctas según alias', () => {
    const headers = ['ID', 'Fecha respuesta', 'Cansancio', 'DOMS', 'Nivel de estrés', 'Animo', 'Molestia', 'Marca temporal']
    const mappings = detectarMapeoWellness(headers)

    const findHeader = (field: string) => mappings.find(m => m.internalField === field)?.excelHeader

    expect(findHeader('id_jugadora')).toBe('ID')
    expect(findHeader('fecha')).toBe('Fecha respuesta')
    expect(findHeader('fatiga')).toBe('Cansancio')
    expect(findHeader('dolor_muscular')).toBe('DOMS')
    expect(findHeader('estres')).toBe('Nivel de estrés')
    expect(findHeader('estado_animo')).toBe('Animo')
    expect(findHeader('dolor_especifico')).toBe('Molestia')
    expect(findHeader('marca_temporal')).toBe('Marca temporal')
  })

  // 2. Normalización de fechas
  it('3. normalizarFecha convierte YYYY-MM-DD', () => {
    expect(normalizarFecha('2026-07-19')).toBe('2026-07-19')
    expect(normalizarFecha('2026/07/19')).toBe('2026-07-19')
  })

  it('4. normalizarFecha convierte DD/MM/YYYY', () => {
    expect(normalizarFecha('19/07/2026')).toBe('2026-07-19')
    expect(normalizarFecha('19-07-2026')).toBe('2026-07-19')
  })

  it('5. normalizarFecha preserva el día local en timestamps de Google Forms', () => {
    expect(normalizarFecha('19/07/2026 14:30:22')).toBe('2026-07-19')
  })

  it('6. normalizarFecha maneja timestamps cerca de la medianoche conservando fecha local del equipo', () => {
    // 23:59:59 del 19 de julio - no debe desplazarse al 20 por desfasajes de UTC
    expect(normalizarFecha('19/07/2026 23:59:59')).toBe('2026-07-19')
  })

  it('7. normalizarFecha convierte número serial de Excel', () => {
    // Excel serial 46222 representa el 19 de Julio de 2026
    expect(normalizarFecha(46222)).toBe('2026-07-19')
  })

  // 3. Extracción de escalas
  it('8. extraerEscala convierte diversos formatos a números enteros', () => {
    expect(extraerEscala('7')).toBe(7)
    expect(extraerEscala('7.0')).toBe(7)
    expect(extraerEscala('1 - Muy bajo')).toBe(1)
    expect(extraerEscala('10 - Excelente')).toBe(10)
    expect(extraerEscala('7/10')).toBe(7)
    expect(extraerEscala('')).toBeNull()
    expect(extraerEscala(null)).toBeNull()
  })

  it('9. validarFilaWellness detecta escalas fuera de rango, IDs inexistentes y fechas futuras', () => {
    const context = { jugadorasIds: ['J01', 'J02'] }
    
    // Caso correcto
    let res = validarFilaWellness({ id_jugadora: 'J01', fecha: '2026-07-19', calidad_sueno: '8', fatiga: '7', dolor_muscular: '6', estres: '5', estado_animo: '8' }, context)
    expect(res.isValid).toBe(true)

    // ID no existente
    res = validarFilaWellness({ id_jugadora: 'J99', fecha: '2026-07-19', calidad_sueno: '8' }, context)
    expect(res.isValid).toBe(false)
    expect(res.errorMsg).toContain('no existe')

    // Fecha futura
    const tomorrowStr = new Date(Date.now() + 86400 * 1000).toISOString().split('T')[0]
    res = validarFilaWellness({ id_jugadora: 'J01', fecha: tomorrowStr, calidad_sueno: '8' }, context)
    expect(res.isValid).toBe(false)
    expect(res.errorMsg).toContain('Fecha futura detectada')

    // Escala fuera de rango (0 u 11)
    res = validarFilaWellness({ id_jugadora: 'J01', fecha: '2026-07-19', calidad_sueno: '11' }, context)
    expect(res.isValid).toBe(false)
    expect(res.errorMsg).toContain('fuera de rango 1-10')
  })

  // 4. Mapeo e idempotencia de plantilla predeterminada
  it('10. ensureDefaultImportTemplate es idempotente', async () => {
    // Primera ejecución: tabla vacía
    ;(global as any).__templateCount = 0
    await ensureDefaultImportTemplate()
    expect(db.plantillas_importacion.put).toHaveBeenCalledTimes(1)

    // Segunda ejecución: ya existe
    ;(global as any).__templateCount = 1
    vi.mocked(db.plantillas_importacion.put).mockClear()
    await ensureDefaultImportTemplate()
    expect(db.plantillas_importacion.put).not.toHaveBeenCalled()
  })

  // 5. Clasificación frente a IndexedDB
  it('11. clasificarFilaImportacion detecta duplicados idénticos y actualizaciones posibles', () => {
    const existing: Wellness[] = [
      { id_jugadora: 'J01', fecha: '2026-07-19', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 8, dolor_especifico: '', score_wellness: 6.8 }
    ]

    // Registro nuevo
    let status = clasificarFilaImportacion({ id_jugadora: 'J02', fecha: '2026-07-19', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 8, dolor_especifico: null }, existing)
    expect(status).toBe('NUEVO')

    // Duplicado idéntico
    status = clasificarFilaImportacion({ id_jugadora: 'J01', fecha: '2026-07-19', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 8, dolor_especifico: null }, existing)
    expect(status).toBe('DUPLICADO_IDENTICO')

    // Actualización posible (conflicto)
    status = clasificarFilaImportacion({ id_jugadora: 'J01', fecha: '2026-07-19', calidad_sueno: 5, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 8, dolor_especifico: null }, existing)
    expect(status).toBe('ACTUALIZACION_POSIBLE')
  })

  // 6. Transacción atómica Dexie y estrategias
  it('12. aplicarImportacionWellness escribe wellness e historial de importaciones', async () => {
    const mockPreview: PreviewRow[] = [{
      filaOriginal: 2,
      estado: 'NUEVO',
      id_jugadora: 'J01',
      nombreJugadora: 'Jugadora 1',
      fecha: '2026-07-19',
      calidad_sueno: 8,
      fatiga: 7,
      dolor_muscular: 6,
      estres: 5,
      estado_animo: 8,
      dolor_especifico: null,
      mensaje: '',
      rowOriginal: {},
      normalRow: { id_jugadora: 'J01', fecha: '2026-07-19', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 8, dolor_especifico: null }
    }]

    const outcome = await aplicarImportacionWellness(mockPreview, 'omit', 'test.csv', 'Hoja1', 'Default', 'backup.json')
    expect(outcome.success).toBe(true)
    expect(outcome.inserted).toBe(1)
    expect(db.wellness.put).toHaveBeenCalledTimes(1)
    expect(db.historial_importaciones.put).toHaveBeenCalledTimes(1)
  })

  it('13. construirVistaPrevia detecta duplicados dentro del archivo', () => {
    const rawRows = [
      { id_jugadora: 'J01', fecha: '2026-07-19', calidad_sueno: 8 },
      { id_jugadora: 'J01', fecha: '2026-07-19', calidad_sueno: 7 } // Misma jugadora y fecha
    ]
    const mapping: ColumnMapping[] = [
      { internalField: 'id_jugadora', excelHeader: 'id_jugadora', required: true, label: 'ID' },
      { internalField: 'fecha', excelHeader: 'fecha', required: true, label: 'Fecha' },
      { internalField: 'calidad_sueno', excelHeader: 'calidad_sueno', required: true, label: 'Sueño' }
    ]
    const playersMap = { 'J01': 'Jugadora 1' }
    const result = construirVistaPrevia(rawRows, mapping, [], playersMap)
    
    expect(result.total).toBe(2)
    expect(result.errores).toBe(1) // El segundo es error por duplicado en archivo
    expect(result.rows[1].estado).toBe('ERROR')
    expect(result.rows[1].mensaje).toContain('Duplicado dentro del archivo')
  })

  it('14. aplicarImportacionWellness maneja estrategias omitir y sobrescribir en conflictos', async () => {
    const conflictPreview: PreviewRow[] = [{
      filaOriginal: 2,
      estado: 'ACTUALIZACION_POSIBLE',
      id_jugadora: 'J01',
      nombreJugadora: 'Jugadora 1',
      fecha: '2026-07-19',
      calidad_sueno: 9,
      fatiga: 3,
      dolor_muscular: 2,
      estres: 2,
      estado_animo: 9,
      dolor_especifico: null,
      mensaje: '',
      rowOriginal: {},
      normalRow: { id_jugadora: 'J01', fecha: '2026-07-19', calidad_sueno: 9, fatiga: 3, dolor_muscular: 2, estres: 2, estado_animo: 9, dolor_especifico: null }
    }]

    // 1. Omitir actualización
    db.wellness.put = vi.fn()
    const outcomeOmit = await aplicarImportacionWellness(conflictPreview, 'omit', 'test.csv', 'Hoja1', 'Default', 'backup.json')
    expect(outcomeOmit.success).toBe(true)
    expect(outcomeOmit.skipped).toBe(1)
    expect(db.wellness.put).not.toHaveBeenCalled()

    // 2. Sobrescribir actualización
    db.wellness.put = vi.fn()
    // Hacer que first() retorne el registro existente
    ;(global as any).__mockExistingWellnessRecord = { id: 100, id_jugadora: 'J01', fecha: '2026-07-19', calidad_sueno: 5 }
    
    const outcomeUpdate = await aplicarImportacionWellness(conflictPreview, 'update', 'test.csv', 'Hoja1', 'Default', 'backup.json')
    expect(outcomeUpdate.success).toBe(true)
    expect(outcomeUpdate.updated).toBe(1)
    expect(db.wellness.put).toHaveBeenCalledTimes(1)
  })

  it('15. aplicarImportacionWellness exige backupName obligatorio y bloquea en su ausencia (Fallo de backup sin escritura)', async () => {
    const mockPreview: PreviewRow[] = [{
      filaOriginal: 2,
      estado: 'NUEVO',
      id_jugadora: 'J01',
      nombreJugadora: 'Jugadora 1',
      fecha: '2026-07-19',
      calidad_sueno: 8,
      fatiga: 7,
      dolor_muscular: 6,
      estres: 5,
      estado_animo: 8,
      dolor_especifico: null,
      mensaje: '',
      rowOriginal: {},
      normalRow: { id_jugadora: 'J01', fecha: '2026-07-19', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 8, dolor_especifico: null }
    }]

    db.wellness.put = vi.fn()
    db.historial_importaciones.put = vi.fn()

    // 1. Debe lanzar un error comprensible si no se pasa backupName (simula fallo de descarga/generación)
    await expect(aplicarImportacionWellness(mockPreview, 'omit', 'test.csv', 'Hoja1', 'Default', ''))
      .rejects.toThrow('No se puede aplicar la importación sin una copia de seguridad previa de seguridad registrada.')

    // 2. Verificar que no se mutó nada
    expect(db.wellness.put).not.toHaveBeenCalled()
    expect(db.historial_importaciones.put).not.toHaveBeenCalled()
  })

  it('16. aplicarImportacionWellness maneja atomicidad de transacciones y registra entrada error', async () => {
    const mockPreview: PreviewRow[] = [{
      filaOriginal: 2,
      estado: 'NUEVO',
      id_jugadora: 'J01',
      nombreJugadora: 'Jugadora 1',
      fecha: '2026-07-19',
      calidad_sueno: 8,
      fatiga: 7,
      dolor_muscular: 6,
      estres: 5,
      estado_animo: 8,
      dolor_especifico: null,
      mensaje: '',
      rowOriginal: {},
      normalRow: { id_jugadora: 'J01', fecha: '2026-07-19', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 8, dolor_especifico: null }
    }]

    // Forzar que la escritura falle lanzando un error
    db.wellness.put = vi.fn().mockRejectedValue(new Error('Fallo de escritura forzado'))
    db.historial_importaciones.put = vi.fn().mockResolvedValue(1)

    const outcome = await aplicarImportacionWellness(mockPreview, 'omit', 'test.csv', 'Hoja1', 'Default', 'backup.json')
    
    // El resultado debe indicar fallo
    expect(outcome.success).toBe(false)
    expect(outcome.inserted).toBe(0)
    
    // Se debió escribir un registro con estado 'error' en el historial
    expect(db.historial_importaciones.put).toHaveBeenCalledTimes(1)
    const calledWith = vi.mocked(db.historial_importaciones.put).mock.calls[0][0] as any
    expect(calledWith.estado).toBe('error')
    expect(calledWith.detalleErrores[0]).toContain('Fallo crítico: Fallo de escritura forzado')
  })

  it('17. parseCSVString maneja delimitadores coma, punto y coma y tabulacion', () => {
    const csvComma = 'id_jugadora,fecha,calidad_sueno\nJ01,2026-07-19,8'
    const csvSemicolon = 'id_jugadora;fecha;calidad_sueno\nJ01;2026-07-19;8'
    const csvTab = 'id_jugadora\tfecha\tcalidad_sueno\nJ01\t2026-07-19\t8'

    const resComma = parseCSVString(csvComma)
    expect(resComma.length).toBe(1)
    expect(resComma[0].id_jugadora).toBe('J01')
    expect(resComma[0].calidad_sueno).toBe('8')

    const resSemi = parseCSVString(csvSemicolon)
    expect(resSemi.length).toBe(1)
    expect(resSemi[0].id_jugadora).toBe('J01')
    expect(resSemi[0].calidad_sueno).toBe('8')

    const resTab = parseCSVString(csvTab)
    expect(resTab.length).toBe(1)
    expect(resTab[0].id_jugadora).toBe('J01')
    expect(resTab[0].calidad_sueno).toBe('8')
  })

  it('18. calcularVentanaPropagacion calcula ventana de 28 dias hacia adelante', () => {
    const dates = ['2026-07-01']
    const window = calcularVentanaPropagacion(dates, '2026-07-10') // limitar a hoy = 2026-07-10
    
    // Del 1 al 10 de julio hay 10 días inclusive
    expect(window.length).toBe(10)
    expect(window[0]).toBe('2026-07-01')
    expect(window[9]).toBe('2026-07-10')
  })

  it('19. aplicarImportacionWellness no escribe filas con estado OMITIDA', async () => {
    const mockPreview: PreviewRow[] = [{
      filaOriginal: 2,
      estado: 'OMITIDA',
      id_jugadora: 'J01',
      nombreJugadora: 'Jugadora 1',
      fecha: '2026-07-19',
      calidad_sueno: 8,
      fatiga: 7,
      dolor_muscular: 6,
      estres: 5,
      estado_animo: 8,
      dolor_especifico: null,
      mensaje: 'Excluido manualmente',
      rowOriginal: {},
      normalRow: { id_jugadora: 'J01', fecha: '2026-07-19', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 8, dolor_especifico: null }
    }]

    db.wellness.put = vi.fn()
    db.historial_importaciones.put = vi.fn().mockResolvedValue(1)

    const outcome = await aplicarImportacionWellness(mockPreview, 'omit', 'test.csv', 'Hoja1', 'Default', 'backup.json')
    expect(outcome.success).toBe(true)
    expect(outcome.inserted).toBe(0)
    expect(outcome.skipped).toBe(1)
    expect(db.wellness.put).not.toHaveBeenCalled()
  })

  it('20. confirmarYEjecutarImportacion integra el flujo de UI y bloquea la importación ante fallo de descarga de backup', async () => {
    const mockPreview: PreviewRow[] = [{
      filaOriginal: 2,
      estado: 'NUEVO',
      id_jugadora: 'J01',
      nombreJugadora: 'Jugadora 1',
      fecha: '2026-07-19',
      calidad_sueno: 8,
      fatiga: 7,
      dolor_muscular: 6,
      estres: 5,
      estado_animo: 8,
      dolor_especifico: null,
      mensaje: '',
      rowOriginal: {},
      normalRow: { id_jugadora: 'J01', fecha: '2026-07-19', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 8, dolor_especifico: null }
    }]

    db.wellness.put = vi.fn()
    db.historial_importaciones.put = vi.fn()

    const onStart = vi.fn()
    const onSuccess = vi.fn()
    const onFailure = vi.fn()
    const onRecalculateTrigger = vi.fn().mockResolvedValue(undefined)

    // Simular que el backup falló / fue cancelado y no generó un nombre de archivo (downloadedBackupName: null)
    await confirmarYEjecutarImportacion({
      downloadedBackupName: null, // backup fallido
      userConfirmedBackup: true,
      previewData: mockPreview,
      strategy: 'omit',
      filename: 'forms.csv',
      sheetName: 'Hoja1',
      mappingName: 'Google Forms Wellness 2026-27',
      onStart,
      onSuccess,
      onFailure,
      onRecalculateTrigger
    })

    // 1. Verificar que aplicarImportacionWellness ni siquiera se intenta (ya que se bloquea al inicio)
    // 2. onStart nunca se llama
    expect(onStart).not.toHaveBeenCalled()
    
    // 3. onFailure es llamado con el mensaje claro de error
    expect(onFailure).toHaveBeenCalledWith('Debes descargar el backup de seguridad previo obligatoriamente.')
    
    // 4. Dexie permanece inalterado
    expect(db.wellness.put).not.toHaveBeenCalled()
    expect(db.historial_importaciones.put).not.toHaveBeenCalled()

    // 5. No se inicia recálculo de derivados
    expect(onRecalculateTrigger).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
