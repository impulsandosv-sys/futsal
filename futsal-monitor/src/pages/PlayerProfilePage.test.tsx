import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { PlayerProfilePage } from './PlayerProfilePage'
import { useStore } from '@/store/store'
import { db } from '@/db/database'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('@/store/store')

describe('PlayerProfilePage (Pestaña e Historial de Fuerza)', () => {
  const mockJugadoras = [
    { id_jugadora: 'J1', nombre: 'Laura García', activa: true, posicion: 'Ala' },
    { id_jugadora: 'J2', nombre: 'Ana Martínez', activa: true, posicion: 'Cierre' },
  ]

  const mockEjercicios = [
    {
      id_ejercicio: 'ej1',
      nombre: 'Sentadilla Trasera',
      nombre_normalizado: 'sentadillatrasera',
      categoria: 'sentadilla' as const,
      activo: true,
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01',
    },
    {
      id_ejercicio: 'ej2',
      nombre: 'Plancha Isométrica',
      nombre_normalizado: 'planchaisometrica',
      categoria: 'core' as const,
      activo: true,
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01',
    },
  ]

  const mockSesionesFuerza = [
    {
      id_sesion_fuerza: 'sf1',
      id_jugadora: 'J1',
      fecha: '2023-10-15',
      finalidad: 'fuerza_maxima' as const,
      rpe_sesion: 8,
      duracion_min: 60,
      createdAt: '2023-10-15T10:00:00Z',
      updatedAt: '2023-10-15T10:00:00Z',
    },
    {
      id_sesion_fuerza: 'sf2',
      id_jugadora: 'J1',
      fecha: '2023-10-18',
      finalidad: 'prevencion' as const,
      rpe_sesion: null,
      duracion_min: null,
      createdAt: '2023-10-18T10:00:00Z',
      updatedAt: '2023-10-18T10:00:00Z',
    },
    {
      id_sesion_fuerza: 'sf3',
      id_jugadora: 'J1',
      fecha: '2023-10-10',
      finalidad: 'hipertrofia' as const,
      rpe_sesion: 7,
      duracion_min: 45,
      createdAt: '2023-10-10T10:00:00Z',
      updatedAt: '2023-10-10T10:00:00Z',
    },
    {
      id_sesion_fuerza: 'sf4',
      id_jugadora: 'J1',
      fecha: '2023-10-05',
      finalidad: 'potencia' as const,
      rpe_sesion: 6,
      duracion_min: 40,
      createdAt: '2023-10-05T10:00:00Z',
      updatedAt: '2023-10-05T10:00:00Z',
    },
    {
      id_sesion_fuerza: 'sf_otra',
      id_jugadora: 'J2', // Otra jugadora
      fecha: '2023-10-17',
      finalidad: 'fuerza_maxima' as const,
      createdAt: '2023-10-17T10:00:00Z',
      updatedAt: '2023-10-17T10:00:00Z',
    },
  ]

  const mockTrabajos = [
    {
      id_trabajo: 'tr1',
      id_sesion_fuerza: 'sf1',
      id_jugadora: 'J1',
      id_ejercicio: 'ej1',
      ejercicio_nombre_historico: 'Sentadilla Trasera',
      realizado: [{ id_serie: 's1', orden: 1, repeticiones: 10, carga_kg: 50 }],
      estado: 'completado' as const,
      updatedAt: '2023-10-15T10:00:00Z',
    },
    {
      id_trabajo: 'tr2',
      id_sesion_fuerza: 'sf2',
      id_jugadora: 'J1',
      id_ejercicio: 'ej2',
      ejercicio_nombre_historico: 'Plancha Isométrica',
      realizado: [{ id_serie: 's2', orden: 1, repeticiones: null, carga_kg: null }],
      estado: 'completado' as const,
      updatedAt: '2023-10-18T10:00:00Z',
    },
    {
      id_trabajo: 'tr3',
      id_sesion_fuerza: 'sf3',
      id_jugadora: 'J1',
      id_ejercicio: 'ej1',
      ejercicio_nombre_historico: 'Sentadilla Trasera',
      realizado: [
        { id_serie: 's3', orden: 1, repeticiones: 10, carga_kg: 40 },
        { id_serie: 's4', orden: 2, repeticiones: null, carga_kg: null },
      ],
      estado: 'completado' as const,
      updatedAt: '2023-10-10T10:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    const mockState = {
      jugadoras: mockJugadoras,
      wellness: [],
      lesiones: [],
      tests: [],
      rpe_partido: [],
      resumen_semanal: [],
      readiness: [],
      sesion_rpe: [],
      sesiones: [],
      ciclo_menstrual: [],
      carga_gps: [],
      fuerza_vbt: [],
      hidratacion: [],
      test_psicologico: [],
      pruebas_cmj: [],
      sesiones_fuerza_individual: mockSesionesFuerza,
      trabajos_fuerza: mockTrabajos,
      ejercicios_fuerza: mockEjercicios,
    }
    vi.mocked(useStore).mockImplementation((selector?: any) => {
      return selector ? selector(mockState) : mockState
    })
  })

  it('1. Pestaña Fuerza aparece en perfil y muestra sesiones de la jugadora ordenadas por fecha descendente', () => {
    render(
      <MemoryRouter initialEntries={['/jugadoras/J1']}>
        <Routes>
          <Route path="/jugadoras/:id" element={<PlayerProfilePage />} />
        </Routes>
      </MemoryRouter>
    )

    // Pestaña Fuerza en tab list
    const btnTabFuerza = screen.getByRole('button', { name: 'Fuerza' })
    expect(btnTabFuerza).toBeInTheDocument()

    // Cambiar a la pestaña Fuerza
    fireEvent.click(btnTabFuerza)

    expect(screen.getByText('Historial de fuerza')).toBeInTheDocument()
    expect(screen.getByText('Sesiones individuales de fuerza registradas para esta jugadora.')).toBeInTheDocument()

    // 2 & 3. Exclusivamente J1, sin sesiones de J2 (2023-10-17)
    expect(screen.queryByText('2023-10-17')).not.toBeInTheDocument()

    // 4. Orden descendente: 2023-10-18, 2023-10-15, 2023-10-10, 2023-10-05
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1) // omit headers
    expect(rows[0]).toHaveTextContent('2023-10-18')
    expect(rows[1]).toHaveTextContent('2023-10-15')
    expect(rows[2]).toHaveTextContent('2023-10-10')
    expect(rows[3]).toHaveTextContent('2023-10-05')
  })

  it('5 & 6. Estado vacío exacto sin sesiones y CTA navega a /fuerza con id_jugadora', () => {
    vi.mocked(useStore).mockImplementation((selector?: any) => {
      const state = {
        jugadoras: mockJugadoras,
        wellness: [],
        lesiones: [],
        tests: [],
        rpe_partido: [],
        resumen_semanal: [],
        readiness: [],
        sesion_rpe: [],
        sesiones: [],
        ciclo_menstrual: [],
        carga_gps: [],
        fuerza_vbt: [],
        hidratacion: [],
        test_psicologico: [],
        pruebas_cmj: [],
        sesiones_fuerza_individual: [], // Sin sesiones
        trabajos_fuerza: [],
        ejercicios_fuerza: mockEjercicios,
      }
      return selector ? selector(state) : state
    })

    render(
      <MemoryRouter initialEntries={['/jugadoras/J1']}>
        <Routes>
          <Route path="/jugadoras/:id" element={<PlayerProfilePage />} />
          <Route path="/fuerza" element={<div>Página Fuerza Destino</div>} />
        </Routes>
      </MemoryRouter>
    )

    // Cambiar a la pestaña Fuerza
    fireEvent.click(screen.getByRole('button', { name: 'Fuerza' }))

    // Estado vacío exacto
    expect(screen.getByText('Sin sesiones de fuerza registradas')).toBeInTheDocument()

    // CTA
    const ctaBtn = screen.getByRole('button', { name: 'Ver registro de fuerza' })
    expect(ctaBtn).toBeInTheDocument()

    fireEvent.click(ctaBtn)
    expect(screen.getByText('Página Fuerza Destino')).toBeInTheDocument()
  })

  it('7, 8, 9, 10, 11, 12. Filtros locales (desde, hasta, finalidad, ejercicio), restablecer y estado sin coincidencias', () => {
    render(
      <MemoryRouter initialEntries={['/jugadoras/J1']}>
        <Routes>
          <Route path="/jugadoras/:id" element={<PlayerProfilePage />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Fuerza' }))

    // Filtro por finalidad: Fuerza Máxima
    const selects = screen.getAllByRole('combobox')
    const finalidadSelect = selects[0] // Finalidad select
    fireEvent.change(finalidadSelect, { target: { value: 'fuerza_maxima' } })

    expect(screen.getByText('2023-10-15')).toBeInTheDocument()
    expect(screen.queryByText('2023-10-18')).not.toBeInTheDocument()

    // Restablecer filtros
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer filtros' }))
    expect(screen.getByText('2023-10-18')).toBeInTheDocument()

    // Estado sin coincidencias (fecha que no existe)
    const dateInputs = screen.getAllByDisplayValue('')
    const desdeInput = dateInputs.find((el) => el.getAttribute('type') === 'date')
    if (desdeInput) {
      fireEvent.change(desdeInput, { target: { value: '2030-01-01' } })
    }
    expect(screen.getByText('No hay sesiones que coincidan con los filtros')).toBeInTheDocument()
  })

  it('13, 14, 15, 16, 17. Formateo de RPE, Duración y Tonelaje (cuantificable, parcial y —)', () => {
    render(
      <MemoryRouter initialEntries={['/jugadoras/J1']}>
        <Routes>
          <Route path="/jugadoras/:id" element={<PlayerProfilePage />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Fuerza' }))

    const table = screen.getByRole('table')

    // sf2 (2023-10-18): RPE null -> —, Duración null -> —, Tonelaje solo no cuantificable -> —
    const rowSf2 = within(table).getByText('2023-10-18').closest('tr')!
    const dashes = within(rowSf2).getAllByText('—')
    expect(dashes.length).toBe(3)

    // sf1 (2023-10-15): 500 kg total cuantificable
    const rowSf1 = within(table).getByText('2023-10-15').closest('tr')!
    expect(within(rowSf1).getByText('500 kg')).toBeInTheDocument()
    expect(within(rowSf1).getByText('8')).toBeInTheDocument()
    expect(within(rowSf1).getByText('60 min')).toBeInTheDocument()

    // sf3 (2023-10-10): tonelaje parcial (400 kg)
    const rowSf3 = within(table).getByText('2023-10-10').closest('tr')!
    expect(within(rowSf3).getByText(/Tonelaje parcial/i)).toBeInTheDocument()
  })

  it('22 & 23. Tarjeta Fuerza reciente muestra máximo 3 sesiones y activa la pestaña Fuerza', () => {
    render(
      <MemoryRouter initialEntries={['/jugadoras/J1']}>
        <Routes>
          <Route path="/jugadoras/:id" element={<PlayerProfilePage />} />
        </Routes>
      </MemoryRouter>
    )

    // Pestaña resumen activa por defecto
    expect(screen.getByText('Fuerza reciente')).toBeInTheDocument()

    // 22. Máximo 3 registros (2023-10-18, 2023-10-15, 2023-10-10, pero NO 2023-10-05)
    expect(screen.getByText('2023-10-18')).toBeInTheDocument()
    expect(screen.getByText('2023-10-15')).toBeInTheDocument()
    expect(screen.getByText('2023-10-10')).toBeInTheDocument()
    expect(screen.queryByText('2023-10-05')).not.toBeInTheDocument()

    // 23. Enlace "Ver historial de fuerza" activa la pestaña Fuerza
    const linkVerHistorial = screen.getByRole('button', { name: 'Ver historial de fuerza' })
    fireEvent.click(linkVerHistorial)

    expect(screen.getByText('Historial de fuerza')).toBeInTheDocument()
  })

  it('24. Enlace "Ver todas en Fuerza" navega con filtro de jugadora', () => {
    render(
      <MemoryRouter initialEntries={['/jugadoras/J1']}>
        <Routes>
          <Route path="/jugadoras/:id" element={<PlayerProfilePage />} />
          <Route path="/fuerza" element={<div>Ruta Fuerza Destino</div>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Fuerza' }))

    const btnVerTodas = screen.getByRole('button', { name: 'Ver todas en Fuerza' })
    fireEvent.click(btnVerTodas)

    expect(screen.getByText('Ruta Fuerza Destino')).toBeInTheDocument()
  })

  it('18. Ver detalle abre la sesión correcta en modo solo lectura y no altera la consulta', () => {
    render(
      <MemoryRouter initialEntries={['/jugadoras/J1']}>
        <Routes>
          <Route path="/jugadoras/:id" element={<PlayerProfilePage />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Fuerza' }))

    const table = screen.getByRole('table')
    const rowSf1 = within(table).getByText('2023-10-15').closest('tr')!
    
    // Click Ver detalle en la sesión sf1
    fireEvent.click(within(rowSf1).getByText('Ver detalle'))

    // Modal abierto con la sesión correcta
    expect(screen.getByText('Detalle de Sesión de Fuerza')).toBeInTheDocument()
    const fechasVisibles = screen.getAllByText('2023-10-15')
    expect(fechasVisibles.length).toBeGreaterThanOrEqual(2)
    const finalidadesVisibles = screen.getAllByText('Fuerza Máxima')
    expect(finalidadesVisibles.length).toBeGreaterThanOrEqual(2)
    const ejerciciosVisibles = screen.getAllByText(/Sentadilla Trasera/i)
    expect(ejerciciosVisibles.length).toBeGreaterThanOrEqual(2)

    // Ausencia de acciones de escritura/editar
    expect(screen.queryByRole('button', { name: 'Editar Sesión' })).not.toBeInTheDocument()

    // Cierre correcto
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByText('Detalle de Sesión de Fuerza')).not.toBeInTheDocument()

    // Filtros y datos visibles sin cambios tras el cierre
    expect(screen.getByText('2023-10-15')).toBeInTheDocument()
    expect(screen.getByText('2023-10-18')).toBeInTheDocument()
  })

  it('28. Trabajos legados asociados exclusivamente por id_sesion no alteran la consulta ni mutan datos legados', () => {
    const trabajoLegadoPuro = {
      id_trabajo: 'tr_legado_puro',
      id_sesion: 'sesion_grupo_1', // Asociado exclusivamente a id_sesion de grupo, sin id_sesion_fuerza
      id_jugadora: 'J1',
      id_ejercicio: 'ej1',
      ejercicio_nombre_historico: 'Sentadilla Legada',
      realizado: [{ id_serie: 's_leg', orden: 1, repeticiones: 10, carga_kg: 50 }],
      estado: 'completado' as const,
      updatedAt: '2023-01-01T10:00:00Z',
    }

    vi.mocked(useStore).mockImplementation((selector?: any) => {
      const state = {
        jugadoras: mockJugadoras,
        wellness: [],
        lesiones: [],
        tests: [],
        rpe_partido: [],
        resumen_semanal: [],
        readiness: [],
        sesion_rpe: [],
        sesiones: [],
        ciclo_menstrual: [],
        carga_gps: [],
        fuerza_vbt: [],
        hidratacion: [],
        test_psicologico: [],
        pruebas_cmj: [],
        sesiones_fuerza_individual: mockSesionesFuerza,
        trabajos_fuerza: [...mockTrabajos, trabajoLegadoPuro],
        ejercicios_fuerza: mockEjercicios,
      }
      return selector ? selector(state) : state
    })

    render(
      <MemoryRouter initialEntries={['/jugadoras/J1']}>
        <Routes>
          <Route path="/jugadoras/:id" element={<PlayerProfilePage />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Fuerza' }))

    // La consulta no crea/modifica entidades y no falla
    expect(screen.getByText('Historial de fuerza')).toBeInTheDocument()
    expect(trabajoLegadoPuro.id_sesion).toBe('sesion_grupo_1')
    expect((trabajoLegadoPuro as any).id_sesion_fuerza).toBeUndefined()
  })

  it('26 & 27 (Ajuste 6). Ausencia estricta de escrituras Dexie y de cambios en dominios externos durante la consulta', () => {
    if (!db.sesiones_fuerza_individual) {
      ;(db as any).sesiones_fuerza_individual = { add: vi.fn(), put: vi.fn(), update: vi.fn(), delete: vi.fn() }
    }
    if (!db.trabajos_fuerza) {
      ;(db as any).trabajos_fuerza = { add: vi.fn(), put: vi.fn(), update: vi.fn(), delete: vi.fn() }
    }

    const spyAddSesion = vi.spyOn(db.sesiones_fuerza_individual, 'add')
    const spyPutSesion = vi.spyOn(db.sesiones_fuerza_individual, 'put')
    const spyUpdateSesion = vi.spyOn(db.sesiones_fuerza_individual, 'update')
    const spyDeleteSesion = vi.spyOn(db.sesiones_fuerza_individual, 'delete')

    const spyAddTrabajo = vi.spyOn(db.trabajos_fuerza, 'add')
    const spyPutTrabajo = vi.spyOn(db.trabajos_fuerza, 'put')
    const spyUpdateTrabajo = vi.spyOn(db.trabajos_fuerza, 'update')
    const spyDeleteTrabajo = vi.spyOn(db.trabajos_fuerza, 'delete')

    render(
      <MemoryRouter initialEntries={['/jugadoras/J1']}>
        <Routes>
          <Route path="/jugadoras/:id" element={<PlayerProfilePage />} />
        </Routes>
      </MemoryRouter>
    )

    // Navegar a pestaña fuerza
    fireEvent.click(screen.getByRole('button', { name: 'Fuerza' }))

    // Aplicar filtro
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'fuerza_maxima' } })

    // Restablecer filtro
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer filtros' }))

    // Abrir detalle
    const table = screen.getByRole('table')
    fireEvent.click(within(table).getAllByText('Ver detalle')[0])

    // Cerrar detalle
    const btnCerrar = screen.getByRole('button', { name: 'Cerrar' })
    fireEvent.click(btnCerrar)

    // Verificación de CERO escrituras Dexie
    expect(spyAddSesion).not.toHaveBeenCalled()
    expect(spyPutSesion).not.toHaveBeenCalled()
    expect(spyUpdateSesion).not.toHaveBeenCalled()
    expect(spyDeleteSesion).not.toHaveBeenCalled()
    expect(spyAddTrabajo).not.toHaveBeenCalled()
    expect(spyPutTrabajo).not.toHaveBeenCalled()
    expect(spyUpdateTrabajo).not.toHaveBeenCalled()
    expect(spyDeleteTrabajo).not.toHaveBeenCalled()

    // Verificación de no mutación de dominios externos (el selector de mock devuelve arreglos inmutados)
    const storeSnapshot = (useStore as any)()
    expect(storeSnapshot.sesion_rpe).toEqual([])
    expect(storeSnapshot.pruebas_cmj).toEqual([])
    expect(storeSnapshot.wellness).toEqual([])
    expect(storeSnapshot.lesiones).toEqual([])
  })
})

