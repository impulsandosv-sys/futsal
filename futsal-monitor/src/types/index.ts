export type Posicion = 'Portera' | 'Cierre' | 'Ala' | 'Pivot' | 'Universal'
export type TipoDia = 'Entreno' | 'Partido' | 'Descanso' | 'Viaje'
export type TipoSesion = 'Fisico' | 'Tecnico' | 'Tactico' | 'Partido' | 'Recuperacion' | 'Preventivo' | 'Gimnasio' | 'Pista' | 'Readaptacion' | 'Compensatorio'
export type Disponibilidad = 'Disponible' | 'Lesionada' | 'Readaptacion' | 'Carga_Gestionada' | 'Descanso'
export type FaseRTP = 'N/A' | 'Fase_1_Reposo' | 'Fase_2_Movilidad' | 'Fase_3_Fuerza' | 'Fase_4_Reentreno' | 'Fase_5_Alta_Competitiva'

export interface Jugadora {
  id_jugadora: string
  nombre: string
  fecha_nacimiento: string
  posicion: Posicion
  altura_cm: number
  peso_kg: number
  imc: number
  grasa: number
  anos_experiencia_futsal: number
  historial_lesional: string
  notas: string
  activa: boolean
}

export interface FormularioRespuesta {
  id?: number
  marca_temporal: string
  id_jugadora: string
  fecha: string
  calidad_sueno: number
  fatiga: number
  dolor_muscular: number
  estres: number
  estado_animo: number
  dolor_especifico: string
}

export interface Wellness {
  id?: number
  id_jugadora: string
  fecha: string
  calidad_sueno: number
  fatiga: number
  dolor_muscular: number
  estres: number
  estado_animo: number
  dolor_especifico: string
  score_wellness: number
  id_temporada?: string
  origen_alias?: OrigenAlias
  alias_origen?: string
}

export interface WellnessPreguntaValor {
  original: number | null
  normalizado: number | null
}

export interface WellnessDiarioImportado {
  id?: number
  id_jugadora: string
  fecha: string
  id_temporada?: string
  origen_alias?: OrigenAlias
  alias_origen?: string
  metricas: Record<string, WellnessPreguntaValor>
  textos: Record<string, string>
  indice_diario: number | null
}

export interface WellnessSemanalImportado {
  id?: number
  id_jugadora: string
  fecha: string
  id_temporada?: string
  origen_alias?: OrigenAlias
  alias_origen?: string
  metricas: Record<string, WellnessPreguntaValor>
  textos: Record<string, string>
  indice_semanal: number | null
}

export interface Sesion {
  id_sesion: string
  fecha: string
  tipo_dia: TipoDia
  tipo_sesion: TipoSesion
  duracion_min?: number
  objetivo_principal: string
  observaciones_grupo: string
  estado?: 'planificada' | 'realizada' | 'cancelada'
  duracion_planificada_min?: number
  duracion_real_grupal_min?: number
  participantes_previstos?: number
  sesion_origen_id?: string
  id_partido?: string
  rpe_objetivo?: number
}

export interface Partido {
  id_partido: string
  fecha: string
  rival: string
  competicion: string
  resultado: string
  lugar: 'Local' | 'Visitante' | 'Neutral'
}

export interface Lesion {
  id_lesion: string
  id_jugadora: string
  fecha_inicio: string
  fecha_fin: string
  tipo: string
  localizacion: string
  mecanismo: string
  severidad_dias_baja: number
  disponibilidad: Disponibilidad
  comentario_fisio_medico: string
  fase_rtp: FaseRTP
  disponible: boolean
}

export interface TestFisico {
  id?: number
  fecha: string
  momento: string
  id_jugadora: string
  test: string
  resultado: number
  unidad: string
  notas: string
}

export type ParticipacionPartido = 'no_convocada' | 'convocada_sin_minutos' | 'parcial' | 'completa' | 'modificada'

export interface RPE_Partido {
  id?: number
  id_partido: string
  id_jugadora: string
  minutos_jugados?: number | null
  minutos_rotacion?: number | null
  rpe?: number | null
  fecha: string
  carga_ua?: number | null
  participacion?: ParticipacionPartido
  participacion_inferida?: boolean
  motivo_participacion_reducida?: string
  comentario_staff?: string
}

export type AsistenciaJugadora = 'completa' | 'parcial' | 'ausente' | 'no_convocada' | 'excusada' | 'sin_registrar'

export interface SesionRPE {
  id?: number
  id_sesion: string
  id_jugadora: string
  rpe?: number | null
  duracion_min?: number | null
  carga_ua?: number | null
  fecha: string
  monotonia?: number
  strain?: number
  asistencia?: AsistenciaJugadora
  participacion?: 'completa' | 'parcial' | 'no_participa'
  motivo_participacion_reducida?: string
  comentario_staff?: string
  fuente?: 'manual' | 'importado'
}

export interface MonotonyStrain {
  monotonia: number
  strain: number
  carga_semanal_media: number
  carga_semanal_std: number
}

export type ReadinessNivel = 'verde' | 'ambar' | 'rojo'

export interface ReadinessInput {
  id_jugadora: string
  fecha: string
  wellness: Wellness | null
  acwr: number
  cargaAguda: number
  cargaCronica: number
  diasDesdeWellness: number
}

export interface Readiness {
  id?: number
  id_jugadora: string
  fecha: string
  nivel: ReadinessNivel
  score: number
  factores: {
    wellness: number
    acwr: number
    carga_aguda: number
    carga_cronica: number
    dias_desde_ultimo_wellness: number
  }
  creada: string
}

export interface ResumenSemanal {
  id?: number
  semana: string
  id_jugadora: string
  carga_entreno: number
  carga_partido: number
  carga_total: number
  carga_cronica: number
  acwr: number
  estado: string
  num_sesiones: number
  wellness_medio: number
}

export type AlertaTipo = 'wellness_bajo' | 'carga_alta' | 'lesion' | 'readaptacion' | 'datos_faltantes' | 'MENSTRUACION_PROXIMA_ESTIMADA'
export type AlertaEstado = 'abierta' | 'en_revision' | 'resuelta' | 'descartada'
export type AlertaPrioridad = 'bajo' | 'medio' | 'alto'

export interface Alerta {
  id?: number
  tipo: AlertaTipo
  prioridad: AlertaPrioridad
  id_jugadora: string
  fecha: string
  mensaje: string
  nivel: 'bajo' | 'medio' | 'alto'
  leida: boolean
  creada: string
  fecha_creacion: string
  fecha_resolucion?: string
  origen: string
  datos_sustento: string
  estado: AlertaEstado
  responsable: string
  nota_decision: string
  sugerencia: string
}

export interface FiltersState {
  id_jugadora: string
  fecha_desde: string
  fecha_hasta: string
  semana: string
  tipo_sesion: TipoSesion | ''
  estado: Disponibilidad | ''
  incluirPartidos?: boolean
  incluirGimnasio?: boolean
  incluirReadaptacion?: boolean
}

export type TipoImportacion = 'wellness' | 'sesion_rpe' | 'lesiones' | 'partidos' | 'tests'

export type ImportacionEstado = 'completada' | 'parcial' | 'cancelada' | 'error'

export type RawCellValue = string | number | boolean | Date | null | undefined
export type RawImportRow = Record<string, RawCellValue>

export interface ColumnMapping {
  internalField: string
  excelHeader: string | null
  required: boolean
  label: string
}

export interface PlantillaImportacion {
  id?: number
  nombre: string
  tipoImportacion: 'wellness'
  mapeoColumnas: ColumnMapping[]
  creadaEn: string
  actualizadaEn: string
  esPredeterminada: boolean
}

export interface MappedWellnessRow {
  id_jugadora: string
  alias_origen?: string
  id_temporada?: string
  fecha: string
  calidad_sueno: number | null
  fatiga: number | null
  dolor_muscular: number | null
  estres: number | null
  estado_animo: number | null
  dolor_especifico: string | null
  comentario_sesion: string | null
  marca_temporal?: string | null
  metodo_resolucion_identidad?: string

  // Semanal
  recuperacion_semana?: number | null
  sueno_semana?: number | null
  estres_fuera?: number | null
  energia_semana?: number | null
  animo_semana?: number | null
  preparada_semana?: number | null
  sintomas_menstruales?: number | null
  dolor_sn?: boolean | null
  dolor_texto_semana?: string | null
  actividad_sn?: boolean | null
  actividad_texto_semana?: string | null
}

export type TipoIncidenciaImportacion =
  | 'sin_incidencia'
  | 'jugadora_no_resuelta'
  | 'alias_ambiguo'
  | 'fecha_invalida'
  | 'formato_invalido'
  | 'temporada_no_activa'
  | 'duplicado_existente'
  | 'duplicado_interno_identico'
  | 'conflicto_interno'
  | 'actualizacion_posible'
  | 'omitida_manual'


export interface PreviewRow {
  filaOriginal: number
  estado: 'NUEVO' | 'ACTUALIZACION_POSIBLE' | 'DUPLICADO_IDENTICO' | 'ERROR' | 'OMITIDA'
  tipo_incidencia?: TipoIncidenciaImportacion
  id_jugadora: string
  alias_origen?: string
  id_temporada?: string
  nombreJugadora: string
  fecha: string
  calidad_sueno: number | null
  fatiga: number | null
  dolor_muscular: number | null
  estres: number | null
  estado_animo: number | null
  dolor_especifico: string | null
  comentario_sesion?: string | null
  // Semanal
  recuperacion_semana?: number | null
  sueno_semana?: number | null
  estres_fuera?: number | null
  energia_semana?: number | null
  animo_semana?: number | null
  preparada_semana?: number | null
  sintomas_menstruales?: number | null
  dolor_sn?: boolean | null
  dolor_texto_semana?: string | null
  actividad_sn?: boolean | null
  actividad_texto_semana?: string | null
  mensaje: string
  metodo_resolucion_identidad?: string
  rowOriginal: RawImportRow
  normalRow?: MappedWellnessRow
}

export type ImportStrategy = 'omit' | 'update' | 'cancel'

export interface ImportOutcome {
  success: boolean
  inserted: number
  updated: number
  skipped: number
  errors: number
  nuevos_aliases?: number
  idImportacion?: number
  recalculoExitoso: boolean
}

export interface HistorialImportacion {
  id?: number
  fechaHora: string
  nombreArchivo: string
  tipoImportacion: TipoImportacion | string
  totalFilas: number
  registrosNuevos: number
  registrosActualizados: number
  registrosOmitidos: number
  registrosErroneos: number
  detalleErrores: string[]
  estrategiaDuplicadosElegida: string
  nombreBackupPrevio: string
  versionEsquema: number
  estado: ImportacionEstado
  hojaSeleccionada?: string
  plantillaMapeo?: string
  derivadosPendientes?: boolean
}

export type TipoCopia = 'manual' | 'previo_importacion' | 'previo_restauracion' | 'exportacion' | 'restauracion'

export interface HistorialCopia {
  id?: number
  fechaHora: string
  tipo: TipoCopia
  nombreArchivo: string
  entidadesIncluidas: string[]
  recuentoPorEntidad: Record<string, number>
  versionEsquema: number
  checksum?: string
  confirmadaExterna: boolean
  fechaConfirmacionExterna?: string
}

export type FaseMenstrual = 'Menstruacion' | 'Folicular' | 'Ovulacion' | 'Lutea'

export interface CicloMenstrual {
  id?: number
  id_jugadora: string
  fecha: string
  fase: FaseMenstrual
  sintomas: string
  notas: string
}

export interface RegistroMenstrual {
  id?: number
  id_jugadora: string
  fecha_inicio: string // ISO local: YYYY-MM-DD
  impacto_percibido: number // entero de 0 a 10
  comentario?: string | null
  nota_ajuste?: string | null
  creado_en: string
  actualizado_en: string
}

export interface CargaGPS {
  id?: number
  id_jugadora: string
  fecha: string
  id_sesion?: string
  id_partido?: string
  distancia_total: number
  distancia_hsr: number
  aceleraciones: number
  deceleraciones: number
  player_load: number
}

export interface FuerzaVBT {
  id?: number
  id_jugadora: string
  fecha: string
  ejercicio: string
  carga_kg: number
  velocidad_media: number
  velocidad_pico: number
  perdida_velocidad: number
}

export interface Hidratacion {
  id?: number
  id_jugadora: string
  fecha: string
  peso_pre: number
  peso_post: number
  liquido_ingerido_ml: number
  tasa_sudoracion: number
}

export interface RTPChecklist {
  id?: number
  id_lesion: string
  fase_1_dolor_controlado: boolean
  fase_2_rango_movimiento: boolean
  fase_3_fuerza_simetrica: boolean
  fase_4_carrera_lineal: boolean
  fase_5_cambios_direccion: boolean
  fase_6_contacto_completo: boolean
}

export interface TestPsicologico {
  id?: number
  id_jugadora: string
  fecha: string
  tension: number
  depresion: number
  ira: number
  vigor: number
  fatiga_mental: number
  confusion: number
  notas: string
}

export type EstadoRespuestaWellness = 'respondió' | 'pendiente' | 'incompleto'

export type NivelSeguimiento =
  | 'revision_prioritaria'
  | 'revisar_hoy'
  | 'seguimiento_semana'
  | 'rutinario'

export type EstadoCalidadDatos =
  | 'suficiente'
  | 'historial_insuficiente'
  | 'wellness_pendiente'
  | 'wellness_incompleto'
  | 'derivados_pendientes'
  | 'rpe_pendiente'

export interface MotivoSeguimiento {
  categoria: NivelSeguimiento
  mensaje: string
}

export interface ReferenciaIndividual {
  jugadoraId: string
  registrosValidos: number
  valoresReferencia: {
    calidad_sueno: number
    fatiga: number
    dolor_muscular: number
    estres: number
    estado_animo: number
    score_wellness: number
  }
  desviacionesEstandar: {
    calidad_sueno: number
    fatiga: number
    dolor_muscular: number
    estres: number
    estado_animo: number
    score_wellness: number
  }
  variabilidadBaja: boolean
}

export interface PanelHoyJugadora {
  id_jugadora: string
  nombre: string
  posicion: string
  disponibilidad: string // 'Disponible' | 'No disponible' | 'Lesión activa'
  estadoWellness: EstadoRespuestaWellness
  wellnessActual: Wellness | null
  referencia: ReferenciaIndividual | null
  prioridad: NivelSeguimiento
  calidadDatos: EstadoCalidadDatos[]
  motivos: MotivoSeguimiento[]
  adherencia7d: { fraccion: string; porcentaje: number; nota?: string }
  adherencia28d: { fraccion: string; porcentaje: number; nota?: string }
  datosPendientes: boolean
  derivadosPendientes: boolean
}

export interface PanelHoyResumen {
  fechaOperativa: string
  totalJugadoras: number
  pendientesWellness: number
  revisionPrioritariaCount: number
  revisarHoyCount: number
  datosPendientesCount: number
}

// ============================================================================
// Tipos para Rendimiento Neuromuscular (CMJ) y Fuerza (Fase 5)
// ============================================================================

export interface ProtocoloCMJ {
  id_protocolo: string
  nombre: string
  descripcion?: string | null
  activo: boolean
  createdAt: string
  updatedAt: string
}

export interface IntentoCMJ {
  id_intento: string
  orden: number
  valido: boolean
  altura_cm?: number | null
  tiempo_vuelo_ms?: number | null
  motivo_no_valido?: string | null
}

export interface MedicionCMJ {
  id_medicion: string
  id_jugadora: string
  fecha: string
  tipo_prueba: 'cmj_bilateral'
  id_protocolo: string
  protocolo_nombre_historico: string
  finalidad?: 'control' | 'pre_sesion' | 'post_sesion' | 'retest' | 'otro'
  intentos: IntentoCMJ[]
  mejor_intento_valido_id?: string | null
  altura_mejor_cm?: number | null
  tiempo_vuelo_mejor_ms?: number | null
  observacion_staff?: string | null
  fuente: 'manual' | 'chronojump_csv_futuro'
  createdAt: string
  updatedAt: string
}

export type CategoriaEjercicioFuerza =
  | 'sentadilla'
  | 'bisagra_cadera'
  | 'unilateral_rodilla'
  | 'empuje'
  | 'traccion'
  | 'gemelo'
  | 'core'
  | 'aductor'
  | 'isquios'
  | 'pliometria'
  | 'movilidad'
  | 'otro'

export interface EjercicioFuerza {
  id_ejercicio: string
  nombre: string
  nombre_normalizado: string
  categoria: CategoriaEjercicioFuerza
  activo: boolean
  notas?: string | null
  createdAt: string
  updatedAt: string
}

export interface SerieFuerzaRealizada {
  id_serie: string
  orden: number
  repeticiones?: number | null
  carga_kg?: number | null
  rpe_serie?: number | null
  observacion?: string | null
}

export type FinalidadSesionFuerza =
  | 'fuerza_maxima'
  | 'hipertrofia'
  | 'potencia'
  | 'mantenimiento'
  | 'prevencion'
  | 'readaptacion'
  | 'otro'

export interface SesionFuerzaIndividual {
  id_sesion_fuerza: string
  id_jugadora: string
  fecha: string
  finalidad?: FinalidadSesionFuerza | null
  rpe_sesion?: number | null
  duracion_min?: number | null
  observacion_staff?: string | null
  id_plantilla_fuerza_origen?: string | null
  createdAt: string
  updatedAt: string
}

export interface TrabajoFuerzaIndividual {
  id_trabajo: string
  id_sesion_fuerza?: string // Obligatorio para nuevas escrituras (v13+)
  id_sesion?: string // Opcional y legado para datos previos a v13
  id_jugadora: string
  id_ejercicio: string
  ejercicio_nombre_historico: string
  planificado?: {
    series?: number | null
    repeticiones?: number | null
    carga_kg?: number | null
    rpe_objetivo?: number | null
  } | null
  realizado?: SerieFuerzaRealizada[] | null
  estado: 'planificado' | 'parcial' | 'completado' | 'no_realizado'
  observacion_staff?: string | null
  updatedAt: string
}

export interface EjercicioPropuestoPlantilla {
  id_ejercicio: string
  ejercicio_nombre_historico?: string
  series_propuestas?: number | null
  repeticiones_propuestas?: number | null
  carga_kg_propuesta?: number | null
  rpe_objetivo?: number | null
  observacion_propuesta?: string | null
}

export interface PlantillaFuerza {
  id_plantilla: string
  nombre: string
  finalidad?: FinalidadSesionFuerza | null
  descripcion?: string | null
  activa: boolean
  ejercicios: EjercicioPropuestoPlantilla[]
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Tipos de Gobierno del Dominio (T-02-DOM-GOV)
// ============================================================================

export type FechaLocalISO = string // Formato estricto YYYY-MM-DD sin componente de tiempo/UTC

export interface Temporada {
  id_temporada: string
  nombre: string
  fecha_inicio: string
  fecha_fin: string
  activa: boolean
  notas?: string
}

export type OrigenAlias = 'google_forms' | 'chronojump' | 'manual' | 'otro' | 'wellness'

export interface AliasJugadora {
  id_alias?: number
  id_jugadora: string
  origen: OrigenAlias
  valor: string
  activo: boolean
  fecha_alta: string
  fecha_baja?: string
  notas?: string
}

export interface CompensacionPostPartido {
  id?: number
  id_partido: string
  id_jugadora: string
  minutos_objetivo?: number | null
  deficit_minutos?: number | null
  estado: 'pendiente' | 'planificada' | 'realizada' | 'omitida'
  id_sesion?: string | null
  tipo_compensacion?: string | null
  observaciones?: string | null
  created_at: string
  updated_at: string
}
