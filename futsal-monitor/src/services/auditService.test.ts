import { describe, it, expect, beforeEach } from 'vitest'
import {
  registrarCambioAuditoria,
  obtenerHistorialAuditoria,
  limpiarAuditoriaPruebas
} from './auditService'

describe('Servicio de Auditoría de Cambios (auditService.ts)', () => {
  beforeEach(() => {
    limpiarAuditoriaPruebas()
  })

  it('1. Registrar un cambio en carga/sRPE genera una entrada con ID y timestamp', () => {
    const reg = registrarCambioAuditoria({
      usuario: 'Coach',
      entidad: 'sRPE',
      idEntidad: 'S1',
      idJugadora: 'J001',
      campoModificado: 'rpe',
      valorAnterior: 6,
      valorNuevo: 8,
      motivo: 'Ajuste tras revisión de video'
    })

    expect(reg.id).toMatch(/^AUD-/)
    expect(reg.timestamp).toBeDefined()
    expect(reg.entidad).toBe('sRPE')
    expect(reg.valorAnterior).toBe(6)
    expect(reg.valorNuevo).toBe(8)
    expect(reg.motivo).toBe('Ajuste tras revisión de video')
  })

  it('2. Registrar un cambio en wellness y alerta', () => {
    registrarCambioAuditoria({
      usuario: 'Fisio',
      entidad: 'wellness',
      idEntidad: 'W1',
      idJugadora: 'J002',
      campoModificado: 'fatiga',
      valorAnterior: 2,
      valorNuevo: 7,
      motivo: 'Corrección de error de teclado de la jugadora'
    })

    registrarCambioAuditoria({
      usuario: 'Coach',
      entidad: 'alerta',
      idEntidad: 'A1',
      idJugadora: 'J002',
      campoModificado: 'estado',
      valorAnterior: 'abierta',
      valorNuevo: 'resuelta',
      motivo: 'Tratamiento completado y jugadora disponible'
    })

    const historial = obtenerHistorialAuditoria()
    expect(historial).toHaveLength(2)
    expect(historial[0].entidad).toBe('alerta') // Muestra el más reciente primero
    expect(historial[1].entidad).toBe('wellness')
  })

  it('3. Filtrar historial por entidad e idJugadora', () => {
    registrarCambioAuditoria({
      usuario: 'Coach',
      entidad: 'sRPE',
      idEntidad: 'S1',
      idJugadora: 'J001',
      campoModificado: 'rpe',
      valorAnterior: 5,
      valorNuevo: 7,
      motivo: 'Ajuste'
    })

    registrarCambioAuditoria({
      usuario: 'Coach',
      entidad: 'test_cmj',
      idEntidad: 'M1',
      idJugadora: 'J002',
      campoModificado: 'altura_cm',
      valorAnterior: 30,
      valorNuevo: 32,
      motivo: 'Corrección'
    })

    const soloJ1 = obtenerHistorialAuditoria({ idJugadora: 'J001' })
    expect(soloJ1).toHaveLength(1)
    expect(soloJ1[0].idJugadora).toBe('J001')

    const soloCMJ = obtenerHistorialAuditoria({ entidad: 'test_cmj' })
    expect(soloCMJ).toHaveLength(1)
    expect(soloCMJ[0].entidad).toBe('test_cmj')
  })

  it('4. Los registros devueltos por obtenerHistorialAuditoria son congelados (no modificables desde UI)', () => {
    registrarCambioAuditoria({
      usuario: 'Coach',
      entidad: 'disponibilidad',
      idEntidad: 'L1',
      idJugadora: 'J001',
      campoModificado: 'disponibilidad',
      valorAnterior: 'Lesionada',
      valorNuevo: 'Disponible',
      motivo: 'Alta médica'
    })

    const historial = obtenerHistorialAuditoria()
    const reg = historial[0]

    expect(() => {
      ;(reg as any).usuario = 'Intruso'
    }).toThrow()
  })

  it('5. Nota vacía, con espacios o nula normaliza a "Sin comentario"', () => {
    const regVacio = registrarCambioAuditoria({
      usuario: 'Preparador Físico',
      entidad: 'alerta',
      idEntidad: '10',
      campoModificado: 'estado',
      valorAnterior: 'abierta',
      valorNuevo: 'resuelta',
      motivo: ''
    })
    expect(regVacio.motivo).toBe('Sin comentario')

    const regEspacios = registrarCambioAuditoria({
      usuario: 'Preparador Físico',
      entidad: 'alerta',
      idEntidad: '11',
      campoModificado: 'estado',
      valorAnterior: 'abierta',
      valorNuevo: 'descartada',
      motivo: '    \n\t   '
    })
    expect(regEspacios.motivo).toBe('Sin comentario')

    const regUndefined = registrarCambioAuditoria({
      usuario: 'Preparador Físico',
      entidad: 'alerta',
      idEntidad: '12',
      campoModificado: 'estado',
      valorAnterior: 'abierta',
      valorNuevo: 'resuelta'
    } as any)
    expect(regUndefined.motivo).toBe('Sin comentario')
  })

  it('6. Nota escrita se almacena recortada con trim()', () => {
    const reg = registrarCambioAuditoria({
      usuario: 'Preparador Físico',
      entidad: 'alerta',
      idEntidad: '20',
      campoModificado: 'estado',
      valorAnterior: 'abierta',
      valorNuevo: 'resuelta',
      motivo: '  Alerta gestionada en sesión matutina   '
    })
    expect(reg.motivo).toBe('Alerta gestionada en sesión matutina')
  })
})
