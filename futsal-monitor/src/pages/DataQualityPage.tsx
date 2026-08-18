import { useMemo } from 'react'
import { useStore } from '@/store/store'
import { useNavigate } from 'react-router-dom'
import { evaluarCompletitudDatos } from '@/domain/monitoring/completitud'
import { getTodayLocalISO } from '@/domain/dates/dates'

export function DataQualityPage() {
  const { jugadoras, wellness, partidos, rpe_partido, sesion_rpe } = useStore()
  const navigate = useNavigate()
  
  const completitud = useMemo(() => {
    return evaluarCompletitudDatos(jugadoras, wellness, partidos, rpe_partido, sesion_rpe, getTodayLocalISO())
  }, [jugadoras, wellness, partidos, rpe_partido, sesion_rpe])

  const resolverAlerta = (item: any) => {
    if (item.destino === 'partidos') {
      navigate('/matches', {
        state: {
          openRpePartidoId: item.id_partido,
          focusJugadoraId: item.id_jugadora,
          source: 'calidad-datos'
        }
      })
    } else if (item.destino === 'sesiones') {
      navigate('/sessions', {
        state: {
          openRpeSesionId: item.id_sesion,
          focusJugadoraId: item.id_jugadora,
          source: 'calidad-datos'
        }
      })
    }
  }

  const getJugadoraNombre = (id: string) => jugadoras.find(j => j.id_jugadora === id)?.nombre || 'Desconocida'

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Calidad de Datos</h1>
        <p className="text-sm text-surface-500 mt-1">
          Monitoriza el estado de la recogida de datos y actúa sobre la información faltante.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
          <div className="p-4 bg-surface-50 border-b border-surface-200">
            <h2 className="font-semibold text-surface-800">Alertas Pendientes ({completitud.alertas.length})</h2>
          </div>
          <div className="divide-y divide-surface-100 max-h-[600px] overflow-y-auto">
            {completitud.alertas.length === 0 ? (
              <div className="p-8 text-center text-surface-500 text-sm">
                🎉 ¡Todo al día! No hay datos pendientes.
              </div>
            ) : (
              completitud.alertas.map((alerta, idx) => {
                const isPendiente = alerta.estado === 'pendiente'
                return (
                  <div key={idx} className={`p-4 flex items-start justify-between gap-4 ${isPendiente ? 'bg-white' : 'bg-surface-50'}`}>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                          isPendiente ? 'bg-amber-100 text-amber-800' : 'bg-surface-200 text-surface-600'
                        }`}>
                          {alerta.estado.replace('_', ' ')}
                        </span>
                        <span className="text-sm font-semibold text-surface-900 truncate">
                          {getJugadoraNombre(alerta.id_jugadora)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-surface-800">{alerta.titulo}</p>
                      <p className="text-xs text-surface-500">{alerta.detalle}</p>
                    </div>
                    {isPendiente && (
                      <button 
                        onClick={() => resolverAlerta(alerta)}
                        className="shrink-0 bg-primary-50 text-primary-600 hover:bg-primary-100 hover:text-primary-700 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                      >
                        Resolver →
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
          <div className="p-4 bg-surface-50 border-b border-surface-200">
            <h2 className="font-semibold text-surface-800">Resumen Wellness (Últimos 7 días)</h2>
          </div>
          <div className="divide-y divide-surface-100 max-h-[600px] overflow-y-auto">
            {completitud.wellness.map((w) => (
              <div key={w.id_jugadora} className="p-4 flex items-center justify-between hover:bg-surface-50 transition-colors">
                <span className="text-sm font-medium text-surface-900">
                  {getJugadoraNombre(w.id_jugadora)}
                </span>
                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium bg-surface-100 text-surface-700">
                  {w.registros_ultimos_7_dias} registros
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
