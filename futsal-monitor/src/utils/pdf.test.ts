import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generatePDF, generatePDFStaff } from './pdf'
import { construirDatosStaffPDFResumen } from '@/domain/privacy/exportPrivacy'

const mockSave = vi.fn()
const mockText = vi.fn()
const mockAddImage = vi.fn()
const mockSetFontSize = vi.fn()

vi.mock('jspdf', () => {
  return {
    default: function MockJsPDF() {
      return {
        internal: { pageSize: { getWidth: () => 297 } },
        text: mockText,
        addImage: mockAddImage,
        setFontSize: mockSetFontSize,
        save: mockSave
      }
    }
  }
})

describe('T-03 — Integration pdf.ts: Generador PDF Staff basado en DTOs', () => {
  const fixtureEntidadInterna = Object.freeze({
    id_jugadora: 'JUG-001',
    nombre: 'Ana López',
    semana: '2026-W28',
    carga_total: 700,
    acwr: 1.08,
    wellness_medio: 78,
    estado: 'Óptimo',
    dolor_especifico: 'Dolor en rodilla',
    ciclo_menstrual: { fase: 'Lútea' },
    registro_menstrual: { fecha_inicio: '2026-07-01', impacto_percibido: 3, comentario: 'Molestia confidencial', nota_ajuste: 'Ajuste interno', accion_ajuste: 'AJUSTE_VOLUMEN', fecha_decision: '2026-07-02' }
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1. generatePDFStaff usa exclusivamente el DTO seguro y añade la nota de privacidad staff', async () => {
    const datosStaff = construirDatosStaffPDFResumen('2026-W28', [fixtureEntidadInterna] as any)
    await generatePDFStaff(datosStaff, 'reporte_pdf_staff_test')

    expect(mockSave).toHaveBeenCalledWith('reporte_pdf_staff_test.pdf')
    expect(mockText).toHaveBeenCalledWith(
      expect.stringContaining('Versión staff: se han excluido datos sensibles y clínicos.'),
      14,
      22
    )

    // Comprobar que no se escribió texto sensible en el PDF
    const textCalls = mockText.mock.calls.map(call => call[0])
    for (const texto of textCalls) {
      expect(texto).not.toContain('Dolor en rodilla')
      expect(texto).not.toContain('Lútea')
      expect(texto).not.toContain('ciclo_menstrual')
      expect(texto).not.toContain('registro_menstrual')
      expect(texto).not.toContain('Molestia confidencial')
      expect(texto).not.toContain('Ajuste interno')
      expect(texto).not.toContain('AJUSTE_VOLUMEN')
      expect(texto).not.toContain('2026-07-02')
    }
  })

  it('2. generatePDF maneja elementos no encontrados sin lanzar excepción', async () => {
    await generatePDF('non-existent-id', 'test_fail')
    expect(mockSave).not.toHaveBeenCalled()
  })
})
