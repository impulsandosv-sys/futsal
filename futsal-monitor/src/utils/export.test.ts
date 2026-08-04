import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportToCSV, exportToExcel, exportToJSON } from './export'
import {
  construirDTOStaffResumenSemanal,
  construirDTOStaffSeguimientoDiario
} from '@/domain/privacy/exportPrivacy'
import { saveAs } from 'file-saver'

vi.mock('file-saver', () => ({
  saveAs: vi.fn()
}))

describe('T-03 — Integration export.ts: Exportaciones Staff con DTOs Concretos', () => {
  const fixtureEntidadInterna = Object.freeze({
    id_jugadora: 'JUG-001',
    nombre: 'Ana López',
    posicion: 'Ala',
    semana: '2026-W28',
    carga_entreno: 500,
    carga_partido: 200,
    carga_total: 700,
    carga_cronica: 650,
    acwr: 1.08,
    wellness_medio: 78,
    num_sesiones: 4,
    estado: 'Óptimo',
    disponibilidad: 'disponible',
    estadoWellness: 'normal',
    prioridad: 'baja',
    motivos: 'RPE acumulado',
    adherencia7d: '7/7',
    adherencia28d: '28/28',
    // DATOS SENSIBLES
    dolor_especifico: 'Dolor severo en isquios',
    comentario_wellness: 'Nota intima de jugadora',
    ciclo_menstrual: { fase: 'Folicular' },
    diagnostico: 'Tendinitis'
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. exportToCSV genera Blob y llama a saveAs con cabeceras y celdas sin datos sensibles', () => {
    const dtoData = construirDTOStaffResumenSemanal([fixtureEntidadInterna] as any)
    exportToCSV(dtoData as any, 'resumen_semanal_test')

    expect(saveAs).toHaveBeenCalledTimes(1)
    const [blobArg, filenameArg] = (saveAs as any).mock.calls[0]

    expect(filenameArg).toBe('resumen_semanal_test.csv')
    expect(blobArg).toBeInstanceOf(Blob)
  })

  it('2. exportToExcel genera archivo xlsx sin incorporar propiedades ni etiquetas sensibles', async () => {
    const dtoData = construirDTOStaffSeguimientoDiario([fixtureEntidadInterna] as any)
    await exportToExcel(dtoData as any, 'seguimiento_diario_test')

    expect(saveAs).toHaveBeenCalledTimes(1)
    const [blobArg, filenameArg] = (saveAs as any).mock.calls[0]

    expect(filenameArg).toBe('seguimiento_diario_test.xlsx')
    expect(blobArg).toBeInstanceOf(Blob)
  })

  it('3. exportToJSON serializa solo los DTOs de staff y excluye propiedades sensibles', () => {
    const dtoData = construirDTOStaffResumenSemanal([fixtureEntidadInterna] as any)
    exportToJSON(dtoData, 'resumen_json_test')

    expect(saveAs).toHaveBeenCalledTimes(1)
    const [blobArg] = (saveAs as any).mock.calls[0]

    expect(blobArg).toBeInstanceOf(Blob)
  })
})
