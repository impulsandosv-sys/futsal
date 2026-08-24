export type WellnessScaleType = 'POSITIVE' | 'NEGATIVE' | 'CATEGORICAL' | 'TEXT'

export const DAILY_WELLNESS_FIELDS: Record<string, WellnessScaleType> = {
  'Calidad de sueño': 'POSITIVE',
  'Fatiga': 'NEGATIVE',
  'Dolor muscular': 'NEGATIVE',
  'Estrés': 'NEGATIVE',
  'Estado de ánimo': 'POSITIVE'
}

export const WELLNESS_WEEKLY_FIELD_MAP: Record<string, WellnessScaleType> = {
  '¿Cómo valorarías tu recuperación general esta semana?': 'POSITIVE',
  '¿Cómo ha sido la calidad de tu sueño esta semana?': 'POSITIVE',
  '¿Cómo ha sido tu nivel de estrés fuera del fútbol sala?': 'NEGATIVE',
  '¿Cómo ha sido tu energía durante los entrenamientos y el partido?': 'POSITIVE',
  '¿Cómo valorarías tu estado de ánimo esta semana?': 'POSITIVE',
  '¿Como de preparada te sientes para la próxima semana de entrenamiento y competición?': 'POSITIVE',
  '¿Tus síntomas menstruales han afectado a tu recuperación, entrenamiento o bienestar esta semana? (opcional)': 'NEGATIVE'
}

export const WEEKLY_MENSTRUAL_FIELD = '¿Tus síntomas menstruales han afectado a tu recuperación, entrenamiento o bienestar esta semana? (opcional)'

export const DAILY_TEXT_FIELDS = [
  'Dolor especifico o nota importante (opcional)',
  'Comentario sobre la sesión (opcional)'
]

export const WEEKLY_TEXT_FIELDS = [
  'Indica que dolor o molestia has tenido',
  'Indica que tipo de actividad e intensidad'
]

export function normalizarValor(
  valorOriginal: number,
  tipo: WellnessScaleType,
  rangoMaximo = 10
): number | null {
  if (!Number.isFinite(valorOriginal)) return null

  if (tipo === 'POSITIVE') return valorOriginal
  if (tipo === 'NEGATIVE') return (rangoMaximo + 1) - valorOriginal

  return null
}

export function normalizarSintomasMenstruales(valorOriginal: number): number | null {
  if (!Number.isFinite(valorOriginal)) return null
  const invertido = 6 - valorOriginal
  return invertido * 2
}

export function calcularIndiceDiario(metricas: Record<string, { normalizado: number | null }>): number | null {
  const valores = Object.keys(DAILY_WELLNESS_FIELDS)
    .map((k) => metricas[k]?.normalizado)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  if (valores.length === 0) return null
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10
}

export function calcularIndiceSemanal(metricas: Record<string, { normalizado: number | null }>): number | null {
  const valores = Object.keys(WELLNESS_WEEKLY_FIELD_MAP)
    .map((k) => metricas[k]?.normalizado)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  if (valores.length === 0) return null
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10
}

