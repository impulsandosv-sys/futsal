import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { ResumenSemanal } from '@/types'

interface LoadChartProps {
  data: ResumenSemanal[]
  height?: number
}

export function LoadChart({ data, height = 200 }: LoadChartProps) {
  const grouped: Record<string, { semana: string; carga: number; count: number }> = {}
  for (const rs of data) {
    if (!grouped[rs.semana]) grouped[rs.semana] = { semana: rs.semana, carga: 0, count: 0 }
    grouped[rs.semana].carga += rs.carga_total
    grouped[rs.semana].count++
  }

  const chartData = Object.values(grouped)
    .map((g) => ({ semana: g.semana.slice(5), carga: Math.round(g.carga / g.count) }))
    .sort((a, b) => a.semana.localeCompare(b.semana))
    .slice(-8)

  if (chartData.length === 0) {
    return <div className="text-xs text-surface-400 text-center py-8">Sin datos de carga</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Bar dataKey="carga" fill="#0052e6" radius={[2, 2, 0, 0]} name="Carga total (UA)" />
      </BarChart>
    </ResponsiveContainer>
  )
}
