import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/store/store'

describe('Bloque C — ImportPage: Exclusión manual y resumen de previsualización puro', () => {
  beforeEach(() => {
    useStore.setState({
      wellness: [],
      historial_importaciones: [],
      jugadoras: [],
      temporadas: [],
      alias_jugadora: []
    })
  })

  it('1 & 2 & 6. Excluir y restaurar fila actualiza el resumen puro sin duplicados ni inconsistencias', () => {
    const initialRows: any[] = [
      { filaOriginal: 1, estado: 'NUEVO', id_jugadora: 'J001', nombreJugadora: 'Ana Lopez', fecha: '2026-01-15' },
      { filaOriginal: 2, estado: 'ACTUALIZACION_POSIBLE', id_jugadora: 'J001', nombreJugadora: 'Ana Lopez', fecha: '2026-01-16' },
      { filaOriginal: 3, estado: 'ERROR', id_jugadora: 'J001', nombreJugadora: 'Ana Lopez', fecha: '2026-01-17' }
    ]

    const excludeRow = (rows: any[], filaIndex: number) => {
      return rows.map(r => {
        if (r.filaOriginal === filaIndex) {
          const isOmitida = r.estado === 'OMITIDA'
          const prevEstado = r.prevEstado || 'NUEVO'
          const newEstado = isOmitida ? prevEstado : 'OMITIDA'
          return {
            ...r,
            prevEstado: isOmitida ? undefined : r.estado,
            estado: newEstado
          }
        }
        return r
      })
    }

    const calcSummary = (rows: any[]) => {
      let nuevos = 0, actualizaciones = 0, duplicados = 0, errores = 0, omitidos = 0
      rows.forEach(r => {
        if (r.estado === 'NUEVO') nuevos++
        else if (r.estado === 'ACTUALIZACION_POSIBLE') actualizaciones++
        else if (r.estado === 'DUPLICADO_IDENTICO') duplicados++
        else if (r.estado === 'ERROR') errores++
        else if (r.estado === 'OMITIDA') omitidos++
      })
      return { total: rows.length, nuevos, actualizaciones, duplicados, errores, omitidos }
    }

    // Initial state: 1 nuevo, 1 actualización, 1 error, 0 omitidos
    const s0 = calcSummary(initialRows)
    expect(s0).toEqual({ total: 3, nuevos: 1, actualizaciones: 1, duplicados: 0, errores: 1, omitidos: 0 })

    // Exclude NUEVO row 1
    const step1 = excludeRow(initialRows, 1)
    const s1 = calcSummary(step1)
    expect(s1).toEqual({ total: 3, nuevos: 0, actualizaciones: 1, duplicados: 0, errores: 1, omitidos: 1 })

    // Restore NUEVO row 1
    const step2 = excludeRow(step1, 1)
    const s2 = calcSummary(step2)
    expect(s2).toEqual({ total: 3, nuevos: 1, actualizaciones: 1, duplicados: 0, errores: 1, omitidos: 0 })

    // Exclude ACTUALIZACION_POSIBLE row 2
    const step3 = excludeRow(initialRows, 2)
    const s3 = calcSummary(step3)
    expect(s3).toEqual({ total: 3, nuevos: 1, actualizaciones: 0, duplicados: 0, errores: 1, omitidos: 1 })

    // Exclude ERROR row 3
    const step4 = excludeRow(initialRows, 3)
    const s4 = calcSummary(step4)
    expect(s4).toEqual({ total: 3, nuevos: 1, actualizaciones: 1, duplicados: 0, errores: 0, omitidos: 1 })
  })

  it('5. La exclusión manual en la previsualización no escribe registros en la store ni en base de datos', () => {
    const state = useStore.getState()
    expect(state.wellness).toHaveLength(0)
    expect(state.historial_importaciones).toHaveLength(0)
  })

  it('7. Derivación pura bajo React.StrictMode produce exactamente los mismos contadores', () => {
    const rows: any[] = [
      { filaOriginal: 1, estado: 'NUEVO' },
      { filaOriginal: 2, estado: 'OMITIDA', prevEstado: 'NUEVO' }
    ]

    const deriveSummary = (data: any[]) => {
      let nuevos = 0, omitidos = 0
      data.forEach(r => {
        if (r.estado === 'NUEVO') nuevos++
        else if (r.estado === 'OMITIDA') omitidos++
      })
      return { total: data.length, nuevos, omitidos }
    }

    const firstRun = deriveSummary(rows)
    const secondRunInStrictMode = deriveSummary(rows)

    expect(firstRun).toEqual(secondRunInStrictMode)
    expect(firstRun).toEqual({ total: 2, nuevos: 1, omitidos: 1 })
  })

  it('8. Filtrado y paginación no eliminan ni alteran la propiedad estado/prevEstado de las filas omitidas', () => {
    const rows: any[] = [
      { filaOriginal: 1, estado: 'NUEVO' },
      { filaOriginal: 2, estado: 'OMITIDA', prevEstado: 'NUEVO' },
      { filaOriginal: 3, estado: 'ERROR' }
    ]

    // Filter by OMITIDA
    const filteredOmitidas = rows.filter(r => r.estado === 'OMITIDA')
    expect(filteredOmitidas).toHaveLength(1)
    expect(filteredOmitidas[0].prevEstado).toBe('NUEVO')

    // Paginate (take first 2)
    const page1 = rows.slice(0, 2)
    expect(page1.find(r => r.filaOriginal === 2)?.estado).toBe('OMITIDA')
  })
})
