import { useStore } from '@/store/store'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function TodayWidget() {
  const { jugadoras, wellness, sesiones, partidos, lesiones } = useStore()
  const navigate = useNavigate()

  const hoy = new Date().toISOString().split('T')[0]
  const activas = jugadoras.filter((j) => j.activa)

  const wellnessHoy = wellness.filter((w) => w.fecha === hoy)
  const jugadorasConWellness = new Set(wellnessHoy.map((w) => w.id_jugadora))
  const jugadorasSinWellness = activas.filter((j) => !jugadorasConWellness.has(j.id_jugadora))

  const sesionHoy = sesiones.find((s) => s.fecha === hoy)
  const partidoHoy = partidos.find((p) => p.fecha === hoy)

  const lesionesActivas = lesiones.filter((l) => !l.disponible)
  const enReadaptacion = lesionesActivas.filter((l) => l.fase_rtp !== 'N/A' && l.fase_rtp !== 'Fase_1_Reposo')

  const wellnessScoreMedio = wellnessHoy.length > 0
    ? Math.round(wellnessHoy.reduce((s, w) => s + w.score_wellness, 0) / wellnessHoy.length * 10) / 10
    : 0

  const pctRespuestas = activas.length > 0 ? Math.round(jugadorasConWellness.size / activas.length * 100) : 0

  return (
    <div className="bg-white rounded-lg border border-surface-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-surface-700">
          Hoy · {format(new Date(), "d 'de' MMMM", { locale: es })}
        </h3>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${pctRespuestas === 100 ? 'bg-green-50 text-green-700' : pctRespuestas > 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
          {pctRespuestas}% wellness
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-surface-50 rounded p-2.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-surface-500">Actividad</span>
          </div>
          {partidoHoy ? (
            <div className="text-xs">
              <span className="font-semibold text-red-600">Partido</span>
              <span className="text-surface-600 ml-1">vs {partidoHoy.rival}</span>
              <span className="text-surface-400 ml-1">{partidoHoy.lugar}</span>
            </div>
          ) : sesionHoy ? (
            <div className="text-xs">
              <span className="font-semibold text-primary-600">{sesionHoy.tipo_sesion}</span>
              <span className="text-surface-400 ml-1">{sesionHoy.duracion_min} min</span>
            </div>
          ) : (
            <span className="text-xs text-surface-400">Sin actividad programada</span>
          )}
        </div>

        <div className="bg-surface-50 rounded p-2.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-surface-500">Wellness equipo</span>
          </div>
          {wellnessScoreMedio > 0 ? (
            <span className={`text-lg font-bold ${wellnessScoreMedio < 5 ? 'text-red-600' : wellnessScoreMedio < 7 ? 'text-amber-600' : 'text-green-600'}`}>
              {wellnessScoreMedio}
            </span>
          ) : (
            <span className="text-xs text-surface-400">Sin datos hoy</span>
          )}
        </div>
      </div>

      {lesionesActivas.length > 0 && (
        <div className="mb-3 bg-red-50 rounded p-2.5">
          <span className="text-[10px] font-medium text-red-700">
            {lesionesActivas.length} lesionada{lesionesActivas.length > 1 ? 's' : ''}
            {enReadaptacion.length > 0 && ` · ${enReadaptacion.length} en readaptación`}
          </span>
        </div>
      )}

      {jugadorasSinWellness.length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] font-medium text-surface-600 block mb-1.5">
            Sin wellness hoy ({jugadorasSinWellness.length})
          </span>
          <div className="flex flex-wrap gap-1">
            {jugadorasSinWellness.map((j) => (
              <span key={j.id_jugadora} className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
                {j.nombre}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-surface-100 pt-2.5 mt-1">
        <span className="text-[10px] text-surface-500 block mb-1.5">Resumen rápido</span>
        <div className="grid grid-cols-3 gap-2 text-center">
          <button
            onClick={() => navigate('/wellness')}
            className="text-[10px] bg-surface-50 hover:bg-surface-100 rounded py-1.5 transition-colors"
          >
            <span className="block font-semibold text-surface-700">{jugadorasConWellness.size}/{activas.length}</span>
            <span className="text-surface-400">Wellness</span>
          </button>
          <button
            onClick={() => navigate('/lesiones')}
            className="text-[10px] bg-surface-50 hover:bg-surface-100 rounded py-1.5 transition-colors"
          >
            <span className={`block font-semibold ${lesionesActivas.length > 0 ? 'text-red-600' : 'text-surface-700'}`}>{lesionesActivas.length}</span>
            <span className="text-surface-400">Lesiones</span>
          </button>
          <button
            onClick={() => navigate('/sesiones')}
            className="text-[10px] bg-surface-50 hover:bg-surface-100 rounded py-1.5 transition-colors"
          >
            <span className="block font-semibold text-surface-700">{sesiones.filter(s => s.fecha === hoy).length}</span>
            <span className="text-surface-400">Sesiones</span>
          </button>
        </div>
      </div>
    </div>
  )
}
