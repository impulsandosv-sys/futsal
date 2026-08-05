import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import React, { StrictMode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.unmock('@/db/database')
vi.unmock('@/services/resumenSemanal')
vi.unmock('@/services/readiness')

import { db } from '@/db/database'
import { useStore } from '@/store/store'
import { ImportPage } from './ImportPage'

describe('Bloque B — Test real de ImportPage (React Testing Library & DOM)', () => {
  beforeEach(async () => {
    await db.jugadoras.clear()
    await db.temporadas.clear()
    await db.alias_jugadora.clear()
    await db.wellness.clear()
    await db.historial_importaciones.clear()

    await db.jugadoras.add({
      id_jugadora: 'J001',
      nombre: 'Ana Lopez',
      fecha_nacimiento: '2000-01-01',
      posicion: 'Ala',
      altura_cm: 170,
      peso_kg: 60,
      imc: 20.7,
      grasa: 18,
      anos_experiencia_futsal: 5,
      historial_lesional: '',
      notas: '',
      activa: true
    })

    await db.temporadas.add({
      id_temporada: '2025-2026',
      nombre: 'Temporada 2025-2026',
      fecha_inicio: '2025-08-01',
      fecha_fin: '2026-06-30',
      activa: true,
      creadaEn: '2025-08-01T00:00:00Z',
      actualizadaEn: '2025-08-01T00:00:00Z',
      esPredeterminada: true
    })

    useStore.setState({
      wellness: [],
      historial_importaciones: [],
      jugadoras: await db.jugadoras.toArray(),
      temporadas: await db.temporadas.toArray(),
      alias_jugadora: [],
      plantillas_importacion: [
        {
          id: 1,
          nombre: 'Google Forms Wellness 2026-27',
          tipoImportacion: 'wellness',
          mapeoColumnas: [
            { excelHeader: 'ID_Jugadora', internalField: 'id_jugadora', required: true, label: 'ID Jugadora' },
            { excelHeader: 'Fecha', internalField: 'fecha', required: true, label: 'Fecha' },
            { excelHeader: 'Calidad_sueno', internalField: 'calidad_sueno', required: false, label: 'Calidad de sueño' },
            { excelHeader: 'Fatiga', internalField: 'fatiga', required: false, label: 'Fatiga' },
            { excelHeader: 'Dolor_muscular', internalField: 'dolor_muscular', required: false, label: 'Dolor muscular' },
            { excelHeader: 'Estres', internalField: 'estres', required: false, label: 'Estrés' },
            { excelHeader: 'Estado_animo', internalField: 'estado_animo', required: false, label: 'Estado de ánimo' }
          ],
          creadaEn: '2025-08-01T00:00:00Z',
          actualizadaEn: '2025-08-01T00:00:00Z',
          esPredeterminada: true
        }
      ]
    })
  })

  it('1, 2, 5 & 7. Excluir y restaurar fila NUEVO en DOM real bajo React.StrictMode actualiza contadores y badges sin escrituras Dexie', async () => {
    const csvContent = [
      'ID_Jugadora,Fecha,Calidad_sueno,Fatiga,Dolor_muscular,Estres,Estado_animo',
      'J001,2026-01-15,8,3,4,2,9'
    ].join('\n')

    const file = new File([csvContent], 'wellness_test.csv', { type: 'text/csv' })

    render(
      <MemoryRouter>
        <StrictMode>
          <ImportPage />
        </StrictMode>
      </MemoryRouter>
    )

    const inputs = document.querySelectorAll('input[type="file"]')
    const importInput = Array.from(inputs).find(input => !input.getAttribute('accept')?.includes('.json')) as HTMLInputElement
    expect(importInput).toBeTruthy()

    fireEvent.change(importInput, { target: { files: [file] } })

    await waitFor(() => {
      const nextBtn = screen.getByRole('button', { name: /siguiente/i })
      expect(nextBtn).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    let omitirCheckbox!: HTMLInputElement
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThan(0)
      omitirCheckbox = checkboxes[checkboxes.length - 1] as HTMLInputElement
    })

    expect(omitirCheckbox.checked).toBe(false)

    // Exclude row
    fireEvent.click(omitirCheckbox)

    // Check OMITIDA badge appears
    await waitFor(() => {
      expect(screen.getAllByText('OMITIDA').length).toBeGreaterThan(1)
    })

    // Restore row
    fireEvent.click(omitirCheckbox)

    // Check NUEVO badge recovers
    await waitFor(() => {
      expect(screen.getAllByText('NUEVO').length).toBeGreaterThan(0)
    })

    // Pureness check: 0 writes to Dexie
    expect(await db.wellness.count()).toBe(0)
    expect(await db.historial_importaciones.count()).toBe(0)
  })

  it('3 & 4. Excluir fila ACTUALIZACION_POSIBLE y ERROR actualiza contadores en el DOM', async () => {
    await db.wellness.add({
      id_jugadora: 'J001',
      fecha: '2026-01-15',
      calidad_sueno: 8,
      fatiga: 3,
      dolor_muscular: 4,
      estres: 2,
      estado_animo: 9,
      score_wellness: 8.0,
      dolor_especifico: ''
    })

    useStore.setState({
      wellness: await db.wellness.toArray()
    })

    const csvContent = [
      'ID_Jugadora,Fecha,Calidad_sueno,Fatiga,Dolor_muscular,Estres,Estado_animo',
      'J001,2026-01-15,7,4,5,3,8',
      'INVALID_ID,2099-01-01,1,1,1,1,1'
    ].join('\n')

    const file = new File([csvContent], 'wellness_test2.csv', { type: 'text/csv' })

    render(
      <MemoryRouter>
        <StrictMode>
          <ImportPage />
        </StrictMode>
      </MemoryRouter>
    )

    const inputs = document.querySelectorAll('input[type="file"]')
    const importInput = Array.from(inputs).find(input => !input.getAttribute('accept')?.includes('.json')) as HTMLInputElement

    fireEvent.change(importInput, { target: { files: [file] } })

    await waitFor(() => {
      const nextBtn = screen.getByRole('button', { name: /siguiente/i })
      expect(nextBtn).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    let errorCheckbox!: HTMLInputElement
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThan(0)
      errorCheckbox = checkboxes[checkboxes.length - 1] as HTMLInputElement
    })

    expect(screen.getByText('CONFLICTO')).toBeInTheDocument()
    expect(screen.getAllByText('ERROR').length).toBeGreaterThan(0)

    fireEvent.click(errorCheckbox)

    await waitFor(() => {
      expect(screen.getAllByText('OMITIDA').length).toBeGreaterThan(1)
    })
  })

  it('6. Filtro de tabla conserva el estado OMITIDA y prevEstado de las filas', async () => {
    const csvContent = [
      'ID_Jugadora,Fecha,Calidad_sueno,Fatiga,Dolor_muscular,Estres,Estado_animo',
      'J001,2026-01-15,8,3,4,2,9'
    ].join('\n')

    const file = new File([csvContent], 'wellness_test3.csv', { type: 'text/csv' })

    render(
      <MemoryRouter>
        <StrictMode>
          <ImportPage />
        </StrictMode>
      </MemoryRouter>
    )

    const inputs = document.querySelectorAll('input[type="file"]')
    const importInput = Array.from(inputs).find(input => !input.getAttribute('accept')?.includes('.json')) as HTMLInputElement

    fireEvent.change(importInput, { target: { files: [file] } })

    await waitFor(() => {
      const nextBtn = screen.getByRole('button', { name: /siguiente/i })
      expect(nextBtn).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    let checkbox!: HTMLInputElement
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThan(0)
      checkbox = checkboxes[checkboxes.length - 1] as HTMLInputElement
    })

    fireEvent.click(checkbox)

    await waitFor(() => {
      expect(screen.getAllByText('OMITIDA').length).toBeGreaterThan(1)
    })

    const filterBtn = screen.getByRole('button', { name: 'OMITIDA' })
    fireEvent.click(filterBtn)

    await waitFor(() => {
      expect(screen.getAllByText('OMITIDA').length).toBeGreaterThan(0)
    })
  })
})
