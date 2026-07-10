interface AlertBadgeProps {
  level: 'bajo' | 'medio' | 'alto'
  label?: string
}

const styles = {
  bajo: 'bg-blue-50 text-blue-700 border-blue-200',
  medio: 'bg-amber-50 text-amber-700 border-amber-200',
  alto: 'bg-red-50 text-red-700 border-red-200',
}

export function AlertBadge({ level, label }: AlertBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${styles[level]}`}>
      {label || level}
    </span>
  )
}
