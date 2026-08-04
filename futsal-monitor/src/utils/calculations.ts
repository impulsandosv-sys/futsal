// Legacy calculations utility delegating to pure domain functions for backward compatibility.

export { 
  calcularIMC, 
  calcularScoreWellness, 
  calcularCargaUA,
  calcularMonotonyStrain,
  calcularACWREWMA,
  calcularCargaACWR,
  calcularTendenciaACWR,
  calcularTendenciaWellness,
  getPercentilEquipo 
} from '../domain/calculations/loadCalculations'

export { 
  getWeekId, 
  formatWeek, 
  getWeeksFromActivities, 
  obtenerFechasUltimosDias 
} from '../domain/dates/dates'

export { 
  calcularResumenSemanal,
  calcularReadinessDiaria,
  calcularPrioridadRevision,
  getWellnessLevel,
  getWellnessThreshold,
  getLoadStatus,
  calcularCargaDiariaUltimosDias,
  calcularResumenEquipoSemanal,
  calcularEdad,
  obtenerJugadoresConReadinessOrdenados
} from '../domain/monitoring/monitoring'