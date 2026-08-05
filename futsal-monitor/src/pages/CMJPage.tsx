import { useState, useMemo } from 'react'
import { useStore } from '@/store/store'
import { CMJFormModal } from '@/components/cmj/CMJFormModal'
import { CMJDetailModal } from '@/components/cmj/CMJDetailModal'
import { CMJProtocolManagerModal } from '@/components/cmj/CMJProtocolManagerModal'
import { ChronojumpImportModal } from '@/components/cmj/ChronojumpImportModal'
import { ChronojumpPrepPanel } from '@/components/cmj/ChronojumpPrepPanel'
import type { PreparacionChronojumpResumen } from '@/domain/alias/chronojumpPrepService'

const FINALIDADES = [
  { value: 'control', label: 'Control / Evaluación' },
  { value: 'pre_sesion', label: 'Pre-sesión' },
  { value: 'post_sesion', label: 'Post-sesión' },
  { value: 'retest', label: 'Retest' },
  { value: 'otro', label: 'Otro' }
]

export function CMJPage() {
  const pruebas = useStore(state => state.pruebas_cmj)
  const jugadoras = useStore(state => state.jugadoras)
  const protocolos = useStore(state => state.protocolos_cmj)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [managerOpen, setManagerOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [prepResumen, setPrepResumen] = useState<PreparacionChronojumpResumen | null>(null)

  const [filters, setFilters] = useState({
    id_jugadora: '',
    fecha_desde: '',
    fecha_hasta: '',
    id_protocolo: '',
    finalidad: ''
  })

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const handleEdit = (id: string) => {
    setEditingId(id)
    setFormOpen(true)
  }

  const handleNew = () => {
    setEditingId(null)
    setFormOpen(true)
  }

  const handleView = (id: string) => {
    setDetailId(id)
  }

  // Pure filtering
  const filtered = useMemo(() => {
    return pruebas.filter(p => {
      if (filters.id_jugadora && p.id_jugadora !== filters.id_jugadora) return false
      if (filters.fecha_desde && p.fecha < filters.fecha_desde) return false
      if (filters.fecha_hasta && p.fecha > filters.fecha_hasta) return false
      if (filters.id_protocolo && p.id_protocolo !== filters.id_protocolo) return false
      if (filters.finalidad && p.finalidad !== filters.finalidad) return false
      return true
    }).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.createdAt.localeCompare(a.createdAt))
  }, [pruebas, filters])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Salto CMJ</h1>
          <p className="text-surface-500 mt-1">Registro y seguimiento de saltos verticales</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setManagerOpen(true)}
            className="px-4 py-2 text-sm font-medium text-surface-700 bg-surface-100 hover:bg-surface-200 border border-surface-200 rounded-md shadow-sm"
          >
            Protocolos
          </button>
          <button
            onClick={handleNew}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm"
          >
            Nueva Medición
          </button>
        </div>
      </div>

      {/* Bloque informativo T-04A: Preparación Importación Chronojump */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1 text-xs text-blue-900">
          <div className="flex items-center gap-2 font-semibold text-sm text-blue-950">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-600"></span>
            Importación Chronojump: pendiente de archivo de muestra (v2.6.0-072)
          </div>
          <p>
            El sistema registrará <strong>tres intentos por jugadora</strong> por fecha/protocolo, conservando todos los intentos y mostrando como resultado principal la <strong>mayor altura válida (cm)</strong>.
          </p>
          <p className="text-blue-800">
            Requisito de identidad: Cada jugadora debe contar con un <strong>alias activo de origen <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">chronojump</code></strong> (ej. <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">CJ-01</code>) en su ficha antes de importar.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            onClick={() => setImportModalOpen(true)}
            title="Importar archivo CSV de exportación de Chronojump"
            className="px-4 py-2 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm"
          >
            Importar CSV Chronojump
          </button>
          <span className="text-[10px] text-surface-500 italic">
            Exportación grupal (sesión actual)
          </span>
          {prepResumen && (
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                prepResumen.totalRequierenCorreccion > 0
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-green-100 text-green-800 border border-green-300'
              }`}
            >
              {prepResumen.totalRequierenCorreccion > 0
                ? `⚠️ ${prepResumen.totalRequierenCorreccion} jugadoras requieren corrección de alias`
                : `✓ ${prepResumen.totalActivas} jugadoras activas preparadas para Chronojump`}
            </span>
          )}
        </div>
      </div>

      {/* Panel de Pre-comprobación de Aliases Chronojump (T-04B-PRE-CHECK) */}
      <div className="mb-6">
        <ChronojumpPrepPanel onPrepChange={setPrepResumen} />
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-4 bg-white p-4 rounded-lg shadow-sm border border-surface-200">
        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Jugadora</label>
          <select 
            className="w-full rounded border-surface-300 text-sm"
            value={filters.id_jugadora}
            onChange={e => { setFilters({ ...filters, id_jugadora: e.target.value }); setCurrentPage(1); }}
          >
            <option value="">Todas</option>
            {jugadoras.map(j => (
              <option key={j.id_jugadora} value={j.id_jugadora}>{j.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Protocolo</label>
          <select 
            className="w-full rounded border-surface-300 text-sm"
            value={filters.id_protocolo}
            onChange={e => { setFilters({ ...filters, id_protocolo: e.target.value }); setCurrentPage(1); }}
          >
            <option value="">Todos</option>
            {protocolos.map(p => (
              <option key={p.id_protocolo} value={p.id_protocolo}>{p.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Finalidad</label>
          <select 
            className="w-full rounded border-surface-300 text-sm"
            value={filters.finalidad}
            onChange={e => { setFilters({ ...filters, finalidad: e.target.value }); setCurrentPage(1); }}
          >
            <option value="">Todas</option>
            {FINALIDADES.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Desde</label>
          <input 
            type="date"
            className="w-full rounded border-surface-300 text-sm"
            value={filters.fecha_desde}
            onChange={e => { setFilters({ ...filters, fecha_desde: e.target.value }); setCurrentPage(1); }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Hasta</label>
          <input 
            type="date"
            className="w-full rounded border-surface-300 text-sm"
            value={filters.fecha_hasta}
            onChange={e => { setFilters({ ...filters, fecha_hasta: e.target.value }); setCurrentPage(1); }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-surface-200 p-12 text-center shadow-sm">
          <div className="mx-auto w-12 h-12 text-surface-400 mb-4">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-surface-900 mb-1">Aún no hay mediciones CMJ registradas</h3>
          <p className="text-surface-500 text-sm max-w-sm mx-auto mb-6">
            Registra tu primera medición de salto vertical para empezar a monitorizar el rendimiento neuromuscular.
          </p>
          <button
            onClick={handleNew}
            className="inline-flex px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm"
          >
            Nueva Medición
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-surface-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-xs font-medium text-surface-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">Jugadora</th>
                  <th className="px-6 py-3">Protocolo</th>
                  <th className="px-6 py-3 text-right">Altura Máx (cm)</th>
                  <th className="px-6 py-3 text-right">Vuelo (ms)</th>
                  <th className="px-6 py-3 text-center">Intentos</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 text-sm">
                {paginated.map(p => {
                  const j = jugadoras.find(x => x.id_jugadora === p.id_jugadora)
                  return (
                    <tr key={p.id_medicion} className="hover:bg-surface-50">
                      <td className="px-6 py-4 whitespace-nowrap text-surface-600">
                        {p.fecha.split('-').reverse().join('/')}
                      </td>
                      <td className="px-6 py-4 font-medium text-surface-900">
                        {j?.nombre || 'Desconocida'}
                      </td>
                      <td className="px-6 py-4 text-surface-600 max-w-[200px] truncate" title={p.protocolo_nombre_historico}>
                        {p.protocolo_nombre_historico}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-surface-900">
                        {p.altura_mejor_cm != null ? p.altura_mejor_cm : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-surface-600">
                        {p.tiempo_vuelo_mejor_ms != null ? p.tiempo_vuelo_mejor_ms : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-surface-500">
                        {p.intentos.length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleView(p.id_medicion)}
                          className="text-surface-500 hover:text-surface-800 mr-4"
                        >
                          Ver
                        </button>
                        <button
                          onClick={() => handleEdit(p.id_medicion)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="bg-surface-50 px-6 py-3 flex items-center justify-between border-t border-surface-200">
              <div className="text-sm text-surface-600">
                Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, filtered.length)} de {filtered.length} resultados
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm bg-white border border-surface-300 rounded-md disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm bg-white border border-surface-300 rounded-md disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <CMJFormModal 
        open={formOpen} 
        onClose={() => setFormOpen(false)} 
        editingId={editingId} 
      />

      <CMJDetailModal 
        medicionId={detailId} 
        onClose={() => setDetailId(null)} 
      />

      <CMJProtocolManagerModal 
        open={managerOpen} 
        onClose={() => setManagerOpen(false)} 
      />

      <ChronojumpImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => {
          useStore.getState().loadAll()
        }}
      />
    </div>
  )
}
