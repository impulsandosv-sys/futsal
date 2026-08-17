import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useStore } from '@/store/store'
import { exportToJSON } from '@/utils/export'
import { forceExternalBackup, getLastExternalBackupInfo, parseBackupFile, restoreFromData, validateBackupData, analyzeBackupMergePreview, type MergePreviewAnalysis } from '@/utils/backup'
import { db } from '@/db/database'
import type {
  RawImportRow,
  ColumnMapping,
  PlantillaImportacion,
  PreviewRow,
  ImportStrategy,
  ImportOutcome,
  HistorialImportacion
} from '@/types'
import {
  detectarMapeoWellness,
  construirVistaPrevia,
  crearInformeValidacion,
  calcularVentanaPropagacion,
  confirmarYEjecutarImportacion,
  obtenerContextoValidacionWellness,
  detectarMapeoWellnessSemanal,
  detectarTipoCuestionario,
  type TipoCuestionarioWellness
} from '@/utils/importEngine'
import { getWeekId } from '@/domain/dates/dates'
import { recalcularReadinessJugadora } from '@/services/readiness'
import { recalcularResumenSemanal } from '@/services/resumenSemanal'

export function ImportPage() {
  const {
    wellness,
    historial_importaciones,
    plantillas_importacion,
    addPlantillaImportacion,
    evaluarSeguimientoJugadora,
    loadAll,
    jugadoras
  } = useStore()

  // States for Backup
  const [, setBackupInfo] = useState(getLastExternalBackupInfo())
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [restoreData, setRestoreData] = useState<any>(null)
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge')
  const [restoreConfirmText, setRestoreConfirmText] = useState('')
  const [validationResult, setValidationResult] = useState<any>(null)
  const [downloadedPrevBackupName, setDownloadedPrevBackupName] = useState<string | null>(null)
  const [confirmBackupPrevio, setConfirmBackupPrevio] = useState(false)

  // Step state
  const [step, setStep] = useState<number>(1)

  // Step 1: Selection of file
  const [importFile, setImportFile] = useState<File | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [fileHeaders, setFileHeaders] = useState<string[]>([])
  const [parsedRawRows, setParsedRawRows] = useState<RawImportRow[]>([])
  const [tipoCuestionario, setTipoCuestionario] = useState<TipoCuestionarioWellness | null>(null)
  const [cuestionarioError, setCuestionarioError] = useState<string | null>(null)

  // Step 2: Mappings and Mapped Preview
  const [selectedPlantillaId, setSelectedPlantillaId] = useState<number | string>('default')
  const [activeMappings, setActiveMappings] = useState<ColumnMapping[]>([])
  const [newTemplateName, setNewTemplateName] = useState<string>('')
  const [previewData, setPreviewData] = useState<PreviewRow[]>([])
  const [omittedRows, setOmittedRows] = useState<Set<number>>(new Set())
  const [editingRowId, setEditingRowId] = useState<number | null>(null)
  const [draftEditData, setDraftEditData] = useState<Record<string, any> | null>(null)

  // Derivación pura del resumen de previsualización (React State Pure Rule)
  const previewSummary = useMemo(() => {
    let nuevos = 0, actualizaciones = 0, duplicados = 0, errores = 0, omitidos = 0
    previewData.forEach(r => {
      if (r.estado === 'NUEVO') nuevos++
      else if (r.estado === 'ACTUALIZACION_POSIBLE') actualizaciones++
      else if (r.estado === 'DUPLICADO_IDENTICO') duplicados++
      else if (r.estado === 'ERROR') errores++
      else if (r.estado === 'OMITIDA') omitidos++
    })
    return {
      total: previewData.length,
      nuevos,
      actualizaciones,
      duplicados,
      errores,
      omitidos
    }
  }, [previewData])

  // Table pagination and filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const pageSize = 50

  // Step 3: Confirmation and Strategies
  const [conflictStrategy, setConflictStrategy] = useState<ImportStrategy>('omit')
  const [downloadedImportBackupName, setDownloadedImportBackupName] = useState<string | null>(null)
  const [confirmImportBackup, setConfirmImportBackup] = useState<boolean>(false)

  // Loading, progress and outcome states
  const [importing, setImporting] = useState<boolean>(false)
  const [recalculating, setRecalculating] = useState<boolean>(false)
  const [recalcProgress, setRecalcProgress] = useState<number>(0)
  const [recalcError, setRecalcError] = useState<string | null>(null)
  const [importOutcome, setImportOutcome] = useState<ImportOutcome | null>(null)

  const restoreFileRef = useRef<HTMLInputElement>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  const refreshBackupInfo = () => setBackupInfo(getLastExternalBackupInfo())

  // Load default template mappings on mount or changes
  useEffect(() => {
    if (plantillas_importacion.length > 0) {
      const pred = plantillas_importacion.find(p => p.esPredeterminada)
      if (pred && selectedPlantillaId === 'default') {
        setActiveMappings(JSON.parse(JSON.stringify(pred.mapeoColumnas)))
      }
    }
  }, [plantillas_importacion, selectedPlantillaId])

  // Recalculate preview directly from Dexie jugadoras when rows or mappings change
  useEffect(() => {
    let isMounted = true
    if (parsedRawRows.length > 0 && activeMappings.length > 0) {
      obtenerContextoValidacionWellness().then(context => {
        if (!isMounted) return
        const summary = construirVistaPrevia(parsedRawRows, activeMappings, wellness, context.jugadorasMap || {}, context, omittedRows)
        setPreviewData(summary.rows)
      })
    }
    return () => { isMounted = false }
  }, [parsedRawRows, activeMappings, wellness, omittedRows])

  // --- Handlers Backup ---
  const handleCreateBackup = async () => {
    try {
      await forceExternalBackup('manual')
      refreshBackupInfo()
      alert('Copia de seguridad externa descargada con éxito.')
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  const [mergeStrategy, setMergeStrategy] = useState<'skip' | 'overwrite'>('skip')
  const [mergePreview, setMergePreview] = useState<MergePreviewAnalysis | null>(null)

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await parseBackupFile(file)
      data.filename = file.name
      setRestoreData(data)

      const validation = validateBackupData(data)
      setValidationResult(validation)

      if (validation.canRestore) {
        const preview = await analyzeBackupMergePreview(data)
        setMergePreview(preview)
      } else {
        setMergePreview(null)
      }

      setDownloadedPrevBackupName(null)
      setConfirmBackupPrevio(false)
      setRestoreConfirmText('')
      setMergeStrategy('skip')

      setShowRestoreModal(true)
    } catch (err: any) {
      alert(err.message)
    }
    if (restoreFileRef.current) restoreFileRef.current.value = ''
  }

  const executeRestore = async () => {
    if (restoreMode === 'replace') {
      if (!downloadedPrevBackupName) {
        alert('Debes descargar una copia de seguridad previa obligatoriamente.')
        return
      }
      if (!confirmBackupPrevio) {
        alert('Debes confirmar que has guardado la copia fuera del navegador.')
        return
      }
      if (restoreConfirmText !== 'REEMPLAZAR') {
        alert('Debes escribir REEMPLAZAR para confirmar.')
        return
      }
    }
    try {
      const res = await restoreFromData(restoreData, restoreMode, restoreMode === 'merge' ? mergeStrategy : 'skip')
      if (res.success) {
        if (res.conflicts.length > 0 && restoreMode === 'merge' && mergeStrategy === 'skip') {
          alert(`Fusión completada. Se omitieron ${res.conflicts.length} conflictos para proteger tus datos locales.\nPor favor recarga la página.`)
        } else {
          alert('Copia de seguridad restaurada con éxito. Por favor recarga la página.')
        }
        window.location.reload()
      } else {
        alert('Error al restaurar: ' + res.error)
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleDownloadEmergencyBackup = async () => {
    try {
      const fname = await forceExternalBackup('previo_restauracion')
      setDownloadedPrevBackupName(fname)
      alert(`Copia de seguridad previa descargada con éxito: ${fname}`)
    } catch (e: any) {
      alert('Error al descargar copia de seguridad: ' + e.message)
    }
  }

  // --- Handlers Step 1: File selection & Reading ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFile(file)

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx')
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        setSheetNames(wb.SheetNames)

        // Select first sheet by default
        const firstSheet = wb.SheetNames[0]
        setSelectedSheet(firstSheet)
        readSheetData(wb, firstSheet, XLSX)
      } catch (err: any) {
        alert('Error al leer el archivo Excel/CSV: ' + err.message)
        resetFileState()
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleSheetChange = (sheet: string) => {
    setSelectedSheet(sheet)
    if (!importFile) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx')
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        readSheetData(wb, sheet, XLSX)
      } catch (err: any) {
        alert('Error al leer la hoja: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(importFile)
  }

  const readSheetData = (wb: any, sheetName: string, XLSX: any) => {
    const ws = wb.Sheets[sheetName]
    const headersRaw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]
    
    const esFilaConContenido = (row: unknown[]) =>
      row.some((cell) => String(cell ?? '').trim() !== '')

    const indiceCabecera = headersRaw.findIndex(esFilaConContenido)
    if (indiceCabecera === -1) {
      alert('Error: La hoja de cálculo está completamente vacía o no contiene cabeceras detectables.')
      return
    }
    
    const headers = (headersRaw[indiceCabecera] as unknown[]).map(h => String(h ?? '').trim())
    setFileHeaders(headers)
    setCuestionarioError(null)
    setTipoCuestionario(null)

    try {
      const tipo = detectarTipoCuestionario(headers)
      setTipoCuestionario(tipo)
      const rawRows = XLSX.utils.sheet_to_json(ws, { range: indiceCabecera, defval: null }) as RawImportRow[]
      setParsedRawRows(rawRows)

      if (tipo === 'DIARIO') {
        const auto = detectarMapeoWellness(headers)
        setActiveMappings(auto)
        setSelectedPlantillaId('default')
      } else if (tipo === 'SEMANAL') {
        const auto = detectarMapeoWellnessSemanal(headers)
        setActiveMappings(auto)
        setSelectedPlantillaId('default')
      } else {
        setActiveMappings([])
      }
    } catch (err: any) {
      setCuestionarioError(err.message)
      setParsedRawRows([])
    }
  }

  const resetFileState = () => {
    setImportFile(null)
    setSheetNames([])
    setSelectedSheet('')
    setFileHeaders([])
    setParsedRawRows([])
    setTipoCuestionario(null)
    setCuestionarioError(null)
    if (importFileRef.current) importFileRef.current.value = ''
  }

  const handleDownloadSampleTemplate = () => {
    const headers = ['ID_Jugadora', 'Fecha', 'Calidad de sueño', 'Fatiga', 'Dolor muscular', 'Estrés', 'Estado de ánimo', 'Dolor específico', 'Marca temporal']
    const mockRow = ['J01', '2026-07-19', '8', '3', '4', '2', '9', 'Ligera molestia en cuádriceps izquierdo', '19/07/2026 10:15:30']
    const csvContent = [headers.join(','), mockRow.join(',')].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_wellness_ejemplo.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // --- Handlers Step 2: Mappings and Mapped Preview ---
  const handleMappingChange = (field: string, header: string | null) => {
    setActiveMappings(prev => prev.map(m => {
      if (m.internalField === field) {
        return { ...m, excelHeader: header }
      }
      return m
    }))
  }

  const handleResetAutoMapping = () => {
    const auto = detectarMapeoWellness(fileHeaders)
    setActiveMappings(auto)
  }

  const handleLoadPlantilla = (idStr: string) => {
    setSelectedPlantillaId(idStr)
    if (idStr === 'default') {
      const pred = plantillas_importacion.find(p => p.esPredeterminada)
      if (pred) {
        setActiveMappings(JSON.parse(JSON.stringify(pred.mapeoColumnas)))
      }
      return
    }

    const template = plantillas_importacion.find(p => p.id === Number(idStr))
    if (template) {
      setActiveMappings(JSON.parse(JSON.stringify(template.mapeoColumnas)))
    }
  }

  const handleSaveAsNewTemplate = async () => {
    const name = newTemplateName.trim()
    if (!name) {
      alert('Introduce un nombre para la nueva plantilla.')
      return
    }
    if (name.toLowerCase() === 'google forms wellness 2026-27') {
      alert('No se puede sobrescribir el nombre de la plantilla predeterminada.')
      return
    }

    const exists = plantillas_importacion.some(p => p.nombre.toLowerCase() === name.toLowerCase())
    if (exists) {
      alert('Ya existe una plantilla con ese nombre.')
      return
    }

    try {
      const template: PlantillaImportacion = {
        nombre: name,
        tipoImportacion: 'wellness',
        mapeoColumnas: activeMappings,
        creadaEn: new Date().toISOString(),
        actualizadaEn: new Date().toISOString(),
        esPredeterminada: false
      }
      await addPlantillaImportacion(template)
      setNewTemplateName('')
      alert('Nueva plantilla de mapeo persistida correctamente.')
    } catch (err: any) {
      alert('Error guardando plantilla: ' + err.message)
    }
  }

  const handleExcludeRow = (filaIndex: number) => {
    setOmittedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(filaIndex)) {
        newSet.delete(filaIndex)
      } else {
        newSet.add(filaIndex)
      }
      return newSet
    })
  }

  const handleEditRow = (row: PreviewRow) => {
    setEditingRowId(row.filaOriginal)
    setDraftEditData({
      id_jugadora: row.id_jugadora,
      fecha: row.fecha,
      calidad_sueno: row.calidad_sueno ?? '',
      fatiga: row.fatiga ?? '',
      dolor_muscular: row.dolor_muscular ?? '',
      estres: row.estres ?? '',
      estado_animo: row.estado_animo ?? '',
      dolor_especifico: row.dolor_especifico ?? '',
      comentario_sesion: row.comentario_sesion ?? ''
    })
  }

  const handleCancelEdit = () => {
    setEditingRowId(null)
    setDraftEditData(null)
  }

  const handleSaveRow = (filaOriginal: number) => {
    if (!draftEditData) return
    setParsedRawRows(prev => {
      const newRows = [...prev]
      const idx = filaOriginal - 2
      const targetRow = { ...newRows[idx] }

      activeMappings.forEach(m => {
        if (m.excelHeader && draftEditData[m.internalField] !== undefined) {
          targetRow[m.excelHeader] = draftEditData[m.internalField]
        }
      })

      newRows[idx] = targetRow
      return newRows
    })
    setEditingRowId(null)
    setDraftEditData(null)
  }

  const handleJumpToNextError = () => {
    const errorIndex = filteredPreview.findIndex((r, idx) => r.estado === 'ERROR' && idx >= currentPage * pageSize)
    if (errorIndex !== -1) {
      const page = Math.floor(errorIndex / pageSize) + 1
      setCurrentPage(page)
    } else {
      // Si no hay más en páginas siguientes, buscar desde el principio
      const firstError = filteredPreview.findIndex(r => r.estado === 'ERROR')
      if (firstError !== -1) {
        const page = Math.floor(firstError / pageSize) + 1
        setCurrentPage(page)
      }
    }
  }

  const handleDownloadValidationReport = () => {
    const reportCsv = crearInformeValidacion(previewData)
    const blob = new Blob([reportCsv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `informe_validacion_${importFile?.name || 'import'}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // --- Handlers Step 3: Confirmation and Strategies ---
  const handleDownloadImportBackup = async () => {
    try {
      const fname = await forceExternalBackup('previo_importacion')
      setDownloadedImportBackupName(fname)
      refreshBackupInfo()
      alert(`Copia de seguridad externa descargada con éxito: ${fname}`)
    } catch (e: any) {
      alert('Error descargando copia previa: ' + e.message)
    }
  }

  const executeImport = async () => {
    setRecalcError(null)

    await confirmarYEjecutarImportacion({
      tipoCuestionario: tipoCuestionario as 'DIARIO' | 'SEMANAL',
      downloadedBackupName: downloadedImportBackupName,
      userConfirmedBackup: confirmImportBackup,
      previewData,
      strategy: conflictStrategy,
      filename: importFile?.name || 'forms.csv',
      sheetName: selectedSheet,
      mappingName: selectedPlantillaId === 'default' ? 'Google Forms Wellness 2026-27' : (plantillas_importacion.find(p => p.id === Number(selectedPlantillaId))?.nombre || 'Personalizada'),
      onStart: () => {
        setImporting(true)
      },
      onSuccess: (outcome) => {
        setImportOutcome(outcome)
        setStep(4)
      },
      onFailure: (errorMsg) => {
        alert(errorMsg)
        setImporting(false)
      },
      onRecalculateTrigger: async () => {
        try {
          const selectedRows = previewData.filter(r => (
            r.estado === 'NUEVO' ||
            (r.estado === 'ACTUALIZACION_POSIBLE' && conflictStrategy === 'update')
          ))
          const affectedJugadoras = Array.from(new Set(selectedRows.map(r => r.normalRow!.id_jugadora)))

          await loadAll()
          for (const jId of affectedJugadoras) {
            await evaluarSeguimientoJugadora(jId)
          }
        } catch (err: any) {
          console.error('Error en evaluación pos-commit de alertas:', err)
        } finally {
          setImporting(false)
        }
      }
    })
  }

  // --- Asynchronous Recalculation Flow ---
  const triggerDerivedRecalculation = async (idImportacion: number, rowsToRecalc: PreviewRow[]) => {
    setRecalculating(true)
    setRecalcProgress(5)
    setRecalcError(null)

    try {
      if ((window as any).__forceRecalcFailure || localStorage.getItem('forceRecalcFailure') === 'true') {
        throw new Error('DEV_MOCK_ERROR: Fallo forzado de recálculo de derivados en desarrollo.')
      }
      const validRows = rowsToRecalc.filter(r => r.normalRow && r.estado !== 'OMITIDA' && r.estado !== 'ERROR' && r.estado !== 'DUPLICADO_IDENTICO')
      const normalRows = validRows.map(r => r.normalRow!)
      const affectedJugadoras = Array.from(new Set(normalRows.map(r => r.id_jugadora)))
      const affectedDates = Array.from(new Set(normalRows.map(r => r.fecha)))

      // Propagar ventanas móviles de 28 días
      const propagatedDates = calcularVentanaPropagacion(affectedDates)
      const affectedWeeks = Array.from(new Set(propagatedDates.map(d => getWeekId(d))))

      const totalSteps = affectedJugadoras.length * (propagatedDates.length + affectedWeeks.length + 1)
      let stepCount = 0

      if (totalSteps === 0) {
        setRecalcProgress(100)
        setRecalculating(false)
        // Mark as completed in db
        const hist = await db.historial_importaciones.get(idImportacion)
        if (hist) {
          hist.derivadosPendientes = false
          await db.historial_importaciones.put(hist)
        }
        await loadAll()
        return
      }

      for (const jId of affectedJugadoras) {
        // Readiness
        for (const fecha of propagatedDates) {
          await recalcularReadinessJugadora(jId, fecha)
          stepCount++
          setRecalcProgress(Math.min(95, Math.round((stepCount / totalSteps) * 95)))
        }
        // Weekly summary
        for (const sem of affectedWeeks) {
          await recalcularResumenSemanal(jId, sem)
          stepCount++
          setRecalcProgress(Math.min(95, Math.round((stepCount / totalSteps) * 95)))
        }
        // Alerts
        await evaluarSeguimientoJugadora(jId)
        stepCount++
        setRecalcProgress(Math.min(95, Math.round((stepCount / totalSteps) * 95)))
      }

      // Mark as completed in db
      const hist = await db.historial_importaciones.get(idImportacion)
      if (hist) {
        hist.derivadosPendientes = false
        await db.historial_importaciones.put(hist)
      }

      await loadAll()
      setRecalcProgress(100)
    } catch (err: any) {
      console.error(err)
      setRecalcError(err.message || 'Error al recalcular indicadores derivados')
      // Note: wellness records remain stored. Historial shows derivadosPendientes = true.
    } finally {
      setRecalculating(false)
    }
  }

  const handleManualRecalculateDerived = async (hist: HistorialImportacion) => {
    if (!hist.id) return
    setRecalculating(true)
    setRecalcProgress(10)
    setRecalcError(null)

    try {
      if ((window as any).__forceRecalcFailure || localStorage.getItem('forceRecalcFailure') === 'true') {
        throw new Error('DEV_MOCK_ERROR: Fallo forzado de recálculo en desarrollo.')
      }
      const allWellness = await db.wellness.toArray()

      const affectedJugadoras = Array.from(new Set(allWellness.map(w => w.id_jugadora)))
      const affectedDates = Array.from(new Set(allWellness.map(w => w.fecha)))
      const propagatedDates = calcularVentanaPropagacion(affectedDates)
      const affectedWeeks = Array.from(new Set(propagatedDates.map(d => getWeekId(d))))

      const totalSteps = affectedJugadoras.length * (propagatedDates.length + affectedWeeks.length + 1)
      let stepCount = 0

      for (const jId of affectedJugadoras) {
        for (const fecha of propagatedDates) {
          await recalcularReadinessJugadora(jId, fecha)
          stepCount++
          setRecalcProgress(Math.min(95, Math.round((stepCount / totalSteps) * 95)))
        }
        for (const sem of affectedWeeks) {
          await recalcularResumenSemanal(jId, sem)
          stepCount++
          setRecalcProgress(Math.min(95, Math.round((stepCount / totalSteps) * 95)))
        }
        await evaluarSeguimientoJugadora(jId)
        stepCount++
        setRecalcProgress(Math.min(95, Math.round((stepCount / totalSteps) * 95)))
      }

      hist.derivadosPendientes = false
      await db.historial_importaciones.put(hist)
      await loadAll()
      setRecalcProgress(100)
      alert('Indicadores recalculados correctamente.')
    } catch (err: any) {
      setRecalcError(err.message || 'Fallo al recalcular derivados')
      alert('Error en el recálculo: ' + err.message)
    } finally {
      setRecalculating(false)
    }
  }

  // Preview filtering and pagination
  const filteredPreview = previewData.filter(r => {
    if (statusFilter === 'ALL') return true
    return r.estado === statusFilter
  })

  const totalPages = Math.max(1, Math.ceil(filteredPreview.length / pageSize))
  const paginatedPreview = filteredPreview.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Block Next in Step 2 if mapping of essential keys is missing, no valid rows, or unomitted ERROR rows exist
  const idMapped = activeMappings.find(m => m.internalField === 'id_jugadora')?.excelHeader
  const dateMapped = activeMappings.find(m => m.internalField === 'fecha')?.excelHeader
  const hayErroresNoOmitidos = previewData.some(r => r.estado === 'ERROR')
  const cannotGoToStep3 = !idMapped || !dateMapped || (previewSummary.nuevos + previewSummary.actualizaciones === 0) || hayErroresNoOmitidos

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-6">
      <header className="flex justify-between items-center pb-4 border-b border-surface-200">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 font-sans">Importación y Gestión de Copias</h1>
          <p className="text-xs text-surface-500">Administra las respuestas de wellness y copias de seguridad de la base de datos local.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCreateBackup} className="bg-white hover:bg-surface-50 text-surface-700 text-xs font-semibold py-2 px-3 border border-surface-300 rounded shadow-sm">
            Crear Backup (Físico)
          </button>
          <button onClick={() => restoreFileRef.current?.click()} className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold py-2 px-3 rounded shadow-sm">
            Restaurar Copia...
          </button>
          <input type="file" ref={restoreFileRef} onChange={handleRestoreFile} className="hidden" accept=".json" />
        </div>
      </header>

      {/* WIZARD CONTAINER */}
      <section className="bg-white rounded-lg border border-surface-200 shadow-sm overflow-hidden">
        <div className="bg-surface-50 border-b border-surface-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-surface-800">Asistente de Importación de Cuestionarios</h2>
          {/* Progress Indicators */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-surface-400">
            <span className={step === 1 ? 'text-primary-600 font-bold' : ''}>1. Archivo</span>
            <span>&rarr;</span>
            <span className={step === 2 ? 'text-primary-600 font-bold' : ''}>2. Validar</span>
            <span>&rarr;</span>
            <span className={step === 3 ? 'text-primary-600 font-bold' : ''}>3. Importar</span>
            <span>&rarr;</span>
            <span className={step === 4 ? 'text-primary-600 font-bold' : ''}>4. Resultado</span>
          </div>
        </div>

        <div className="p-6">
          {/* STEP 1: SELECT FILE */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-surface-700 mb-2">1. Selecciona el archivo de respuestas (.csv, .xlsx, .xls):</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => importFileRef.current?.click()}
                        className="bg-white hover:bg-surface-50 text-surface-700 text-xs font-semibold py-2 px-4 border border-surface-300 rounded shadow-sm"
                      >
                        Examinar Archivo...
                      </button>
                      <input type="file" ref={importFileRef} onChange={handleFileSelect} className="hidden" accept=".csv,.xlsx,.xls" />
                      {importFile && (
                        <div className="text-xs">
                          <span className="font-semibold text-surface-800">{importFile.name}</span>
                          <span className="text-surface-500 ml-2">({(importFile.size / 1024).toFixed(1)} KB)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {sheetNames.length > 1 && (
                    <div>
                      <label className="block text-xs font-bold text-surface-700 mb-2">Detectadas varias hojas. Selecciona la correcta:</label>
                      <select
                        value={selectedSheet}
                        onChange={e => handleSheetChange(e.target.value)}
                        className="text-xs border border-surface-300 rounded p-2 bg-white focus:outline-none"
                      >
                        {sheetNames.map((s, idx) => (
                          <option key={idx} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleDownloadSampleTemplate}
                      className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1.5"
                    >
                      📎 Descargar plantilla de ejemplo (wellness)
                    </button>
                  </div>
                </div>

                <div className="bg-surface-50 p-4 rounded border border-surface-200 text-xs space-y-3">
                  <div>
                    <span className="font-bold text-surface-750 block">Tipo de importación:</span>
                    {cuestionarioError ? (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs font-semibold">
                        {cuestionarioError}
                      </div>
                    ) : tipoCuestionario ? (
                      <select disabled className="w-full text-xs border border-green-300 rounded p-1.5 bg-green-50 text-green-700 mt-1 cursor-not-allowed font-semibold">
                        <option>Wellness {tipoCuestionario === 'DIARIO' ? 'Diario' : 'Semanal'}</option>
                      </select>
                    ) : (
                      <select disabled className="w-full text-xs border border-surface-300 rounded p-1.5 bg-surface-100 text-surface-500 mt-1 cursor-not-allowed">
                        <option>Pendiente de archivo...</option>
                      </select>
                    )}
                    <span className="text-[10px] text-surface-450 mt-1 block">La detección (Diario/Semanal) se realiza automáticamente a partir de las cabeceras.</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-surface-150">
                <button
                  type="button"
                  disabled={!importFile || parsedRawRows.length === 0 || !!cuestionarioError}
                  onClick={() => {
                    setStep(2)
                  }}
                  className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold py-2 px-4 rounded shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente &rarr;
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW & VALIDATE */}
          {step === 2 && (
            <div className="space-y-6">
              {/* MAPPINGS MANAGER */}
              <div className="bg-surface-50 p-4 rounded-lg border border-surface-200">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-surface-800">Mapeo de Columnas</h3>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-surface-500 font-medium">Cargar plantilla:</label>
                    <select
                      value={selectedPlantillaId}
                      onChange={e => handleLoadPlantilla(e.target.value)}
                      className="text-[11px] border border-surface-300 rounded px-2 py-1 bg-white"
                    >
                      <option value="default">Google Forms Wellness 2026-27 (Predeterminada)</option>
                      {plantillas_importacion.filter(p => !p.esPredeterminada).map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleResetAutoMapping}
                      className="text-[10px] bg-white hover:bg-surface-100 text-surface-600 border border-surface-300 rounded px-2 py-1"
                    >
                      Restablecer automático
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {activeMappings.map((m, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-surface-600">
                        {m.label} {m.required && <span className="text-red-500">*</span>}
                      </span>
                      <select
                        value={m.excelHeader || ''}
                        onChange={e => handleMappingChange(m.internalField, e.target.value || null)}
                        className="text-xs border border-surface-300 rounded p-1 bg-white focus:outline-none"
                      >
                        <option value="">[Sin asignar]</option>
                        {fileHeaders.map((h, i) => (
                          <option key={i} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-surface-200 flex justify-end gap-2 items-center">
                  <span className="text-[10px] text-surface-500">¿Quieres guardar este mapeo?</span>
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={e => setNewTemplateName(e.target.value)}
                    className="text-xs border border-surface-300 rounded px-2 py-1 w-48"
                    placeholder="Nombre de plantilla"
                  />
                  <button
                    onClick={handleSaveAsNewTemplate}
                    className="text-[10px] bg-primary-600 text-white font-medium rounded px-3 py-1 hover:bg-primary-700"
                  >
                    Guardar Nueva Plantilla
                  </button>
                </div>
              </div>

              {/* VALIDATION STATUS SUMMARY */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="bg-surface-50 border border-surface-200 p-3 rounded text-center">
                  <span className="text-[10px] text-surface-500 uppercase block">Total Filas</span>
                  <span data-testid="preview-count-total" className="text-xl font-bold text-surface-800">{previewSummary.total}</span>
                </div>
                <div className="bg-green-50 border border-green-200 p-3 rounded text-center">
                  <span className="text-[10px] text-green-700 uppercase block">Nuevos</span>
                  <span data-testid="preview-count-nuevos" className="text-xl font-bold text-green-700">{previewSummary.nuevos}</span>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-3 rounded text-center">
                  <span className="text-[10px] text-blue-700 uppercase block">Actualizaciones</span>
                  <span data-testid="preview-count-actualizaciones" className="text-xl font-bold text-blue-700">{previewSummary.actualizaciones}</span>
                </div>
                <div className="bg-surface-100 border border-surface-300 p-3 rounded text-center">
                  <span className="text-[10px] text-surface-600 uppercase block">Duplicados</span>
                  <span data-testid="preview-count-duplicados" className="text-xl font-bold text-surface-700">{previewSummary.duplicados}</span>
                </div>
                <div className="bg-red-50 border border-red-200 p-3 rounded text-center">
                  <span className="text-[10px] text-red-700 uppercase block">Errores</span>
                  <span data-testid="preview-count-errores" className="text-xl font-bold text-red-700">{previewSummary.errores}</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-3 rounded text-center">
                  <span className="text-[10px] text-amber-700 uppercase block">Omitidas</span>
                  <span data-testid="preview-count-omitidas" className="text-xl font-bold text-amber-750">{previewSummary.omitidos}</span>
                </div>
              </div>

              {/* INTERACTIVE PREVIEW TABLE */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    {['ALL', 'NUEVO', 'ACTUALIZACION_POSIBLE', 'DUPLICADO_IDENTICO', 'ERROR', 'OMITIDA'].map((f, i) => (
                      <button
                        key={i}
                        onClick={() => { setStatusFilter(f); setCurrentPage(1) }}
                        className={`text-[10px] font-medium py-1 px-2.5 rounded border transition-colors ${
                          statusFilter === f
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-white text-surface-600 border-surface-300 hover:bg-surface-50'
                        }`}
                      >
                        {f === 'ALL' ? 'Todos' : f === 'ACTUALIZACION_POSIBLE' ? 'Actualizaciones' : f === 'DUPLICADO_IDENTICO' ? 'Duplicados' : f}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleDownloadValidationReport}
                    className="text-[10px] bg-white hover:bg-surface-100 text-primary-700 border border-primary-300 font-semibold px-3 py-1 rounded"
                  >
                    Descargar Informe de Validación
                  </button>
                </div>

                <div className="border border-surface-200 rounded overflow-hidden">
                  <table className="w-full text-left border-collapse bg-white">
                    <thead>
                      <tr className="bg-surface-50 border-b border-surface-200 text-[10px] font-bold text-surface-600 uppercase">
                        <th className="p-2 w-12 text-center">Fila</th>
                        <th className="p-2 w-28">Estado</th>
                        <th className="p-2 w-24">ID</th>
                        <th className="p-2">Jugadora</th>
                        <th className="p-2 w-24">Fecha</th>
                        <th className="p-2 w-10 text-center">Sue</th>
                        <th className="p-2 w-10 text-center">Fat</th>
                        <th className="p-2 w-10 text-center">Mus</th>
                        <th className="p-2 w-10 text-center">Est</th>
                        <th className="p-2 w-10 text-center">Áni</th>
                        <th className="p-2">Dolor Esp.</th>
                        <th className="p-2 w-12 text-center">Omitir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 text-xs">
                      {paginatedPreview.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="p-4 text-center text-surface-500 italic">No hay registros que coincidan con este filtro.</td>
                        </tr>
                      ) : (
                        paginatedPreview.map((row, idx) => {
                          const isEditing = editingRowId === row.filaOriginal
                          return (
                            <React.Fragment key={idx}>
                              <tr className={row.estado === 'ERROR' && !isEditing ? 'bg-red-50/30' : row.estado === 'OMITIDA' ? 'opacity-50 bg-surface-50' : ''}>
                                <td className="p-2 text-center text-surface-500 font-mono">{row.filaOriginal}</td>
                                <td className="p-2">
                                  <span className={`text-[9px] font-bold py-0.5 px-2.5 rounded-full ${
                                    row.estado === 'NUEVO' ? 'bg-green-100 text-green-700' :
                                    row.estado === 'ACTUALIZACION_POSIBLE' ? 'bg-blue-100 text-blue-700' :
                                    row.estado === 'DUPLICADO_IDENTICO' ? 'bg-surface-200 text-surface-700' :
                                    row.estado === 'ERROR' ? 'bg-red-100 text-red-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                    {row.estado === 'ACTUALIZACION_POSIBLE' ? 'CONFLICTO' : row.estado}
                                  </span>
                                </td>
                                {isEditing && draftEditData ? (
                                  <>
                                    <td colSpan={2} className="p-1">
                                      <select
                                        value={draftEditData.id_jugadora}
                                        onChange={e => setDraftEditData({ ...draftEditData, id_jugadora: e.target.value })}
                                        className="w-full text-xs border border-primary-300 rounded p-1 bg-white focus:outline-none focus:border-primary-500"
                                      >
                                        <option value="">[Seleccionar]</option>
                                        {jugadoras.map(j => (
                                          <option key={j.id_jugadora} value={j.id_jugadora}>
                                            {j.id_jugadora} - {j.nombre}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="p-1">
                                      <input
                                        type="date"
                                        value={draftEditData.fecha}
                                        onChange={e => setDraftEditData({ ...draftEditData, fecha: e.target.value })}
                                        className="w-full text-xs border border-primary-300 rounded p-1 bg-white focus:outline-none focus:border-primary-500"
                                      />
                                    </td>
                                    {['calidad_sueno', 'fatiga', 'dolor_muscular', 'estres', 'estado_animo'].map(metric => (
                                      <td key={metric} className="p-1 text-center">
                                        <input
                                          type="number"
                                          min="1" max="10"
                                          value={draftEditData[metric]}
                                          onChange={e => setDraftEditData({ ...draftEditData, [metric]: e.target.value })}
                                          className="w-10 text-xs border border-primary-300 rounded p-1 text-center bg-white focus:outline-none focus:border-primary-500"
                                        />
                                      </td>
                                    ))}
                                    <td className="p-1">
                                      <input
                                        type="text"
                                        value={draftEditData.dolor_especifico}
                                        onChange={e => setDraftEditData({ ...draftEditData, dolor_especifico: e.target.value })}
                                        className="w-full text-xs border border-primary-300 rounded p-1 bg-white focus:outline-none focus:border-primary-500"
                                        placeholder="Dolor..."
                                      />
                                    </td>
                                    <td className="p-1 text-center">
                                      <div className="flex flex-col gap-1">
                                        <button onClick={() => handleSaveRow(row.filaOriginal)} className="text-[10px] bg-primary-600 text-white font-medium px-2 py-0.5 rounded hover:bg-primary-700">Revalidar</button>
                                        <button onClick={handleCancelEdit} className="text-[10px] bg-surface-200 text-surface-700 font-medium px-2 py-0.5 rounded hover:bg-surface-300">Cancelar</button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-2 font-semibold font-mono text-surface-800">{row.id_jugadora}</td>
                                    <td className="p-2 text-surface-800">{row.nombreJugadora}</td>
                                    <td className="p-2 font-mono text-surface-700">{row.fecha}</td>
                                    <td className="p-2 text-center font-semibold">{row.calidad_sueno ?? '-'}</td>
                                    <td className="p-2 text-center font-semibold">{row.fatiga ?? '-'}</td>
                                    <td className="p-2 text-center font-semibold">{row.dolor_muscular ?? '-'}</td>
                                    <td className="p-2 text-center font-semibold">{row.estres ?? '-'}</td>
                                    <td className="p-2 text-center font-semibold">{row.estado_animo ?? '-'}</td>
                                    <td className="p-2 text-surface-600 truncate max-w-[150px]" title={row.dolor_especifico || ''}>{row.dolor_especifico || <span className="text-surface-300 italic">Ninguno</span>}</td>
                                    <td className="p-2 text-center">
                                      <div className="flex flex-col items-center gap-1">
                                        {row.estado !== 'DUPLICADO_IDENTICO' && (
                                          <input
                                            type="checkbox"
                                            checked={row.estado === 'OMITIDA'}
                                            onChange={() => handleExcludeRow(row.filaOriginal)}
                                            className="rounded border-surface-350 text-primary-600 focus:ring-primary-500 cursor-pointer mb-1"
                                            title="Omitir"
                                          />
                                        )}
                                        {!isEditing && (row.estado === 'ERROR' || row.estado === 'ACTUALIZACION_POSIBLE') && (
                                          <button onClick={() => handleEditRow(row)} className="text-[10px] font-medium text-primary-600 hover:text-primary-800 bg-primary-50 px-2 py-0.5 rounded border border-primary-200">Editar</button>
                                        )}
                                      </div>
                                    </td>
                                  </>
                                )}
                              </tr>
                              {row.estado === 'ERROR' && !isEditing && (
                                <tr>
                                  <td colSpan={12} className="p-2 bg-red-50 text-[11px] text-red-700 border-b border-red-100">
                                    <span className="font-bold">Error:</span> {row.mensaje}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION CONTROLS */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center pt-2">
                    <span data-testid="pagination-info" className="text-[10px] text-surface-500">Página {currentPage} de {totalPages}</span>
                    <div className="flex gap-1.5">
                      <button
                        data-testid="pagination-prev"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2 py-1 text-[10px] font-semibold bg-white border border-surface-300 rounded hover:bg-surface-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        &larr; Pág. anterior
                      </button>
                      <button
                        data-testid="pagination-next"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 text-[10px] font-semibold bg-white border border-surface-300 rounded hover:bg-surface-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Siguiente pág. &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {cannotGoToStep3 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded flex justify-between items-center">
                  <div className="text-amber-800 text-xs leading-relaxed max-w-3xl">
                    ⚠️ <strong>Asistente bloqueado:</strong> Hay {previewSummary.errores} fila(s) con ERROR. Asegúrate de asignar las columnas obligatorias, tener al menos una fila válida ("Nuevos" o "Actualizaciones") y omitir o corregir los errores para continuar.
                  </div>
                  {previewSummary.errores > 0 && (
                    <button
                      onClick={handleJumpToNextError}
                      className="bg-white hover:bg-amber-100 text-amber-700 text-[11px] font-semibold py-1.5 px-3 border border-amber-300 rounded shadow-sm whitespace-nowrap"
                    >
                      Saltar al siguiente error &rarr;
                    </button>
                  )}
                </div>
              )}

              <div className="flex justify-between gap-3 pt-4 border-t border-surface-150">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="bg-white hover:bg-surface-50 text-surface-600 text-xs font-semibold py-2 px-4 border border-surface-300 rounded shadow-sm"
                >
                  &larr; Volver
                </button>
                <button
                  type="button"
                  disabled={cannotGoToStep3}
                  onClick={() => setStep(3)}
                  className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold py-2 px-4 rounded shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente &rarr;
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CONFIRM & STRATEGY */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-surface-50 p-4 rounded border border-surface-200 text-xs space-y-4">
                <h3 className="font-bold text-surface-800 text-sm">Resumen de Carga</h3>
                <ul className="space-y-2 list-disc pl-4 text-surface-700">
                  <li>Archivo origen: <strong>{importFile?.name}</strong> {selectedSheet && `(Hoja: ${selectedSheet})`}</li>
                  <li>Plantilla de mapeo: <strong>{selectedPlantillaId === 'default' ? 'Google Forms Wellness 2026-27' : 'Personalizada'}</strong></li>
                  <li>Registros nuevos a insertar: <strong className="text-green-700">{previewSummary.nuevos}</strong></li>
                  <li>Conflictos/Actualizaciones posibles: <strong className="text-blue-700">{previewSummary.actualizaciones}</strong></li>
                  <li>Duplicados idénticos a omitir: <span className="text-surface-500 font-medium">{previewSummary.duplicados}</span></li>
                  <li>Errores descartados: <span className="text-red-600 font-medium">{previewSummary.errores}</span></li>
                </ul>
              </div>

              {/* CONFLICT STRATEGY SELECTOR */}
              {previewSummary.actualizaciones > 0 && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-3">
                  <h4 className="text-xs font-bold text-blue-900">¿Cómo quieres resolver las {previewSummary.actualizaciones} actualizaciones?</h4>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-xs text-blue-800 cursor-pointer">
                      <input
                        type="radio"
                        name="conflict"
                        checked={conflictStrategy === 'omit'}
                        onChange={() => setConflictStrategy('omit')}
                      />
                      <span><strong>Omitir actualizaciones:</strong> Conserva tus datos locales tal como están (recomendado por seguridad).</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-blue-800 cursor-pointer">
                      <input
                        type="radio"
                        name="conflict"
                        checked={conflictStrategy === 'update'}
                        onChange={() => setConflictStrategy('update')}
                      />
                      <span><strong>Sobrescribir datos locales:</strong> Actualiza las filas del sistema local con los valores del archivo.</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-blue-800 cursor-pointer">
                      <input
                        type="radio"
                        name="conflict"
                        checked={conflictStrategy === 'cancel'}
                        onChange={() => setConflictStrategy('cancel')}
                      />
                      <span><strong>Cancelar importación:</strong> Detiene todo el asistente sin escribir ninguna modificación.</span>
                    </label>
                  </div>
                </div>
              )}

              {/* SAFETY EMERGENGY BACKUP */}
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg space-y-4">
                <h4 className="text-xs font-bold text-red-900">⚠️ Paso obligatorio de seguridad antes de importar:</h4>
                <p className="text-[11px] text-red-700 leading-normal">
                  Debes generar y descargar un backup completo físico. En caso de fallo o descontento con los resultados de la importación, podrás utilizar este archivo para restaurar la base de datos local a su estado anterior.
                </p>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleDownloadImportBackup}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2 px-4 rounded shadow-sm shadow-red-200 block w-full md:w-auto"
                  >
                    1. Descargar copia de seguridad previa
                  </button>

                  {downloadedImportBackupName && (
                    <div className="text-xs text-green-700 font-semibold flex items-center gap-1.5">
                      ✓ Copia descargada con éxito: <span className="font-mono text-[11px] bg-white border border-green-300 rounded px-1.5 py-0.5">{downloadedImportBackupName}</span>
                    </div>
                  )}

                  <label className={`flex items-start gap-2 ${!downloadedImportBackupName ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      disabled={!downloadedImportBackupName}
                      checked={confirmImportBackup}
                      onChange={e => setConfirmImportBackup(e.target.checked)}
                      className="mt-0.5 rounded border-red-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-[11px] font-medium text-red-800">
                      2. Confirmo que he guardado esta copia de seguridad fuera del navegador.
                    </span>
                  </label>
                </div>
              </div>

              {/* SUBMIT OR CANCEL */}
              <div className="flex justify-between gap-3 pt-4 border-t border-surface-150">
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => setStep(2)}
                  className="bg-white hover:bg-surface-50 text-surface-600 text-xs font-semibold py-2 px-4 border border-surface-300 rounded shadow-sm disabled:opacity-50"
                >
                  &larr; Volver
                </button>
                <button
                  type="button"
                  disabled={importing || !downloadedImportBackupName || !confirmImportBackup}
                  onClick={executeImport}
                  className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold py-2 px-6 rounded shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {importing ? 'Importando...' : 'Aplicar importación'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: OUTCOMES & PROGRESS */}
          {step === 4 && (
            <div className="space-y-6">
              {importOutcome?.success && (
                <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg">
                  <h3 className="font-bold text-sm">✓ ¡Importación aplicada en la base de datos local!</h3>
                  <p className="text-xs mt-1">Registros añadidos: <strong>{importOutcome.inserted}</strong> | Actualizados: <strong>{importOutcome.updated}</strong> | Omitidos: {importOutcome.skipped} | Errores: {importOutcome.errors}</p>
                </div>
              )}

              {/* RECALCULATION PROGRESS BAR */}
              <div className="bg-surface-50 p-4 rounded border border-surface-200 space-y-4">
                <h4 className="text-xs font-bold text-surface-800 flex items-center gap-2">
                  {(recalculating || recalcProgress < 100) && !recalcError ? (
                    <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-primary-600 border-t-transparent rounded-full" />
                  ) : recalcProgress === 100 ? (
                    <span className="text-green-700">✓</span>
                  ) : (
                    <span className="text-amber-600">⚠️</span>
                  )}
                  <span>Recálculo de Indicadores Derivados (Readiness y Alertas)</span>
                </h4>

                <div className="w-full bg-surface-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${recalcError ? 'bg-red-500' : 'bg-primary-600'}`}
                    style={{ width: `${recalcProgress}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-surface-500 font-mono">
                  <span>Progreso: {recalcProgress}%</span>
                  {recalcProgress === 100 && <span className="text-green-700 font-bold">Completado con éxito</span>}
                  {recalcError && <span className="text-red-600 font-bold">Fallido</span>}
                </div>

                {recalcError && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs space-y-2">
                    <p className="text-amber-800">
                      <strong>Aviso:</strong> El wellness se importó correctamente, pero el proceso de regeneración automática falló debido a: <em>{recalcError}</em>.
                    </p>
                    <p className="text-amber-700 text-[11px]">
                      Puedes forzar el cálculo manual de todos los indicadores dependientes en cualquier momento utilizando el botón inferior.
                    </p>
                    <button
                      onClick={() => importOutcome?.idImportacion && triggerDerivedRecalculation(importOutcome.idImportacion, previewData)}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-semibold px-3 py-1.5 rounded shadow-sm"
                    >
                      Recalcular seguimiento ahora
                    </button>
                  </div>
                )}
              </div>

              {/* SUCCESS ACTIONS */}
              <div className="flex justify-between items-center pt-4 border-t border-surface-200">
                <button
                  type="button"
                  onClick={() => { setStep(1); resetFileState() }}
                  className="bg-white hover:bg-surface-50 text-surface-700 text-xs font-semibold py-2 px-4 border border-surface-300 rounded shadow-sm"
                >
                  Importar otro archivo
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const reportCsv = crearInformeValidacion(previewData)
                      const blob = new Blob([reportCsv], { type: 'text/csv;charset=utf-8;' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `reporte_resultado_wellness.csv`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                    }}
                    className="bg-white hover:bg-surface-50 text-surface-700 text-xs font-semibold py-2 px-4 border border-surface-300 rounded shadow-sm"
                  >
                    Descargar reporte final
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* IMPORT HISTORY LIST */}
      <section className="bg-white rounded-lg border border-surface-200 shadow-sm overflow-hidden">
        <div className="bg-surface-50 border-b border-surface-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-surface-800">Historial de Importaciones</h2>
          <button
            onClick={() => {
              exportToJSON(historial_importaciones, 'historial_importaciones')
            }}
            className="text-[10px] bg-white hover:bg-surface-100 text-surface-600 border border-surface-300 rounded px-2.5 py-1"
          >
            Exportar Historial (JSON)
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200 text-[10px] font-bold text-surface-500 uppercase">
                <th className="p-3 w-40">Fecha/Hora</th>
                <th className="p-3">Archivo</th>
                <th className="p-3 w-28">Tipo</th>
                <th className="p-3 w-20 text-center">Registros</th>
                <th className="p-3 w-28">Estado</th>
                <th className="p-3 w-28 text-center">Derivados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 text-xs text-surface-700">
              {historial_importaciones.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-surface-400 italic">No hay historial de importaciones disponible.</td>
                </tr>
              ) : (
                historial_importaciones.map((hist, idx) => (
                  <tr key={idx} className="hover:bg-surface-50/50">
                    <td className="p-3 font-mono">{new Date(hist.fechaHora).toLocaleString()}</td>
                    <td className="p-3 font-semibold text-surface-800">
                      {hist.nombreArchivo} {hist.hojaSeleccionada && <span className="text-[10px] text-surface-400 font-normal">({hist.hojaSeleccionada})</span>}
                    </td>
                    <td className="p-3 uppercase font-semibold text-[10px] text-surface-600">{hist.tipoImportacion}</td>
                    <td className="p-3 text-center">
                      <span className="text-green-700 font-bold" title="Insertados">{hist.registrosNuevos}</span>
                      <span className="text-surface-400 mx-1">/</span>
                      <span className="text-blue-700 font-bold" title="Actualizados">{hist.registrosActualizados}</span>
                      {hist.registrosErroneos > 0 && (
                        <>
                          <span className="text-surface-400 mx-1">/</span>
                          <span className="text-red-600 font-bold" title="Errores">{hist.registrosErroneos}</span>
                        </>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`text-[9px] font-bold py-0.5 px-2 rounded-full ${
                        hist.estado === 'completada' ? 'bg-green-100 text-green-700' :
                        hist.estado === 'parcial' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {hist.estado === 'completada' ? 'EXITOSA' : hist.estado === 'parcial' ? 'PARCIAL' : 'ERROR'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {hist.derivadosPendientes ? (
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="text-[9px] font-bold py-0.5 px-2 rounded bg-amber-100 text-amber-700">PENDIENTE</span>
                          <button
                            onClick={() => handleManualRecalculateDerived(hist)}
                            disabled={recalculating}
                            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-[9px] text-white font-medium px-2 py-0.5 rounded shadow-sm"
                          >
                            Recalcular
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-green-700 font-semibold">✓ Al día</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* RESTORE REPLACE/MERGE DIALOG */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-surface-800 mb-4 font-sans">Restaurar Copia de Seguridad</h3>

            {validationResult && (
              <div className="mb-4 text-xs">
                <div className="bg-surface-50 p-3 rounded border border-surface-200 mb-3">
                  <p className="font-semibold text-surface-700">Previsualización de la Copia:</p>
                  <ul className="list-disc pl-4 mt-1 space-y-1 text-surface-600">
                    <li>Versión del archivo: <strong>v{validationResult.details?.versionBackup || 'Desconocida'}</strong> (Versión App: v{validationResult.details?.versionApp || 15})</li>
                    <li>Fecha del backup: {restoreData?.timestamp ? new Date(restoreData.timestamp).toLocaleString() : 'No informada'}</li>
                    <li>Tablas detectadas: {validationResult.details?.tablesFound.length || 0}</li>
                    {validationResult.details?.criticalMissing?.length ? (
                      <li className="text-red-700 font-semibold">Tablas críticas ausentes: {validationResult.details.criticalMissing.join(', ')}</li>
                    ) : null}
                    {validationResult.details?.tablesMissing?.length > 0 && (
                      <li className="text-amber-700">Tablas opcionales ausentes: {validationResult.details.tablesMissing.join(', ')}</li>
                    )}
                    {validationResult.details?.unknownEntities?.length > 0 && (
                      <li className="text-amber-600">Entidades desconocidas: {validationResult.details.unknownEntities.join(', ')}</li>
                    )}
                  </ul>
                </div>

                {!validationResult.canRestore ? (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded font-medium">
                    ⚠️ {validationResult.error}
                    <p className="text-[10px] mt-1 text-red-600">La restauración está deshabilitada porque no es compatible con el esquema actual (v15).</p>
                  </div>
                ) : (
                  validationResult.warnings.map((w: string, idx: number) => (
                    <div key={idx} className="p-2 bg-amber-50 border border-amber-200 text-amber-700 rounded mb-2">
                      ⚠️ {w}
                    </div>
                  ))
                )}
              </div>
            )}

            {validationResult?.canRestore && (
              <div className="space-y-4 mb-6">
                <p className="text-xs text-surface-600">Selecciona el modo de restauración:</p>
                <label className="flex flex-col gap-1 p-3 border rounded cursor-pointer hover:bg-surface-50">
                  <div className="flex items-center gap-2">
                    <input type="radio" name="restoreMode" checked={restoreMode === 'merge'} onChange={() => setRestoreMode('merge')} />
                    <span className="text-sm font-medium text-surface-800">Fusionar de forma segura</span>
                  </div>
                  <p className="text-[10px] text-surface-500 ml-5">Añade registros nuevos y conserva tus datos locales actuales si hay conflictos (sin sobreescribir).</p>
                </label>

                <label className="flex flex-col gap-1 p-3 border border-red-200 bg-red-50 rounded cursor-pointer">
                  <div className="flex items-center gap-2">
                    <input type="radio" name="restoreMode" checked={restoreMode === 'replace'} onChange={() => setRestoreMode('replace')} />
                    <span className="text-sm font-medium text-red-800">Reemplazar datos actuales (Replace)</span>
                  </div>
                  <p className="text-[10px] text-red-600 ml-5">Vacía las tablas base locales y escribe el contenido de la copia de seguridad tras confirmación explícita.</p>
                </label>

                {restoreMode === 'merge' && mergePreview && (
                  <div className="bg-blue-50/70 p-3 rounded border border-blue-200 text-xs space-y-3">
                    <p className="font-semibold text-blue-900">📊 Previsualización del análisis de Fusión:</p>
                    <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                      <div className="bg-white p-2 rounded border border-blue-150">
                        <span className="block font-bold text-green-700">{mergePreview.totalNew}</span>
                        <span className="text-[10px] text-surface-500">Nuevos</span>
                      </div>
                      <div className="bg-white p-2 rounded border border-blue-150">
                        <span className="block font-bold text-amber-700">{mergePreview.totalConflicts}</span>
                        <span className="text-[10px] text-surface-500">Conflictos</span>
                      </div>
                      <div className="bg-white p-2 rounded border border-blue-150">
                        <span className="block font-bold text-surface-600">{mergePreview.totalOrphans}</span>
                        <span className="text-[10px] text-surface-500">Huérfanos</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <p className="font-semibold text-blue-900 text-[11px]">Estrategia para registros conflictivos:</p>
                      <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-blue-200">
                        <input
                          type="radio"
                          name="mergeStrategy"
                          checked={mergeStrategy === 'skip'}
                          onChange={() => setMergeStrategy('skip')}
                        />
                        <div className="text-[11px]">
                          <span className="font-bold text-surface-800">Omitir (Recomendado)</span>
                          <p className="text-[10px] text-surface-500">Conserva tus datos locales sin sobreescribirlos.</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-blue-200">
                        <input
                          type="radio"
                          name="mergeStrategy"
                          checked={mergeStrategy === 'overwrite'}
                          onChange={() => setMergeStrategy('overwrite')}
                        />
                        <div className="text-[11px]">
                          <span className="font-bold text-amber-800">Sobrescribir</span>
                          <p className="text-[10px] text-surface-500">Actualiza los registros locales con los del backup.</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {restoreMode === 'replace' && (
                  <div className="bg-red-50 p-3 rounded border border-red-200 text-xs space-y-3">
                    <p className="font-semibold text-red-700">⚠️ Pasos obligatorios de seguridad para reemplazar:</p>

                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handleDownloadEmergencyBackup}
                        className="w-full bg-red-600 hover:bg-red-700 text-white text-[11px] font-medium py-1.5 px-3 rounded shadow-sm"
                      >
                        1. Descargar copia de seguridad previa (obligatoria)
                      </button>

                      {downloadedPrevBackupName && (
                        <p className="text-[10px] text-green-700 font-medium">
                          ✓ Descargado: {downloadedPrevBackupName}
                        </p>
                      )}
                    </div>

                    <label className={`flex items-start gap-2 ${!downloadedPrevBackupName ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        disabled={!downloadedPrevBackupName}
                        checked={confirmBackupPrevio}
                        onChange={e => setConfirmBackupPrevio(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span className="text-[10px] text-red-700 font-medium leading-tight">
                        2. Confirmo que he guardado esta copia de seguridad previa fuera del navegador.
                      </span>
                    </label>

                    <div className={!confirmBackupPrevio ? 'opacity-50 pointer-events-none' : ''}>
                      <p className="text-[10px] text-red-700 font-medium mb-1">
                        3. Escribe REEMPLAZAR abajo para confirmar:
                      </p>
                      <input
                        type="text"
                        disabled={!confirmBackupPrevio}
                        value={restoreConfirmText}
                        onChange={e => setRestoreConfirmText(e.target.value)}
                        className="w-full text-xs border border-red-300 rounded px-2 py-1 bg-white focus:outline-none"
                        placeholder="REEMPLAZAR"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
              <button onClick={() => setShowRestoreModal(false)} className="px-4 py-2 text-xs font-medium text-surface-600 hover:text-surface-800">
                Cancelar
              </button>
              <button
                onClick={executeRestore}
                disabled={
                  !validationResult?.canRestore ||
                  (restoreMode === 'replace' && (!downloadedPrevBackupName || !confirmBackupPrevio || restoreConfirmText !== 'REEMPLAZAR'))
                }
                className="px-4 py-2 text-xs font-medium bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Confirmar y Restaurar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
