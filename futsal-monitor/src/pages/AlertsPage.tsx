import { useState } from 'react'
import { useStore } from '@/store/store'
import { DataTable, DataRow, DataCell } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmationModal } from '@/components/shared/ConfirmationModal'
import { registrarCambioAuditoria } from '@/services/auditService'
import { generarAlertas, getEstadoEfectivo } from '@/utils/alerts'
import { useNavigate } from 'react-router-dom'
import type { Alerta } from '@/types'

export function AlertsPage() {
  const {
    alertas,
    jugadoras,
    updateAlertaEstado,
    registrarAlertaDecision,
    archivarAlertasResueltas
  } = useStore()
  const navigate = useNavigate()
  
  const [generating, setGenerating] = useState(false)
  
  // Filters state
  const [filterEstado, setFilterEstado] = useState<string>('todas')
  const [filterTipo, setFilterTipo] = useState<string>('todas')
  const [filterJugadora, setFilterJugadora] = useState<string>('todas')
  const [filterPrioridad, setFilterPrioridad] = useState<string>('todas')
  const [filterFecha, setFilterFecha] = useState<string>('')

  // Decision Modal state
  const [decisionModalOpen, setDecisionModalOpen] = useState(false)
  const [selectedAlerta, setSelectedAlerta] = useState<Alerta | null>(null)
  const [responsable, setResponsable] = useState('')
  const [notaDecision, setNotaDecision] = useState('')

  // Archive confirmation dialog state
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)

  // Critical action confirmation modal state
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<{
    id: number
    nuevoEstado: 'resuelta' | 'descartada'
    estadoAnterior: string
    idJugadora?: string
  } | null>(null)

  const handleTriggerStateChange = (alerta: Alerta, nuevoEstado: 'resuelta' | 'descartada') => {
    if (alerta.id !== undefined) {
      const estadoAnterior = alerta.estado || (alerta.leida ? 'resuelta' : 'abierta')
      setPendingAction({
        id: alerta.id,
        nuevoEstado,
        estadoAnterior,
        idJugadora: alerta.id_jugadora
      })
      setConfirmModalOpen(true)
    }
  }

  const handleConfirmStateChange = async (motivo: string) => {
    if (pendingAction) {
      await updateAlertaEstado(pendingAction.id, pendingAction.nuevoEstado)
      registrarCambioAuditoria({
        usuario: 'Preparador Físico',
        entidad: 'alerta',
        idEntidad: String(pendingAction.id),
        idJugadora: pendingAction.idJugadora,
        campoModificado: 'estado',
        valorAnterior: pendingAction.estadoAnterior,
        valorNuevo: pendingAction.nuevoEstado,
        motivo
      })
      setConfirmModalOpen(false)
      setPendingAction(null)
    }
  }

  const handleDirectDismiss = async (alerta: Alerta) => {
    if (alerta.id !== undefined) {
      try {
        const estadoAnterior = getEstadoEfectivo(alerta)
        await updateAlertaEstado(alerta.id, 'descartada')
        registrarCambioAuditoria({
          usuario: 'Preparador Físico',
          entidad: 'alerta',
          idEntidad: String(alerta.id),
          idJugadora: alerta.id_jugadora,
          campoModificado: 'estado',
          valorAnterior: estadoAnterior,
          valorNuevo: 'descartada',
          motivo: 'ALERTA_DESCARTADA_MANUALMENTE'
        })
      } catch (error) {
        console.error('Error descartando alerta:', error)
        alert('Hubo un error al descartar la alerta. Inténtalo de nuevo.')
      }
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await generarAlertas()
      await useStore.getState().loadAll()
    } finally {
      setGenerating(false)
    }
  }

  const handleOpenDecisionModal = (alerta: Alerta) => {
    setSelectedAlerta(alerta)
    setResponsable(alerta.responsable || '')
    setNotaDecision(alerta.nota_decision || '')
    setDecisionModalOpen(true)
  }

  const handleSaveDecision = async () => {
    if (selectedAlerta && selectedAlerta.id !== undefined) {
      await registrarAlertaDecision(selectedAlerta.id, responsable, notaDecision)
      // Automatically transition to "en_revision" if it was "abierta"
      const currentEstado = getEstadoEfectivo(selectedAlerta)
      if (currentEstado === 'abierta') {
        await updateAlertaEstado(selectedAlerta.id, 'en_revision')
      }
      setDecisionModalOpen(false)
      setSelectedAlerta(null)
    }
  }

  const handleConfirmArchive = async () => {
    await archivarAlertasResueltas()
    setArchiveConfirmOpen(false)
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'en_revision':
        return 'text-amber-700 bg-amber-50 border-amber-200'
      case 'resuelta':
        return 'text-green-700 bg-green-50 border-green-200'
      case 'descartada':
        return 'text-surface-600 bg-surface-50 border-surface-200'
      case 'abierta':
      default:
        return 'text-red-700 bg-red-50 border-red-200'
    }
  }

  const getPrioridadBadge = (prio: string) => {
    switch (prio) {
      case 'alto':
        return 'text-red-700 bg-red-50 border-red-200 font-semibold'
      case 'medio':
        return 'text-amber-700 bg-amber-50 border-amber-200'
      case 'bajo':
      default:
        return 'text-blue-700 bg-blue-50 border-blue-200'
    }
  }

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'en_revision': return 'En Revisión'
      case 'resuelta': return 'Resuelta'
      case 'descartada': return 'Descartada'
      case 'abierta':
      default: return 'Abierta'
    }
  }

  // Filter logic
  const filteredAlertas = alertas.filter((a) => {
    const aEstado = getEstadoEfectivo(a)
    const aPrioridad = a.prioridad || a.nivel || 'bajo'

    if (filterEstado !== 'todas' && aEstado !== filterEstado) return false
    if (filterTipo !== 'todas' && a.tipo !== filterTipo) return false
    if (filterJugadora !== 'todas' && a.id_jugadora !== filterJugadora) return false
    if (filterPrioridad !== 'todas' && aPrioridad !== filterPrioridad) return false
    
    if (filterFecha) {
      const aFecha = a.fecha_creacion?.slice(0, 10) || a.fecha
      if (aFecha !== filterFecha) return false
    }
    return true
  })

  // Separate into 3 categories
  const loadAlerts = filteredAlertas.filter(a => a.tipo === 'wellness_bajo' || a.tipo === 'carga_alta')
  const injuryAlerts = filteredAlertas.filter(a => a.tipo === 'lesion' || a.tipo === 'readaptacion')
  const dataAlerts = filteredAlertas.filter(a => a.tipo === 'datos_faltantes')

  const renderAlertTable = (tableAlertas: Alerta[], emptyMsg: string) => (
    <DataTable
      headers={['Jugadora', 'Mensaje y Sustento', 'Sugerencia', 'Prioridad', 'Estado', 'Decisión / Responsable', 'Acciones']}
      emptyMessage={emptyMsg}
    >
      {tableAlertas.map((a) => {
        const jug = jugadoras.find((j) => j.id_jugadora === a.id_jugadora)
        const aEstado = getEstadoEfectivo(a)
        const aPrioridad = a.prioridad || a.nivel || 'bajo'
        const aFecha = a.fecha_creacion?.slice(0, 10) || a.fecha

        return (
          <DataRow key={a.id}>
            <DataCell className="align-top">
              <div className="space-y-0.5">
                <button
                  onClick={() => navigate(`/jugadoras/${a.id_jugadora}`)}
                  className="text-primary-600 hover:underline font-semibold block text-left"
                >
                  {jug?.nombre || a.id_jugadora}
                </button>
                <span className="text-[10px] text-surface-400 block">{aFecha}</span>
              </div>
            </DataCell>
            
            <DataCell className="max-w-xs align-top">
              <div className="space-y-1">
                <div className="font-medium text-surface-700 text-xs">{a.mensaje}</div>
                {a.datos_sustento && (
                  <div className="text-[10px] text-surface-500 bg-surface-50 px-1.5 py-0.5 rounded border border-surface-100 font-mono">
                    <span className="font-semibold text-surface-600 block text-[9px] uppercase">Datos de sustento</span>
                    {a.datos_sustento}
                  </div>
                )}
                {a.origen && (
                  <div className="text-[9px] text-surface-400">
                    Regla: {a.origen}
                  </div>
                )}
              </div>
            </DataCell>

            <DataCell className="align-top max-w-[130px]">
              <span className="text-[10px] font-medium text-surface-600 bg-surface-50 border border-surface-200 px-1.5 py-0.5 rounded block">
                💡 {a.sugerencia || 'Revisar ficha'}
              </span>
            </DataCell>

            <DataCell className="align-top">
              <span className={`inline-block border rounded px-1.5 py-0.5 text-[10px] capitalize ${getPrioridadBadge(aPrioridad)}`}>
                {aPrioridad}
              </span>
            </DataCell>

            <DataCell className="align-top">
              <span className={`inline-block border rounded px-1.5 py-0.5 text-[10px] font-semibold ${getEstadoBadge(aEstado)}`}>
                {getEstadoLabel(aEstado)}
              </span>
            </DataCell>

            <DataCell className="max-w-[150px] align-top">
              {a.nota_decision || a.responsable ? (
                <div className="text-[10px] space-y-1 bg-primary-25 p-1.5 rounded border border-primary-100">
                  {a.nota_decision && <p className="text-surface-700 italic">"{a.nota_decision}"</p>}
                  {a.responsable && <p className="text-surface-500 text-[9px] font-medium">Resp: {a.responsable}</p>}
                </div>
              ) : aEstado === 'descartada' ? (
                <div className="text-[10px] space-y-1 bg-surface-50 p-1.5 rounded border border-surface-200">
                  <p className="text-surface-700 font-medium">Descartada manualmente</p>
                  {a.fecha_resolucion && <p className="text-surface-500 text-[9px]">{a.fecha_resolucion}</p>}
                </div>
              ) : (
                <span className="text-surface-400 italic text-[10px]">Sin revisar</span>
              )}
            </DataCell>

            <DataCell className="align-top">
              <div className="flex flex-wrap gap-1">
                {aEstado === 'abierta' && (
                  <button
                    onClick={() => a.id !== undefined && updateAlertaEstado(a.id, 'en_revision')}
                    className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 px-1 py-0.5 rounded"
                  >
                    Revisar
                  </button>
                )}
                
                <button
                  onClick={() => handleOpenDecisionModal(a)}
                  className="text-[9px] bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 px-1 py-0.5 rounded"
                >
                  Nota/Resp
                </button>

                {aEstado !== 'resuelta' && (
                  <button
                    onClick={() => handleTriggerStateChange(a, 'resuelta')}
                    className="text-[9px] bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 px-1 py-0.5 rounded"
                  >
                    Resolver
                  </button>
                )}

                {aEstado !== 'descartada' && (
                  <button
                    onClick={() => handleDirectDismiss(a)}
                    className="text-[9px] bg-surface-50 text-surface-700 border border-surface-200 hover:bg-surface-100 px-1 py-0.5 rounded"
                  >
                    Descartar
                  </button>
                )}

                {(aEstado === 'resuelta' || aEstado === 'descartada') && (
                  <button
                    onClick={() => a.id !== undefined && updateAlertaEstado(a.id, 'abierta')}
                    className="text-[9px] bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 px-1 py-0.5 rounded"
                  >
                    Reabrir
                  </button>
                )}
              </div>
            </DataCell>
          </DataRow>
        )
      })}
    </DataTable>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-surface-800">Panel de Decisiones del Staff</h1>
          <p className="text-[10px] text-surface-500">Historial y estado de revisiones físicas, carga y completitud de datos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700 disabled:opacity-50"
          >
            {generating ? 'Generando...' : 'Escanear Nuevas Incidencias'}
          </button>
          <button
            onClick={() => setArchiveConfirmOpen(true)}
            className="text-xs text-red-600 px-3 py-1.5 border border-red-200 rounded bg-red-25 hover:bg-red-50"
          >
            Archivar Resueltas/Descartadas
          </button>
        </div>
      </div>

      {/* Filters section */}
      <div className="bg-white rounded-lg border border-surface-200 p-3 grid grid-cols-5 gap-3 text-xs">
        <div>
          <label className="text-[10px] font-medium text-surface-500 block mb-1">Estado</label>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="w-full border border-surface-200 rounded px-2 py-1 bg-white text-surface-700"
          >
            <option value="todas">Todos los estados</option>
            <option value="abierta">Abierta</option>
            <option value="en_revision">En Revisión</option>
            <option value="resuelta">Resuelta</option>
            <option value="descartada">Descartada</option>
          </select>
        </div>
        
        <div>
          <label className="text-[10px] font-medium text-surface-500 block mb-1">Tipo</label>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="w-full border border-surface-200 rounded px-2 py-1 bg-white text-surface-700"
          >
            <option value="todas">Todos los tipos</option>
            <option value="wellness_bajo">Wellness Bajo</option>
            <option value="carga_alta">Carga Alta</option>
            <option value="lesion">Lesión</option>
            <option value="readaptacion">Readaptación</option>
            <option value="datos_faltantes">Datos Faltantes</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-medium text-surface-500 block mb-1">Jugadora</label>
          <select
            value={filterJugadora}
            onChange={(e) => setFilterJugadora(e.target.value)}
            className="w-full border border-surface-200 rounded px-2 py-1 bg-white text-surface-700"
          >
            <option value="todas">Todas las jugadoras</option>
            {jugadoras.map(j => (
              <option key={j.id_jugadora} value={j.id_jugadora}>{j.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-medium text-surface-500 block mb-1">Prioridad</label>
          <select
            value={filterPrioridad}
            onChange={(e) => setFilterPrioridad(e.target.value)}
            className="w-full border border-surface-200 rounded px-2 py-1 bg-white text-surface-700"
          >
            <option value="todas">Todas las prioridades</option>
            <option value="bajo">Bajo</option>
            <option value="medio">Medio</option>
            <option value="alto">Alto</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-medium text-surface-500 block mb-1">Fecha</label>
          <input
            type="date"
            value={filterFecha}
            onChange={(e) => setFilterFecha(e.target.value)}
            className="w-full border border-surface-200 rounded px-2 py-1 text-surface-700 bg-white"
          />
        </div>
      </div>

      {/* Group 1: Respuesta a la Carga */}
      <div className="space-y-2">
        <div className="border-b border-surface-200 pb-1">
          <h2 className="text-xs font-bold text-surface-700 uppercase tracking-wide">
            1. Respuesta a la Carga e Indicadores de Cansancio ({loadAlerts.length})
          </h2>
        </div>
        {renderAlertTable(loadAlerts, 'No hay incidencias de wellness o carga acumulada.')}
      </div>

      {/* Group 2: Disponibilidad y Lesiones */}
      <div className="space-y-2">
        <div className="border-b border-surface-200 pb-1">
          <h2 className="text-xs font-bold text-surface-700 uppercase tracking-wide">
            2. Disponibilidad y Lesiones en Readaptación ({injuryAlerts.length})
          </h2>
        </div>
        {renderAlertTable(injuryAlerts, 'No hay incidencias de lesiones o disponibilidad registradas.')}
      </div>

      {/* Group 3: Calidad y Completitud de Datos */}
      <div className="space-y-2">
        <div className="border-b border-surface-200 pb-1">
          <h2 className="text-xs font-bold text-surface-700 uppercase tracking-wide">
            3. Completitud de Datos y Calidad ({dataAlerts.length})
          </h2>
        </div>
        {renderAlertTable(dataAlerts, 'No hay alertas de calidad o completitud de datos.')}
      </div>

      {/* Decision Modal */}
      <Modal open={decisionModalOpen} onClose={() => setDecisionModalOpen(false)} title="Registrar Decisión y Nota de Revisión">
        <div className="space-y-3">
          <p className="text-[10px] text-surface-500">
            Registra una decisión de staff sobre la alerta: <span className="font-semibold text-surface-700">{selectedAlerta?.mensaje}</span>
          </p>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Responsable del Staff *</label>
            <input
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs text-surface-700 bg-white"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              placeholder="Nombre del preparador físico, fisio, etc."
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Nota de decisión / Observación clínica o técnica *</label>
            <textarea
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs text-surface-700 bg-white"
              rows={3}
              value={notaDecision}
              onChange={(e) => setNotaDecision(e.target.value)}
              placeholder="Ej. Se acuerda descanso parcial en pista. Se consulta con fisio."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setDecisionModalOpen(false)}
            className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveDecision}
            disabled={!responsable.trim() || !notaDecision.trim()}
            className="text-xs text-white bg-primary-600 px-3 py-1.5 rounded hover:bg-primary-700 disabled:opacity-50"
          >
            Guardar Decisión
          </button>
        </div>
      </Modal>

      {/* Archive Confirmation Dialog */}
      <Modal open={archiveConfirmOpen} onClose={() => setArchiveConfirmOpen(false)} title="Archivar Alertas Resueltas y Descartadas">
        <div className="space-y-3 text-xs text-surface-600">
          <p>
            ¿Estás seguro de que deseas archivar y eliminar permanentemente todas las alertas marcadas como <span className="font-semibold text-green-600">Resuelta</span> o <span className="font-semibold text-surface-500">Descartada</span>?
          </p>
          <div className="bg-amber-50 text-amber-800 border border-amber-200 p-2.5 rounded text-[10px] font-medium">
            ⚠️ Las alertas <span className="underline">Abierta</span> y <span className="underline">En Revisión</span> **nunca** serán borradas por esta acción.
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setArchiveConfirmOpen(false)}
            className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmArchive}
            className="text-xs text-white bg-red-600 px-3 py-1.5 rounded hover:bg-red-700"
          >
            Archivar permanentemente
          </button>
        </div>
      </Modal>

      {/* Confirmation Modal for Critical Action (Resolver / Descartar Alerta) */}
      {confirmModalOpen && pendingAction && (
        <ConfirmationModal
          open={confirmModalOpen}
          onClose={() => {
            setConfirmModalOpen(false)
            setPendingAction(null)
          }}
          onConfirm={handleConfirmStateChange}
          entidad="alerta"
          valorAnterior={pendingAction.estadoAnterior}
          valorNuevo={pendingAction.nuevoEstado}
          descripcion={`Modificación de estado de alerta a ${pendingAction.nuevoEstado.toUpperCase()}. Requiere motivo justificado.`}
        />
      )}
    </div>
  )
}
