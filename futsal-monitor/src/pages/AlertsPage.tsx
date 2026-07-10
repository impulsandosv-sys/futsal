import { useState } from 'react'
import { useStore } from '@/store/store'
import { DataTable, DataRow, DataCell } from '@/components/shared/DataTable'
import { AlertBadge } from '@/components/shared/AlertBadge'
import { generarAlertas } from '@/utils/alerts'
import { useNavigate } from 'react-router-dom'

export function AlertsPage() {
  const { alertas, jugadoras, markAlertaLeida, clearAlertas } = useStore()
  const navigate = useNavigate()
  const [generating, setGenerating] = useState(false)

  const noLeidas = alertas.filter((a) => !a.leida)
  const leidas = alertas.filter((a) => a.leida)

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await generarAlertas()
      await useStore.getState().loadAll()
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-surface-800">Alertas e Incidencias</h1>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700 disabled:opacity-50"
          >
            {generating ? 'Generando...' : 'Generar alertas'}
          </button>
          <button
            onClick={clearAlertas}
            className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded hover:bg-surface-50"
          >
            Limpiar todas
          </button>
        </div>
      </div>

      {noLeidas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-amber-700 mb-2">
            Alertas activas ({noLeidas.length})
          </h3>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold text-surface-700 mb-2">Alertas activas</h3>
        <DataTable
          headers={['', 'Tipo', 'Jugadora', 'Mensaje', 'Nivel', 'Fecha']}
          emptyMessage="No hay alertas activas"
        >
          {noLeidas.map((a) => {
            const jug = jugadoras.find((j) => j.id_jugadora === a.id_jugadora)
            return (
              <DataRow key={a.id}>
                <DataCell>
                  <input
                    type="checkbox"
                    onChange={() => a.id && markAlertaLeida(a.id)}
                    className="cursor-pointer"
                  />
                </DataCell>
                <DataCell>
                  <span className="text-[10px] font-medium uppercase text-surface-500">{a.tipo.replace(/_/g, ' ')}</span>
                </DataCell>
                <DataCell>
                  <button
                    onClick={() => navigate(`/jugadoras/${a.id_jugadora}`)}
                    className="text-primary-600 hover:underline font-medium"
                  >
                    {jug?.nombre || a.id_jugadora}
                  </button>
                </DataCell>
                <DataCell className="max-w-[300px]">{a.mensaje}</DataCell>
                <DataCell>
                  <AlertBadge level={a.nivel} />
                </DataCell>
                <DataCell className="text-surface-500 text-[10px]">{a.creada?.slice(0, 10) || a.fecha}</DataCell>
              </DataRow>
            )
          })}
        </DataTable>
      </div>

      {leidas.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-surface-700 mb-2">Alertas resueltas</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200">
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Tipo</th>
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Jugadora</th>
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Mensaje</th>
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Nivel</th>
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {leidas.slice(0, 20).map((a) => {
                const jug = jugadoras.find((j) => j.id_jugadora === a.id_jugadora)
                return (
                  <tr key={a.id} className="text-surface-400">
                    <td className="px-3 py-2">{a.tipo.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2">{jug?.nombre || a.id_jugadora}</td>
                    <td className="px-3 py-2 max-w-[300px] truncate">{a.mensaje}</td>
                    <td className="px-3 py-2">{a.nivel}</td>
                    <td className="px-3 py-2">{a.creada?.slice(0, 10) || a.fecha}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
