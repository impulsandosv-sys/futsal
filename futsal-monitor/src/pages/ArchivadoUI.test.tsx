import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { InjuriesPage } from './InjuriesPage'
import { TestsPage } from './TestsPage'
import { useStore } from '@/store/store'

vi.mock('@/store/store', async () => {
  const actual = await vi.importActual('@/store/store') as any
  return {
    ...actual,
    useStore: Object.assign(vi.fn(), {
      getState: actual.useStore.getState,
      setState: actual.useStore.setState,
      subscribe: actual.useStore.subscribe,
      destroy: actual.useStore.destroy,
    })
  }
})

describe('Test UI: Exclusión de jugadoras archivadas en listados de nueva creación', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const jActiva = { id_jugadora: 'J_ACTIVA', nombre: 'Jugadora Activa', activa: true, alias: '', posicion: 'Ala', fecha_nacimiento: '2000-01-01', perfil_img: '', pie_dominante: 'Diestro', dorsal: 10 }
    const jArchivada = { id_jugadora: 'J_ARCHIVADA', nombre: 'Jugadora Archivada', activa: false, alias: '', posicion: 'Cierre', fecha_nacimiento: '2000-01-01', perfil_img: '', pie_dominante: 'Diestro', dorsal: 2 }
    const jLegacy = { id_jugadora: 'J_LEGACY', nombre: 'Jugadora Legacy', activa: undefined, alias: '', posicion: 'Pívot', fecha_nacimiento: '2000-01-01', perfil_img: '', pie_dominante: 'Diestro', dorsal: 9 }

    // Mockeamos la implementación de useStore para que devuelva un estado parcial con las jugadoras
    // y los metadatos necesarios.
    ;(useStore as any).mockImplementation((selector: any) => {
      const state = {
        jugadoras: [jActiva, jArchivada, jLegacy],
        lesiones: [],
        tests: [],
        filters: { id_jugadora: '' },
        filtrosLesiones: { id_jugadora: '', mes: '', estado: '' },
        filtrosTests: { id_jugadora: '', id_test: '', fecha_desde: '', fecha_hasta: '' },
        addLesion: vi.fn(),
        updateLesion: vi.fn(),
        deleteLesion: vi.fn(),
        addTest: vi.fn(),
        updateTest: vi.fn(),
        deleteTest: vi.fn(),
      }
      return selector ? selector(state) : state
    })
  })

  it('InjuriesPage no debe incluir jugadoras archivadas en el select de nueva lesión, pero sí legacy', () => {
    render(
      <MemoryRouter>
        <InjuriesPage />
      </MemoryRouter>
    )

    const btnNueva = screen.getByText('+ Nueva lesión')
    btnNueva.click()

    const options = screen.getAllByRole('option')
    const texts = options.map(opt => opt.textContent)

    expect(texts).toContain('Jugadora Activa')
    expect(texts).toContain('Jugadora Legacy')
    expect(texts).not.toContain('Jugadora Archivada (Inactiva)') // or just Jugadora Archivada
    
    // As it uses .filter(j => j.activa !== false), Jugadora Archivada should not be in the DOM options at all
    // Let's just check by exact match of texts to be safe.
    const joinedTexts = texts.join(' ')
    expect(joinedTexts).toContain('Jugadora Activa')
    expect(joinedTexts).toContain('Jugadora Legacy')
    expect(joinedTexts).not.toContain('Jugadora Archivada')
  })

  it('TestsPage no debe incluir jugadoras archivadas en el select de nuevo test, pero sí legacy', () => {
    render(
      <MemoryRouter>
        <TestsPage />
      </MemoryRouter>
    )

    const btnNuevo = screen.getByText('+ Nuevo test')
    btnNuevo.click()

    const options = screen.getAllByRole('option')
    const texts = options.map(opt => opt.textContent)

    const joinedTexts = texts.join(' ')
    expect(joinedTexts).toContain('Jugadora Activa')
    expect(joinedTexts).toContain('Jugadora Legacy')
    expect(joinedTexts).not.toContain('Jugadora Archivada')
  })
})
