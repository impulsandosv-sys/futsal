import type { DatosStaffPDFResumen } from '@/domain/privacy/exportPrivacy'

export const generatePDF = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId)
  if (!element) {
    console.error(`No se encontró el elemento con ID ${elementId}`)
    return
  }

  try {
    const { default: html2canvas } = await import('html2canvas')
    const { default: jsPDF } = await import('jspdf')

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    pdf.save(`${filename}.pdf`)
  } catch (error) {
    console.error('Error generando PDF:', error)
  }
}

/**
 * Generador de PDF exclusivo para el perfil Staff basado en DTO de datos seguros.
 */
export const generatePDFStaff = async (datosStaff: DatosStaffPDFResumen, filename: string) => {
  try {
    const { default: jsPDF } = await import('jspdf')
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    pdf.setFontSize(14)
    pdf.text(datosStaff.titulo, 14, 15)

    pdf.setFontSize(9)
    pdf.text(datosStaff.notaPrivacidad, 14, 22)

    let y = 30
    pdf.setFontSize(10)
    pdf.text('Jugadora | Carga Total | ACWR | Wellness | Estado', 14, y)
    y += 6

    datosStaff.filas.forEach(f => {
      pdf.text(`${f.Jugadora} | ${f['Carga Total']} | ${f.ACWR} | ${f.Wellness} | ${f.Estado}`, 14, y)
      y += 5
    })

    pdf.save(`${filename}.pdf`)
  } catch (error) {
    console.error('Error generando PDF Staff:', error)
  }
}
