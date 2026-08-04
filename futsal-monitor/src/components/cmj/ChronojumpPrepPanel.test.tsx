import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.unmock('@/db/database')

import { FutsalDB } from '@/db/database'
import { ChronojumpPrepPanel } from './ChronojumpPrepPanel'
import { agregarAliasJugadora } from '@/domain/alias/aliasJugadora'
import type { Jugadora, AliasJugadora } from '@/types'

describe('ChronojumpPrepPanel Component (T-04B-PRE-CHECK)', () => {
  let testDb: FutsalDB

  beforeEach(async () => {
    const dbName = `test_panel_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    testDb = new FutsalDB(dbName)
    await testDb.open()
  })

  afterEach(async () => {
    if (testDb) {
      await testDb.close()
    }
  })

  it('1. Muestra estado vacío si no hay jugadoras activas en la plantilla', async () => {
    render(
      <MemoryRouter>
        <ChronojumpPrepPanel dbOverride={testDb} />
      </MemoryRouter>
    )

    expect(await screen.findByText(/No hay jugadoras activas/i)).toBeInTheDocument()
  })

  it('2. Muestra resumen e incidencias listando primero las jugadoras que requieren corrección', async () => {
    const j1: Jugadora = {
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
      notas: '',
      activa: true,
    }
    const j2: Jugadora = {
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
      activa: true,
    }
    await testDb.jugadoras.bulkPut([j1, j2])

    // Solo J2 tiene alias activo
    const aliasJ2: AliasJugadora = {
      id_jugadora: 'J2',
      origen: 'chronojump',
      valor: 'CJ-02',
      activo: true,
      fecha_alta: '2026-08-01',
    }
    await agregarAliasJugadora(testDb, aliasJ2)

    render(
      <MemoryRouter>
        <ChronojumpPrepPanel dbOverride={testDb} />
      </MemoryRouter>
    )

    expect(await screen.findByText(/Preparación Chronojump/i)).toBeInTheDocument()
    expect(await screen.findByText(/1 requieren atención/i)).toBeInTheDocument()

    // Ana Lopez (sin_alias) debe tener el botón "Gestionar alias"
    expect(screen.getByText('Ana Lopez')).toBeInTheDocument()
    expect(screen.getByText('Sin alias')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gestionar alias/i })).toBeInTheDocument()

    // Beatriz Gomez (lista) debe mostrar su alias CJ-02
    expect(screen.getByText('Beatriz Gomez')).toBeInTheDocument()
    expect(screen.getByText('CJ-02')).toBeInTheDocument()
  })

  it('3. Muestra estado compacto positivo cuando el 100% de las jugadoras están listas', async () => {
    const j1: Jugadora = {
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
      notas: '',
      activa: true,
    }
    await testDb.jugadoras.put(j1)

    const aliasJ1: AliasJugadora = {
      id_jugadora: 'J1',
      origen: 'chronojump',
      valor: 'CJ-01',
      activo: true,
      fecha_alta: '2026-08-01',
    }
    await agregarAliasJugadora(testDb, aliasJ1)

    render(
      <MemoryRouter>
        <ChronojumpPrepPanel dbOverride={testDb} />
      </MemoryRouter>
    )

    expect(await screen.findByText(/100% Preparado/i)).toBeInTheDocument()
    expect(screen.getByText(/Todas las jugadoras activas están listas para Chronojump/i)).toBeInTheDocument()
  })
})
