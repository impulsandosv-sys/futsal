import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Wellness } from '@/types'

interface WellnessChartProps {
  data: Wellness[]
  height?: number
}

export function WellnessChart({ data, height = 200 }: WellnessChartProps) {
  const grouped: Record<string, { fecha: string; media: number; count: number }> = {}
  const sorted = [...data].sort((a, b) => a.fecha.localeCompare(b.fecha))
  for (const w of sorted) {
    if (!grouped[w.fecha]) grouped[w.fecha] = { fecha: w.fecha, media: 0, count: 0 }
    grouped[w.fecha].media += w.score_wellness
    grouped[w.fecha].count++
  }

  const chartData = Object.values(grouped)
    .map((g) => ({ fecha: g.fecha.slice(5), media: Math.round(g.media / g.count * 10) / 10 }))
    .slice(-14)

  if (chartData.length === 0) {
    return <div className="text-xs text-surface-400 text-center py-8">Sin datos de wellness</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Bar dataKey="media" fill="#1a6dff" radius={[2, 2, 0, 0]} name="Wellness medio" />
      </BarChart>
    </ResponsiveContainer>
  )
}
