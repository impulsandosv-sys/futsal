import { useMemo } from 'react'

interface TrendIndicatorProps {
  value: number
  size?: "sm" | "md"
}

export function TrendIndicator({ value, size = "sm" }: TrendIndicatorProps) {
  const colors = useMemo(() => {
    if (Math.abs(value) < 1) return {
      bg: 'bg-surface-50',
      text: 'text-surface-600',
      border: 'border-surface-200'
    }
    if (value > 0) {
      if (value < 2) return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' }
      if (value < 5) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
      return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' }
    }
    if (value < 0) {
      if (value > -2) return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
      if (value > -5) return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' }
      return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' }
    }
    return { bg: 'bg-surface-50', text: 'text-surface-600', border: 'border-surface-200' }
  }, [value])

  const icon = useMemo(() => {
    if (value > 2) return '↗'
    if (value < -2) return '↘'
    return '→'
  }, [value])

  return (
    <span className={`inline-flex items-center gap-0.5 px-${size === "sm" ? 1 : 1.5} py-${size === "sm" ? 0.5 : 1} rounded ${colors.bg} ${colors.text} border ${colors.border} text-${size === "sm" ? "10px" : "11px"}`}
      title={`Tendencia: ${value.toFixed(1)}`}
    >
      <span className="font-medium">{icon}</span>
      <span className="font-semibold">{Math.abs(value).toFixed(1)}</span>
    </span>
  )
}

interface TeamMetricsProps {
  wellness: { media: number; tendencia: number }[]
  carga: { media: number; tendencia: number }[]
  rendimiento: { media: number; tendencia: number }[]
}

export function TeamMetrics({ wellness, carga, rendimiento }: TeamMetricsProps) {
  const teamWellnessAvg = useMemo(() => wellness.reduce((s, w) => s + w.media, 0) / wellness.length, [wellness])
  const teamWellnessTrend = useMemo(() => {
    const values = wellness.map(w => w.tendencia)
    return values.reduce((s, v) => s + v, 0) / values.length
  }, [wellness])

  const teamLoadAvg = useMemo(() => carga.reduce((s, c) => s + c.media, 0) / carga.length, [carga])
  const teamLoadTrend = useMemo(() => {
    const values = carga.map(c => c.tendencia)
    return values.reduce((s, v) => s + v, 0) / values.length
  }, [carga])

  const teamPerfAvg = useMemo(() => rendimiento.reduce((s, r) => s + r.media, 0) / rendimiento.length, [rendimiento])
  const teamPerfTrend = useMemo(() => {
    const values = rendimiento.map(r => r.tendencia)
    return values.reduce((s, v) => s + v, 0) / values.length
  }, [rendimiento])

  return (
    <div className="bg-white rounded-lg border border-surface-200 p-4">
      <h3 className="text-xs font-semibold text-surface-700 mb-3">Análisis de equipo</h3>
      
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface-50 rounded p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-surface-500">Wellness</span>
            <TrendIndicator value={teamWellnessTrend} size="sm" />
          </div>
          <div className="text-sm font-bold text-surface-800">{teamWellnessAvg.toFixed(1)}/10</div>
          <div className="text-[10px] text-surface-500 mt-0.5">Media del equipo</div>
        </div>
        
        <div className="bg-surface-50 rounded p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-surface-500">Carga</span>
            <TrendIndicator value={teamLoadTrend} size="sm" />
          </div>
          <div className="text-sm font-bold text-surface-800">{Math.round(teamLoadAvg)} UA</div>
          <div className="text-[10px] text-surface-500 mt-0.5">Promedio semanal equipo</div>
        </div>
        
        <div className="bg-surface-50 rounded p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-surface-500">Rendimiento</span>
            <TrendIndicator value={teamPerfTrend} size="sm" />
          </div>
          <div className="text-sm font-bold text-surface-800">{(teamPerfAvg * 100).toFixed(0)}%</div>
          <div className="text-[10px] text-surface-500 mt-0.5">Eficiencia ACWR</div>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-surface-100">
        <div className="text-[10px] text-surface-500 mb-1.5">Estado del equipo</div>
        <div className="flex flex-wrap gap-1.5">
          {teamWellnessAvg < 5 && (
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">
              Wellness bajo
            </span>
          )}
          {teamLoadAvg > 0 && teamLoadTrend > 2 && (
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
              Carga en aumento
            </span>
          )}
          {teamPerfAvg < 0.8 && (
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
              Rendimiento bajo
            </span>
          )}
          {teamWellnessAvg >= 5 && teamLoadTrend <= 1 && teamPerfAvg >= 0.8 && (
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Estado óptimo
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
