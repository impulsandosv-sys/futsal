import type { Jugadora, Wellness, RPE_Entreno } from '@/types'

export function mockJugadora(overrides?: Partial<Jugadora>): Jugadora {
  return {
    id_jugadora: 'J001',
    nombre: 'Test',
    posicion: 'Ala',
    fecha_nacimiento: '2000-01-01',
    altura_cm: 165,
    peso_kg: 60,
    imc: 22,
    grasa: 20,
    anos_experiencia_futsal: 5,
    historial_lesional: '',
    activa: true,
    ...overrides,
  }
}

export function mockWellness(overrides?: Partial<Wellness>): Wellness {
  return {
    id: 1,
    id_jugadora: 'J001',
    fecha: '2026-07-01',
    calidad_sueno: 7,
    fatiga: 6,
    dolor_muscular: 5,
    estres: 4,
    estado_animo: 7,
    dolor_especifico: '',
    score_wellness: 6.5,
    ...overrides,
  }
}

export function mockRPE_Entreno(overrides?: Partial<RPE_Entreno>): RPE_Entreno {
  return {
    id: 1,
    id_jugadora: 'J001',
    fecha: '2026-07-01',
    tipo_sesion: 'Fisico',
    rpe: 6,
    duracion_min: 60,
    carga_ua: 360,
    ...overrides,
  }
}
