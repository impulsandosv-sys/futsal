import { useState, useRef, useEffect } from 'react'
import { Modal } from '@/components/shared/Modal'
import { db } from '@/db/database'
import {
  analizarImportacionChronojumpCMJ,
  ejecutarImportacionChronojumpCMJAtomica,
  type ResumenPrevisualizacionChronojumpCMJ,
} from '@/domain/neuromuscular/chronojumpImportService'

interface ChronojumpImportModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function ChronojumpImportModal({ open, onClose, onSuccess }: ChronojumpImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [analizando, setAnalizando] = useState(false)
  const [insertando, setInsertando] = useState(false)
  const [resumen, setResumen] = useState<ResumenPrevisualizacionChronojumpCMJ | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setSelectedFile(null)
      setResumen(null)
      setErrorMsg('')
      setSuccessMsg('')
      setAnalizando(false)
      setInsertando(false)
    }
  }, [open])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setResumen(null)
    setErrorMsg('')
    setSuccessMsg('')
    analizarArchivo(file)
  }

  const analizarArchivo = async (file: File) => {
    setAnalizando(true)
    setErrorMsg('')
    try {
      const texto = await file.text()
      const res = await analizarImportacionChronojumpCMJ(db, texto, file.name)
      setResumen(res)
      if (!res.exito && res.mensajeGlobal) {
        setErrorMsg(res.mensajeGlobal)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido al analizar el archivo'
      setErrorMsg(`Error de lectura: ${message}`)
    } finally {
      setAnalizando(false)
    }
  }

  const handleConfirmar = async () => {
    if (!resumen || !resumen.puedeConfirmar) return

    setInsertando(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await ejecutarImportacionChronojumpCMJAtomica(db, resumen)
      if (res.exito) {
        setSuccessMsg(`¡Importación completada! ${res.totalInsertados} saltos importados en el lote.`)
        if (onSuccess) onSuccess()
        setTimeout(() => {
          onClose()
        }, 1500)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fallo en la transacción de importación'
      setErrorMsg(`Error al importar: ${message}`)
    } finally {
      setInsertando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Importar CSV Chronojump (CMJ)" width="max-w-4xl">
      <div className="space-y-4 text-xs">
        {/* Aviso de alcance del adaptador */}
        <div className="bg-surface-50 p-3 rounded-lg border border-surface-200 text-surface-600">
          <p className="font-semibold text-surface-900 mb-1">
            Adaptador Nativo Chronojump Desktop (v2.6.0-072)
          </p>
          <p>
            Soporta la exportación de sesión (grupal). Procesa exclusivamente la sección{' '}
            <code className="bg-surface-200 px-1 py-0.5 rounded font-mono">+ SALTOS SIMPLES</code> para saltos tipo{' '}
            <code className="bg-surface-200 px-1 py-0.5 rounded font-mono">CMJ</code>. Requiere que las jugadoras tengan un alias activo de origen{' '}
            <code className="bg-surface-200 px-1 py-0.5 rounded font-mono">chronojump</code> (ej. CJ-01).
          </p>
        </div>

        {/* Selección de archivo */}
        <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-surface-200">
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={analizando || insertando}
            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded font-medium disabled:opacity-50"
          >
            {selectedFile ? 'Cambiar archivo CSV' : 'Seleccionar CSV Chronojump'}
          </button>
          <span className="text-surface-600 font-mono">
            {selectedFile ? selectedFile.name : 'Ningún archivo seleccionado'}
          </span>
          {analizando && <span className="text-primary-600 font-medium animate-pulse">Analizando...</span>}
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg font-medium">
            {successMsg}
          </div>
        )}

        {/* Previsualización del resumen de importación */}
        {resumen && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <div className="p-2 bg-surface-100 rounded text-center">
                <span className="block text-[10px] text-surface-500 uppercase font-medium">Filas CMJ</span>
                <span className="text-sm font-bold text-surface-900">{resumen.totalCMJ}</span>
              </div>
              <div className="p-2 bg-green-50 rounded text-center border border-green-200">
                <span className="block text-[10px] text-green-700 uppercase font-medium">Válidos</span>
                <span className="text-sm font-bold text-green-700">{resumen.nuevosValidos}</span>
              </div>
              <div className="p-2 bg-amber-50 rounded text-center border border-amber-200">
                <span className="block text-[10px] text-amber-700 uppercase font-medium">Revisión</span>
                <span className="text-sm font-bold text-amber-700">{resumen.requierenRevision}</span>
              </div>
              <div className="p-2 bg-surface-100 rounded text-center border border-surface-300">
                <span className="block text-[10px] text-surface-600 uppercase font-medium">Duplicados</span>
                <span className="text-sm font-bold text-surface-700">{resumen.duplicados}</span>
              </div>
              <div className="p-2 bg-red-50 rounded text-center border border-red-200">
                <span className="block text-[10px] text-red-700 uppercase font-medium">Conflictos</span>
                <span className="text-sm font-bold text-red-700">{resumen.conflictos}</span>
              </div>
              <div className="p-2 bg-red-100 rounded text-center border border-red-300">
                <span className="block text-[10px] text-red-800 uppercase font-medium">Errores</span>
                <span className="text-sm font-bold text-red-800">{resumen.errores}</span>
              </div>
            </div>

            {/* Mensaje de bloqueo si hay errores/conflictos */}
            {!resumen.puedeConfirmar && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded text-[11px]">
                ⚠️ <strong>Importación bloqueada:</strong>{' '}
                {resumen.errores > 0 || resumen.conflictos > 0
                  ? 'El archivo contiene errores de identidad o conflictos con mediciones existentes. Corrija los alias o el archivo antes de confirmar.'
                  : 'No hay mediciones nuevas ni elegibles para importar.'}
              </div>
            )}

            {/* Tabla detallada de previsualización por fila */}
            <div className="max-h-60 overflow-y-auto border border-surface-200 rounded-lg">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-surface-100 sticky top-0 border-b border-surface-200">
                  <tr>
                    <th className="p-2">Fila</th>
                    <th className="p-2">Alias Chronojump</th>
                    <th className="p-2">Jugadora Resuelta</th>
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Intento</th>
                    <th className="p-2">Altura</th>
                    <th className="p-2">TV</th>
                    <th className="p-2">Estado</th>
                    <th className="p-2">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {resumen.filas.map((f, i) => (
                    <tr key={i} className="hover:bg-surface-50">
                      <td className="p-2 text-surface-400 font-mono">#{f.numFilaOriginal}</td>
                      <td className="p-2 font-mono">{f.aliasOrigen}</td>
                      <td className="p-2 font-medium">
                        {f.nombreJugadoraInternal ? (
                          <span className="text-surface-900">{f.nombreJugadoraInternal}</span>
                        ) : (
                          <span className="text-red-600 font-normal">Sin resolver</span>
                        )}
                      </td>
                      <td className="p-2 font-mono">{f.fecha || '—'}</td>
                      <td className="p-2">{f.intento ? `#${f.intento}` : '—'}</td>
                      <td className="p-2 font-semibold">
                        {f.alturaSaltoCm ? `${f.alturaSaltoCm} cm` : '—'}
                        {f.seleccionadoComoMejor && (
                          <span className="ml-1 text-[9px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                            ★ Mejor
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-surface-600">{f.tiempoVueloMs ? `${f.tiempoVueloMs} ms` : '—'}</td>
                      <td className="p-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            f.estado === 'valido'
                              ? 'bg-green-100 text-green-800'
                              : f.estado === 'requiere_revision'
                              ? 'bg-amber-100 text-amber-800'
                              : f.estado === 'duplicado'
                              ? 'bg-surface-200 text-surface-700'
                              : f.estado === 'conflicto'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-red-200 text-red-900'
                          }`}
                        >
                          {f.estado}
                        </span>
                      </td>
                      <td className="p-2 text-surface-500 max-w-xs truncate" title={f.motivoEstado}>
                        {f.motivoEstado || 'OK'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Acciones del Modal */}
        <div className="flex justify-between items-center pt-2 border-t border-surface-200">
          <span className="text-[11px] text-surface-400">
            {resumen ? `${resumen.nuevosValidos + resumen.requierenRevision} mediciones listas para insertar` : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={insertando}
              className="px-3 py-1.5 border border-surface-300 hover:bg-surface-100 text-surface-700 rounded font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={!resumen || !resumen.puedeConfirmar || insertando}
              className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {insertando ? 'Importando...' : 'Confirmar Importación'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
