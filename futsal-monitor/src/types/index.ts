export type Posicion = 'Portera' | 'Cierre' | 'Ala' | 'Pivot' | 'Universal'
export type TipoDia = 'Entreno' | 'Partido' | 'Descanso' | 'Viaje'
export type TipoSesion = 'Fisico' | 'Tecnico' | 'Tactico' | 'Partido' | 'Recuperacion' | 'Preventivo' | 'Gimnasio'
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
}

export interface Sesion {
  id_sesion: string
  fecha: string
  tipo_dia: TipoDia
  tipo_sesion: TipoSesion
  duracion_min: number
  objetivo_principal: string
  observaciones_grupo: string
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

export interface RPE_Entreno {
  id?: number
  id_sesion: string
  id_jugadora: string
  rpe: number
  duracion_min: number
  fecha: string
  carga_ua: number
}

export interface RPE_Partido {
  id?: number
  id_partido: string
  id_jugadora: string
  minutos_jugados: number
  rpe: number
  fecha: string
  carga_ua: number
}

export interface SesionRPE {
  id?: number
  id_sesion: string
  id_jugadora: string
  rpe: number
  duracion_min: number
  carga_ua: number
  fecha: string
  monotonia?: number
  strain?: number
}

export interface MonotonyStrain {
  monotonia: number
  strain: number
  carga_semanal_media: number
  carga_semanal_std: number
}

export type ReadinessNivel = 'verde' | 'ambar' | 'rojo'

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

export type AlertaTipo = 'wellness_bajo' | 'carga_alta' | 'lesion' | 'readaptacion' | 'datos_faltantes'

export interface Alerta {
  id?: number
  tipo: AlertaTipo
  id_jugadora: string
  fecha: string
  mensaje: string
  nivel: 'bajo' | 'medio' | 'alto'
  leida: boolean
  creada: string
}

export interface FiltersState {
  id_jugadora: string
  fecha_desde: string
  fecha_hasta: string
  semana: string
  tipo_sesion: TipoSesion | ''
  estado: Disponibilidad | ''
}
