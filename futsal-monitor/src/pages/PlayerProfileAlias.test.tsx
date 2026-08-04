import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.unmock('@/db/database')
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PlayerAliasSection } from '@/components/player/PlayerAliasSection'
import { db } from '@/db/database'

describe('T-02B — PlayerAliasSection UI & Alias Management', () => {
  const targetJugadoraId = 'JUG-TEST-001'

  beforeEach(async () => {
    await db.alias_jugadora.clear()
    await db.jugadoras.clear()
    await db.jugadoras.put({
      id_jugadora: targetJugadoraId,
      nombre: 'Ana López',
      posicion: 'Ala',
      dorsal: 10,
      activa: true
    } as any)
  })

  it('1. Renderiza estado vacío cuando la jugadora no tiene alias vinculados', async () => {
    render(<PlayerAliasSection id_jugadora={targetJugadoraId} nombreJugadora="Ana López" />)

    await waitFor(() => {
      expect(screen.getByText(/No hay alias vinculados a esta jugadora/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/Identidad vinculada a Ana López/i)).toBeInTheDocument()
  })

  it('2. Añadir alias de Google Forms lo persiste con id_jugadora de la ficha', async () => {
    render(<PlayerAliasSection id_jugadora={targetJugadoraId} nombreJugadora="Ana López" />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ej. GF-001 o ID-Chronojump')).toBeInTheDocument()
    })

    const valorInput = screen.getByPlaceholderText('Ej. GF-001 o ID-Chronojump')
    fireEvent.change(valorInput, { target: { value: 'GF-ANA-001' } })

    const submitBtn = screen.getByRole('button', { name: /Añadir Alias/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Alias "GF-ANA-001" \(google_forms\) añadido con éxito/i)).toBeInTheDocument()
    })

    const stored = await db.alias_jugadora.toArray()
    expect(stored.length).toBe(1)
    expect(stored[0].id_jugadora).toBe(targetJugadoraId)
    expect(stored[0].origen).toBe('google_forms')
    expect(stored[0].valor).toBe('GF-ANA-001')
    expect(stored[0].activo).toBe(true)
  })

  it('3. Permite seleccionar Origen Chronojump para preparar T-04', async () => {
    render(<PlayerAliasSection id_jugadora={targetJugadoraId} nombreJugadora="Ana López" />)

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    const selectOrigen = screen.getByRole('combobox')
    fireEvent.change(selectOrigen, { target: { value: 'chronojump' } })

    const valorInput = screen.getByPlaceholderText('Ej. GF-001 o ID-Chronojump')
    fireEvent.change(valorInput, { target: { value: 'CHRONO-ANA-99' } })

    const submitBtn = screen.getByRole('button', { name: /Añadir Alias/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Alias "CHRONO-ANA-99" \(chronojump\) añadido con éxito/i)).toBeInTheDocument()
    })

    const stored = await db.alias_jugadora.toArray()
    expect(stored.length).toBe(1)
    expect(stored[0].origen).toBe('chronojump')
    expect(stored[0].valor).toBe('CHRONO-ANA-99')
  })

  it('4. Muestra error legible de colisión si el par (origen, valor) ya existe activo', async () => {
    await db.alias_jugadora.put({
      id_jugadora: 'OTRA-JUGADORA',
      origen: 'google_forms',
      valor: 'GF-DUPLICADO',
      activo: true,
      fecha_alta: '2026-01-01'
    })

    render(<PlayerAliasSection id_jugadora={targetJugadoraId} nombreJugadora="Ana López" />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ej. GF-001 o ID-Chronojump')).toBeInTheDocument()
    })

    const valorInput = screen.getByPlaceholderText('Ej. GF-001 o ID-Chronojump')
    fireEvent.change(valorInput, { target: { value: 'GF-DUPLICADO' } })

    const submitBtn = screen.getByRole('button', { name: /Añadir Alias/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/ya está registrado/i)).toBeInTheDocument()
    })

    const listTarget = await db.alias_jugadora.where('id_jugadora').equals(targetJugadoraId).toArray()
    expect(listTarget.length).toBe(0)
  })

  it('5. Desactivar alias requiere confirmación y fecha de baja válida, conservando el registro histórico inactivo', async () => {
    const idAlias = await db.alias_jugadora.put({
      id_jugadora: targetJugadoraId,
      origen: 'google_forms',
      valor: 'GF-TO-DESACTIVATE',
      activo: true,
      fecha_alta: '2026-01-01'
    })

    render(<PlayerAliasSection id_jugadora={targetJugadoraId} nombreJugadora="Ana López" />)

    await waitFor(() => {
      expect(screen.getByText('GF-TO-DESACTIVATE')).toBeInTheDocument()
    })

    const desactivarBtn = screen.getByRole('button', { name: /Desactivar/i })
    fireEvent.click(desactivarBtn)

    await waitFor(() => {
      expect(screen.getByText(/Desactivar Alias Externo/i)).toBeInTheDocument()
    })

    const confirmarBtn = screen.getByRole('button', { name: /Confirmar Desactivación/i })
    fireEvent.click(confirmarBtn)

    await waitFor(() => {
      expect(screen.getByText(/Alias "GF-TO-DESACTIVATE" desactivado correctamente/i)).toBeInTheDocument()
    })

    const aliasDb = await db.alias_jugadora.get(idAlias)
    expect(aliasDb?.activo).toBe(false)
    expect(aliasDb?.fecha_baja).toBeDefined()
  })
})
