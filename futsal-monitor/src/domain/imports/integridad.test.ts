import { describe, it, expect } from 'vitest'
import { verificarConsistenciaRelacional, corregirInconsistenciasRelacionales } from './integridad'

describe('Validación de Consistencia Relacional (src/domain/imports/integridad.ts)', () => {
  const jugadorasValidas = [
    { id_jugadora: 'J001', nombre: 'Ana', activa: true, fecha_alta: '2026-01-01' },
    { id_jugadora: 'J002', nombre: 'Bea', activa: true, fecha_alta: '2026-01-01' }
  ]

  it('detecta registros huérfanos asociados a jugadoras inexistentes', () => {
    const data = {
      jugadoras: jugadorasValidas,
      sesion_rpe: [
        { id: 1, id_jugadora: 'J001', fecha: '2026-05-10', rpe: 7, duracion_min: 60 },
        { id: 2, id_jugadora: 'J999', fecha: '2026-05-10', rpe: 8, duracion_min: 60 } // Huérfano!
      ],
      wellness: [],
      tests_fisicos: []
    }

    const reporte = verificarConsistenciaRelacional(data as any)
    expect(reporte.tieneInconsistencias).toBe(true)
    expect(reporte.huerfanos).toHaveLength(1)
    expect(reporte.huerfanos[0].idJugadora).toBe('J999')
    expect(reporte.huerfanos[0].entidad).toBe('sesion_rpe')
  })

  it('detecta registros con fechas anteriores a la fecha de alta de la jugadora', () => {
    const data = {
      jugadoras: jugadorasValidas,
      sesion_rpe: [],
      wellness: [
        { id: 1, id_jugadora: 'J001', fecha: '2025-12-01', calidad_sueno: 4 } // Anterior a fecha_alta 2026-01-01!
      ],
      tests_fisicos: []
    }

    const reporte = verificarConsistenciaRelacional(data as any)
    expect(reporte.tieneInconsistencias).toBe(true)
    expect(reporte.fechasInconsistentes).toHaveLength(1)
    expect(reporte.fechasInconsistentes[0].motivo).toBe('anterior_a_fecha_alta')
  })

  it('permite corregir registros huérfanos eliminándolos del dataset', () => {
    const data = {
      jugadoras: jugadorasValidas,
      sesion_rpe: [
        { id: 1, id_jugadora: 'J001', fecha: '2026-05-10', rpe: 7, duracion_min: 60 },
        { id: 2, id_jugadora: 'J999', fecha: '2026-05-10', rpe: 8, duracion_min: 60 }
      ],
      wellness: [],
      tests_fisicos: []
    }

    const res = corregirInconsistenciasRelacionales(data as any, 'eliminar_huerfanos')
    expect(res.dataLimpia.sesion_rpe).toHaveLength(1)
    expect(res.dataLimpia.sesion_rpe[0].id_jugadora).toBe('J001')
    expect(res.registrosEliminadosCount).toBe(1)
  })
})
