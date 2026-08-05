import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React, { StrictMode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.unmock('@/db/database')
vi.unmock('@/services/resumenSemanal')
vi.unmock('@/services/readiness')

import { db } from '@/db/database'
import { useStore } from '@/store/store'
import { ImportPage } from './ImportPage'

describe('Microcierre de Fase 2 — Cobertura real de ImportPage (DOM, Contadores, Paginación, StrictMode)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    errorSpy = vi.spyOn(console, 'error')
    warnSpy = vi.spyOn(console, 'warn')

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

  afterEach(() => {
    const reactErrorMsgs = errorSpy.mock.calls
      .flatMap(call => call.map(arg => String(arg)))
      .filter(msg =>
        msg.includes('Warning:') ||
        msg.includes('Cannot update') ||
        msg.includes('stale state') ||
        msg.includes('unmounted')
      )
    expect(reactErrorMsgs).toEqual([])

    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })

  describe('BLOQUE A — Contadores reales de previsualización', () => {
    it('Caso 1 — Fila NUEVO: verifica contadores iniciales (1/1/0), exclusión (0/1/OMITIDA) y restauración (1/0/NUEVO) sin escrituras Dexie', async () => {
      const csvContent = [
        'ID_Jugadora,Fecha,Calidad_sueno,Fatiga,Dolor_muscular,Estres,Estado_animo',
        'J001,2026-01-15,8,3,4,2,9'
      ].join('\n')

      const file = new File([csvContent], 'wellness_nuevo.csv', { type: 'text/csv' })

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

      // 3. Verifica contadores DOM iniciales
      expect(screen.getByTestId('preview-count-total').textContent).toBe('1')
      expect(screen.getByTestId('preview-count-nuevos').textContent).toBe('1')
      expect(screen.getByTestId('preview-count-omitidas').textContent).toBe('0')
      expect(screen.getAllByText('NUEVO').length).toBeGreaterThan(0)

      // 4. Excluye fila
      fireEvent.click(omitirCheckbox)

      // 5. Verifica contadores y estado OMITIDA tras exclusión
      await waitFor(() => {
        expect(screen.getByTestId('preview-count-nuevos').textContent).toBe('0')
        expect(screen.getByTestId('preview-count-omitidas').textContent).toBe('1')
        expect(screen.getAllByText('OMITIDA').length).toBeGreaterThan(1)
      })

      // 6. Restaura fila
      fireEvent.click(omitirCheckbox)

      // 7. Verifica contadores y estado NUEVO tras restauración
      await waitFor(() => {
        expect(screen.getByTestId('preview-count-nuevos').textContent).toBe('1')
        expect(screen.getByTestId('preview-count-omitidas').textContent).toBe('0')
        expect(screen.getAllByText('NUEVO').length).toBeGreaterThan(0)
      })

      // Pureza Dexie: 0 escrituras
      expect(await db.wellness.count()).toBe(0)
      expect(await db.historial_importaciones.count()).toBe(0)
    })

    it('Caso 2 — Fila ACTUALIZACION_POSIBLE: verifica contadores (Act:1, Omit:0, CONFLICTO), exclusión (Act:0, Omit:1) y restauración', async () => {
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
        'J001,2026-01-15,7,4,5,3,8'
      ].join('\n')

      const file = new File([csvContent], 'wellness_conflicto.csv', { type: 'text/csv' })

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

      // 3. Comprueba contadores iniciales y CONFLICTO
      expect(screen.getByTestId('preview-count-actualizaciones').textContent).toBe('1')
      expect(screen.getByTestId('preview-count-omitidas').textContent).toBe('0')
      expect(screen.getByText('CONFLICTO')).toBeInTheDocument()

      // 4. Excluye fila
      fireEvent.click(checkbox)

      // 5. Comprueba contadores y OMITIDA
      await waitFor(() => {
        expect(screen.getByTestId('preview-count-actualizaciones').textContent).toBe('0')
        expect(screen.getByTestId('preview-count-omitidas').textContent).toBe('1')
        expect(screen.getAllByText('OMITIDA').length).toBeGreaterThan(1)
      })

      // 6. Restaura fila
      fireEvent.click(checkbox)

      // Comprueba vuelta a CONFLICTO
      await waitFor(() => {
        expect(screen.getByTestId('preview-count-actualizaciones').textContent).toBe('1')
        expect(screen.getByTestId('preview-count-omitidas').textContent).toBe('0')
        expect(screen.getByText('CONFLICTO')).toBeInTheDocument()
      })

      // Pureza Dexie: sólo el registro previo
      expect(await db.wellness.count()).toBe(1)
    })

    it('Caso 3 — Fila ERROR: verifica contadores (Nuevos:1, Errores:1), bloqueo del paso 3, exclusión de error y desbloqueo', async () => {
      const csvContent = [
        'ID_Jugadora,Fecha,Calidad_sueno,Fatiga,Dolor_muscular,Estres,Estado_animo',
        'J001,2026-01-15,8,3,4,2,9',
        'INVALID_ID,2099-01-01,1,1,1,1,1'
      ].join('\n')

      const file = new File([csvContent], 'wellness_error.csv', { type: 'text/csv' })

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

      // 2. Comprueba contadores (Nuevos: 1, Errores: 1) y bloqueo
      expect(screen.getByTestId('preview-count-nuevos').textContent).toBe('1')
      expect(screen.getByTestId('preview-count-errores').textContent).toBe('1')
      expect(screen.getByText(/Asistente bloqueado/i)).toBeInTheDocument()

      const stepNextBtn = screen.getByRole('button', { name: /siguiente/i })
      expect(stepNextBtn).toBeDisabled()

      // 3. Excluye fila de error
      fireEvent.click(errorCheckbox)

      // 4. Comprueba contadores (Errores: 0, Omitidas: 1) y desbloqueo del paso 3
      await waitFor(() => {
        expect(screen.getByTestId('preview-count-errores').textContent).toBe('0')
        expect(screen.getByTestId('preview-count-omitidas').textContent).toBe('1')
        expect(screen.queryByText(/Asistente bloqueado/i)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /siguiente/i })).not.toBeDisabled()
      })

      // Pureza Dexie: 0 escrituras
      expect(await db.wellness.count()).toBe(0)
    })
  })

  describe('BLOQUE B — Paginación real (51 filas)', () => {
    it('Demuestra paginación real (>50 filas), navegación a pág 2, exclusión en pág 2, filtrado OMITIDA y restauración', async () => {
      // 1. Genera 51 filas válidas para J001 con fechas únicas en temporada 2025-2026
      const csvLines = ['ID_Jugadora,Fecha,Calidad_sueno,Fatiga,Dolor_muscular,Estres,Estado_animo']
      
      const startDate = new Date('2026-01-01')
      for (let i = 0; i < 51; i++) {
        const current = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
        const y = current.getFullYear()
        const m = String(current.getMonth() + 1).padStart(2, '0')
        const d = String(current.getDate()).padStart(2, '0')
        const dateStr = `${y}-${m}-${d}`
        csvLines.push(`J001,${dateStr},8,3,4,2,9`)
      }

      const csvContent = csvLines.join('\n')
      const file = new File([csvContent], 'wellness_51_rows.csv', { type: 'text/csv' })

      // 2. Renderiza en StrictMode
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

      // 3. Avanza al paso de validación
      await waitFor(() => {
        const nextBtn = screen.getByRole('button', { name: /siguiente/i })
        expect(nextBtn).not.toBeDisabled()
      })

      fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

      // 4. Comprueba página 1 de 2 y botón Siguiente disponible
      await waitFor(() => {
        expect(screen.getByTestId('pagination-info')).toHaveTextContent('Página 1 de 2')
        expect(screen.getByTestId('pagination-next')).not.toBeDisabled()
      })

      // 5. Pulsa Siguiente
      fireEvent.click(screen.getByTestId('pagination-next'))

      // 6. Comprueba que muestra la segunda página
      await waitFor(() => {
        expect(screen.getByTestId('pagination-info')).toHaveTextContent('Página 2 de 2')
      })

      // 7. Excluye la fila visible en la segunda página (fila 51 original)
      const page2Checkboxes = screen.getAllByRole('checkbox')
      expect(page2Checkboxes.length).toBe(1) // Sólo 1 fila en la página 2
      const row51Checkbox = page2Checkboxes[0] as HTMLInputElement

      fireEvent.click(row51Checkbox)

      // 8. Comprueba estado visible OMITIDA, contador omitidas (1) y total (51)
      await waitFor(() => {
        expect(screen.getByTestId('preview-count-omitidas')).toHaveTextContent('1')
        expect(screen.getByTestId('preview-count-total')).toHaveTextContent('51')
        expect(screen.getAllByText('OMITIDA').length).toBeGreaterThan(1)
      })

      // 9. Cambia el filtro a OMITIDA
      const filterOmitidaBtn = screen.getByRole('button', { name: 'OMITIDA' })
      fireEvent.click(filterOmitidaBtn)

      // 10. Comprueba que la fila sigue visible en el filtro OMITIDA
      await waitFor(() => {
        const omitidaFilterCheckboxes = screen.getAllByRole('checkbox')
        expect(omitidaFilterCheckboxes.length).toBe(1)
        expect(screen.getAllByText('OMITIDA').length).toBeGreaterThan(0)
      })

      // 11. Restaura la fila desde el filtro OMITIDA
      const omitidaCheckboxInFilter = screen.getByRole('checkbox')
      fireEvent.click(omitidaCheckboxInFilter)

      // 12. Comprueba que desaparece del filtro OMITIDA y el contador de omitidas vuelve a 0
      await waitFor(() => {
        expect(screen.getByText('No hay registros que coincidan con este filtro.')).toBeInTheDocument()
        expect(screen.getByTestId('preview-count-omitidas')).toHaveTextContent('0')
      })

      // Pureza Dexie: 0 escrituras
      expect(await db.wellness.count()).toBe(0)
      expect(await db.historial_importaciones.count()).toBe(0)
    })
  })
})
