import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useStore } from '@/store/store'
import { DailyDecisionPage } from './DailyDecisionPage'
import type { Jugadora, Wellness } from '@/types'
import { db } from '@/db/database'

describe('DailyDecisionPage Component (T-05-VISTA-DECISION-DIARIA & T-05-R)', () => {
  const mockJugadoras: Jugadora[] = [
    {
      id_jugadora: 'J1',
      nombre: 'Ana Lopez',
      fecha_nacimiento: '2000-01-01',
      posicion: 'Ala',
      altura_cm: 165,
      peso_kg: 58,
      imc: 21.3,
      grasa: 18,
      anos_experiencia_futsal: 5,
      historial_lesional: '',
      notas: 'INFORMACION_MEDICA_CONFIDENCIAL_2026',
      activa: true
    },
    {
      id_jugadora: 'J2',
      nombre: 'Beatriz Gomez',
      fecha_nacimiento: '2001-02-02',
      posicion: 'Pivot',
      altura_cm: 170,
      peso_kg: 62,
      imc: 21.5,
      grasa: 17,
      anos_experiencia_futsal: 6,
      historial_lesional: '',
      notas: '',
      activa: true
    },
    {
      id_jugadora: 'J4_INACTIVA',
      nombre: 'Diana Inactiva',
      fecha_nacimiento: '1998-04-04',
      posicion: 'Portera',
      altura_cm: 175,
      peso_kg: 65,
      imc: 21.2,
      grasa: 20,
      anos_experiencia_futsal: 8,
      historial_lesional: '',
      notas: '',
      activa: false
    }
  ]

  beforeEach(() => {
    useStore.setState({
      jugadoras: mockJugadoras,
      wellness: [],
      lesiones: [],
      alertas: [],
      pruebas_cmj: [],
      sesion_rpe: [],
      rpe_partido: []
    })
  })

  // A. Plantilla activa
  it('A. Muestra únicamente las jugadoras activas en la UI y excluye las inactivas', () => {
    render(
      <MemoryRouter>
        <DailyDecisionPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Ana Lopez')).toBeInTheDocument()
    expect(screen.getByText('Beatriz Gomez')).toBeInTheDocument()
    expect(screen.queryByText('Diana Inactiva')).not.toBeInTheDocument()
  })

  // B. Cambio de fecha
  it('B. Actualiza la pantalla mediante botones (Ayer/Hoy/Mañana) y selector de fecha date', () => {
    render(
      <MemoryRouter>
        <DailyDecisionPage />
      </MemoryRouter>
    )

    // Pulsar Ayer
    const btnAyer = screen.getByRole('button', { name: /← Ayer/i })
    fireEvent.click(btnAyer)
    expect(screen.getByRole('button', { name: /^Hoy$/i })).toBeInTheDocument()

    // Regresar a Hoy
    const btnHoy = screen.getByRole('button', { name: /^Hoy$/i })
    fireEvent.click(btnHoy)
    expect(screen.queryByRole('button', { name: /^Hoy$/i })).not.toBeInTheDocument()

    // Pulsar Mañana
    const btnManana = screen.getByRole('button', { name: /Mañana →/i })
    fireEvent.click(btnManana)
    expect(screen.getByRole('button', { name: /^Hoy$/i })).toBeInTheDocument()

    // Interacción directa con input type="date"
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    expect(dateInput).toBeInTheDocument()

    fireEvent.change(dateInput, { target: { value: '2026-08-01' } })
    expect(dateInput.value).toBe('2026-08-01')
  })

  // C. Ausencia de datos no equivale a cero
  it('C. Muestra etiquetas claras de falta de datos ("Sin registro hoy", "Sin CMJ registrado", "Sin sRPE reciente") y no valores cero', () => {
    render(
      <MemoryRouter>
        <DailyDecisionPage />
      </MemoryRouter>
    )

    expect(screen.getAllByText('Sin registro hoy').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sin CMJ registrado').length).toBeGreaterThan(0)
    expect(screen.getAllByText('sin registro').length).toBeGreaterThan(0)

    expect(screen.queryByText('0 cm')).not.toBeInTheDocument()
    expect(screen.queryByText('0 UA')).not.toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  // D. Error parcial de una fuente
  it('D. Se renderiza sin colapsar cuando una colección de datos es nula o indefinida en la store', () => {
    useStore.setState({
      pruebas_cmj: undefined as any,
      sesion_rpe: null as any
    })

    render(
      <MemoryRouter>
        <DailyDecisionPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Ana Lopez')).toBeInTheDocument()
    expect(screen.getAllByText('Sin CMJ registrado').length).toBeGreaterThan(0)
  })

  // E. Navegación a ficha correcta
  it('E. Ofrece enlaces de navegación con el id_jugadora correcto para múltiples jugadoras', () => {
    render(
      <MemoryRouter>
        <DailyDecisionPage />
      </MemoryRouter>
    )

    const linkJ1 = screen.getAllByRole('link', { name: /Ana Lopez|Ver ficha →/i })
    const linkJ2 = screen.getAllByRole('link', { name: /Beatriz Gomez|Ver ficha →/i })

    expect(linkJ1.some((l) => l.getAttribute('href') === '/jugadoras/J1')).toBe(true)
    expect(linkJ2.some((l) => l.getAttribute('href') === '/jugadoras/J2')).toBe(true)
  })

  // F. Lectura pura contra Dexie
  it('F. Confirma que la renderización y cambio de fecha no disparan escrituras en Dexie', () => {
    if (!db.jugadoras.put) (db.jugadoras as any).put = vi.fn()
    const spyPut = vi.spyOn(db.jugadoras, 'put')

    render(
      <MemoryRouter>
        <DailyDecisionPage />
      </MemoryRouter>
    )

    const btnAyer = screen.getByRole('button', { name: /← Ayer/i })
    fireEvent.click(btnAyer)

    expect(spyPut).not.toHaveBeenCalled()
    spyPut.mockRestore()
  })

  // G. Privacidad con datos sensibles presentes en fixtures
  it('G. Excluye del DOM cualquier texto médico confidencial, nota privada o dolor específico', () => {
    const hoyStr = new Date().toISOString().split('T')[0]
    const wellness: Wellness[] = [
      {
        id_jugadora: 'J1',
        fecha: hoyStr,
        calidad_sueno: 8,
        fatiga: 3,
        dolor_muscular: 2,
        estres: 2,
        estado_animo: 8,
        dolor_especifico: 'DOLOR_ESPECIFICO_PRIVADO_2026',
        score_wellness: 8
      }
    ]

    const lesiones: any[] = [
      {
        id_lesion: 1,
        id_jugadora: 'J1',
        fecha_inicio: hoyStr,
        tipo: 'Esguince Grado 1',
        disponibilidad: 'Lesionada',
        comentario_fisio_medico: 'NOTA_CLINICA_SECRETA_2026',
        disponible: false
      }
    ]

    useStore.setState({ wellness, lesiones })

    render(
      <MemoryRouter>
        <DailyDecisionPage />
      </MemoryRouter>
    )

    // Datos confidenciales no aparecen en el DOM
    expect(screen.queryByText(/INFORMACION_MEDICA_CONFIDENCIAL_2026/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/DOLOR_ESPECIFICO_PRIVADO_2026/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/NOTA_CLINICA_SECRETA_2026/i)).not.toBeInTheDocument()

    // Datos operativos permitidos sí aparecen
    expect(screen.getByText('Ana Lopez')).toBeInTheDocument()
    expect(screen.getByText(/⛔ Lesionada/i)).toBeInTheDocument()
    expect(screen.getByText('Esguince Grado 1')).toBeInTheDocument()
    expect(screen.getByText('8 / 10')).toBeInTheDocument()
  })

  // H. Renderizado con datos vacíos
  it('H. Renderiza correctamente con datos vacíos sin lanzar excepciones en pantalla', () => {
    useStore.setState({
      jugadoras: [],
      wellness: [],
      lesiones: [],
      alertas: [],
      pruebas_cmj: [],
      sesion_rpe: [],
      rpe_partido: []
    })

    render(
      <MemoryRouter>
        <DailyDecisionPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Decisión diaria')).toBeInTheDocument()
    expect(screen.getAllByText('0').length).toBeGreaterThan(0) // Múltiples KPIs muestran 0
  })

  // I. No se disparan alertas por datos ausentes
  it('I. La falta de wellness no genera alertas automáticas espurias en la vista de Decisión Diaria', () => {
    useStore.setState({
      jugadoras: mockJugadoras,
      wellness: [], // Ausencia de registros
      alertas: []
    })

    render(
      <MemoryRouter>
        <DailyDecisionPage />
      </MemoryRouter>
    )

    expect(screen.queryByText(/wellness_bajo/i)).not.toBeInTheDocument()
  })
})

