import { useState, useMemo } from 'react'
import { useStore } from '@/store/store'
import { DataTable, DataRow, DataCell } from '@/components/shared/DataTable'
import { Filters } from '@/components/shared/Filters'
import { Modal } from '@/components/shared/Modal'
import { DatePicker } from '@/components/shared/DatePicker'
import type { Partido, ParticipacionPartido, RPE_Partido } from '@/types'

export function MatchesPage() {
  const { partidos, rpe_partido, jugadoras, filters, addPartido, updatePartido, saveRpePartidoBatch } = useStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Partido | null>(null)
  const [form, setForm] = useState<Partido>({
    id_partido: '', fecha: '', rival: '', competicion: '', resultado: '', lugar: 'Local',
  })

  const [rpeModalOpen, setRpeModalOpen] = useState(false)
  const [rpePartidoId, setRpePartidoId] = useState<string>('')
  
  // State for the batch form: map of jugadoraId -> formData
  type PlayerForm = {
    participacion: ParticipacionPartido | ''
    minutos_jugados: number | ''
    rpe: number | ''
    motivo_participacion_reducida: string
    comentario_staff: string
  }
  const [batchForm, setBatchForm] = useState<Record<string, PlayerForm>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const activePlayers = useMemo(() => jugadoras.filter(j => j.activa !== false), [jugadoras])

  const filtered = partidos.filter((p) => {
    if (filters.fecha_desde && p.fecha < filters.fecha_desde) return false
    if (filters.fecha_hasta && p.fecha > filters.fecha_hasta) return false
    return true
  })

  const openRpeModal = (partidoId: string) => {
    setRpePartidoId(partidoId)
    const existingRpes = rpe_partido.filter(r => r.id_partido === partidoId)
    
    const initialForm: Record<string, PlayerForm> = {}
    activePlayers.forEach(j => {
      const existing = existingRpes.find(r => r.id_jugadora === j.id_jugadora)
      if (existing) {
        initialForm[j.id_jugadora] = {
          participacion: existing.participacion || '',
          minutos_jugados: existing.minutos_jugados ?? '',
          rpe: existing.rpe ?? '',
          motivo_participacion_reducida: existing.motivo_participacion_reducida || '',
          comentario_staff: existing.comentario_staff || ''
        }
      } else {
        initialForm[j.id_jugadora] = {
          participacion: '',
          minutos_jugados: '',
          rpe: '',
          motivo_participacion_reducida: '',
          comentario_staff: ''
        }
      }
    })
    setBatchForm(initialForm)
    setErrorMsg('')
    setRpeModalOpen(true)
  }

  const handleUpdatePlayerForm = (id: string, key: keyof PlayerForm, value: any) => {
    setBatchForm(prev => {
      const current = prev[id]
      const updated = { ...current, [key]: value }

      if (key === 'participacion') {
        if (value === 'completa') {
          updated.minutos_jugados = 40
        } else if (value === 'no_convocada' || value === 'convocada_sin_minutos') {
          updated.minutos_jugados = 0
          updated.rpe = ''
        }
      } else if (key === 'minutos_jugados') {
        if (updated.participacion === 'modificada' && value === 0) {
          updated.rpe = ''
        }
      }
      
      return { ...prev, [id]: updated }
    })
  }

  const handleSaveBatch = async () => {
    setErrorMsg('')
    setIsSaving(true)
    
    const match = partidos.find(p => p.id_partido === rpePartidoId)
    const fecha = match?.fecha || ''
    
    const toSave: RPE_Partido[] = []
    
    for (const [id_jugadora, data] of Object.entries(batchForm)) {
      // Only process rows that have some data entered
      if (data.participacion || data.minutos_jugados !== '' || data.rpe !== '') {
        const isZero = data.participacion === 'no_convocada' || data.participacion === 'convocada_sin_minutos'
        const min = isZero ? 0 : (data.minutos_jugados === '' ? null : Number(data.minutos_jugados))
        const rpeVal = isZero ? null : (data.rpe === '' ? null : Number(data.rpe))
        const carga = (rpeVal !== null && min !== null) ? rpeVal * min : null
        
        toSave.push({
          id_partido: rpePartidoId,
          id_jugadora,
          fecha,
          participacion: (data.participacion as ParticipacionPartido) || undefined,
          minutos_jugados: min,
          rpe: rpeVal,
          carga_ua: carga,
          motivo_participacion_reducida: data.motivo_participacion_reducida || undefined,
          comentario_staff: data.comentario_staff || undefined
        })
      }
    }
    
    try {
      if (toSave.length > 0) {
        await saveRpePartidoBatch(toSave)
      }
      setRpeModalOpen(false)
    } catch (e: any) {
      setErrorMsg(e.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-surface-800">Partidos</h1>
        <div className="flex gap-2">
          <button onClick={() => { setEditing(null); setForm({
            id_partido: '', fecha: '', rival: '', competicion: '', resultado: '', lugar: 'Local',
          }); setModalOpen(true) }}
            className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700"
          >
            + Nuevo partido
          </button>
        </div>
      </div>

      <Filters showDate />

      <DataTable
        headers={['ID', 'Fecha', 'Rival', 'Competición', 'Resultado', 'Lugar', 'RPE', 'Acciones']}
        emptyMessage="No hay partidos registrados"
      >
        {filtered.map((p) => {
          const rpes = rpe_partido.filter((r) => r.id_partido === p.id_partido)
          const cargaTotal = rpes.reduce((s, r) => s + (r.carga_ua || 0), 0)
          return (
            <DataRow key={p.id_partido}>
              <DataCell className="font-mono text-[10px] text-surface-500">{p.id_partido}</DataCell>
              <DataCell>{p.fecha}</DataCell>
              <DataCell className="font-medium">{p.rival}</DataCell>
              <DataCell>{p.competicion}</DataCell>
              <DataCell>{p.resultado || '—'}</DataCell>
              <DataCell>{p.lugar}</DataCell>
              <DataCell>
                <button onClick={() => openRpeModal(p.id_partido)}
                  className="text-primary-600 hover:underline">
                  {rpes.length > 0 ? `${Math.round(cargaTotal)} UA (${rpes.length})` : 'Añadir RPE'}
                </button>
              </DataCell>
              <DataCell>
                <button onClick={() => { setEditing(p); setForm(p); setModalOpen(true) }}
                  className="text-[10px] text-primary-600 hover:underline">Editar</button>
              </DataCell>
            </DataRow>
          )
        })}
      </DataTable>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar partido' : 'Nuevo partido'}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">ID Partido *</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.id_partido} onChange={(e) => setForm({ ...form, id_partido: e.target.value })}
              disabled={!!editing} />
          </div>
          <DatePicker
            label="Fecha"
            value={form.fecha}
            onChange={(fecha) => setForm({ ...form, fecha })}
          />
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Rival</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.rival} onChange={(e) => setForm({ ...form, rival: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Competición</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.competicion} onChange={(e) => setForm({ ...form, competicion: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Resultado</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.resultado} onChange={(e) => setForm({ ...form, resultado: e.target.value })}
              placeholder="Ej: 3-2" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Lugar</label>
            <select className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value as Partido['lugar'] })}>
              <option value="Local">Local</option>
              <option value="Visitante">Visitante</option>
              <option value="Neutral">Neutral</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setModalOpen(false)} className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded">Cancelar</button>
          <button onClick={async () => {
            if (editing) await updatePartido(form); else await addPartido(form)
            setModalOpen(false)
          }} className="text-xs text-white bg-primary-600 px-3 py-1.5 rounded hover:bg-primary-700">
            {editing ? 'Guardar' : 'Crear partido'}
          </button>
        </div>
      </Modal>

      <Modal open={rpeModalOpen} onClose={() => setRpeModalOpen(false)} title="Carga Competitiva (RPE de partido)" width="max-w-6xl">
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-xs mb-4 whitespace-pre-wrap">
            {errorMsg}
          </div>
        )}
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-3 py-2 font-medium text-surface-600 border-b border-surface-200 w-48">Jugadora</th>
                <th className="px-3 py-2 font-medium text-surface-600 border-b border-surface-200 w-40">Participación</th>
                <th className="px-3 py-2 font-medium text-surface-600 border-b border-surface-200 w-24">Minutos</th>
                <th className="px-3 py-2 font-medium text-surface-600 border-b border-surface-200 w-20">RPE (1-10)</th>
                <th className="px-3 py-2 font-medium text-surface-600 border-b border-surface-200 w-24">sRPE (UA)</th>
                <th className="px-3 py-2 font-medium text-surface-600 border-b border-surface-200 min-w-[200px]">Nota / Motivo</th>
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
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        {isModificada && (
                          <input 
                            type="text" 
                            className="w-full border border-red-200 bg-red-50 rounded px-2 py-1 text-xs placeholder:text-red-400"
                            placeholder="Motivo modificada *"
                            value={data.motivo_participacion_reducida}
                            onChange={(e) => handleUpdatePlayerForm(j.id_jugadora, 'motivo_participacion_reducida', e.target.value)}
                          />
                        )}
                        <input 
                          type="text" 
                          className="w-full border border-surface-200 rounded px-2 py-1 text-xs"
                          placeholder="Nota (opcional)"
                          value={data.comentario_staff}
                          onChange={(e) => handleUpdatePlayerForm(j.id_jugadora, 'comentario_staff', e.target.value)}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-surface-200">
          <button 
            onClick={() => setRpeModalOpen(false)} 
            className="text-xs font-medium text-surface-600 px-4 py-2 border border-surface-200 rounded hover:bg-surface-50"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button 
            onClick={handleSaveBatch} 
            disabled={isSaving} 
            className="text-xs font-medium text-white bg-primary-600 px-4 py-2 rounded hover:bg-primary-700 disabled:opacity-50 shadow-sm"
          >
            {isSaving ? 'Guardando...' : 'Guardar todo'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
