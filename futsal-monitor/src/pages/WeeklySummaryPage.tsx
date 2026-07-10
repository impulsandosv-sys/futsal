import { useMemo, useState } from 'react'
import { useStore } from '@/store/store'
import { DataTable, DataRow, DataCell } from '@/components/shared/DataTable'
import { Filters } from '@/components/shared/Filters'
import { calcularResumenSemanal, getWeekId, formatWeek, getLoadStatus } from '@/utils/calculations'
import { db } from '@/db/database'
import { exportToExcel } from '@/utils/export'
import { useNavigate } from 'react-router-dom'

export function WeeklySummaryPage() {
  const {
    jugadoras, sesiones, partidos, rpe_entreno, rpe_partido,
    wellness, resumen_semanal, filters,
  } = useStore()
  const navigate = useNavigate()
  const [generating, setGenerating] = useState(false)

  const semanas = useMemo(() => {
    const allFechas = [...sesiones.map(s => s.fecha), ...partidos.map(p => p.fecha)]
    const unique = new Set(allFechas.map(f => getWeekId(f)))
    return Array.from(unique).sort().reverse()
  }, [sesiones, partidos])

  const activePlayers = jugadoras.filter(j => j.activa)

  const handleGenerateWeek = async (semana: string) => {
    setGenerating(true)
    try {
      for (const jug of activePlayers) {
        const rs = calcularResumenSemanal(
          jug.id_jugadora, semana, sesiones, partidos,
          rpe_entreno, rpe_partido, wellness, resumen_semanal,
        )
        const existing = await db.resumen_semanal
          .where({ id_jugadora: jug.id_jugadora, semana })
          .first()
        if (existing) {
          await db.resumen_semanal.put({ ...rs, id: existing.id })
        } else {
          await db.resumen_semanal.put(rs)
        }
      }
      await useStore.getState().loadAll()
    } finally {
      setGenerating(false)
    }
  }

  const semanaActual = filters.semana || semanas[0] || ''
  const resumenSemana = resumen_semanal.filter(rs => rs.semana === semanaActual)

  const equipoResumen = useMemo(() => {
    if (resumenSemana.length === 0) return null
    const n = resumenSemana.length
    return {
      carga_total: Math.round(resumenSemana.reduce((s, rs) => s + rs.carga_total, 0)),
      carga_media: Math.round(resumenSemana.reduce((s, rs) => s + rs.carga_total, 0) / n * 10) / 10,
      acwr_medio: Math.round(resumenSemana.reduce((s, rs) => s + rs.acwr, 0) / n * 100) / 100,
      wellness_medio: Math.round(resumenSemana.reduce((s, rs) => s + rs.wellness_medio, 0) / n * 10) / 10,
      con_datos: resumenSemana.filter(rs => rs.carga_total > 0).length,
      riesgo: resumenSemana.filter(rs => rs.acwr >= 1.5).length,
      elevado: resumenSemana.filter(rs => rs.acwr >= 1.3 && rs.acwr < 1.5).length,
    }
  }, [resumenSemana])

  const handleExport = () => {
    const data = resumenSemana.map(rs => {
      const jug = jugadoras.find(j => j.id_jugadora === rs.id_jugadora)
      return {
        Semana: formatWeek(rs.semana),
        Jugadora: jug?.nombre || rs.id_jugadora,
        'Carga Entreno': rs.carga_entreno,
        'Carga Partido': rs.carga_partido,
        'Carga Total': rs.carga_total,
        'Carga Crónica': rs.carga_cronica,
        ACWR: rs.acwr,
        Wellness: rs.wellness_medio,
        Sesiones: rs.num_sesiones,
        Estado: rs.estado,
      }
    })
    exportToExcel(data, `resumen_semanal_${semanaActual}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-surface-800">Resumen Semanal</h1>
        <div className="flex gap-2">
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

      {equipoResumen && (
        <div className="grid grid-cols-5 gap-3">
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
            <span className="text-[10px] text-surface-500 block">En riesgo (ACWR{'>'}1.5)</span>
            <span className={`text-lg font-bold ${equipoResumen.riesgo > 0 ? 'text-red-600' : 'text-surface-800'}`}>
              {equipoResumen.riesgo}
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
                <DataCell>{Math.round(rs.carga_entreno)}</DataCell>
                <DataCell>{Math.round(rs.carga_partido)}</DataCell>
                <DataCell className="font-medium">{Math.round(rs.carga_total)}</DataCell>
                <DataCell>{Math.round(rs.carga_cronica)}</DataCell>
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
