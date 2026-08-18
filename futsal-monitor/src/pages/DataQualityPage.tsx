import { useMemo } from 'react'
import { useStore } from '@/store/store'
import { evaluarCompletitudDatos } from '@/domain/monitoring/completitud'

export function DataQualityPage() {
  const { jugadoras, wellness, rpe_partido, sesion_rpe } = useStore()
  
  const completitud = useMemo(() => {
    return evaluarCompletitudDatos(jugadoras, wellness, rpe_partido, sesion_rpe)
  }, [jugadoras, wellness, rpe_partido, sesion_rpe])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Calidad de Datos</h1>
        <p className="text-sm text-surface-500 mt-1">
          Monitoriza el estado de la recogida de datos y actúa sobre la información faltante.
        </p>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 font-medium">
              <tr>
                <th className="px-6 py-4">Jugadora</th>
                <th className="px-6 py-4 text-center">Wellness (últimos 7 días)</th>
                <th className="px-6 py-4 text-center">RPE Partidos Pendiente</th>
                <th className="px-6 py-4 text-center">RPE Sesiones Pendiente</th>
                <th className="px-6 py-4">Estado General</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {completitud.map((c) => {
                const isWellnessOk = c.wellnessUltimos7Dias >= 5
                const isPartidosOk = c.rpePartidosFaltantes === 0
                const isSesionesOk = c.rpeSesionesFaltantes === 0
                const isAllOk = isWellnessOk && isPartidosOk && isSesionesOk

                return (
                  <tr key={c.jugadora.id_jugadora} className="hover:bg-surface-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-surface-900">
                      {c.jugadora.nombre}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isWellnessOk ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {c.wellnessUltimos7Dias} / 7
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isPartidosOk ? (
                        <span className="text-surface-400">-</span>
                      ) : (
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                          {c.rpePartidosFaltantes} faltantes
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isSesionesOk ? (
                        <span className="text-surface-400">-</span>
                      ) : (
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                          {c.rpeSesionesFaltantes} faltantes
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isAllOk ? (
                        <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Al día
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Requiere acción
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              
              {completitud.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-surface-500">
                    No hay jugadoras activas para evaluar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
