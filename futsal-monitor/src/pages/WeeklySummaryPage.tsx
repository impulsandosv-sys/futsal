import { useMemo, useState } from 'react'
import { useStore } from '@/store/store'
import { DataTable, DataRow, DataCell } from '@/components/shared/DataTable'
import { Filters } from '@/components/shared/Filters'
import { formatWeek, getWeeksFromActivities, getLocalDateString } from '@/domain/dates/dates'
import { getLoadStatus, calcularResumenEquipoSemanal, calcularCompletitudSemana } from '@/domain/monitoring/monitoring'
import { exportToExcel } from '@/utils/export'
import { generatePDFStaff } from '@/utils/pdf'
import { construirDTOStaffResumenSemanal, construirDatosStaffPDFResumen } from '@/domain/privacy/exportPrivacy'
import { useNavigate } from 'react-router-dom'

export function WeeklySummaryPage() {
  const {
    jugadoras, sesiones, partidos, sesion_rpe,
    resumen_semanal, filters, setFilter,
    generateWeeklySummary
  } = useStore()
  const navigate = useNavigate()
  const [generating, setGenerating] = useState(false)

  const semanas = useMemo(() => {
    const allFechas = [...sesiones.map(s => s.fecha), ...partidos.map(p => p.fecha)]
    return getWeeksFromActivities(allFechas)
  }, [sesiones, partidos])

  const handleGenerateWeek = async (semana: string) => {
    setGenerating(true)
    try {
      await generateWeeklySummary(semana, {
        incluirPartidos: filters.incluirPartidos ?? true,
        incluirGimnasio: filters.incluirGimnasio ?? true,
        incluirReadaptacion: filters.incluirReadaptacion ?? true,
      })
    } finally {
      setGenerating(false)
    }
  }

  const semanaActual = filters.semana || semanas[0] || ''
  const resumenSemana = resumen_semanal.filter(rs => rs.semana === semanaActual)

  const equipoResumen = useMemo(() => {
    return calcularResumenEquipoSemanal(resumenSemana)
  }, [resumenSemana])

  const completitudSemana = useMemo(() => {
    if (!semanaActual) return 0
    const weekEnd = new Date(semanaActual)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const weekEndStr = getLocalDateString(weekEnd)

    const sesionesSemana = sesiones.filter(s => s.fecha >= semanaActual && s.fecha <= weekEndStr)
    const rpesSemana = sesion_rpe.filter(r => r.fecha >= semanaActual && r.fecha <= weekEndStr)

    return calcularCompletitudSemana(jugadoras, sesionesSemana, rpesSemana)
  }, [semanaActual, sesiones, sesion_rpe, jugadoras])

  const handleExport = () => {
    const rawData = resumenSemana.map(rs => {
      const jug = jugadoras.find(j => j.id_jugadora === rs.id_jugadora)
      return {
        semana: formatWeek(rs.semana),
        nombre: jug?.nombre || rs.id_jugadora,
        carga_entreno: rs.carga_entreno,
        carga_partido: rs.carga_partido,
        carga_total: rs.carga_total,
        carga_cronica: rs.carga_cronica,
        acwr: rs.acwr,
        wellness_medio: rs.wellness_medio,
        num_sesiones: rs.num_sesiones,
        estado: rs.estado,
      }
    })
    const dtoData = construirDTOStaffResumenSemanal(rawData)
    exportToExcel(dtoData, `resumen_semanal_${semanaActual}`)
  }

  const handlePDF = () => {
    const rawData = resumenSemana.map(rs => {
      const jug = jugadoras.find(j => j.id_jugadora === rs.id_jugadora)
      return {
        semana: formatWeek(rs.semana),
        nombre: jug?.nombre || rs.id_jugadora,
        carga_entreno: rs.carga_entreno,
        carga_partido: rs.carga_partido,
        carga_total: rs.carga_total,
        carga_cronica: rs.carga_cronica,
        acwr: rs.acwr,
        wellness_medio: rs.wellness_medio,
        num_sesiones: rs.num_sesiones,
        estado: rs.estado,
      }
    })
    const datosPDF = construirDatosStaffPDFResumen(semanaActual, rawData)
    generatePDFStaff(datosPDF, `reporte_semanal_${semanaActual}`)
  }

  return (
    <div className="space-y-4" id="report-container">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-surface-800">Resumen Semanal</h1>
        <div className="flex gap-2">
          <button
            onClick={handlePDF}
            disabled={resumenSemana.length === 0}
            className="text-xs text-red-600 px-3 py-1.5 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
          >
            PDF
          </button>
          <button
            onClick={handleExport}
            disabled={resumenSemana.length === 0}
            className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded hover:bg-surface-50 disabled:opacity-50"
          >
            Exportar
          </button>
          <button
            onClick={() => semanaActual && handleGenerateWeek(semanaActual)}
            disabled={generating || !semanaActual}
            className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700 disabled:opacity-50"
          >
            {generating ? 'Generando...' : 'Generar resumen'}
          </button>
        </div>
      </div>

      <Filters showPlayer showWeek />

      <div className="bg-white rounded-lg border border-surface-200 p-3 flex flex-wrap gap-6 text-xs text-surface-600">
        <span className="font-semibold text-surface-700 self-center">Incluir en Carga Semanal:</span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.incluirPartidos ?? true}
            onChange={(e) => setFilter('incluirPartidos', e.target.checked)}
            className="rounded text-primary-600 focus:ring-primary-500 border-surface-300"
          />
          Partidos
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.incluirGimnasio ?? true}
            onChange={(e) => setFilter('incluirGimnasio', e.target.checked)}
            className="rounded text-primary-600 focus:ring-primary-500 border-surface-300"
          />
          Gimnasio
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.incluirReadaptacion ?? true}
            onChange={(e) => setFilter('incluirReadaptacion', e.target.checked)}
            className="rounded text-primary-600 focus:ring-primary-500 border-surface-300"
          />
          Recuperación / Readaptación
        </label>
      </div>

      {equipoResumen && semanaActual && (
        <div className="grid grid-cols-6 gap-3">
          <div className="bg-white rounded-lg border border-surface-200 p-3">
            <span className="text-[10px] text-surface-500 block">Carga total equipo</span>
            <span className="text-lg font-bold text-surface-800">{equipoResumen.carga_total} UA</span>
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-3">
            <span className="text-[10px] text-surface-500 block">Carga media jug.</span>
            <span className="text-lg font-bold text-surface-800">{equipoResumen.carga_media} UA</span>
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-3">
            <span className="text-[10px] text-surface-500 block">ACWR medio</span>
            <span className={`text-lg font-bold ${equipoResumen.acwr_medio >= 1.3 ? 'text-amber-600' : 'text-surface-800'}`}>
              {equipoResumen.acwr_medio.toFixed(2)}
            </span>
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-3">
            <span className="text-[10px] text-surface-500 block">Wellness medio</span>
            <span className="text-lg font-bold text-surface-800">{equipoResumen.wellness_medio}</span>
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-3">
            <span className="text-[10px] text-surface-500 block">Revisión prioritaria (ACWR &gt; 1.5)</span>
            <span className={`text-lg font-bold ${equipoResumen.prioritarias > 0 ? 'text-red-600' : 'text-surface-800'}`}>
              {equipoResumen.prioritarias}
            </span>
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-3">
            <span className="text-[10px] text-surface-500 block">Completitud datos</span>
            <span className={`text-lg font-bold ${
              completitudSemana >= 90 ? 'text-green-600' : completitudSemana >= 50 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {completitudSemana}%
            </span>
          </div>
        </div>
      )}

      {!semanaActual && (
        <div className="text-center py-12 text-surface-400 text-sm">
          Selecciona una semana para ver el resumen
        </div>
      )}

      {semanaActual && (
        <DataTable
          headers={['Jugadora', 'Posición', 'Carga Entreno', 'Carga Partido', 'Carga Total', 'Carga Crónica', 'ACWR', 'Wellness', 'Sesiones', 'Estado']}
          emptyMessage="No hay datos para esta semana. Genera el resumen primero."
        >
          {resumenSemana.map((rs) => {
            const jug = jugadoras.find((j) => j.id_jugadora === rs.id_jugadora)
            const status = getLoadStatus(rs.acwr)
            return (
              <DataRow key={rs.id} onClick={() => navigate(`/jugadoras/${rs.id_jugadora}`)}>
                <DataCell className="font-medium">{jug?.nombre || rs.id_jugadora}</DataCell>
                <DataCell className="text-surface-500">{jug?.posicion || '—'}</DataCell>
                <DataCell>{rs.carga_entreno !== null && rs.carga_entreno !== undefined ? Math.round(rs.carga_entreno) : '—'}</DataCell>
                <DataCell>{rs.carga_partido !== null && rs.carga_partido !== undefined ? Math.round(rs.carga_partido) : '—'}</DataCell>
                <DataCell className="font-medium">{rs.carga_total !== null && rs.carga_total !== undefined ? Math.round(rs.carga_total) : '—'}</DataCell>
                <DataCell>{rs.carga_cronica !== null && rs.carga_cronica !== undefined ? Math.round(rs.carga_cronica) : '—'}</DataCell>
                <DataCell>
                  <span className={`font-semibold ${status.color.split(' ')[0]}`}>
                    {rs.acwr.toFixed(2)}
                  </span>
                </DataCell>
                <DataCell>{rs.wellness_medio > 0 ? rs.wellness_medio : '—'}</DataCell>
                <DataCell>{rs.num_sesiones}</DataCell>
                <DataCell>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </DataCell>
              </DataRow>
            )
          })}
        </DataTable>
      )}
    </div>
  )
}
