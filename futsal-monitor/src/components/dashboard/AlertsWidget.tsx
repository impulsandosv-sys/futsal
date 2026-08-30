import { useStore } from '@/store/store'
import { useNavigate } from 'react-router-dom'
import { esAlertaActiva } from '@/utils/alerts'

export function AlertsWidget() {
  const { alertas } = useStore()
  const navigate = useNavigate()

  const activas = alertas.filter(esAlertaActiva)
  const alertasVisibles = activas.slice(0, 8)

  if (activas.length === 0) {
    return <div className="text-xs text-surface-400 text-center py-6">No hay alertas activas</div>
  }

  return (
    <div className="space-y-1">
      {alertasVisibles.map((a) => (
        <div
          key={a.id}
          className={`text-xs px-3 py-2 rounded cursor-pointer transition-colors ${
            a.nivel === 'alto'
              ? 'bg-red-50 text-red-700'
              : a.nivel === 'medio'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-blue-50 text-blue-700'
          }`}
          onClick={() => navigate('/alertas')}
        >
          {a.mensaje}
        </div>
      ))}
      {activas.length > 8 && (
        <div className="text-xs text-surface-500 text-center pt-1">
          +{activas.length - 8} más
        </div>
      )}
    </div>
  )
}
