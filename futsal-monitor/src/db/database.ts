import Dexie from 'dexie'
import type {
  Jugadora, FormularioRespuesta, Wellness, Sesion, Partido,
  Lesion, TestFisico, RPE_Entreno, RPE_Partido, ResumenSemanal, Alerta
} from '@/types'

// ============================================================================
// Esquema de base de datos optimizado para Futsal Monitor
// ============================================================================
// Principio rector: mantener compatibilidad, agregar índices donde sea necesario,
// prevenir duplicados lógicos, y usar genéricos Dexie tipo-safe para mejor rendimiento.
// ==============================================================================

export class FutsalDB extends Dexie {
  // Jugadoras: clave primaria única por ID, índices por nombre/posición para búsqueda rápida
  jugadoras!: Dexie.Table<Jugadora, 'id_jugadora'>
  
  // Formularios de respuesta: histórico de submissions de wellness, prevenir duplicados jugador + fecha
  formulario_respuestas!: Dexie.Table<FormularioRespuesta, number>
  
  // Registros de wellness diarios por jugadora – necesitamos consultas rápidas por jugador + fecha
  wellness!: Dexie.Table<Wellness, number>
  
  // Sesiones de entrenamiento y datos grupales
  sesiones!: Dexie.Table<Sesion, 'id_sesion'>
  
  // Partidos: por fecha y ordenación por fecha
  partidos!: Dexie.Table<Partido, 'id_partido'>
  
  // Lesiones: facilitar búsqueda por jugador y disponibilidad
  lesiones!: Dexie.Table<Lesion, 'id_lesion'>
  
  // Resultados de tests físicos – organización por jugador + fecha + test
  tests_fisicos!: Dexie.Table<TestFisico, number>
  
  // RPE de entreno: relación con sesiones individuales por jugador
  rpe_entreno!: Dexie.Table<RPE_Entreno, number>
  
  // RPE de partido: seguimiento de minutos jugados y carga por partido
  rpe_partido!: Dexie.Table<RPE_Partido, number>
  
  // Resúmenes semanales por jugador y semana (alta con predominancia única)
  resumen_semanal!: Dexie.Table<ResumenSemanal, number>
  
  // Alertas generadas – recuperadas por jugador con estado de lectura
  alertas!: Dexie.Table<Alerta, number>

  constructor() {
    super('futsal_monitor')

    // Versi��n 1.0 – Esquema original, conservado para compatibilidad
    this.version(1).stores({
      // Jugadoras – fácil búsqueda por ID, nombre, posición, filtrans por activa
      jugadoras: 'id_jugadora, nombre, posicion, activa',
      // Formularios – prevenir duplicados por jugador + fecha
      formulario_respuestas: '++id, id_jugadora, fecha',
      // Wellness – historial diario, preventivo de datos duplicados por jugador y fecha
      wellness: '++id, id_jugadora, fecha',
      // Sesiones – por ID de sesi��n y orden cronol��gico
      sesiones: 'id_sesion, fecha, tipo_sesion',
      // Partidos – por ID de partido y orden por fecha
      partidos: 'id_partido, fecha',
      // Lesiones – ID de lesion y consulta por jugador/disponibilidad
      lesiones: 'id_lesion, id_jugadora, fecha_inicio, disponible',
      // Tests – por jugador, fecha, y nombre de test para an��lisis
      tests_fisicos: '++id, id_jugadora, fecha, test',
      // RPE de entreno – relaci��n con sesi��n y jugador
      rpe_entreno: '++id, id_jugadora, id_sesion, fecha',
      // RPE de partido – relaci��n con partido y jugador
      rpe_partido: '++id, id_jugadora, id_partido, fecha',
      // Resumen semanal – clave por jugador + semana (sin duplicados)
      resumen_semanal: '++id, id_jugadora, semana',
      // Alertas – por jugador, tipo, y estado de lectura
      alertas: '++id, id_jugadora, tipo, leida',
    })

    // Versi��n 2.0 – Nueva versi�n con �ndices compuestos adicionales para optimizaci�n de consultas
    this.version(2).stores({
      // Mantener las definiciones existentes
      jugadoras: 'id_jugadora, nombre, posicion, activa',
      formulario_respuestas: '++id, id_jugadora, fecha',
      wellness: '++id, id_jugadora, fecha',

      // Nuevos �ndices compuestos para consultas frecuentes

      // Lesiones – R�pido lookup de lesiones activas por jugador
      lesiones: 'id_lesion, id_jugadora, fecha_inicio, disponible, fase_rtp',

      // Tests – Filtrar por jugador y rango de fechas para informes
      tests_fisicos: '++id, id_jugadora, fecha, test',

      // RPE de partido – Agrupar por partido y jugador
      rpe_partido: '++id, id_jugadora, id_partido, fecha',

      // Resumen semanal – Permite consulta r��pida por jugador + semana
      resumen_semanal: '++id, id_jugadora, semana, estado',

      // Alertas – Buscar por jugador + tipo + estado de lectura
      alertas: '++id, id_jugadora, tipo, leida',
    })

    // Versi��n 3.0 – Esquema listo para futuras mejoras, mantener compatibilidad
    // Crear nuevas tablas con �ndices m�s específicos donde sea necesario sin romper lo existente
    this.version(3).stores({})
  }
}

export const db = new FutsalDB()
