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
    await db.wellness_diario_importado.clear()
    await db.wellness_semanal_importado.clear()

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

  describe('BLOCK A — Preview counters', () => {
    it('Case 1 — Row NEW: check initial counters (1/1/0), exclusion (0/1/OMITIDA) and restoration (1/0/NUEVO) without Dexie writes', async () => {
      const csvContent = [
        'ID_Jugadora,Fecha,Calidad de sueno,Fatiga,Dolor muscular,Estres,Estado de animo',
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
        const nextBtn = screen.getByRole('button', { name: /^siguiente →$/i })
        expect(nextBtn).not.toBeDisabled()
      })

      fireEvent.click(screen.getByRole('button', { name: /^siguiente →$/i }))

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

    it('Case 2 — Row POSSIBLE_UPDATE: check counters (Act:1, Omit:0, CONFLICT), exclusion (Act:0, Omit:1) and restoration', async () => {
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
        'ID_Jugadora,Fecha,Calidad de sueno,Fatiga,Dolor muscular,Estres,Estado de animo',
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
        const nextBtn = screen.getByRole('button', { name: /^siguiente →$/i })
        expect(nextBtn).not.toBeDisabled()
      })

      fireEvent.click(screen.getByRole('button', { name: /^siguiente →$/i }))

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

    it('Case 3 — Row ERROR: check counters (New:1, Errors:1), block step 3, error exclusion and unblock', async () => {
      const csvContent = [
        'ID_Jugadora,Fecha,Calidad de sueno,Fatiga,Dolor muscular,Estres,Estado de animo',
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
        const nextBtn = screen.getByRole('button', { name: /^siguiente →$/i })
        expect(nextBtn).not.toBeDisabled()
      })

      fireEvent.click(screen.getByRole('button', { name: /^siguiente →$/i }))

      let errorCheckbox!: HTMLInputElement
      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox')
        expect(checkboxes.length).toBeGreaterThan(0)
        errorCheckbox = checkboxes[checkboxes.length - 1] as HTMLInputElement
      })

      // 2. Comprueba contadores (Nuevos: 1, Errores: 1) y bloqueo
      expect(screen.getByTestId('preview-count-nuevos').textContent).toBe('1')
      expect(screen.getByTestId('preview-count-errores').textContent).toBe('1')
      expect(screen.getByText(/No puedes aplicar la importaci.n todav.a/i)).toBeInTheDocument()

      const stepNextBtn = screen.getByRole('button', { name: /^siguiente →$/i })
      expect(stepNextBtn).toBeDisabled()

      // 3. Excluye fila de error
      fireEvent.click(errorCheckbox)

      // 4. Comprueba contadores (Errores: 0, Omitidas: 1) y desbloqueo del paso 3
      await waitFor(() => {
        expect(screen.getByTestId('preview-count-errores').textContent).toBe('0')
        expect(screen.getByTestId('preview-count-omitidas').textContent).toBe('1')
        expect(screen.queryByText(/No puedes aplicar la importaci.n todav.a/i)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /^siguiente →$/i })).not.toBeDisabled()
      })

      // Pureza Dexie: 0 escrituras
      expect(await db.wellness.count()).toBe(0)
    })

    it('Case 3.5 — Row ERROR: inline editing of ID Jugadora, save, and unblock', async () => {
      const csvContent = [
        'ID_Jugadora,Fecha,Calidad de sueno,Fatiga,Dolor muscular,Estres,Estado de animo',
        'INVALID_ID,2026-01-15,8,3,4,2,9'
      ].join('\n')

      const file = new File([csvContent], 'wellness_error_inline.csv', { type: 'text/csv' })

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
        expect(screen.getByRole('button', { name: /^siguiente →$/i })).not.toBeDisabled()
      })
      fireEvent.click(screen.getByRole('button', { name: /^siguiente →$/i }))

      // 1. Wait for ERROR state and block
      await waitFor(() => {
        expect(screen.getByTestId('preview-count-errores')).toHaveTextContent('1')
        expect(screen.getByText(/No puedes aplicar la importaci.n todav.a/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /^siguiente →$/i })).toBeDisabled()
      })

      // 2. Click Edit button
      const editBtn = screen.getByRole('button', { name: /editar/i })
      fireEvent.click(editBtn)

      // 3. Edit mode active: ID Jugadora dropdown and save button should be visible
      const idSelect = screen.getAllByRole('combobox').slice(-1)[0] // Dropdown for ID Jugadora
      const saveBtn = screen.getByRole('button', { name: /revalidar/i })

      expect(idSelect).toBeInTheDocument()
      expect(saveBtn).toBeInTheDocument()

      // 4. Change ID Jugadora to valid J001
      fireEvent.change(idSelect, { target: { value: 'J001' } })

      // 5. Save changes
      fireEvent.click(saveBtn)

      // 6. Wait for revalidation and unblock
      await waitFor(() => {
        expect(screen.getByTestId('preview-count-errores')).toHaveTextContent('0')
        expect(screen.getByTestId('preview-count-nuevos')).toHaveTextContent('1')
        expect(screen.queryByText(/No puedes aplicar la importaci.n todav.a/i)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /^siguiente →$/i })).not.toBeDisabled()
      })
    })

    it('Case 3.6 — Row ERROR: inline editing preserves comentario_sesion', async () => {
      useStore.setState({
        plantillas_importacion: [
          {
            id: 2,
            nombre: 'Google Forms',
            tipoImportacion: 'wellness',
            mapeoColumnas: [
              { excelHeader: 'ID_Jugadora', internalField: 'id_jugadora', required: true, label: 'ID Jugadora' },
              { excelHeader: 'Fecha del entreno', internalField: 'fecha', required: true, label: 'Fecha' },
              { excelHeader: 'Calidad de sueno', internalField: 'calidad_sueno', required: false, label: 'Calidad de sueño' },
              { excelHeader: 'Fatiga', internalField: 'fatiga', required: false, label: 'Fatiga' },
              { excelHeader: 'Dolor muscular', internalField: 'dolor_muscular', required: false, label: 'Dolor muscular' },
              { excelHeader: 'Estres', internalField: 'estres', required: false, label: 'Estrés' },
              { excelHeader: 'Estado de animo', internalField: 'estado_animo', required: false, label: 'Estado de ánimo' },
              { excelHeader: 'Comentario sobre la sesion (opcional)', internalField: 'comentario_sesion', required: false, label: 'Comentario de sesión' }
            ],
            creadaEn: '2025-08-01T00:00:00Z',
            actualizadaEn: '2025-08-01T00:00:00Z',
            esPredeterminada: true
          }
        ]
      })

      const csvContent = [
        'ID_Jugadora,Fecha del entreno,Calidad de sueno,Fatiga,Dolor muscular,Estres,Estado de animo,Comentario sobre la sesion (opcional)',
        'INVALID_ID,2026-01-15,8,3,4,2,9,Mi comentario de prueba'
      ].join('\n')

      const file = new File([csvContent], 'wellness_comentario.csv', { type: 'text/csv' })

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
        expect(screen.getByRole('button', { name: /^siguiente →$/i })).not.toBeDisabled()
      })
      fireEvent.click(screen.getByRole('button', { name: /^siguiente →$/i }))

      // 1. Wait for ERROR state
      await waitFor(() => {
        expect(screen.getByTestId('preview-count-errores')).toHaveTextContent('1')
      })

      // 2. Click Edit button
      const editBtn = screen.getByRole('button', { name: /editar/i })
      fireEvent.click(editBtn)

      const idSelect = screen.getAllByRole('combobox').slice(-1)[0]
      const saveBtn = screen.getByRole('button', { name: /revalidar/i })

      // 3. Change ID Jugadora to valid J001
      fireEvent.change(idSelect, { target: { value: 'J001' } })

      // 4. Save changes
      fireEvent.click(saveBtn)

      // 5. Wait for revalidation and unblock
      await waitFor(() => {
        expect(screen.getByTestId('preview-count-errores')).toHaveTextContent('0')
        expect(screen.getByTestId('preview-count-nuevos')).toHaveTextContent('1')
      })

      fireEvent.click(screen.getByRole('button', { name: /^siguiente →$/i }))

      const downloadBtn = await screen.findByRole('button', { name: /descargar copia de seguridad/i })
      fireEvent.click(downloadBtn)

      const confirmBackupCb = await screen.findByRole('checkbox', { name: /confirmo que he guardado/i })
      fireEvent.click(confirmBackupCb)

      // Mock window.alert
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})

      const applyBtn = await screen.findByRole('button', { name: /aplicar importación/i })
      fireEvent.click(applyBtn)

      await waitFor(() => {
        expect(screen.getByText(/Importación aplicada/i)).toBeInTheDocument()
      }, { timeout: 3000 })

      // Verificamos en IndexedDB
      const dbImportado = await db.wellness_diario_importado.toArray()
      expect(dbImportado).toHaveLength(1)
      expect(dbImportado[0].textos['Comentario sobre la sesión (opcional)']).toBe('Mi comentario de prueba')

      alertMock.mockRestore()
    })
  })

  describe('BLOCK B — Real pagination (51 rows)', () => {
    it('Demonstrates real pagination (>50 rows), navigation to page 2, exclusion on page 2, filtering OMITIDA and restoration', async () => {
      // 1. Genera 51 filas válidas para J001 con fechas únicas en temporada 2025-2026
      const csvLines = ['ID_Jugadora,Fecha,Calidad de sueno,Fatiga,Dolor muscular,Estres,Estado de animo']

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
        const nextBtn = screen.getByRole('button', { name: /^siguiente →$/i })
        expect(nextBtn).not.toBeDisabled()
      })

      fireEvent.click(screen.getByRole('button', { name: /^siguiente →$/i }))

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

  describe('BLOCK C — Flujo real de Importación (Google Forms)', () => {
    it('Case 4 — Mapea fechas y textos correctamente, bloquea con ERROR y desblquea al omitir', async () => {
      // 1. Configuramos plantilla parecida a la que se genera en la app real
      useStore.setState({
        plantillas_importacion: [
          {
            id: 2,
            nombre: 'Google Forms',
            tipoImportacion: 'wellness',
            mapeoColumnas: [
              { excelHeader: 'ID_Jugadora', internalField: 'id_jugadora', required: true, label: 'ID Jugadora' },
              { excelHeader: 'Fecha del entreno', internalField: 'fecha', required: true, label: 'Fecha' },
              { excelHeader: 'Calidad de sueno', internalField: 'calidad_sueno', required: false, label: 'Calidad de sueño' },
              { excelHeader: 'Fatiga', internalField: 'fatiga', required: false, label: 'Fatiga' },
              { excelHeader: 'Dolor muscular', internalField: 'dolor_muscular', required: false, label: 'Dolor muscular' },
              { excelHeader: 'Estres', internalField: 'estres', required: false, label: 'Estrés' },
              { excelHeader: 'Estado de animo', internalField: 'estado_animo', required: false, label: 'Estado de ánimo' },
              { excelHeader: 'Dolor especifico o nota importante (opcional)', internalField: 'dolor_especifico', required: false, label: 'Dolor específico' },
              { excelHeader: 'Comentario sobre la sesion (opcional)', internalField: 'comentario_sesion', required: false, label: 'Comentario de sesión' }
            ],
            creadaEn: '2025-08-01T00:00:00Z',
            actualizadaEn: '2025-08-01T00:00:00Z',
            esPredeterminada: false
          }
        ]
      })

      const csvContent = [
        'Marca temporal,ID_Jugadora,Fecha del entreno,Calidad de sueno,Fatiga,Dolor muscular,Estres,Estado de animo,Dolor especifico o nota importante (opcional),Comentario sobre la sesion (opcional)',
        '2026-02-01 10:00:00,J001,2026-02-01,8,3,4,2,9,Rodilla derecha,Buen entreno', // Válida
        '2026-02-02 10:00:00,J001,2099-01-01,1,1,1,1,1,,', // Inválida (fecha futura)
      ].join('\n')

      const file = new File([csvContent], 'Wellnes-Diario.csv', { type: 'text/csv' })

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
        expect(screen.getByRole('button', { name: /^siguiente →$/i })).not.toBeDisabled()
      })
      fireEvent.click(screen.getByRole('button', { name: /^siguiente →$/i }))

      // Debe haber error
      await waitFor(() => {
        expect(screen.getByTestId('preview-count-errores')).toHaveTextContent('1')
        expect(screen.getByText(/No puedes aplicar la importaci.n todav.a/i)).toBeInTheDocument()
      })

      // Omitir la fila con error
      const checkboxes = screen.getAllByRole('checkbox')
      const errorCheckbox = checkboxes[checkboxes.length - 1] as HTMLInputElement
      fireEvent.click(errorCheckbox)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^siguiente →$/i })).not.toBeDisabled()
      })

      // Avanzar al paso de confirmación
      fireEvent.click(screen.getByRole('button', { name: /^siguiente →$/i }))

      // Simular copia de seguridad
      const downloadBtn = await screen.findByRole('button', { name: /descargar copia de seguridad/i })
      fireEvent.click(downloadBtn)

      const confirmBackupCb = await screen.findByRole('checkbox', { name: /confirmo que he guardado/i })
      fireEvent.click(confirmBackupCb)

      // Mock window.alert to see if an error is thrown
      const alertMock = vi.spyOn(window, 'alert').mockImplementation((msg) => {
        console.error('WINDOW ALERT CALLED WITH:', msg)
        console.error('ALL CONSOLE ERRORS:', errorSpy.mock.calls)
      })

      // Confirmar importación
      const applyBtn = await screen.findByRole('button', { name: /aplicar importación/i })
      fireEvent.click(applyBtn)

      await waitFor(() => {
        expect(screen.getByText(/Importación aplicada/i)).toBeInTheDocument()
      }, { timeout: 3000 })

      // Verificar DB
      const dbWellness = await db.wellness.toArray()
      expect(dbWellness).toHaveLength(1)
      expect(dbWellness[0].fecha).toBe('2026-02-01')
      expect(dbWellness[0].dolor_especifico).toBe('Rodilla derecha')

      const dbImportado = await db.wellness_diario_importado.toArray()
      expect(dbImportado).toHaveLength(1)
      expect(dbImportado[0].textos['Comentario sobre la sesión (opcional)']).toBe('Buen entreno')
      expect(dbImportado[0].textos['Marca temporal']).toBe('46054.41615740741')

      alertMock.mockRestore()
    })
  })

  describe('BLOCK D - Flujo de Aliases (Recordar Asignacion)', () => {
    beforeEach(async () => {
      await db.wellness.clear()
      await db.wellness_diario_importado.clear()
      await db.alias_jugadora.clear()
      await db.jugadoras.clear()

      await db.jugadoras.bulkAdd([
        { id_jugadora: 'J001', nombre: 'Jugadora 1', posicion: 'Cierre', activa: true },
        { id_jugadora: 'J002', nombre: 'Jugadora 2', posicion: 'Ala', activa: true }
      ])
      await db.wellness.bulkAdd([
        { id: 'W1', id_jugadora: 'J001', fecha: '2026-02-01', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 8, dolor_especifico: 'Ninguno' },
        { id: 'W2', id_jugadora: 'J001', fecha: '2026-02-02', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 8, dolor_especifico: 'Ninguno' },
        { id: 'W3', id_jugadora: 'J002', fecha: '2026-02-01', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 8, dolor_especifico: 'Ninguno' },
        { id: 'W4', id_jugadora: 'J002', fecha: '2026-02-02', calidad_sueno: 8, fatiga: 7, dolor_muscular: 6, estres: 5, estado_animo: 8, dolor_especifico: 'Ninguno' }
      ])

      useStore.getState().loadAll()
    })

    const setupWithCSV = async (csvRows: string[]) => {
      const header = "Marca temporal,ID_Jugadora,Fecha,Calidad_sueno,Fatiga,Dolor_muscular,Estres,Estado_animo,Dolor_especifico\n";
      const csvContent = header + csvRows.join("\n")
      const file = new File([csvContent], 'test-wellness.csv', { type: 'text/csv' })

      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})

      render(
        <MemoryRouter>
          <ImportPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Asistente de Importacin|Asistente de Importación/i)).toBeInTheDocument()
      })

      const inputs = document.querySelectorAll('input[type="file"]')
      const importInput = Array.from(inputs).find(input => !input.getAttribute('accept')?.includes('.json')) as HTMLInputElement

      fireEvent.change(importInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^siguiente/i })).not.toBeDisabled()
      })
      fireEvent.click(screen.getByRole('button', { name: /^siguiente/i }))

      await waitFor(() => {
        expect(screen.getByText(/ID Jugadora/i)).toBeInTheDocument()
      })

      const selects = screen.getAllByRole('combobox')
      fireEvent.change(selects[1], { target: { value: 'ID_Jugadora' } })
      fireEvent.change(selects[2], { target: { value: 'Fecha' } })

      await waitFor(() => {
        expect(screen.getByText(/No puedes aplicar la importaci.n todav.a/i)).toBeInTheDocument()
      })

      return alertMock
    }

    const completeImport = async () => {
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^siguiente/i })).not.toBeDisabled()
      })
      fireEvent.click(screen.getByRole('button', { name: /^siguiente/i }))

      await waitFor(() => {
        expect(screen.getByText(/resumen de carga/i)).toBeInTheDocument()
      })

      const backupBtn = screen.getByRole('button', { name: /descargar copia de seguridad previa/i })
      fireEvent.click(backupBtn)

      const confirmCheck = await screen.findByRole('checkbox', { name: /confirmo que he guardado/i })
      await waitFor(() => {
        expect(confirmCheck).not.toBeDisabled()
      })
      fireEvent.click(confirmCheck)

      const applyBtn = screen.getByRole('button', { name: /^aplicar importacin|^aplicar importación/i })
      fireEvent.click(applyBtn)

      await waitFor(() => {
        expect(screen.getByText(/importacin aplicada|importación aplicada/i)).toBeInTheDocument()
      }, { timeout: 3000 })
    }

    it('Test A - Reabrir conserva alias original', async () => {
      const alertMock = await setupWithCSV(["2026-02-01 10:00:00,Desconocida1,2026-02-01,9,7,6,5,8,Ninguno"])

      // 1. Asignar J001 con recordar activado
      let editBtn = await screen.findByRole('button', { name: /editar/i })
      fireEvent.click(editBtn)
      await waitFor(() => { expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0) })

      const idSelects = screen.getAllByRole('combobox')
      const idSelect = idSelects[idSelects.length - 1]
      fireEvent.change(idSelect, { target: { value: 'J001' } })

      let checkbox = await screen.findByLabelText(/recordar asignacin|recordar asignación/i) as HTMLInputElement
      if (!checkbox.checked) fireEvent.click(checkbox)

      // 2. Guardar/revalidar
      let saveBtn = screen.getByRole('button', { name: /revalidar/i })
      fireEvent.click(saveBtn)
      await waitFor(() => { expect(screen.queryByRole('button', { name: /revalidar/i })).not.toBeInTheDocument() })
      fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
      await waitFor(() => { expect(screen.getByRole('button', { name: /^siguiente/i })).not.toBeDisabled() })
      fireEvent.click(screen.getByRole('button', { name: 'Todos' }))

      // 3. Reabrir edicion
      editBtn = await screen.findByRole('button', { name: /editar/i })
      fireEvent.click(editBtn)
      await waitFor(() => { expect(screen.getByRole('button', { name: /revalidar/i })).toBeInTheDocument() })

      // 4. Verificar que alias_origen_real sigue siendo Desconocida1 (el checkbox esta visible y marcado)
      checkbox = await screen.findByLabelText(/recordar asignacin|recordar asignación/i) as HTMLInputElement
      expect(checkbox).toBeInTheDocument()
      expect(checkbox.checked).toBe(true)

      // 5. Desmarcar, guardar e importar
      fireEvent.click(checkbox)
      saveBtn = screen.getByRole('button', { name: /revalidar/i })
      fireEvent.click(saveBtn)
      await waitFor(() => { expect(screen.queryByRole('button', { name: /revalidar/i })).not.toBeInTheDocument() })
      fireEvent.click(screen.getByRole('button', { name: 'Todos' }))

      await completeImport()

      // 6. Verificar que Desconocida1 no se persiste
      const allAliases = await db.alias_jugadora.toArray()
      const savedAlias = allAliases.find(a => a.valor.toLowerCase() === 'desconocida1')
      expect(savedAlias).toBeUndefined()

      alertMock.mockRestore()
    })

    it('Test B - Dos aliases, misma jugadora', async () => {
      const alertMock = await setupWithCSV([
        "2026-02-01 10:00:00,Ani,2026-02-01,9,7,6,5,8,Ninguno",
        "2026-02-02 10:00:00,Ana G.,2026-02-02,9,7,6,5,8,Ninguno"
      ])

      // Asignar ambas a J001
      let editBtns = await screen.findAllByRole('button', { name: /editar/i })

      // Fila 2 (Ani)
      fireEvent.click(editBtns[0])
      await waitFor(() => { expect(screen.getByRole('button', { name: /revalidar/i })).toBeInTheDocument() })
      let idSelects = screen.getAllByRole('combobox')
      fireEvent.change(idSelects[idSelects.length - 1], { target: { value: 'J001' } })
      let checkbox = await screen.findByLabelText(/recordar asignacin|recordar asignación/i) as HTMLInputElement
      if (!checkbox.checked) fireEvent.click(checkbox)
      fireEvent.click(screen.getByRole('button', { name: /revalidar/i }))
      await waitFor(() => { expect(screen.queryByRole('button', { name: /revalidar/i })).not.toBeInTheDocument() })
      fireEvent.click(screen.getByRole('button', { name: 'Todos' }))

      // Fila 3 (Ana G.)
      editBtns = await screen.findAllByRole('button', { name: /editar/i })
      fireEvent.click(editBtns[1])

      await waitFor(() => { expect(screen.getByRole('button', { name: /revalidar/i })).toBeInTheDocument() })
      idSelects = screen.getAllByRole('combobox')
      fireEvent.change(idSelects[idSelects.length - 1], { target: { value: 'J001' } })
      checkbox = await screen.findByLabelText(/recordar asignacin|recordar asignación/i) as HTMLInputElement
      if (!checkbox.checked) fireEvent.click(checkbox)
      fireEvent.click(screen.getByRole('button', { name: /revalidar/i }))
      await waitFor(() => { expect(screen.queryByRole('button', { name: /revalidar/i })).not.toBeInTheDocument() })
      fireEvent.click(screen.getByRole('button', { name: 'Todos' }))

      await waitFor(() => { expect(screen.getByRole('button', { name: /^siguiente/i })).not.toBeDisabled() })
      fireEvent.click(screen.getByRole('button', { name: 'Todos' }))

      // Reabrir solo fila 2 (Ani)
      const reopenBtns = await screen.findAllByRole('button', { name: /editar/i })
      fireEvent.click(reopenBtns[0])
      await waitFor(() => { expect(screen.getByRole('button', { name: /revalidar/i })).toBeInTheDocument() })

      // Desmarcar
      checkbox = await screen.findByLabelText(/recordar asignacin|recordar asignación/i) as HTMLInputElement
      if (checkbox.checked) fireEvent.click(checkbox)
      fireEvent.click(screen.getByRole('button', { name: /revalidar/i }))
      await waitFor(() => { expect(screen.queryByRole('button', { name: /revalidar/i })).not.toBeInTheDocument() })
      fireEvent.click(screen.getByRole('button', { name: 'Todos' }))

      await completeImport()

      // Verificar DB
      const allAliases = await db.alias_jugadora.toArray()

      const ani = allAliases.find(a => a.valor.toLowerCase() === 'ani' && a.activo === true)
      expect(ani).toBeUndefined()

      const anaG = allAliases.find(a => a.valor.toLowerCase() === 'ana g.' && a.activo === true)
      expect(anaG).toBeDefined()
      expect(anaG?.id_jugadora).toBe('J001')

      alertMock.mockRestore()
    })

    it('Test C - Cambio de jugadora', async () => {
      const alertMock = await setupWithCSV(["2026-02-01 10:00:00,Ani,2026-02-01,9,7,6,5,8,Ninguno"])

      // Asignar J001
      let editBtn = await screen.findByRole('button', { name: /editar/i })
      fireEvent.click(editBtn)
      await waitFor(() => { expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0) })

      let idSelects = screen.getAllByRole('combobox')
      fireEvent.change(idSelects[idSelects.length - 1], { target: { value: 'J001' } })

      let checkbox = await screen.findByLabelText(/recordar asignacin|recordar asignación/i) as HTMLInputElement
      if (!checkbox.checked) fireEvent.click(checkbox)

      fireEvent.click(screen.getByRole('button', { name: /revalidar/i }))
      await waitFor(() => { expect(screen.queryByRole('button', { name: /revalidar/i })).not.toBeInTheDocument() })
      fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
      await waitFor(() => { expect(screen.getByRole('button', { name: /^siguiente/i })).not.toBeDisabled() })
      fireEvent.click(screen.getByRole('button', { name: 'Todos' }))

      // Reabrir misma fila
      editBtn = await screen.findByRole('button', { name: /editar/i })
      fireEvent.click(editBtn)
      await waitFor(() => { expect(screen.getByRole('button', { name: /revalidar/i })).toBeInTheDocument() })

      // Cambiar a J002
      idSelects = screen.getAllByRole('combobox')
      fireEvent.change(idSelects[idSelects.length - 1], { target: { value: 'J002' } })

      // El checkbox deberia seguir ahi y estar marcado, si no, lo marcamos
      checkbox = await screen.findByLabelText(/recordar asignacin|recordar asignación/i) as HTMLInputElement
      if (!checkbox.checked) fireEvent.click(checkbox)

      fireEvent.click(screen.getByRole('button', { name: /revalidar/i }))
      await waitFor(() => { expect(screen.queryByRole('button', { name: /revalidar/i })).not.toBeInTheDocument() })
      fireEvent.click(screen.getByRole('button', { name: 'Todos' }))

      await completeImport()

      // Verificar
      const allAliases = await db.alias_jugadora.toArray()
      const ani = allAliases.find(a => a.valor.toLowerCase() === 'ani' && a.activo === true)
      expect(ani).toBeDefined()
      expect(ani?.id_jugadora).toBe('J002')

      const aniJ001 = allAliases.find(a => a.valor.toLowerCase() === 'ani' && a.id_jugadora === 'J001')
      expect(aniJ001).toBeUndefined()

      alertMock.mockRestore()
    })
  })

  describe('BLOCK E - PR-3 Calidad del Dato', () => {
    it('Muestra los contadores correctos del Panel de Calidad y verifica mensaje de bloqueo', async () => {
      const csvContent = [
        'ID_Jugadora,Fecha,Calidad de sueno,Fatiga,Dolor muscular,Estres,Estado de animo',
        'J001,2026-01-15,8,3,4,2,9',
        'J002,2026-01-15,8,3,4,2,9',
        'NO_EXISTE,2026-01-15,8,3,4,2,9',
        'J001,2026-01-15,8,3,4,2,10' // Conflicto/Actualizacion
      ].join('\n')

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

      useStore.setState({ wellness: await db.wellness.toArray() })

      const file = new File([csvContent], 'wellness_pr3.csv', { type: 'text/csv' })

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
        expect(screen.getByRole('button', { name: /^siguiente/i })).not.toBeDisabled()
      })
      fireEvent.click(screen.getByRole('button', { name: /^siguiente/i }))

      // Esperar a que se calcule la previsualizacion (async)
      await waitFor(() => {
        expect(screen.getByTestId('preview-count-total').textContent).toBe('4')
      })

      // Verificar contadores del panel de calidad (id=quality-*)
      expect(screen.getByTestId('quality-resIdExacto').textContent).toBe('1') // J001 (x2) - 1 duplicado identico que cuenta, y 1 duplicado de archivo que da ERROR
      expect(screen.getByTestId('quality-resConflictosPendientes').textContent).toBe('3') // J002 y NO_EXISTE

      // Verificar que el asistente está bloqueado con un mensaje accionable
      expect(screen.getByText(/No puedes aplicar la importación todavía:/i)).toBeInTheDocument()
      expect(screen.getByText(/2 fila\(s\) requiere\(n\) asignar jugadora/i)).toBeInTheDocument()
    })
  })
})
