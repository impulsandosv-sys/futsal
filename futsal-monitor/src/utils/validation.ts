import type { Jugadora, Wellness, Sesion, Partido, Lesion, TestFisico, RPE_Partido, SesionRPE } from '@/types'

export interface ValidationError {
  field: string
  message: string
}

export function validateIdUnico(id: string, existingIds: string[]): ValidationError | null {
  const trimmed = id.trim().toUpperCase()
  if (!trimmed) return { field: 'id', message: 'El ID es obligatorio' }
  if (trimmed.length < 2 || trimmed.length > 10) return { field: 'id', message: 'El ID debe tener entre 2 y 10 caracteres' }
  if (!/^[A-Z0-9_-]+$/i.test(trimmed)) return { field: 'id', message: 'El ID solo puede contener letras, números, guiones o guiones bajos' }
  if (existingIds.includes(trimmed)) return { field: 'id', message: `El ID "${trimmed}" ya existe` }
  return null
}

export function validateRange(value: number, min: number, max: number, fieldName: string): ValidationError | null {
  if (isNaN(value)) return { field: fieldName, message: `${fieldName} debe ser un número` }
  if (value < min || value > max) return { field: fieldName, message: `${fieldName} debe estar entre ${min} y ${max}` }
  return null
}

export function validateWellness(w: Omit<Wellness, 'score_wellness' | 'id'>): ValidationError[] {
  const errors: ValidationError[] = []
  if (!w.id_jugadora) errors.push({ field: 'id_jugadora', message: 'Selecciona una jugadora' })
  if (!w.fecha) errors.push({ field: 'fecha', message: 'La fecha es obligatoria' })

  const ranges = [
    { key: 'calidad_sueno', label: 'Calidad de sueño', value: w.calidad_sueno },
    { key: 'fatiga', label: 'Fatiga', value: w.fatiga },
    { key: 'dolor_muscular', label: 'Dolor muscular', value: w.dolor_muscular },
    { key: 'estres', label: 'Estrés', value: w.estres },
    { key: 'estado_animo', label: 'Estado de ánimo', value: w.estado_animo },
  ]
  for (const r of ranges) {
    if (r.value === undefined || r.value === null || r.value === '' as any || isNaN(r.value)) {
      continue
    }
    const err = validateRange(r.value, 1, 10, r.key)
    if (err) {
      err.message = `${r.label} debe estar entre 1 y 10`
      errors.push(err)
    } else if (!Number.isInteger(r.value)) {
      errors.push({ field: r.key, message: `${r.label} debe ser un número entero` })
    }
  }
  return errors
}

export function validateJugadora(j: Jugadora, existingIds: string[], editingId?: string): ValidationError[] {
  const errors: ValidationError[] = []
  if (!j.nombre.trim()) errors.push({ field: 'nombre', message: 'El nombre es obligatorio' })

  const idsToCheck = editingId ? existingIds.filter((id) => id !== editingId) : existingIds
  const idErr = validateIdUnico(j.id_jugadora, idsToCheck)
  if (idErr) errors.push(idErr)

  if (j.altura_cm < 100 || j.altura_cm > 220) errors.push({ field: 'altura_cm', message: 'Altura fuera de rango (100-220 cm)' })
  if (j.peso_kg < 30 || j.peso_kg > 120) errors.push({ field: 'peso_kg', message: 'Peso fuera de rango (30-120 kg)' })
  if (j.grasa < 0 || j.grasa > 50) errors.push({ field: 'grasa', message: '% grasa fuera de rango (0-50%)' })
  if (j.anos_experiencia_futsal < 0 || j.anos_experiencia_futsal > 30) errors.push({ field: 'anos_experiencia_futsal', message: 'Años de experiencia fuera de rango' })
  return errors
}

export function validateSesion(s: Sesion): ValidationError[] {
  const errors: ValidationError[] = []
  if (!s.id_sesion || !s.id_sesion.trim()) {
    errors.push({ field: 'id_sesion', message: 'El ID de la sesión es obligatorio' })
  }
  if (!s.fecha) {
    errors.push({ field: 'fecha', message: 'La fecha de la sesión es obligatoria' })
  }
  if (s.tipo_sesion === 'Partido' && (!s.id_partido || !s.id_partido.trim())) {
    errors.push({ field: 'id_partido', message: 'Una sesión de tipo Partido requiere un partido vinculado' })
  }

  const hasPlanificada = s.duracion_planificada_min !== undefined && s.duracion_planificada_min !== null
  const hasReal = s.duracion_real_grupal_min !== undefined && s.duracion_real_grupal_min !== null
  const hasHistorica = s.duracion_min !== undefined && s.duracion_min !== null

  if (!hasPlanificada && !hasReal && !hasHistorica) {
    errors.push({ field: 'duracion', message: 'Debe especificar al menos una duración' })
  }

  if (hasHistorica && (s.duracion_min! < 5 || s.duracion_min! > 300)) errors.push({ field: 'duracion_min', message: 'Duración histórica fuera de rango (5-300 min)' })
  if (hasPlanificada && (s.duracion_planificada_min! < 5 || s.duracion_planificada_min! > 300)) errors.push({ field: 'duracion_planificada_min', message: 'Duración planificada fuera de rango (5-300 min)' })
  if (hasReal && (s.duracion_real_grupal_min! < 5 || s.duracion_real_grupal_min! > 300)) errors.push({ field: 'duracion_real_grupal_min', message: 'Duración real fuera de rango (5-300 min)' })

  return errors
}

export function validatePartido(p: Partido): ValidationError[] {
  const errors: ValidationError[] = []
  if (!p.id_partido.trim()) errors.push({ field: 'id_partido', message: 'El ID de partido es obligatorio' })
  if (!p.fecha) errors.push({ field: 'fecha', message: 'La fecha es obligatoria' })
  if (!p.rival.trim()) errors.push({ field: 'rival', message: 'El rival es obligatorio' })
  return errors
}

export function validateLesion(l: Lesion): ValidationError[] {
  const errors: ValidationError[] = []
  if (!l.id_lesion.trim()) errors.push({ field: 'id_lesion', message: 'El ID de lesión es obligatorio' })
  if (!l.id_jugadora) errors.push({ field: 'id_jugadora', message: 'Selecciona una jugadora' })
  if (!l.fecha_inicio) errors.push({ field: 'fecha_inicio', message: 'La fecha de inicio es obligatoria' })
  if (!l.tipo.trim()) errors.push({ field: 'tipo', message: 'El tipo de lesión es obligatorio' })
  if (!l.localizacion.trim()) errors.push({ field: 'localizacion', message: 'La localización es obligatoria' })
  if (l.severidad_dias_baja < 0) errors.push({ field: 'severidad_dias_baja', message: 'Los días de baja no pueden ser negativos' })
  return errors
}

export function validateTest(t: TestFisico): ValidationError[] {
  const errors: ValidationError[] = []
  if (!t.fecha) errors.push({ field: 'fecha', message: 'La fecha es obligatoria' })
  if (!t.id_jugadora) errors.push({ field: 'id_jugadora', message: 'Selecciona una jugadora' })
  if (!t.test.trim()) errors.push({ field: 'test', message: 'El nombre del test es obligatorio' })
  if (isNaN(t.resultado)) errors.push({ field: 'resultado', message: 'El resultado debe ser un número' })
  return errors
}

export function inferirParticipacionPartido(r: RPE_Partido): void {
  if (r.participacion) return // If explicitly defined, don't infer

  const hasMins = r.minutos_jugados !== undefined && r.minutos_jugados !== null && r.minutos_jugados !== '' as any
  if (!hasMins) return // Cannot infer from null
  if (r.minutos_jugados === 0) return // Cannot infer from 0

  if (r.minutos_jugados === 40) {
    r.participacion_inferida = true
    r.participacion = 'completa'
  } else if (r.minutos_jugados! >= 1 && r.minutos_jugados! <= 39) {
    r.participacion_inferida = true
    r.participacion = 'parcial'
  }
}

export function validateRPE_Partido(r: RPE_Partido): ValidationError[] {
  const errors: ValidationError[] = []
  if (!r.id_partido) errors.push({ field: 'id_partido', message: 'Selecciona un partido' })
  if (!r.id_jugadora) errors.push({ field: 'id_jugadora', message: 'Selecciona una jugadora' })
  
  const hasRPE = r.rpe !== undefined && r.rpe !== null && r.rpe !== '' as any
  const hasMins = r.minutos_jugados !== undefined && r.minutos_jugados !== null && r.minutos_jugados !== '' as any

  if (r.participacion) {
    switch (r.participacion) {
      case 'no_convocada':
      case 'convocada_sin_minutos':
        if (!hasMins || r.minutos_jugados !== 0) {
          errors.push({ field: 'minutos_jugados', message: 'Los minutos deben ser exactamente 0 para este estado' })
        }
        if (hasRPE) {
          errors.push({ field: 'rpe', message: 'El RPE no aplica para este estado' })
        }
        break
      case 'completa':
        if (!hasMins || r.minutos_jugados !== 40) {
          errors.push({ field: 'minutos_jugados', message: 'Minutos deben ser exactamente 40' })
        }
        if (!hasRPE) {
          errors.push({ field: 'rpe', message: 'RPE obligatorio (1-10)' })
        } else {
          const rpeErr = validateRange(r.rpe!, 1, 10, 'RPE')
          if (rpeErr) errors.push(rpeErr)
        }
        break
      case 'parcial':
        if (!hasMins || r.minutos_jugados! < 1 || r.minutos_jugados! > 39) {
          errors.push({ field: 'minutos_jugados', message: 'Minutos deben estar entre 1 y 39' })
        }
        if (!hasRPE) {
          errors.push({ field: 'rpe', message: 'RPE obligatorio (1-10)' })
        } else {
          const rpeErr = validateRange(r.rpe!, 1, 10, 'RPE')
          if (rpeErr) errors.push(rpeErr)
        }
        break
      case 'modificada':
        if (!hasMins || r.minutos_jugados! < 0 || r.minutos_jugados! > 39) {
          errors.push({ field: 'minutos_jugados', message: 'Minutos deben estar entre 0 y 39' })
        }
        if (r.minutos_jugados === 0) {
          if (hasRPE) {
            errors.push({ field: 'rpe', message: 'RPE debe ser nulo o estar ausente si hay 0 minutos' })
          }
        } else if (r.minutos_jugados! > 0) {
          if (!hasRPE) {
            errors.push({ field: 'rpe', message: 'RPE obligatorio entre 1 y 10 si hay minutos jugados' })
          } else {
            const rpeErr = validateRange(r.rpe!, 1, 10, 'RPE')
            if (rpeErr) errors.push(rpeErr)
          }
        }
        if (!r.motivo_participacion_reducida?.trim()) {
          errors.push({ field: 'motivo_participacion_reducida', message: 'Motivo obligatorio' })
        }
        break
    }
  } else {
    // Legacy support for records without `participacion`
    if (hasRPE) {
      const rpeErr = validateRange(r.rpe!, 1, 10, 'RPE')
      if (rpeErr) errors.push(rpeErr)
    }
    if (hasMins) {
      if (r.minutos_jugados! < 0 || r.minutos_jugados! > 40) {
        errors.push({ field: 'minutos_jugados', message: 'Minutos fuera de rango (0-40)' })
      }
      if (r.minutos_jugados! > 0 && !hasRPE) {
          errors.push({ field: 'rpe', message: 'RPE requerido si hay minutos jugados' })
      }
    }
  }
  
  return errors
}

export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map((e) => e.message).join('. ')
}

export function validateSesionRPE(srpe: SesionRPE): ValidationError[] {
  const errors: ValidationError[] = []
  if (!srpe.id_sesion?.trim()) errors.push({ field: 'id_sesion', message: 'ID de sesión requerido' })
  if (!srpe.id_jugadora?.trim()) errors.push({ field: 'id_jugadora', message: 'Jugadora requerida' })
  if (!srpe.fecha) errors.push({ field: 'fecha', message: 'Fecha requerida' })
  
  if (srpe.rpe !== undefined && srpe.rpe !== null && srpe.rpe !== '' as any) {
    const rpeNum = Number(srpe.rpe)
    if (isNaN(rpeNum) || rpeNum < 1 || rpeNum > 10) {
      errors.push({ field: 'rpe', message: 'RPE debe ser 1-10' })
    }
  }
  
  if (srpe.duracion_min !== undefined && srpe.duracion_min !== null && srpe.duracion_min !== '' as any) {
    const durNum = Number(srpe.duracion_min)
    if (isNaN(durNum) || durNum < 0) {
      errors.push({ field: 'duracion_min', message: 'Duración debe ser >= 0' })
    }
  }
  return errors
}

export { isFechaLocalISO, validateFechaLocalISO } from '@/domain/dates/dates'

