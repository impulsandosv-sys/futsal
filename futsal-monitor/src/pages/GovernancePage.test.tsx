import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.unmock('@/db/database')
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GovernancePage } from './GovernancePage'
import { db } from '@/db/database'

describe('T-02B — GovernancePage UI & Season Management', () => {
  beforeEach(async () => {
    await db.temporadas.clear()
  })

  it('1. Renderiza estado vacío cuando no hay temporadas y muestra aviso obligatorio', async () => {
    render(<GovernancePage />)

    await waitFor(() => {
      expect(screen.getByText(/No hay temporadas registradas/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/Sin temporada activa/i)).toBeInTheDocument()
    expect(
      screen.getByText(/La temporada activa es una referencia operativa y de gobierno. El filtrado transversal de históricos por temporada queda fuera de T-02B./i)
    ).toBeInTheDocument()
  })

  it('2. El formulario no expone ni acepta id_temporada ni activa como inputs', async () => {
    render(<GovernancePage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ej. 2026-2027')).toBeInTheDocument()
    })

    expect(screen.queryByLabelText(/id_temporada/i)).toBeNull()
    expect(screen.queryByLabelText(/activa/i)).toBeNull()
  })

  it('3. Crear la primera temporada se crea como ACTIVA automáticamente', async () => {
    render(<GovernancePage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ej. 2026-2027')).toBeInTheDocument()
    })

    const nameInput = screen.getByPlaceholderText('Ej. 2026-2027')
    const startDateInput = screen.getByLabelText(/Fecha de Inicio/i)
    const endDateInput = screen.getByLabelText(/Fecha de Fin/i)

    fireEvent.change(nameInput, { target: { value: 'Temporada 2026-2027' } })
    fireEvent.change(startDateInput, { target: { value: '2026-09-01' } })
    fireEvent.change(endDateInput, { target: { value: '2027-06-30' } })

    const submitBtn = screen.getByRole('button', { name: /Crear Temporada/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Temporada "Temporada 2026-2027" creada correctamente/i)).toBeInTheDocument()
    })

    const stored = await db.temporadas.toArray()
    expect(stored.length).toBe(1)
    expect(stored[0].nombre).toBe('Temporada 2026-2027')
    expect(stored[0].activa).toBe(true)
  })

  it('4. Crear una segunda temporada cuando ya hay una activa se crea como INACTIVA', async () => {
    await db.temporadas.put({
      id_temporada: 'TEMP-1',
      nombre: 'Temporada Actual',
      fecha_inicio: '2025-09-01',
      fecha_fin: '2026-06-30',
      activa: true
    })

    render(<GovernancePage />)

    await waitFor(() => {
      expect(screen.getByText('Temporada Actual')).toBeInTheDocument()
    })

    const nameInput = screen.getByPlaceholderText('Ej. 2026-2027')
    const startDateInput = screen.getByLabelText(/Fecha de Inicio/i)
    const endDateInput = screen.getByLabelText(/Fecha de Fin/i)

    fireEvent.change(nameInput, { target: { value: 'Temporada Nueva' } })
    fireEvent.change(startDateInput, { target: { value: '2026-09-01' } })
    fireEvent.change(endDateInput, { target: { value: '2027-06-30' } })

    const submitBtn = screen.getByRole('button', { name: /Crear Temporada/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Temporada "Temporada Nueva" creada correctamente/i)).toBeInTheDocument()
    })

    const stored = await db.temporadas.toArray()
    expect(stored.length).toBe(2)
    const nueva = stored.find((t) => t.nombre === 'Temporada Nueva')
    expect(nueva?.activa).toBe(false)
  })

  it('5. Rechaza fecha de inicio posterior a fecha de fin con mensaje de error legible', async () => {
    render(<GovernancePage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ej. 2026-2027')).toBeInTheDocument()
    })

    const nameInput = screen.getByPlaceholderText('Ej. 2026-2027')
    const startDateInput = screen.getByLabelText(/Fecha de Inicio/i)
    const endDateInput = screen.getByLabelText(/Fecha de Fin/i)

    fireEvent.change(nameInput, { target: { value: 'Temporada Error' } })
    fireEvent.change(startDateInput, { target: { value: '2027-09-01' } })
    fireEvent.change(endDateInput, { target: { value: '2026-06-30' } })

    const submitBtn = screen.getByRole('button', { name: /Crear Temporada/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/no puede ser posterior/i)).toBeInTheDocument()
    })

    const stored = await db.temporadas.toArray()
    expect(stored.length).toBe(0)
  })

  it('6. Activar requiere confirmación en modal y desactiva la temporada anterior', async () => {
    await db.temporadas.put({
      id_temporada: 'TEMP-1',
      nombre: 'Temporada Antigua',
      fecha_inicio: '2025-09-01',
      fecha_fin: '2026-06-30',
      activa: true
    })
    await db.temporadas.put({
      id_temporada: 'TEMP-2',
      nombre: 'Temporada Nueva',
      fecha_inicio: '2026-09-01',
      fecha_fin: '2027-06-30',
      activa: false
    })

    render(<GovernancePage />)

    await waitFor(() => {
      expect(screen.getByText('Temporada Nueva')).toBeInTheDocument()
    })

    const activarBtn = screen.getByRole('button', { name: /Activar/i })
    fireEvent.click(activarBtn)

    await waitFor(() => {
      expect(screen.getByText(/Confirmar Activación de Temporada/i)).toBeInTheDocument()
    })

    const confirmarBtn = screen.getByRole('button', { name: /Confirmar Activación/i })
    fireEvent.click(confirmarBtn)

    await waitFor(() => {
      expect(screen.getByText(/Temporada "Temporada Nueva" activada con éxito/i)).toBeInTheDocument()
    })

    const stored = await db.temporadas.toArray()
    const antigua = stored.find((t) => t.id_temporada === 'TEMP-1')
    const nueva = stored.find((t) => t.id_temporada === 'TEMP-2')

    expect(antigua?.activa).toBe(false)
    expect(nueva?.activa).toBe(true)
  })

  it('7. Archivar solicita confirmación y persiste activa: false (Inactiva)', async () => {
    await db.temporadas.put({
      id_temporada: 'TEMP-1',
      nombre: 'Temporada a Archivar',
      fecha_inicio: '2025-09-01',
      fecha_fin: '2026-06-30',
      activa: true
    })

    render(<GovernancePage />)

    await waitFor(() => {
      expect(screen.getByText('Temporada a Archivar')).toBeInTheDocument()
    })

    const archivarBtn = screen.getByRole('button', { name: /Archivar/i })
    fireEvent.click(archivarBtn)

    await waitFor(() => {
      expect(screen.getByText(/Confirmar Archivado de Temporada/i)).toBeInTheDocument()
    })

    const confirmarBtn = screen.getByRole('button', { name: /Confirmar Archivado/i })
    fireEvent.click(confirmarBtn)

    await waitFor(() => {
      expect(screen.getByText(/Temporada archivada/i)).toBeInTheDocument()
    })

    const stored = await db.temporadas.toArray()
    expect(stored.length).toBe(1)
    expect(stored[0].activa).toBe(false)
  })

  it('8. Al crear temporada, id_temporada se genera internamente con crypto.randomUUID, no vacío ni derivado de campos del formulario', async () => {
    const mockUUID = '550e8400-e29b-41d4-a716-446655440000'
    const originalRandomUUID = crypto.randomUUID
    crypto.randomUUID = vi.fn(() => mockUUID) as typeof crypto.randomUUID

    render(<GovernancePage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ej. 2026-2027')).toBeInTheDocument()
    })

    const nameInput = screen.getByPlaceholderText('Ej. 2026-2027')
    const startDateInput = screen.getByLabelText(/Fecha de Inicio/i)
    const endDateInput = screen.getByLabelText(/Fecha de Fin/i)

    fireEvent.change(nameInput, { target: { value: 'Mi Temporada' } })
    fireEvent.change(startDateInput, { target: { value: '2026-09-01' } })
    fireEvent.change(endDateInput, { target: { value: '2027-06-30' } })

    fireEvent.click(screen.getByRole('button', { name: /Crear Temporada/i }))

    await waitFor(() => {
      expect(screen.getByText(/creada correctamente/i)).toBeInTheDocument()
    })

    expect(crypto.randomUUID).toHaveBeenCalledOnce()

    const stored = await db.temporadas.toArray()
    expect(stored.length).toBe(1)
    expect(stored[0].id_temporada).toBe(mockUUID)
    expect(stored[0].id_temporada).not.toContain('Mi Temporada')
    expect(stored[0].id_temporada).not.toContain('2026-09-01')
    expect(stored[0].id_temporada).not.toContain('2027-06-30')

    crypto.randomUUID = originalRandomUUID
  })

  it('9. Dos creaciones consecutivas generan IDs diferentes', async () => {
    render(<GovernancePage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ej. 2026-2027')).toBeInTheDocument()
    })

    // Primera temporada
    fireEvent.change(screen.getByPlaceholderText('Ej. 2026-2027'), { target: { value: 'Temp A' } })
    fireEvent.change(screen.getByLabelText(/Fecha de Inicio/i), { target: { value: '2025-09-01' } })
    fireEvent.change(screen.getByLabelText(/Fecha de Fin/i), { target: { value: '2026-06-30' } })
    fireEvent.click(screen.getByRole('button', { name: /Crear Temporada/i }))

    await waitFor(() => {
      expect(screen.getByText(/creada correctamente/i)).toBeInTheDocument()
    })

    // Segunda temporada
    fireEvent.change(screen.getByPlaceholderText('Ej. 2026-2027'), { target: { value: 'Temp B' } })
    fireEvent.change(screen.getByLabelText(/Fecha de Inicio/i), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText(/Fecha de Fin/i), { target: { value: '2027-06-30' } })
    fireEvent.click(screen.getByRole('button', { name: /Crear Temporada/i }))

    await waitFor(async () => {
      const stored = await db.temporadas.toArray()
      expect(stored.length).toBe(2)
    })

    const stored = await db.temporadas.toArray()
    expect(stored[0].id_temporada).not.toBe(stored[1].id_temporada)
    expect(stored[0].id_temporada.length).toBeGreaterThan(0)
    expect(stored[1].id_temporada.length).toBeGreaterThan(0)
  })

  it('10. Se preserva lógica de primera temporada activa y siguientes inactivas con nuevo ID', async () => {
    render(<GovernancePage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ej. 2026-2027')).toBeInTheDocument()
    })

    // Primera
    fireEvent.change(screen.getByPlaceholderText('Ej. 2026-2027'), { target: { value: 'Primera' } })
    fireEvent.change(screen.getByLabelText(/Fecha de Inicio/i), { target: { value: '2025-09-01' } })
    fireEvent.change(screen.getByLabelText(/Fecha de Fin/i), { target: { value: '2026-06-30' } })
    fireEvent.click(screen.getByRole('button', { name: /Crear Temporada/i }))

    await waitFor(() => {
      expect(screen.getByText(/creada correctamente/i)).toBeInTheDocument()
    })

    // Segunda
    fireEvent.change(screen.getByPlaceholderText('Ej. 2026-2027'), { target: { value: 'Segunda' } })
    fireEvent.change(screen.getByLabelText(/Fecha de Inicio/i), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText(/Fecha de Fin/i), { target: { value: '2027-06-30' } })
    fireEvent.click(screen.getByRole('button', { name: /Crear Temporada/i }))

    await waitFor(async () => {
      const stored = await db.temporadas.toArray()
      expect(stored.length).toBe(2)
    })

    const stored = await db.temporadas.toArray()
    const primera = stored.find((t) => t.nombre === 'Primera')
    const segunda = stored.find((t) => t.nombre === 'Segunda')

    expect(primera?.activa).toBe(true)
    expect(segunda?.activa).toBe(false)
    // IDs are UUID format, not timestamp-based
    expect(primera?.id_temporada).not.toMatch(/^temp_/)
    expect(segunda?.id_temporada).not.toMatch(/^temp_/)
  })
})
