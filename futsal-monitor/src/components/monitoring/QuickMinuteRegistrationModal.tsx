import { useMemo, useState, useEffect } from 'react'
import { Modal } from '@/components/shared/Modal'
import { useStore } from '@/store/store'
import { useRpeBatchForm } from '@/hooks/useRpeBatchForm'
import { getTodayLocalISO } from '@/domain/dates/dates'

interface QuickMinuteRegistrationModalProps {
  open: boolean
  onClose: () => void
  initialMatchId: string
}

export function QuickMinuteRegistrationModal({
  open,
  onClose,
  initialMatchId
}: QuickMinuteRegistrationModalProps) {
  const { partidos, jugadoras, rpe_partido, saveRpePartidoBatch } = useStore()
  
  const [selectedMatchId, setSelectedMatchId] = useState(initialMatchId)
  
  useEffect(() => {
    if (open) {
      setSelectedMatchId(initialMatchId)
    }
  }, [open, initialMatchId])

  const { batchForm, initializeForm, handleUpdatePlayerForm, buildBatchToSave } = useRpeBatchForm()
  
  const activePlayers = useMemo(() => jugadoras.filter(j => j.activa !== false), [jugadoras])
  const pastMatches = useMemo(() => {
    const today = getTodayLocalISO()
    return partidos.filter(p => p.fecha <= today).sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [partidos])

  useEffect(() => {
    if (open && selectedMatchId) {
      const existingRpes = rpe_partido.filter(r => r.id_partido === selectedMatchId)
      initializeForm(activePlayers, existingRpes)
    }
  }, [open, selectedMatchId, rpe_partido, activePlayers, initializeForm])

  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleSaveQuick = async () => {
    setErrorMsg('')
    setSuccessMsg('')
    setIsSaving(true)
    
    const match = partidos.find(p => p.id_partido === selectedMatchId)
    const fecha = match?.fecha || ''
    
    const toSave = buildBatchToSave(selectedMatchId, fecha)
    
    try {
      if (toSave.length > 0) {
        await saveRpePartidoBatch(toSave)
        setSuccessMsg('Minutos actualizados correctamente')
        setTimeout(() => {
          onClose()
          setSuccessMsg('')
        }, 1500)
      } else {
        onClose()
      }
    } catch (e: any) {
      setErrorMsg(e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const jugadorasConMinutos = Object.values(batchForm).filter(d => typeof d.minutos_jugados === 'number' && d.minutos_jugados > 0).length
  const jugadorasConRpePendiente = Object.values(batchForm).filter(d => typeof d.minutos_jugados === 'number' && d.minutos_jugados > 0 && d.rpe === '').length
  const jugadorasSinDefinir = Object.values(batchForm).filter(d => !d.participacion).length

  return (
    <Modal open={open} onClose={onClose} title="Registro rápido de minutos" width="max-w-5xl">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-xs mb-4 whitespace-pre-wrap">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded text-xs mb-4">
          {successMsg}
        </div>
      )}
      
      <div className="mb-4">
        <label className="block text-xs font-medium text-surface-600 mb-1">Partido</label>
        <select 
          className="w-full border border-surface-300 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary-500"
          value={selectedMatchId}
          onChange={(e) => setSelectedMatchId(e.target.value)}
        >
          <option value="" disabled>Selecciona un partido...</option>
          {pastMatches.map(p => (
            <option key={p.id_partido} value={p.id_partido}>
              {p.fecha} - {p.rival} ({p.competicion})
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto max-h-[50vh]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-surface-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-3 py-2 font-medium text-surface-600 border-b border-surface-200 w-48">Jugadora</th>
              <th className="px-3 py-2 font-medium text-surface-600 border-b border-surface-200 w-40">Participación</th>
              <th className="px-3 py-2 font-medium text-surface-600 border-b border-surface-200 w-24">Minutos</th>
              <th className="px-3 py-2 font-medium text-surface-600 border-b border-surface-200 w-20">RPE (opc)</th>
              <th className="px-3 py-2 font-medium text-surface-600 border-b border-surface-200 w-24">sRPE (UA)</th>
              <th className="px-3 py-2 font-medium text-surface-600 border-b border-surface-200">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {activePlayers.map(j => {
              const data = batchForm[j.id_jugadora]
              if (!data) return null
              
              const isZero = data.participacion === 'no_convocada' || data.participacion === 'convocada_sin_minutos'
              const rpeVal = Number(data.rpe) || 0
              const minVal = Number(data.minutos_jugados) || 0
              const sRPE = (isZero || !data.minutos_jugados || !data.rpe) ? 0 : rpeVal * minVal
              const isModificada = data.participacion === 'modificada'
              
              let status = ''
              if (!data.participacion) status = 'Pendiente'
              else if (data.minutos_jugados !== '' && data.minutos_jugados !== 0 && data.rpe === '') status = 'RPE pendiente'
              else if (isZero) status = '0 UA'
              else if (sRPE > 0) status = 'Completo'
              else status = 'Pendiente'
              
              return (
                <tr key={j.id_jugadora} className="hover:bg-surface-50 transition-colors">
                  <td className="px-3 py-2 font-medium">{j.nombre}</td>
                  <td className="px-3 py-2">
                    <select 
                      className="w-full border border-surface-200 rounded px-2 py-1 text-xs"
                      value={data.participacion} 
                      onChange={(e) => handleUpdatePlayerForm(j.id_jugadora, 'participacion', e.target.value)}
                    >
                      <option value="">(Sin definir)</option>
                      <option value="completa">Completa (40')</option>
                      <option value="parcial">Parcial (1-39')</option>
                      <option value="modificada">Modificada</option>
                      <option value="convocada_sin_minutos">Convocada sin jugar (0')</option>
                      <option value="no_convocada">No convocada (0')</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input 
                      type="number" 
                      min={0} max={isModificada ? 39 : 40} 
                      className="w-full border border-surface-200 rounded px-2 py-1 text-xs disabled:bg-surface-100 disabled:opacity-50"
                      value={data.minutos_jugados} 
                      disabled={isZero || data.participacion === 'completa' || !data.participacion}
                      placeholder={isZero ? '0' : ''}
                      onChange={(e) => handleUpdatePlayerForm(j.id_jugadora, 'minutos_jugados', e.target.value === '' ? '' : Number(e.target.value))} 
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input 
                      type="number" min={1} max={10} step={1}
                      className="w-full border border-surface-200 rounded px-2 py-1 text-xs disabled:bg-surface-100 disabled:opacity-50"
                      value={data.rpe} 
                      disabled={isZero || (isModificada && data.minutos_jugados === 0) || !data.participacion}
                      onChange={(e) => handleUpdatePlayerForm(j.id_jugadora, 'rpe', e.target.value === '' ? '' : Number(e.target.value))} 
                    />
                  </td>
                  <td className="px-3 py-2 font-mono font-medium">
                    {isZero ? '0' : (sRPE > 0 ? sRPE : '—')}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className={status === 'RPE pendiente' ? 'text-amber-600 font-medium' : status === 'Pendiente' ? 'text-surface-400' : 'text-green-600'}>
                      {status}
                    </span>
                    {isModificada && (
                      <input 
                        type="text" 
                        className="w-full mt-1 border border-red-200 bg-red-50 rounded px-2 py-1 text-[10px] placeholder:text-red-400"
                        placeholder="Motivo modificada *"
                        value={data.motivo_participacion_reducida}
                        onChange={(e) => handleUpdatePlayerForm(j.id_jugadora, 'motivo_participacion_reducida', e.target.value)}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      <div className="flex flex-wrap justify-between items-center mt-4 pt-4 border-t border-surface-200 gap-4">
        <div className="flex gap-4 text-xs font-medium text-surface-600">
          <span>{jugadorasConMinutos} jugadoras con minutos registrados</span>
          {jugadorasConRpePendiente > 0 && <span className="text-amber-600">{jugadorasConRpePendiente} jugadoras con RPE pendiente</span>}
          <span>{jugadorasSinDefinir} jugadoras sin definir</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onClose} 
            className="text-xs font-medium text-surface-600 px-4 py-2 border border-surface-200 rounded hover:bg-surface-50"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button 
            onClick={handleSaveQuick} 
            disabled={isSaving} 
            className="text-xs font-medium text-white bg-primary-600 px-4 py-2 rounded hover:bg-primary-700 disabled:opacity-50 shadow-sm"
          >
            {isSaving ? 'Guardando...' : 'Guardar minutos'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
