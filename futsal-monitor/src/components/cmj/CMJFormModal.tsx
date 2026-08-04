import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/shared/Modal'
import { useStore } from '@/store/store'
import { procesarMedicionCMJ } from '@/domain/neuromuscular/cmjEngine'
import type { MedicionCMJ, IntentoCMJ } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  editingId?: string | null
}

const FINALIDADES = [
  { value: 'control', label: 'Control / Evaluación' },
  { value: 'pre_sesion', label: 'Pre-sesión' },
  { value: 'post_sesion', label: 'Post-sesión' },
  { value: 'retest', label: 'Retest' },
  { value: 'otro', label: 'Otro' }
]

export function CMJFormModal({ open, onClose, editingId }: Props) {
  const jugadoras = useStore(state => state.jugadoras)
  const protocolos = useStore(state => state.protocolos_cmj)
  const pruebas = useStore(state => state.pruebas_cmj)
  const addPruebaCMJ = useStore(state => state.addPruebaCMJ)
  const updatePruebaCMJ = useStore(state => state.updatePruebaCMJ)

  const [idJugadora, setIdJugadora] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [idProtocolo, setIdProtocolo] = useState('')
  const [finalidad, setFinalidad] = useState<MedicionCMJ['finalidad'] | ''>('')
  const [observacion, setObservacion] = useState('')
  const [intentos, setIntentos] = useState<IntentoCMJ[]>([])
  const [error, setError] = useState<string | null>(null)
  
  const [posibleDuplicado, setPosibleDuplicado] = useState<MedicionCMJ | null>(null)
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)

  // Determinar la lista de protocolos disponibles memoizada
  const protocolosOpciones = useMemo(() => protocolos.filter(p => p.activo), [protocolos])

  useEffect(() => {
    if (open) {
      if (editingId) {
        const existente = pruebas.find(p => p.id_medicion === editingId)
        if (existente) {
          setIdJugadora(existente.id_jugadora)
          setFecha(existente.fecha)
          setIdProtocolo(existente.id_protocolo)
          setFinalidad(existente.finalidad || '')
          setObservacion(existente.observacion_staff || '')
          // Clones profundos de los intentos
          setIntentos(JSON.parse(JSON.stringify(existente.intentos)))
        }
      } else {
        // Valores por defecto para nueva medición
        setIdJugadora('')
        setFecha(new Date().toISOString().split('T')[0])
        setIdProtocolo(protocolosOpciones.length === 1 ? protocolosOpciones[0].id_protocolo : '')
        setFinalidad('')
        setObservacion('')
        setIntentos([{
          id_intento: 'int-' + Date.now(),
          orden: 1,
          valido: true
        }])
      }
      setError(null)
      setShowDuplicateWarning(false)
    }
  }, [open, editingId, pruebas, protocolosOpciones])

  // Computed state for UI display
  const medicionParcial: MedicionCMJ = {
    id_medicion: '',
    id_jugadora: idJugadora,
    fecha,
    tipo_prueba: 'cmj_bilateral',
    id_protocolo: idProtocolo,
    protocolo_nombre_historico: '',
    intentos,
    fuente: 'manual',
    createdAt: '',
    updatedAt: ''
  }
  const medicionProcesada = procesarMedicionCMJ(medicionParcial)
  const mejorId = medicionProcesada.mejor_intento_valido_id

  const handleAddIntento = () => {
    const nextOrden = intentos.length > 0 ? Math.max(...intentos.map(i => i.orden)) + 1 : 1
    setIntentos([...intentos, {
      id_intento: 'int-' + Date.now(),
      orden: nextOrden,
      valido: true
    }])
  }

  const handleRemoveIntento = (id: string) => {
    const exists = intentos.find(i => i.id_intento === id)
    if (exists && (exists.altura_cm != null || exists.tiempo_vuelo_ms != null)) {
      if (!confirm('¿Seguro que quieres eliminar este intento con datos registrados?')) return
    }
    setIntentos(intentos.filter(i => i.id_intento !== id))
  }

  const updateIntento = (id: string, field: keyof IntentoCMJ, value: any) => {
    setIntentos(intentos.map(i => {
      if (i.id_intento !== id) return i
      const updated = { ...i, [field]: value }
      if (!updated.valido && field === 'valido') {
        updated.motivo_no_valido = updated.motivo_no_valido || ''
      }
      return updated
    }))
  }

  const trySave = () => {
    setError(null)

    if (!idJugadora) return setError('Selecciona una jugadora.')
    if (!fecha) return setError('La fecha es obligatoria.')
    if (!idProtocolo) return setError('Selecciona un protocolo.')
    if (intentos.length === 0) return setError('Debe existir al menos un intento.')

    // Validar duplicidad de orden (no debería pasar por UI pero por seguridad)
    const ordenes = new Set(intentos.map(i => i.orden))
    if (ordenes.size !== intentos.length) return setError('Hay intentos con el mismo orden.')

    // Validar intentos válidos sin datos o con datos negativos
    for (const i of intentos) {
      if (i.valido && i.altura_cm == null && i.tiempo_vuelo_ms == null) {
        return setError(`El intento ${i.orden} está marcado como válido pero no tiene altura ni tiempo de vuelo.`)
      }
      if (i.altura_cm != null && i.altura_cm < 0) return setError(`Altura negativa en intento ${i.orden}.`)
      if (i.tiempo_vuelo_ms != null && i.tiempo_vuelo_ms <= 0) return setError(`Tiempo de vuelo inválido en intento ${i.orden}.`)
    }

    // Detección de duplicado exacto (Jugadora + Fecha + Protocolo)
    const existente = pruebas.find(p => 
      p.id_jugadora === idJugadora && 
      p.fecha === fecha && 
      p.id_protocolo === idProtocolo && 
      p.id_medicion !== editingId
    )

    if (existente) {
      setPosibleDuplicado(existente)
      setShowDuplicateWarning(true)
      return
    }

    // Guardar directo
    commitSave()
  }

  const commitSave = async () => {
    try {
      const ahora = new Date().toISOString()
      const protocoloObj = protocolos.find(p => p.id_protocolo === idProtocolo)
      
      // Si estamos editando y el protocolo seleccionado es diferente, o el histórico no existía
      // Pero según reglas: Editar no altera el nombre histórico de la medición si no cambiamos de ID.
      let protocolo_nombre_historico = protocoloObj?.nombre || 'Protocolo Desconocido'
      
      const isEdit = !!editingId
      const targetMedicion: MedicionCMJ = {
        id_medicion: isEdit ? editingId : 'cmj-' + Date.now(),
        id_jugadora: idJugadora,
        fecha,
        tipo_prueba: 'cmj_bilateral',
        id_protocolo: idProtocolo,
        protocolo_nombre_historico, // esto puede ser sobreescrito abajo
        finalidad: finalidad ? (finalidad as any) : undefined,
        intentos,
        fuente: 'manual',
        observacion_staff: observacion || null,
        createdAt: isEdit ? (pruebas.find(p => p.id_medicion === editingId)?.createdAt || ahora) : ahora,
        updatedAt: ahora
      }

      if (isEdit) {
        const existente = pruebas.find(p => p.id_medicion === editingId)
        if (existente && existente.id_protocolo === idProtocolo) {
          // Mantener histórico si no cambió el ID
          targetMedicion.protocolo_nombre_historico = existente.protocolo_nombre_historico
        }
      }

      const final = procesarMedicionCMJ(targetMedicion)

      if (isEdit) {
        await updatePruebaCMJ(final)
      } else {
        await addPruebaCMJ(final)
      }

      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al guardar la medición')
    }
  }

  const handleDuplicateOverride = () => {
    if (!finalidad && !observacion.trim()) {
      setError('Para guardar un duplicado, debes especificar una finalidad o incluir una observación aclaratoria.')
      return
    }
    commitSave()
  }

  // Preparar opciones de jugadoras (mostrar activas + la actual si está inactiva y estamos editando)
  const jugadorasOpciones = jugadoras.filter(j => {
    if (j.activa !== false) return true
    if (editingId && j.id_jugadora === idJugadora) return true
    return false
  })

  // Obtener el nombre histórico si es edición
  const nombreHistoricoEdit = editingId ? pruebas.find(p => p.id_medicion === editingId)?.protocolo_nombre_historico : null

  if (showDuplicateWarning && posibleDuplicado) {
    return (
      <Modal open={open} onClose={() => setShowDuplicateWarning(false)} title="Posible medición duplicada" width="max-w-md">
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 text-amber-800 rounded-md text-sm border border-amber-200">
            <p className="font-medium mb-1">Ya existe una medición para esta jugadora, fecha y protocolo.</p>
            <ul className="list-disc ml-5 space-y-1 mt-2">
              <li><strong>Fecha:</strong> {posibleDuplicado.fecha}</li>
              <li><strong>Protocolo:</strong> {posibleDuplicado.protocolo_nombre_historico}</li>
              <li><strong>Mejor altura:</strong> {posibleDuplicado.altura_mejor_cm != null ? `${posibleDuplicado.altura_mejor_cm} cm` : '—'}</li>
              <li><strong>Intentos registrados:</strong> {posibleDuplicado.intentos.length}</li>
            </ul>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button 
              onClick={() => {
                setShowDuplicateWarning(false)
                setError(null)
              }}
              className="px-4 py-2 text-sm font-medium text-surface-700 bg-surface-100 hover:bg-surface-200 rounded-md"
            >
              Volver y revisar
            </button>
            <button 
              onClick={handleDuplicateOverride}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md"
            >
              Guardar de todos modos
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={editingId ? 'Editar Medición CMJ' : 'Nueva Medición CMJ'} width="max-w-4xl">
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Jugadora *</label>
            <select
              className="w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              value={idJugadora}
              onChange={(e) => setIdJugadora(e.target.value)}
              disabled={!!editingId && jugadoras.find(j => j.id_jugadora === idJugadora)?.activa === false}
            >
              <option value="">Seleccionar jugadora...</option>
              {jugadorasOpciones.map(j => (
                <option key={j.id_jugadora} value={j.id_jugadora}>
                  {j.nombre} {j.activa !== false ? '' : '(Inactiva)'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Fecha *</label>
            <input
              type="date"
              className="w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Finalidad</label>
            <select
              className="w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              value={finalidad}
              onChange={(e) => setFinalidad(e.target.value as any)}
            >
              <option value="">(Ninguna)</option>
              {FINALIDADES.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Protocolo *</label>
            <select
              className="w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              value={idProtocolo}
              onChange={(e) => {
                if (editingId && idProtocolo && e.target.value !== idProtocolo) {
                  if (!confirm('Alerta: Cambiar el protocolo de una medición histórica puede afectar la comparabilidad. ¿Continuar?')) {
                    return
                  }
                }
                setIdProtocolo(e.target.value)
              }}
            >
              <option value="">Seleccionar protocolo...</option>
              {protocolosOpciones.map(p => (
                <option key={p.id_protocolo} value={p.id_protocolo}>{p.nombre}</option>
              ))}
              {editingId && !protocolosOpciones.some(p => p.id_protocolo === idProtocolo) && idProtocolo && (
                <option value={idProtocolo}>{nombreHistoricoEdit || 'Protocolo Inactivo'}</option>
              )}
            </select>
            {editingId && (
              <p className="text-xs text-surface-500 mt-1">Histórico guardado: {nombreHistoricoEdit}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Observaciones</label>
            <input
              type="text"
              className="w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Detalles relevantes..."
            />
          </div>
        </div>

        <div className="border-t border-surface-200 pt-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium text-surface-900">Intentos Registrados</h4>
            <button
              type="button"
              onClick={handleAddIntento}
              className="px-3 py-1 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-md border border-primary-200"
            >
              + Añadir intento
            </button>
          </div>

          {intentos.length === 0 ? (
            <div className="text-center py-6 bg-surface-50 rounded-lg border border-dashed border-surface-300 text-surface-500">
              No hay intentos añadidos. Se requiere al menos uno.
            </div>
          ) : (
            <div className="space-y-3">
              {intentos.sort((a,b) => a.orden - b.orden).map((intento) => {
                const esMejor = intento.id_intento === mejorId
                return (
                  <div key={intento.id_intento} className={`flex items-start gap-4 p-3 rounded-lg border ${esMejor ? 'border-primary-400 bg-primary-50 shadow-sm' : 'border-surface-200 bg-white'}`}>
                    <div className="w-16 flex-shrink-0 pt-1">
                      <label className="block text-xs font-medium text-surface-500 mb-1">Orden</label>
                      <input 
                        type="number" 
                        min="1"
                        className="w-full rounded text-sm border-surface-300 px-2 py-1"
                        value={intento.orden}
                        onChange={e => updateIntento(intento.id_intento, 'orden', parseInt(e.target.value))}
                      />
                    </div>
                    
                    <div className="w-24 pt-1">
                      <label className="block text-xs font-medium text-surface-500 mb-1">Altura (cm)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        className="w-full rounded text-sm border-surface-300 px-2 py-1"
                        value={intento.altura_cm ?? ''}
                        onChange={e => updateIntento(intento.id_intento, 'altura_cm', e.target.value ? parseFloat(e.target.value) : null)}
                        disabled={!intento.valido}
                      />
                    </div>
                    
                    <div className="w-28 pt-1">
                      <label className="block text-xs font-medium text-surface-500 mb-1">Vuelo (ms)</label>
                      <input 
                        type="number" 
                        min="0"
                        className="w-full rounded text-sm border-surface-300 px-2 py-1"
                        value={intento.tiempo_vuelo_ms ?? ''}
                        onChange={e => updateIntento(intento.id_intento, 'tiempo_vuelo_ms', e.target.value ? parseInt(e.target.value, 10) : null)}
                        disabled={!intento.valido}
                      />
                    </div>

                    <div className="flex-1 pt-1">
                      <label className="block text-xs font-medium text-surface-500 mb-1">Estado</label>
                      <div className="flex items-center gap-2 mb-1 h-[30px]">
                        <input 
                          type="checkbox"
                          className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                          checked={intento.valido}
                          onChange={e => updateIntento(intento.id_intento, 'valido', e.target.checked)}
                          id={`valido-${intento.id_intento}`}
                        />
                        <label htmlFor={`valido-${intento.id_intento}`} className={`text-sm ${intento.valido ? 'text-surface-900' : 'text-red-600'}`}>
                          {intento.valido ? 'Válido' : 'Inválido'}
                        </label>
                        {esMejor && (
                          <span className="ml-auto text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded font-medium">Mejor Válido</span>
                        )}
                      </div>
                      {!intento.valido && (
                        <input 
                          type="text"
                          placeholder="Motivo de anulación..."
                          className="w-full rounded text-xs border-surface-300 px-2 py-1 mt-1 bg-red-50 text-red-800 placeholder-red-300"
                          value={intento.motivo_no_valido || ''}
                          onChange={e => updateIntento(intento.id_intento, 'motivo_no_valido', e.target.value)}
                        />
                      )}
                    </div>

                    <div className="pt-6">
                      <button 
                        type="button"
                        onClick={() => handleRemoveIntento(intento.id_intento)}
                        className="text-surface-400 hover:text-red-600 p-1"
                        title="Eliminar intento"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-3 pt-4 border-t border-surface-200 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100 border border-surface-300 rounded-md"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={trySave}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
          >
            Guardar Medición
          </button>
        </div>
      </div>
    </Modal>
  )
}
