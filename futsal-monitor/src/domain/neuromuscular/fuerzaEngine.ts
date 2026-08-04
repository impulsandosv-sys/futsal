import type { TrabajoFuerzaIndividual, Sesion, EjercicioFuerza, SesionFuerzaIndividual, FinalidadSesionFuerza, PlantillaFuerza } from '@/types'

export const FINALIDADES_FUERZA: FinalidadSesionFuerza[] = [
  'fuerza_maxima',
  'hipertrofia',
  'potencia',
  'mantenimiento',
  'prevencion',
  'readaptacion',
  'otro',
]

export function getFinalidadLabel(finalidad: FinalidadSesionFuerza): string {
  switch (finalidad) {
    case 'fuerza_maxima':
      return 'Fuerza Máxima'
    case 'hipertrofia':
      return 'Hipertrofia'
    case 'potencia':
      return 'Potencia'
    case 'mantenimiento':
      return 'Mantenimiento'
    case 'prevencion':
      return 'Prevención'
    case 'readaptacion':
      return 'Readaptación'
    case 'otro':
      return 'Otro'
    default:
      return finalidad
  }
}

export function esSesionFuerza(sesion: Sesion): boolean {
  return sesion.tipo_sesion === 'Gimnasio'
}

export interface ResumenSesionFuerza {
  ejerciciosCount: number
  seriesCount: number
  totalTonelaje: number
  hayCuantificable: boolean
  hayNoCuantificable: boolean
  tonelajeLabel: string
}

export function calcularResumenSesionFuerza(sessionTrabajos: TrabajoFuerzaIndividual[]): ResumenSesionFuerza {
  let totalSeries = 0
  let totalTonelaje = 0
  let hayCuantificable = false
  let hayNoCuantificable = false

  sessionTrabajos.forEach((t) => {
    if (t.estado === 'no_realizado') return
    if (!t.realizado || t.realizado.length === 0) {
      hayNoCuantificable = true
      return
    }
    t.realizado.forEach((serie) => {
      totalSeries++
      if (serie.repeticiones != null && serie.carga_kg != null) {
        totalTonelaje += serie.repeticiones * serie.carga_kg
        hayCuantificable = true
      } else {
        hayNoCuantificable = true
      }
    })
  })

  let tonelajeLabel = '—'
  if (hayCuantificable) {
    if (hayNoCuantificable) {
      tonelajeLabel = `Tonelaje parcial (${totalTonelaje.toLocaleString()} kg)`
    } else {
      tonelajeLabel = `${totalTonelaje.toLocaleString()} kg`
    }
  }

  return {
    ejerciciosCount: sessionTrabajos.length,
    seriesCount: totalSeries,
    totalTonelaje,
    hayCuantificable,
    hayNoCuantificable,
    tonelajeLabel,
  }
}

export function calcularVolumenTrabajoFuerza(trabajo: TrabajoFuerzaIndividual): number | null {
  if (trabajo.estado === 'no_realizado') return null
  
  if (!trabajo.realizado || trabajo.realizado.length === 0) return null

  let totalVolumen = 0
  let calculable = false

  for (const serie of trabajo.realizado) {
    if (serie.repeticiones != null && serie.carga_kg != null) {
      totalVolumen += (serie.repeticiones * serie.carga_kg)
      calculable = true
    } else {
      // Si una serie no tiene reps o kg, no podemos calcular el volumen total
      // Solo sumamos si todas las completadas son calculables. 
      // Por regla, si falta reps o kg, el tonelaje es null para esa serie.
      // Si el usuario quiere volumen 0, debe poner 0 kg.
    }
  }

  // Si hay alguna serie calculable, devolvemos el total. 
  // Si ninguna lo es (ej: bodyweight sin kg), devolvemos null
  return calculable ? totalVolumen : null
}

export function esNumeroFinitoValido(val: unknown): val is number {
  return typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val)
}

export function normalizarTextoObservacion(val: string | null | undefined): string | null {
  if (val == null) return null
  const trimmed = val.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function validarTrabajoFuerza(trabajo: TrabajoFuerzaIndividual): string[] {
  const errores: string[] = []

  if (trabajo.estado === 'completado') {
    const tieneRealizado = trabajo.realizado && trabajo.realizado.length > 0
    const tieneObservacion = trabajo.observacion_staff && trabajo.observacion_staff.trim().length > 0
    
    if (!tieneRealizado && !tieneObservacion) {
      errores.push('Trabajo completado requiere datos realizados o una observación')
    }
  }

  if (trabajo.realizado) {
    const ordenes = new Set<number>()
    for (const s of trabajo.realizado) {
      if (ordenes.has(s.orden)) errores.push(`Orden duplicado en serie: ${s.orden}`)
      ordenes.add(s.orden)

      if (s.repeticiones !== undefined && s.repeticiones !== null) {
        if (!esNumeroFinitoValido(s.repeticiones)) {
          errores.push(`Las repeticiones de la serie #${s.orden} deben ser un número finito válido`)
        } else if (s.repeticiones < 0) {
          errores.push(`Las repeticiones de la serie #${s.orden} no pueden ser negativas`)
        }
      }

      if (s.carga_kg !== undefined && s.carga_kg !== null) {
        if (!esNumeroFinitoValido(s.carga_kg)) {
          errores.push(`La carga de la serie #${s.orden} debe ser un número finito válido`)
        } else if (s.carga_kg < 0) {
          errores.push(`La carga de la serie #${s.orden} no puede ser negativa`)
        }
      }

      if (s.rpe_serie !== undefined && s.rpe_serie !== null) {
        if (!esNumeroFinitoValido(s.rpe_serie)) {
          errores.push(`El RPE de la serie #${s.orden} debe ser un número finito válido`)
        } else if (s.rpe_serie < 0 || s.rpe_serie > 10) {
          errores.push(`El RPE de la serie #${s.orden} debe estar entre 0 y 10`)
        }
      }
    }
  }

  return errores
}

export function normalizarNombreEjercicio(nombre: string): string {
  return nombre.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

export function validarEjercicioFuerza(ejercicio: Omit<EjercicioFuerza, 'createdAt' | 'updatedAt' | 'id_ejercicio'>, existentes: EjercicioFuerza[], omitirId?: string): string[] {
  const errores: string[] = []
  if (!ejercicio.nombre || ejercicio.nombre.trim() === '') {
    errores.push('El nombre del ejercicio es obligatorio')
  }
  
  const normalizado = normalizarNombreEjercicio(ejercicio.nombre)
  
  const duplicado = existentes.find(e => 
    e.activo && 
    e.nombre_normalizado === normalizado && 
    e.id_ejercicio !== omitirId
  )
  
  if (duplicado) {
    errores.push(`Ya existe un ejercicio activo similar: ${duplicado.nombre}`)
  }
  
  return errores
}

export function validarSesionFuerzaIndividual(sesion: Omit<SesionFuerzaIndividual, 'createdAt' | 'updatedAt' | 'id_sesion_fuerza'>): string[] {
  const errores: string[] = []
  
  if (!sesion.id_jugadora || sesion.id_jugadora.trim() === '') {
    errores.push('El identificador de la jugadora es obligatorio')
  }

  if (!sesion.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(sesion.fecha)) {
    errores.push('La fecha debe estar en formato YYYY-MM-DD local')
  } else {
    const d = new Date(sesion.fecha)
    if (Number.isNaN(d.getTime()) || sesion.fecha !== d.toISOString().split('T')[0]) {
      errores.push('La fecha proporcionada no es una fecha local válida')
    }
  }

  if (sesion.rpe_sesion !== undefined && sesion.rpe_sesion !== null) {
    if (!esNumeroFinitoValido(sesion.rpe_sesion)) {
      errores.push('El sRPE debe ser un número finito válido')
    } else if (sesion.rpe_sesion < 0 || sesion.rpe_sesion > 10) {
      errores.push('El sRPE debe estar entre 0 y 10')
    }
  }

  if (sesion.duracion_min !== undefined && sesion.duracion_min !== null) {
    if (!esNumeroFinitoValido(sesion.duracion_min)) {
      errores.push('La duración en minutos debe ser un número finito válido')
    } else if (sesion.duracion_min <= 0) {
      errores.push('La duración en minutos debe ser mayor que 0')
    }
  }

  return errores
}

export function validarNuevoTrabajoFuerzaV13(trabajo: TrabajoFuerzaIndividual): string[] {
  const errores = validarTrabajoFuerza(trabajo)
  
  if (!trabajo.id_sesion_fuerza || trabajo.id_sesion_fuerza.trim() === '') {
    errores.push('Toda nueva escritura de trabajo de fuerza requiere id_sesion_fuerza')
  }

  if (!trabajo.ejercicio_nombre_historico || trabajo.ejercicio_nombre_historico.trim() === '') {
    errores.push('El nombre histórico del ejercicio es obligatorio para preservar el snapshot')
  }

  return errores
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloque 5.1: Dominio de Plantillas de Fuerza — conversión pura a borrador
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Borrador en memoria generado al aplicar una plantilla.
 * NUNCA se persiste directamente en Dexie.
 *
 * Solo `origen`, `sesion` y `trabajos` pueden alimentar el payload de guardado.
 * `referenciaPlantilla` es exclusivamente de lectura visual bajo la etiqueta:
 *   "Propuesta de plantilla — no registrada como ejecución"
 */
export interface BorradorSesionFuerza {
  origen: {
    id_plantilla_fuerza_origen: string
    nombre_plantilla: string
  }
  sesion: {
    id_jugadora: string
    fecha: string
    finalidad: FinalidadSesionFuerza | null
    rpe_sesion: null
    duracion_min: null
    observacion_staff: null
  }
  trabajos: Array<{
    id_ejercicio: string
    ejercicio_nombre_historico: string
    observacion_staff: ''
    series: Array<{
      orden: number
      repeticiones: ''
      carga_kg: ''
      rpe_serie: ''
      observacion: ''
    }>
  }>
  referenciaPlantilla: Array<{
    id_ejercicio: string
    ejercicio_nombre_historico: string
    series_propuestas: number | null
    repeticiones_propuestas: number | null
    carga_kg_propuesta: number | null
    rpe_objetivo: number | null
    observacion_propuesta: string | null
    ejercicio_inactivo: boolean
  }>
}

/** Único tipo que puede pasarse al formulario y llegar al payload de guardado */
export type BorradorEjecutable = Pick<BorradorSesionFuerza, 'origen' | 'sesion' | 'trabajos'>

/** Referencia de solo lectura, pasa únicamente a la UI de visualización */
export type ReferenciaPlantilla = BorradorSesionFuerza['referenciaPlantilla']

/**
 * Convierte una PlantillaFuerza en un BorradorSesionFuerza en memoria.
 *
 * Garantías absolutas:
 * - Sin Dexie, store, React, rutas.
 * - Sin fecha automática, IDs persistibles, timestamps ni estado de ejecución.
 * - No muta `plantilla` ni `ejerciciosCatalogo`.
 * - trabajos[i].series tiene exactamente max(series_propuestas ?? 1, 1) filas vacías.
 * - Ningún campo de objetivo acaba en un campo de ejecución real.
 * - referenciaPlantilla contiene los objetivos propuestos solo para visualización.
 */
export function plantillaToBorrador(
  plantilla: PlantillaFuerza,
  ejerciciosCatalogo: EjercicioFuerza[]
): BorradorSesionFuerza {
  const trabajos: BorradorSesionFuerza['trabajos'] = []
  const referenciaPlantilla: BorradorSesionFuerza['referenciaPlantilla'] = []

  for (const ej of plantilla.ejercicios) {
    // Resolución de nombre histórico
    const catEj = ejerciciosCatalogo.find((e) => e.id_ejercicio === ej.id_ejercicio)
    const nombreHistorico = catEj?.nombre ?? ej.ejercicio_nombre_historico ?? '[Ejercicio eliminado]'
    const ejercicioInactivo = catEj != null ? !catEj.activo : true

    // N filas vacías: max(series_propuestas ?? 1, 1)
    const numSeries = Math.max((ej.series_propuestas ?? 1) || 1, 1)
    const series: BorradorSesionFuerza['trabajos'][number]['series'] = Array.from(
      { length: numSeries },
      (_, i) => ({
        orden: i + 1,
        repeticiones: '' as const,
        carga_kg: '' as const,
        rpe_serie: '' as const,
        observacion: '' as const,
      })
    )

    trabajos.push({
      id_ejercicio: ej.id_ejercicio,
      ejercicio_nombre_historico: nombreHistorico,
      observacion_staff: '' as const,
      series,
    })

    referenciaPlantilla.push({
      id_ejercicio: ej.id_ejercicio,
      ejercicio_nombre_historico: nombreHistorico,
      series_propuestas: ej.series_propuestas ?? null,
      repeticiones_propuestas: ej.repeticiones_propuestas ?? null,
      carga_kg_propuesta: ej.carga_kg_propuesta ?? null,
      rpe_objetivo: ej.rpe_objetivo ?? null,
      observacion_propuesta: ej.observacion_propuesta ?? null,
      ejercicio_inactivo: ejercicioInactivo,
    })
  }

  return {
    origen: {
      id_plantilla_fuerza_origen: plantilla.id_plantilla,
      nombre_plantilla: plantilla.nombre,
    },
    sesion: {
      id_jugadora: '',
      fecha: '',
      finalidad: plantilla.finalidad ?? null,
      rpe_sesion: null,
      duracion_min: null,
      observacion_staff: null,
    },
    trabajos,
    referenciaPlantilla,
  }
}

