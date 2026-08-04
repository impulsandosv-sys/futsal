import { useMemo } from 'react'
import { startOfWeek, addDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Sesion, Partido } from '@/types'
import { calcularEtiquetaMD } from '@/domain/planning/planningEngine'

interface WeeklyCalendarProps {
  fechaBase: string
  sesiones: Sesion[]
  partidos: Partido[]
  onSelectSesion?: (sesion: Sesion) => void
  onAddSesion?: (fecha: string) => void
}

export function WeeklyCalendar({ fechaBase, sesiones, partidos, onSelectSesion, onAddSesion }: WeeklyCalendarProps) {
  const startDate = startOfWeek(parseISO(fechaBase), { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i))

  const partidosDeLaSemana = useMemo(() => {
    return partidos.filter(p => {
      const pDate = parseISO(p.fecha)
      return pDate >= startDate && pDate <= addDays(startDate, 6)
    })
  }, [partidos, startDate])

  return (
    <div className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm">
      <div className="grid grid-cols-7 divide-x divide-surface-200">
        {days.map((day, i) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const daySessions = sesiones.filter(s => s.fecha === dateStr)
          const dayMatches = partidos.filter(p => p.fecha === dateStr)
          const mdLabel = calcularEtiquetaMD(dateStr, partidosDeLaSemana)

          return (
            <div key={dateStr} className={`min-h-[120px] flex flex-col group ${i === 6 ? 'bg-surface-50' : 'bg-white'}`}>
              <div className="px-2 py-1.5 border-b border-surface-100 flex justify-between items-center bg-surface-50">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs font-semibold text-surface-700 capitalize">{format(day, 'EEEE', { locale: es }).slice(0, 3)}</span>
                  <span className="text-[10px] text-surface-500">{format(day, 'd MMM', { locale: es })}</span>
                </div>
                {mdLabel && (
                  <span className="text-[9px] font-bold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded">{mdLabel}</span>
                )}
              </div>
              <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto relative">
                {dayMatches.map(p => (
                  <div key={p.id_partido} className="p-1.5 border border-amber-200 bg-amber-50 rounded shadow-sm relative group cursor-default">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold text-amber-800">PARTIDO</span>
                      <span className="text-[9px] text-amber-600">{p.lugar === 'Local' ? '(L)' : '(V)'}</span>
                    </div>
                    <p className="text-[9px] text-surface-700 mt-0.5 line-clamp-1">{p.rival}</p>
                    <p className="text-[8px] text-surface-500">{p.competicion}</p>
                  </div>
                ))}
                {daySessions.map(s => (
                  <div 
                    key={s.id_sesion} 
                    onClick={() => onSelectSesion?.(s)}
                    className={`p-1.5 border rounded shadow-sm cursor-pointer hover:border-primary-400 transition-colors ${s.estado === 'cancelada' ? 'bg-surface-100 border-surface-200 opacity-60' : s.estado === 'planificada' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}
                  >
                    <div className="flex justify-between items-start">
                      <span className={`text-[10px] font-bold ${s.estado === 'planificada' ? 'text-blue-800' : s.estado === 'cancelada' ? 'text-surface-500' : 'text-green-800'}`}>
                        {s.tipo_sesion}
                      </span>
                      <span className="text-[9px] text-surface-500 font-mono">{s.duracion_planificada_min || s.duracion_real_grupal_min || 0}'</span>
                    </div>
                    {s.objetivo_principal && <p className="text-[9px] text-surface-700 mt-0.5 line-clamp-2">{s.objetivo_principal}</p>}
                    <div className="mt-1 flex gap-1 flex-wrap">
                      {s.estado === 'planificada' && <span className="text-[8px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded-sm">Planificada</span>}
                      {s.estado === 'cancelada' && <span className="text-[8px] px-1 py-0.5 bg-surface-200 text-surface-600 rounded-sm">Cancelada</span>}
                    </div>
                  </div>
                ))}

                <button 
                  onClick={() => onAddSesion?.(dateStr)}
                  className="w-full text-center py-1 mt-1 text-[10px] text-surface-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 border border-dashed border-transparent hover:border-primary-200"
                >
                  + Sesión
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
