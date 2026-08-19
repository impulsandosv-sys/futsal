import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuickMinuteRegistrationModal } from './QuickMinuteRegistrationModal'
import { useStore } from '@/store/store'

vi.mock('@/store/store')

describe('QuickMinuteRegistrationModal', () => {
  const mockSave = vi.fn()
  const mockJugadoras = [
    { id_jugadora: 'j1', nombre: 'Jugadora 1', activa: true }
  ]
  const mockPartidos = [
    { id_partido: 'p1', fecha: '2023-01-01', rival: 'Rival 1', competicion: 'Liga' }
  ]
  const mockRpePartido: any[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useStore).mockReturnValue({
      jugadoras: mockJugadoras,
      partidos: mockPartidos,
      rpe_partido: mockRpePartido,
      saveRpePartidoBatch: mockSave
    } as any)
  })

  it('1. El modal renderiza correctamente', () => {
    render(<QuickMinuteRegistrationModal open={true} onClose={vi.fn()} initialMatchId="p1" />)
    expect(screen.getByText('Registro rápido de minutos')).toBeInTheDocument()
  })

  it('4. Al registrar "Completa", se aplica la duración competitiva de 40', async () => {
    render(<QuickMinuteRegistrationModal open={true} onClose={vi.fn()} initialMatchId="p1" />)
    const select = screen.getAllByRole('combobox')[1] // Participacion select
    fireEvent.change(select, { target: { value: 'completa' } })
    
    // Minutes input should be 40
    const minsInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement
    expect(minsInput.value).toBe('40')
  })

  it('5 & 6. "Convocada sin jugar" / "No convocada" guarda minutos 0, RPE null y carga 0', async () => {
    render(<QuickMinuteRegistrationModal open={true} onClose={vi.fn()} initialMatchId="p1" />)
    const select = screen.getAllByRole('combobox')[1]
    
    fireEvent.change(select, { target: { value: 'no_convocada' } })
    const minsInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement
    expect(minsInput.value).toBe('0')
    
    const saveBtn = screen.getByText('Guardar minutos')
    fireEvent.click(saveBtn)
    
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith([{
        id_partido: 'p1',
        id_jugadora: 'j1',
        fecha: '2023-01-01',
        participacion: 'no_convocada',
        minutos_jugados: 0,
        rpe: null,
        carga_ua: 0,
        motivo_participacion_reducida: undefined,
        comentario_staff: undefined
      }])
    })
  })

  it('7. "Parcial" con 18 min y RPE vacío guarda minutos=18, rpe=null, carga=null', async () => {
    render(<QuickMinuteRegistrationModal open={true} onClose={vi.fn()} initialMatchId="p1" />)
    const select = screen.getAllByRole('combobox')[1]
    fireEvent.change(select, { target: { value: 'parcial' } })
    
    const minsInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement
    fireEvent.change(minsInput, { target: { value: '18' } })
    
    const saveBtn = screen.getByText('Guardar minutos')
    fireEvent.click(saveBtn)
    
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith([{
        id_partido: 'p1',
        id_jugadora: 'j1',
        fecha: '2023-01-01',
        participacion: 'parcial',
        minutos_jugados: 18,
        rpe: null,
        carga_ua: null,
        motivo_participacion_reducida: undefined,
        comentario_staff: undefined
      }])
    })
  })

  it('8. "Parcial" con 18 min y RPE 7 guarda carga_ua=126', async () => {
    render(<QuickMinuteRegistrationModal open={true} onClose={vi.fn()} initialMatchId="p1" />)
    const select = screen.getAllByRole('combobox')[1]
    fireEvent.change(select, { target: { value: 'parcial' } })
    
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[0], { target: { value: '18' } })
    fireEvent.change(inputs[1], { target: { value: '7' } })
    
    const saveBtn = screen.getByText('Guardar minutos')
    fireEvent.click(saveBtn)
    
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith([{
        id_partido: 'p1',
        id_jugadora: 'j1',
        fecha: '2023-01-01',
        participacion: 'parcial',
        minutos_jugados: 18,
        rpe: 7,
        carga_ua: 126,
        motivo_participacion_reducida: undefined,
        comentario_staff: undefined
      }])
    })
  })

  it('10. Minutos null no se convierten en 0 (estado pendiente)', async () => {
    render(<QuickMinuteRegistrationModal open={true} onClose={vi.fn()} initialMatchId="p1" />)
    const saveBtn = screen.getByText('Guardar minutos')
    fireEvent.click(saveBtn)
    
    await waitFor(() => {
      // should not save empty row
      expect(mockSave).not.toHaveBeenCalled()
    })
  })
})
