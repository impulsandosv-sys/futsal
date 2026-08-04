export const UMBRALES = {
  WELLNESS: {
    CRITICO: 5.0,
    BAJO: 6.5,
    BUENO: 8.0,
  },
  ACWR: {
    INSUFICIENTE: 3, // semanas mínimas
    ALTO: 1.5,
    ELEVADO: 1.3,
    BAJO: 0.8,
    MUY_BAJO: 0.5,
  },
  CARGA: {
    VARIABILIDAD_INCREMENTO_PCT: 0.25, // 25%
  },
  ALERTAS: {
    WELLNESS_CRITICO: 5.0,
    WELLNESS_BAJO: 6.5,
    ACWR_ALTO: 1.5,
    ACWR_ELEVADO: 1.3,
    DIAS_FALTANTES_WELLNESS: 3,
  }
} as const
