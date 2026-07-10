interface KPICardProps {
  label: string
  value: string | number
  subtitle?: string
  icon?: string
  trend?: 'up' | 'down' | 'neutral'
  color?: string
}

export function KPICard({ label, value, subtitle, icon, color = 'text-surface-800' }: KPICardProps) {
  return (
    <div className="bg-white rounded-lg border border-surface-200 p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">{label}</span>
        {icon && <span className="text-surface-300 text-sm">{icon}</span>}
      </div>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      {subtitle && <span className="text-[10px] text-surface-400">{subtitle}</span>}
    </div>
  )
}
