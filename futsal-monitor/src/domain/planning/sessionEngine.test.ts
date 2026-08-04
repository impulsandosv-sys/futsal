import { describe, it, expect } from 'vitest'
import type { Lesion, SesionRPE, Sesion } from '@/types'

// Mock de funciones que irán en el código final
function getAsistenciaInicial(_jugadora: any, _lesiones: any): string {
  // Regla: No disponibilidad no implica ausencia
  // Siempre se inicializa como sin_registrar
  return 'sin_registrar'
}

function crearSesionCompensatoria(sesionOriginalId: string, jugadoraNombre: string): Sesion {
  return {
    id_sesion: `comp_${sesionOriginalId}_123`,
    fecha: new Date().toISOString().split('T')[0],
    tipo_dia: 'Entreno',
    tipo_sesion: 'Compensatorio',
    objetivo_principal: `Compensatorio para ${jugadoraNombre} (Origen: ${sesionOriginalId})`,
    observaciones_grupo: '',
    estado: 'planificada',
    sesion_origen_id: sesionOriginalId,
    duracion_planificada_min: 30
  }
}

function calcularCargaSemanal(sesionesRPE: SesionRPE[], rpePartidos: any[]): number {
  let total = 0
  const sesionesProcesadas = new Set<string>()

  for (const srpe of sesionesRPE) {
    if (srpe.carga_ua) {
      total += srpe.carga_ua
      sesionesProcesadas.add(srpe.id_sesion) // Trackeamos qué sesiones (o partidos vinculados) ya sumamos
    }
  }

  // Simular lógica de no doble conteo
  for (const rp of rpePartidos) {
    // Si ya procesamos una sesión que estaba vinculada a este partido, no lo sumamos de nuevo
    // Para simplificar en este test, asumimos que si existe un id_partido, la sesión vinculada tendría id_sesion === id_partido
    if (!sesionesProcesadas.has(rp.id_partido)) {
       if (rp.carga_ua) total += rp.carga_ua
    }
  }

  return total
}

function migrarDuracionHistorica(sesionData: any): Sesion {
  const sesion: Sesion = { ...sesionData }
  if (sesion.duracion_min !== undefined && sesion.duracion_real_grupal_min === undefined) {
    sesion.duracion_real_grupal_min = sesion.duracion_min
  }
  return sesion
}

describe('Reglas de Negocio de Sesiones (Fase 4)', () => {
  it('No disponibilidad no implica ausencia (asistencia inicial es sin_registrar)', () => {
    const jugadora: Jugadora = { id_jugadora: 'J1', nombre: 'Test', posicion: 'Ala', fecha_nacimiento: '', altura_cm: 160, peso_kg: 60, imc: 20, grasa: 20, anos_experiencia_futsal: 5, historial_lesional: '', notas: '', activa: true }
    const lesiones: Lesion[] = [{ id_lesion: 'L1', id_jugadora: 'J1', disponible: false, disponibilidad: 'Lesionada', fecha_inicio: '2024-01-01', fecha_fin: '', tipo: '', localizacion: '', mecanismo: '', severidad_dias_baja: 10, comentario_fisio_medico: '', fase_rtp: 'Fase_1_Reposo' }]
    
    expect(getAsistenciaInicial(jugadora, lesiones)).toBe('sin_registrar')
  })

  it('Compensatorio se guarda como sesión independiente planificada', () => {
    const sesion = crearSesionCompensatoria('SES_ORIGINAL', 'Test Jugadora')
    
    expect(sesion.id_sesion).toContain('comp_SES_ORIGINAL')
    expect(sesion.sesion_origen_id).toBe('SES_ORIGINAL')
    expect(sesion.tipo_sesion).toBe('Compensatorio')
    expect(sesion.estado).toBe('planificada')
    expect((sesion as any).duracion_real_grupal_min).toBeUndefined() // No copia duración real
  })

  it('Participación parcial conserva su carga principal y la compensatoria suma carga independientemente', () => {
    // Sesión principal: Parcial
    const rpePrincipal = { id_sesion: 'SES_1', id_jugadora: 'J1', rpe: 6, duracion_min: 45, asistencia: 'parcial', carga_ua: 270 }
    
    // Sesión compensatoria (registrada luego por separado)
    const rpeComp = { id_sesion: 'comp_SES_1_123', id_jugadora: 'J1', rpe: 5, duracion_min: 30, asistencia: 'completa', carga_ua: 150 }
    
    // La suma de cargas es independiente
    const sesionesRegistradas = [rpePrincipal, rpeComp] as any[]
    const totalCarga = calcularCargaSemanal(sesionesRegistradas, [])
    
    expect(totalCarga).toBe(420) // 270 + 150
  })

  it('Evitar doble conteo de partido si existe en Sesion y RPE_Partido', () => {
    const sesionesRPE: SesionRPE[] = [
      { id_sesion: 'PARTIDO_1', id_jugadora: 'J1', fecha: '2024-01-10', carga_ua: 300 } // Registrado vía nueva interfaz unificada
    ]
    const rpePartidos = [
      { id_partido: 'PARTIDO_1', id_jugadora: 'J1', fecha: '2024-01-10', carga_ua: 300 } // Registro legacy u oficial
    ]
    
    // Debería sumar solo 300, no 600
    const total = calcularCargaSemanal(sesionesRPE, rpePartidos)
    expect(total).toBe(300)
  })

  it('Migración lógica de duración histórica', () => {
    const sesionAntigua = {
      id_sesion: 'S1', fecha: '2024-01-01', tipo_dia: 'Entreno', tipo_sesion: 'Fisico',
      duracion_min: 90, objetivo_principal: '', observaciones_grupo: ''
    }
    const sesionMigrada = migrarDuracionHistorica(sesionAntigua)
    
    expect(sesionMigrada.duracion_min).toBe(90)
    expect(sesionMigrada.duracion_real_grupal_min).toBe(90) // Mapeado correctamente
    expect(sesionMigrada.duracion_planificada_min).toBeUndefined()
  })
})
