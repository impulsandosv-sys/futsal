import Dexie from 'dexie'
import type {
  Jugadora, FormularioRespuesta, Wellness, Sesion, Partido,
  Lesion, TestFisico, RPE_Partido, ResumenSemanal, Alerta,
  SesionRPE, Readiness, HistorialImportacion,
  CicloMenstrual, CargaGPS, FuerzaVBT, Hidratacion,
  RTPChecklist, TestPsicologico, HistorialCopia, PlantillaImportacion,
  ProtocoloCMJ, MedicionCMJ, EjercicioFuerza, TrabajoFuerzaIndividual, PlantillaFuerza, SesionFuerzaIndividual,
  Temporada, AliasJugadora, WellnessDiarioImportado, WellnessSemanalImportado
} from '@/types'

// ============================================================================
// Esquema de base de datos optimizado para Futsal Monitor
// ============================================================================
// Principio rector: mantener compatibilidad, agregar índices donde sea necesario,
// prevenir duplicados lógicos, y usar genéricos Dexie tipo-safe para mejor rendimiento.
// ==============================================================================

export class FutsalDB extends Dexie {
  // Gobierno del dominio (v15+)
  temporadas!: Dexie.Table<Temporada, string>
  alias_jugadora!: Dexie.Table<AliasJugadora, number>

  // Jugadoras: clave primaria única por ID, índices por nombre/posición para búsqueda rápida
  jugadoras!: Dexie.Table<Jugadora, string>
  
  // Formularios de respuesta: histórico de submissions de wellness, prevenir duplicados jugador + fecha
  formulario_respuestas!: Dexie.Table<FormularioRespuesta, number>
  
  // Registros de wellness diarios por jugadora – necesitamos consultas rápidas por jugador + fecha
  wellness!: Dexie.Table<Wellness, number>
  wellness_diario_importado!: Dexie.Table<WellnessDiarioImportado, number>
  wellness_semanal_importado!: Dexie.Table<WellnessSemanalImportado, number>
  
  // Sesiones de entrenamiento y datos grupales
  sesiones!: Dexie.Table<Sesion, string>
  
  // Partidos: por fecha y ordenación por fecha
  partidos!: Dexie.Table<Partido, string>
  
  // Lesiones: facilitar búsqueda por jugador y disponibilidad
  lesiones!: Dexie.Table<Lesion, string>
  
  // Resultados de tests físicos – organización por jugador + fecha + test
  tests_fisicos!: Dexie.Table<TestFisico, number>
  
  // RPE de partido: seguimiento de minutos jugados y carga por partido
  rpe_partido!: Dexie.Table<RPE_Partido, number>
  
  // Resúmenes semanales por jugador y semana (alta con predominancia única)
  resumen_semanal!: Dexie.Table<ResumenSemanal, number>
  
  // Alertas generadas – recuperadas por jugador con estado de lectura
  alertas!: Dexie.Table<Alerta, number>

  // RPE de sesión – relación con sesiones individuales por jugador
  sesion_rpe!: Dexie.Table<SesionRPE, number>

  // Readiness diario – estado de preparación por jugador y fecha
  readiness!: Dexie.Table<Readiness, number>

  // Historial de importaciones manuales (CSV/Excel)
  historial_importaciones!: Dexie.Table<HistorialImportacion, number>

  // Historial de copias de seguridad (JSON)
  historial_copias!: Dexie.Table<HistorialCopia, number>

  // Nuevas tablas (Fase 2)
  ciclo_menstrual!: Dexie.Table<CicloMenstrual, number>
  carga_gps!: Dexie.Table<CargaGPS, number>
  fuerza_vbt!: Dexie.Table<FuerzaVBT, number>
  hidratacion!: Dexie.Table<Hidratacion, number>

  // Nuevas tablas (Fase 3 - Médico/Psicológico)
  rtp_checklist!: Dexie.Table<RTPChecklist, number>
  test_psicologico!: Dexie.Table<TestPsicologico, number>

  // Plantillas de Mapeo
  plantillas_importacion!: Dexie.Table<PlantillaImportacion, number>

  // ==========================================================
  // Fase 5 - CMJ y Fuerza
  // ==========================================================
  protocolos_cmj!: Dexie.Table<ProtocoloCMJ, string>
  pruebas_cmj!: Dexie.Table<MedicionCMJ, string>
  ejercicios_fuerza!: Dexie.Table<EjercicioFuerza, string>
  trabajos_fuerza!: Dexie.Table<TrabajoFuerzaIndividual, string>
  plantillas_fuerza!: Dexie.Table<PlantillaFuerza, string>
  sesiones_fuerza_individual!: Dexie.Table<SesionFuerzaIndividual, string>

  constructor(name = 'futsal_monitor') {
    super(name)

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

    // Versi\u00f3n 3.0 – Esquema listo para futuras mejoras, mantener compatibilidad
    // Crear nuevas tablas con \u00edndices m\u00e1s espec\u00edficos donde sea necesario sin romper lo existente
    this.version(3).stores({})

    // Versión 5.0 – Eliminar rpe_entreno sobrante y añadir índice compuesto de wellness
    this.version(5).stores({
      jugadoras: 'id_jugadora, nombre, posicion, activa',
      formulario_respuestas: '++id, id_jugadora, fecha',
      wellness: '++id, [id_jugadora+fecha], id_jugadora, fecha',
      sesiones: 'id_sesion, fecha, tipo_sesion',
      partidos: 'id_partido, fecha',
      lesiones: 'id_lesion, id_jugadora, fecha_inicio, disponible, fase_rtp',
      tests_fisicos: '++id, id_jugadora, fecha, test',
      rpe_partido: '++id, id_jugadora, id_partido, fecha',
      resumen_semanal: '++id, id_jugadora, semana, estado',
      alertas: '++id, id_jugadora, tipo, leida',
      sesion_rpe: '++id, id_sesion, id_jugadora, fecha',
      readiness: '++id, id_jugadora, fecha',
    })

    // Versión 6.0 – Añadir índices compuestos para estado y prioridad de alertas
    this.version(6).stores({
      alertas: '++id, id_jugadora, tipo, estado, prioridad',
    }).upgrade(async (tx) => {
      await tx.table('alertas').toCollection().modify((alerta: any) => {
        alerta.estado = alerta.leida ? 'resuelta' : 'abierta'
        alerta.prioridad = alerta.nivel || 'bajo'
        alerta.responsable = alerta.responsable || ''
        alerta.nota_decision = alerta.nota_decision || ''
        alerta.sugerencia = alerta.sugerencia || ''
      })
    })

    // Versión 7.0 - Añadir historial_importaciones
    this.version(7).stores({
      historial_importaciones: '++id, fechaHora, tipoImportacion, archivo'
    })

    // Versión 8.0 - Nuevos modelos médicos y físicos
    this.version(8).stores({
      ciclo_menstrual: '++id, id_jugadora, fecha',
      carga_gps: '++id, id_jugadora, fecha, id_sesion, id_partido',
      fuerza_vbt: '++id, id_jugadora, fecha',
      hidratacion: '++id, id_jugadora, fecha'
    })

    // Versión 9.0 - RTP y Test Psicológico
    this.version(9).stores({
      rtp_checklist: '++id, id_lesion',
      test_psicologico: '++id, id_jugadora, fecha'
    })

    // Versión 10.0 - Fase 1: Historial de copias
    this.version(10).stores({
      historial_copias: '++id, fechaHora, tipo, confirmadaExterna'
    })

    // Versión 11.0 - Esquema Completo + plantillas_importacion (Fase 2)
    this.version(11).stores({
      jugadoras: 'id_jugadora, nombre, posicion, activa',
      formulario_respuestas: '++id, id_jugadora, fecha',
      wellness: '++id, [id_jugadora+fecha], id_jugadora, fecha',
      sesiones: 'id_sesion, fecha, tipo_sesion',
      partidos: 'id_partido, fecha',
      lesiones: 'id_lesion, id_jugadora, fecha_inicio, disponible, fase_rtp',
      tests_fisicos: '++id, id_jugadora, fecha, test',
      rpe_partido: '++id, id_jugadora, id_partido, fecha',
      resumen_semanal: '++id, id_jugadora, semana, estado',
      alertas: '++id, id_jugadora, tipo, estado, prioridad',
      sesion_rpe: '++id, id_sesion, id_jugadora, fecha',
      readiness: '++id, id_jugadora, fecha',
      historial_importaciones: '++id, fechaHora, tipoImportacion, archivo',
      historial_copias: '++id, fechaHora, tipo, confirmadaExterna',
      ciclo_menstrual: '++id, id_jugadora, fecha',
      carga_gps: '++id, id_jugadora, fecha, id_sesion, id_partido',
      fuerza_vbt: '++id, id_jugadora, fecha',
      hidratacion: '++id, id_jugadora, fecha',
      rtp_checklist: '++id, id_lesion',
      test_psicologico: '++id, id_jugadora, fecha',
      plantillas_importacion: '++id, nombre, tipoImportacion, esPredeterminada'
    })

    // Versión 12.0 - Fase 5 (CMJ y Fuerza)
    this.version(12).stores({
      protocolos_cmj: 'id_protocolo, activo',
      pruebas_cmj: 'id_medicion, id_jugadora, fecha, id_protocolo, [id_jugadora+fecha], [id_jugadora+id_protocolo+fecha]',
      ejercicios_fuerza: 'id_ejercicio, nombre_normalizado, activo',
      trabajos_fuerza: 'id_trabajo, id_sesion, id_jugadora, id_ejercicio, [id_sesion+id_jugadora], [id_jugadora+id_sesion]',
      plantillas_fuerza: 'id_plantilla, activa'
    }).upgrade(async (tx) => {
      await this.seedFase5(tx)
    })

    // Versión 13.0 - UI de Fuerza (Independizar sesiones individuales de fuerza)
    this.version(13).stores({
      sesiones_fuerza_individual: 'id_sesion_fuerza, id_jugadora, fecha, [id_jugadora+fecha], finalidad',
      trabajos_fuerza: 'id_trabajo, id_sesion, id_jugadora, id_ejercicio, [id_sesion+id_jugadora], [id_jugadora+id_sesion], id_sesion_fuerza'
    })

    // Versión 14.0 - Índices compuestos para readiness y rpe_partido
    // Justificación: consultas where({ id_jugadora, fecha }) en readiness
    // y where({ id_partido, id_jugadora }) en rpe_partido producían warnings Dexie
    // por ausencia de índice compuesto. Ver docs/CIERRE_T-01C-R_RECTIFICACION_V14.md
    // NOTA: sesion_rpe excluida — ninguna query productiva usa { id_jugadora, fecha }
    // compuesto sobre esa tabla; se conserva su esquema v13 sin añadir índice nuevo.
    this.version(14).stores({
      readiness:   '++id, [id_jugadora+fecha], id_jugadora, fecha',
      rpe_partido: '++id, [id_partido+id_jugadora], id_jugadora, id_partido, fecha'
    })

    // Versión 15.0 - Gobierno del dominio (Temporadas y Alias de Jugadora)
    // Justificación: T-02-DOM-GOV introduce entidades de gobierno del dominio para
    // segmentación por temporada y resolución explicita de alias externos.
    this.version(15).stores({
      temporadas:     'id_temporada, activa, fecha_inicio, fecha_fin',
      alias_jugadora: '++id_alias, [origen+valor], id_jugadora, origen, valor, activo'
    })

    // Versión 16.0 - Persistencia detallada de importaciones wellness diario/semanal
    this.version(16).stores({
      wellness_diario_importado: '++id, [id_jugadora+fecha], id_jugadora, fecha',
      wellness_semanal_importado: '++id, [id_jugadora+fecha], id_jugadora, fecha'
    })

    this.on('populate', async (tx) => {
      await this.seedFase5(tx)
    })
  }

  private async seedFase5(tx: any) {
    const existentes = await tx.table('protocolos_cmj').toArray()
    const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
    const stdName = 'CMJ bilateral — manos en caderas — protocolo estándar'
    const stdNorm = normalizar(stdName)

    const tieneStd = existentes.some((p: any) => normalizar(p.nombre) === stdNorm)

    if (!tieneStd) {
      const ahora = new Date().toISOString()
      await tx.table('protocolos_cmj').add({
        id_protocolo: 'cmj-std',
        nombre: stdName,
        descripcion: 'Protocolo estándar inicial de saltos verticales.',
        activo: true,
        createdAt: ahora,
        updatedAt: ahora
      })
    }
  }
}

export const db = new FutsalDB()
