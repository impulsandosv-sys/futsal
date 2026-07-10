import { useState, useRef } from 'react'
import { useStore } from '@/store/store'
import { parseCSV, parseExcel } from '@/utils/sync'
import type { ImportResult } from '@/utils/sync'
import { exportToExcel, exportToJSON } from '@/utils/export'
import { exportBackupToFile, getBackupInfo } from '@/utils/backup'

export function ImportPage() {
  const { jugadoras, wellness, sesiones, partidos, lesiones, tests, rpe_entreno, rpe_partido, resumen_semanal, alertas, importFormResponses, seedDemoData, hasData } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [seeding, setSeeding] = useState(false)

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await seedDemoData()
    } finally {
      setSeeding(false)
    }
  }

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setImporting(true)
    setError('')
    setResult(null)

    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let responses
      if (ext === 'csv') {
        responses = await parseCSV(file)
      } else if (ext === 'xlsx' || ext === 'xls') {
        responses = await parseExcel(file)
      } else {
        throw new Error('Formato no soportado. Usa CSV o Excel.')
      }

      const validas = responses.filter((r) => jugadoras.some((j) => j.id_jugadora === r.id_jugadora))
      const invalidas = responses.length - validas.length
      const antes = wellness.length

      await importFormResponses(responses)

      const despues = useStore.getState().wellness.length
      const importadas = despues - antes

      setResult({
        importadas,
        omitidas: validas.length - importadas + invalidas,
        errores: invalidas > 0 ? [`${invalidas} respuestas con ID no reconocido`] : [],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setImporting(false)
    }
  }

  const handleExportAll = () => {
    const data = {
      jugadoras,
      wellness,
      sesiones,
      partidos,
      lesiones,
      tests,
      rpe_entreno,
      rpe_partido,
      resumen_semanal,
      alertas,
    }
    exportToJSON(data, `futsal_export_${new Date().toISOString().split('T')[0]}`)
  }

  const handleExportWellness = () => {
    const data = wellness.map((w) => {
      const jug = jugadoras.find((j) => j.id_jugadora === w.id_jugadora)
      return {
        Fecha: w.fecha,
        ID_Jugadora: w.id_jugadora,
        Jugadora: jug?.nombre || '',
        Sueño: w.calidad_sueno,
        Fatiga: w.fatiga,
        Dolor_Muscular: w.dolor_muscular,
        Estrés: w.estres,
        Ánimo: w.estado_animo,
        Score_Wellness: w.score_wellness,
        Dolor_Específico: w.dolor_especifico,
      }
    })
    exportToExcel(data, `wellness_${new Date().toISOString().split('T')[0]}`)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-surface-800">Importar / Exportar datos</h1>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-surface-200 p-5">
          <h2 className="text-sm font-semibold text-surface-800 mb-4">Importar respuestas de formulario</h2>
          <p className="text-[10px] text-surface-500 mb-4">
            Sube un archivo CSV o Excel exportado desde Google Sheets con las respuestas del formulario diario de wellness.
            Las columnas se normalizarán automáticamente. Los IDs de jugadora deben coincidir con los registrados.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-medium text-surface-600 block mb-1">Seleccionar archivo</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="w-full text-xs text-surface-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
            </div>

            <button
              onClick={handleImport}
              disabled={importing}
              className="bg-primary-600 text-white text-xs font-medium px-4 py-2 rounded hover:bg-primary-700 disabled:opacity-50"
            >
              {importing ? 'Importando...' : 'Importar respuestas'}
            </button>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>
            )}

            {result && (
              <div className="text-xs bg-green-50 border border-green-200 rounded p-3 space-y-1">
                <p className="text-green-700 font-medium">Importación completada</p>
                <p className="text-green-600">Registros importados: {result.importadas}</p>
                <p className="text-green-600">Registros omitidos (duplicados/erróneos): {result.omitidas}</p>
                {result.errores.map((e, i) => (
                  <p key={i} className="text-amber-600">{e}</p>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-surface-100 pt-4">
            <h3 className="text-xs font-semibold text-surface-700 mb-2">Estructura esperada del formulario</h3>
            <p className="text-[10px] text-surface-500 mb-2">
              El archivo debe contener columnas que se puedan mapear a estos campos. El sistema reconoce múltiples nombres de columna (ej: "Calidad de sueño", "Sueño", "Sueño (1-10)").
            </p>
            <table className="text-[10px] w-full">
              <thead>
                <tr className="bg-surface-50">
                  <th className="text-left px-2 py-1 text-surface-600">Campo</th>
                  <th className="text-left px-2 py-1 text-surface-600">Tipo</th>
                  <th className="text-left px-2 py-1 text-surface-600">Descripción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                <tr><td className="px-2 py-1 font-medium">ID_Jugadora</td><td className="px-2 py-1">Texto</td><td className="px-2 py-1 text-surface-500">Identificador único</td></tr>
                <tr><td className="px-2 py-1 font-medium">Fecha</td><td className="px-2 py-1">Fecha</td><td className="px-2 py-1 text-surface-500">YYYY-MM-DD</td></tr>
                <tr><td className="px-2 py-1 font-medium">Calidad_Sueño</td><td className="px-2 py-1">1-10</td><td className="px-2 py-1 text-surface-500">Calidad de sueño percibida</td></tr>
                <tr><td className="px-2 py-1 font-medium">Fatiga</td><td className="px-2 py-1">1-10</td><td className="px-2 py-1 text-surface-500">Nivel de fatiga</td></tr>
                <tr><td className="px-2 py-1 font-medium">Dolor_Muscular</td><td className="px-2 py-1">1-10</td><td className="px-2 py-1 text-surface-500">Dolor muscular percibido</td></tr>
                <tr><td className="px-2 py-1 font-medium">Estrés</td><td className="px-2 py-1">1-10</td><td className="px-2 py-1 text-surface-500">Nivel de estrés</td></tr>
                <tr><td className="px-2 py-1 font-medium">Estado_Ánimo</td><td className="px-2 py-1">1-10</td><td className="px-2 py-1 text-surface-500">Estado de ánimo</td></tr>
                <tr><td className="px-2 py-1 font-medium">Dolor_Específico</td><td className="px-2 py-1">Texto</td><td className="px-2 py-1 text-surface-500">Nota sobre dolor (opcional)</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-surface-200 p-5">
            <h2 className="text-sm font-semibold text-surface-800 mb-4">Exportar datos</h2>
            <div className="space-y-3">
              <button onClick={handleExportWellness} className="w-full text-left text-xs bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded px-4 py-2.5 transition-colors">
                <span className="font-medium text-surface-700">Exportar Wellness a Excel</span>
                <span className="block text-[10px] text-surface-400">Todos los registros de wellness diario</span>
              </button>
              <button onClick={handleExportAll} className="w-full text-left text-xs bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded px-4 py-2.5 transition-colors">
                <span className="font-medium text-surface-700">Exportar todo (JSON)</span>
                <span className="block text-[10px] text-surface-400">Backup completo de la base de datos</span>
              </button>
              <button
                onClick={exportBackupToFile}
                className="w-full text-left text-xs bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded px-4 py-2.5 transition-colors"
              >
                <span className="font-medium text-surface-700">Descargar backup automático</span>
                <span className="block text-[10px] text-surface-400">
                  {getBackupInfo().exists
                    ? `Último backup: ${new Date(getBackupInfo().timestamp!).toLocaleString('es-ES')}`
                    : 'No hay backup disponible. Los backups se crean automáticamente cada 5 min.'}
                </span>
              </button>
              <button
                onClick={() => {
                  const data = resumen_semanal.map(rs => {
                    const jug = jugadoras.find(j => j.id_jugadora === rs.id_jugadora)
                    return {
                      Semana: rs.semana,
                      Jugadora: jug?.nombre || rs.id_jugadora,
                      'Carga Total': rs.carga_total,
                      'Carga Crónica': rs.carga_cronica,
                      ACWR: rs.acwr,
                      Wellness: rs.wellness_medio,
                    }
                  })
                  exportToExcel(data, 'resumen_semanal')
                }}
                className="w-full text-left text-xs bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded px-4 py-2.5 transition-colors"
              >
                <span className="font-medium text-surface-700">Exportar resumen semanal</span>
                <span className="block text-[10px] text-surface-400">Datos de carga y ACWR semanal</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-surface-200 p-5">
            <h2 className="text-sm font-semibold text-surface-800 mb-3">Resumen de datos</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-xs bg-surface-50 rounded p-3 flex justify-between">
                <span className="text-surface-500">Jugadoras</span>
                <span className="font-semibold">{jugadoras.length}</span>
              </div>
              <div className="text-xs bg-surface-50 rounded p-3 flex justify-between">
                <span className="text-surface-500">Wellness</span>
                <span className="font-semibold">{wellness.length}</span>
              </div>
              <div className="text-xs bg-surface-50 rounded p-3 flex justify-between">
                <span className="text-surface-500">Sesiones</span>
                <span className="font-semibold">{sesiones.length}</span>
              </div>
              <div className="text-xs bg-surface-50 rounded p-3 flex justify-between">
                <span className="text-surface-500">Partidos</span>
                <span className="font-semibold">{partidos.length}</span>
              </div>
              <div className="text-xs bg-surface-50 rounded p-3 flex justify-between">
                <span className="text-surface-500">Lesiones</span>
                <span className="font-semibold">{lesiones.length}</span>
              </div>
              <div className="text-xs bg-surface-50 rounded p-3 flex justify-between">
                <span className="text-surface-500">Tests</span>
                <span className="font-semibold">{tests.length}</span>
              </div>
              <div className="text-xs bg-surface-50 rounded p-3 flex justify-between">
                <span className="text-surface-500">RPE Entreno</span>
                <span className="font-semibold">{rpe_entreno.length}</span>
              </div>
              <div className="text-xs bg-surface-50 rounded p-3 flex justify-between">
                <span className="text-surface-500">Alertas</span>
                <span className="font-semibold">{alertas.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-surface-200 p-5">
            <h2 className="text-sm font-semibold text-surface-800 mb-3">Datos de demostración</h2>
            <p className="text-[10px] text-surface-500 mb-3">
              Carga datos de ejemplo para explorar la aplicación. Solo se ejecuta si no hay datos.
            </p>
            <button
              onClick={handleSeed}
              disabled={seeding || hasData}
              className="w-full bg-surface-800 text-white text-xs font-medium px-4 py-2 rounded hover:bg-surface-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {seeding ? 'Cargando datos...' : hasData ? 'Ya hay datos cargados' : 'Cargar datos de demostración'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
