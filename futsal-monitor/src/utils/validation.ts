import type { Jugadora, Wellness, Sesion, Partido, Lesion, TestFisico, RPE_Entreno, RPE_Partido } from '@/types'

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
    const err = validateRange(r.value, 1, 10, r.label)
    if (err) errors.push(err)
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
  if (!s.id_sesion.trim()) errors.push({ field: 'id_sesion', message: 'El ID de sesión es obligatorio' })
  if (!s.fecha) errors.push({ field: 'fecha', message: 'La fecha es obligatoria' })
  if (s.duracion_min < 5 || s.duracion_min > 300) errors.push({ field: 'duracion_min', message: 'Duración fuera de rango (5-300 min)' })
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

export function validateRPE_Entreno(r: RPE_Entreno): ValidationError[] {
  const errors: ValidationError[] = []
  if (!r.id_sesion) errors.push({ field: 'id_sesion', message: 'Selecciona una sesión' })
  if (!r.id_jugadora) errors.push({ field: 'id_jugadora', message: 'Selecciona una jugadora' })
  const rpeErr = validateRange(r.rpe, 1, 10, 'RPE')
  if (rpeErr) errors.push(rpeErr)
  if (r.duracion_min < 5) errors.push({ field: 'duracion_min', message: 'Duración mínima 5 min' })
  return errors
}

export function validateRPE_Partido(r: RPE_Partido): ValidationError[] {
  const errors: ValidationError[] = []
  if (!r.id_partido) errors.push({ field: 'id_partido', message: 'Selecciona un partido' })
  if (!r.id_jugadora) errors.push({ field: 'id_jugadora', message: 'Selecciona una jugadora' })
  const rpeErr = validateRange(r.rpe, 1, 10, 'RPE')
  if (rpeErr) errors.push(rpeErr)
  if (r.minutos_jugados < 0 || r.minutos_jugados > 40) errors.push({ field: 'minutos_jugados', message: 'Minutos fuera de rango (0-40)' })
  return errors
}

export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map((e) => e.message).join('. ')
}
