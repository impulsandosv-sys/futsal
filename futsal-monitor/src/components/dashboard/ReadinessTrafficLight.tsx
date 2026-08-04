import { useStore } from '@/store/store'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { obtenerJugadoresConReadinessOrdenados } from '@/domain/monitoring/monitoring'

export function ReadinessTrafficLight() {
  const { jugadoras, readiness } = useStore()

  const hoy = useMemo(() => new Date().toISOString().split('T')[0], [])
  
  const jugadoresConReadiness = useMemo(() => {
    return obtenerJugadoresConReadinessOrdenados(jugadoras, readiness, hoy)
  }, [jugadoras, readiness, hoy])


  return (
    <div className="bg-white rounded-lg border border-surface-200 p-4">
      <h3 className="text-xs font-semibold text-surface-700 mb-3">Readiness Diaria ({hoy})</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {jugadoresConReadiness.map(({ jugadora, readiness }) => {
          const nivel = readiness?.nivel || 'sin_datos'
          const color = nivel === 'rojo' ? 'bg-red-500' : nivel === 'ambar' ? 'bg-amber-500' : nivel === 'verde' ? 'bg-green-500' : 'bg-surface-300'
          const label = nivel === 'rojo' ? '🔴' : nivel === 'ambar' ? '🟡' : nivel === 'verde' ? '🟢' : '⚪'
          
          return (
            <Link key={jugadora.id_jugadora} to={`/jugadoras/${jugadora.id_jugadora}`} className="block">
              <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${color}`}></span>
                  <span className="text-xs font-medium text-surface-800">{jugadora.nombre}</span>
                  <span className="text-[10px] text-surface-500">{jugadora.posicion}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span>{label}</span>
                  {readiness && (
                    <span className="font-mono text-surface-600">{readiness.score}</span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
