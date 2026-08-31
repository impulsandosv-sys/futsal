import React, { useState, useMemo } from 'react'
import { useStore } from '@/store/store'
import { buildMicrocycleDashboardData, MicrocycleDashboardData, PlayerMicrocycleRow } from '@/domain/microcycle/microcycleOperationalEngine'
import { getTodayLocalISO, getWeekId, formatWeek } from '@/domain/dates/dates'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { CompetitiveExposureCard } from '@/components/exposure/CompetitiveExposureCard'
import { format, parseISO, addWeeks, subWeeks } from 'date-fns'

export function MicrocycleDashboardPage() {
  const store = useStore()

  const [currentWeekISO, setCurrentWeekISO] = useState<string>(() => {
    const today = getTodayLocalISO()
    return getWeekId(today)
  })

  const dashboardData = useMemo(() => {
    return buildMicrocycleDashboardData(
      currentWeekISO,
      store.jugadoras,
      store.sesiones,
      store.partidos,
      store.wellness,
      store.sesion_rpe,
      store.rpe_partido,
      store.alertas,
      store.lesiones
    )
  }, [
    currentWeekISO,
    store.jugadoras,
    store.sesiones,
    store.partidos,
    store.wellness,
    store.sesion_rpe,
    store.rpe_partido,
    store.alertas,
    store.lesiones
  ])

  const handlePrevWeek = () => {
    const d = parseISO(currentWeekISO)
    setCurrentWeekISO(format(subWeeks(d, 1), 'yyyy-MM-dd'))
  }

  const handleNextWeek = () => {
    const d = parseISO(currentWeekISO)
    setCurrentWeekISO(format(addWeeks(d, 1), 'yyyy-MM-dd'))
  }

  const handleCurrentWeek = () => {
    const today = getTodayLocalISO()
    setCurrentWeekISO(getWeekId(today))
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Microciclo Operativo</h1>
          <p className="text-sm text-surface-500 mt-1">
            Resumen semanal y priorizacin individual
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevWeek}
            className="px-3 py-1.5 text-xs font-medium text-surface-700 bg-white border border-surface-200 rounded hover:bg-surface-50"
          >
            &larr; Anterior
          </button>
          <div className="px-4 py-1.5 text-sm font-semibold bg-surface-100 rounded text-surface-800 min-w-[180px] text-center">
            {formatWeek(currentWeekISO)}
          </div>
          <button
            onClick={handleNextWeek}
            className="px-3 py-1.5 text-xs font-medium text-surface-700 bg-white border border-surface-200 rounded hover:bg-surface-50"
          >
            Siguiente &rarr;
          </button>
          <button
            onClick={handleCurrentWeek}
            className="ml-2 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded hover:bg-primary-100"
          >
            Semana Actual
          </button>
        </div>
      </div>

      <CollectiveSummary summary={dashboardData.resumenColectivo} />

      <div className="mt-8">
        <h2 className="text-lg font-bold text-surface-900 mb-4">Tabla Individual Operativa</h2>
        <IndividualTable rows={dashboardData.filasJugadoras} endDate={dashboardData.endDate} />
      </div>
    </div>
  )
}

function CollectiveSummary({ summary }: { summary: MicrocycleDashboardData['resumenColectivo'] }) {
  const Card = ({ title, value, empty }: { title: string, value: React.ReactNode, empty?: boolean }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-surface-200">
      <div className="text-[10px] uppercase font-semibold text-surface-500 mb-1">{title}</div>
      <div className={`text-xl font-bold ${empty ? 'text-surface-400' : 'text-surface-900'}`}>
        {value}
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
      <Card title="Jugadoras" value={summary.activePlayers} empty={summary.activePlayers === 0} />
      <Card title="Sesiones Programadas" value={summary.scheduledSessions} empty={summary.scheduledSessions === 0} />
      <Card title="Sesiones Realizadas" value={summary.completedSessions} empty={summary.completedSessions === 0} />
      <Card title="Partidos" value={summary.matches} empty={summary.matches === 0} />
      <Card
        title="Adherencia Wellness"
        value={summary.wellnessAdherencePercent !== null ? `${Math.round(summary.wellnessAdherencePercent)}%` : '—'}
        empty={summary.wellnessAdherencePercent === null}
      />
      <Card
        title="Sin Wellness"
        value={summary.playersWithoutWellness}
        empty={summary.playersWithoutWellness === 0}
      />
      <Card
        title="Alertas (No Menstruales)"
        value={summary.openNonMenstrualAlerts}
        empty={summary.openNonMenstrualAlerts === 0}
      />
      <Card
        title="Datos Pendientes"
        value={summary.pendingQualityIssues}
        empty={summary.pendingQualityIssues === 0}
      />
    </div>
  )
}

function IndividualTable({ rows, endDate }: { rows: PlayerMicrocycleRow[], endDate: string }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-surface-200 p-8 text-center text-sm text-surface-500">
        No hay jugadoras activas para este microciclo.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-surface-200 overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-50 text-[10px] uppercase font-semibold text-surface-500 border-b border-surface-200">
            <th className="px-4 py-3">Jugadora</th>
            <th className="px-4 py-3">Prioridad</th>
            <th className="px-4 py-3 text-center">Wellness</th>
            <th className="px-4 py-3 text-right">Carga Entreno (sRPE)</th>
            <th className="px-4 py-3 text-right">Carga Partido (sRPE)</th>
            <th className="px-4 py-3">Exposición Competitiva</th>
            <th className="px-4 py-3">Problemas Datos</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="text-xs">
          {rows.map((row) => (
            <tr key={row.jugadora.id_jugadora} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
              <td className="px-4 py-3 font-medium text-surface-900">
                <div className="flex items-center gap-2">
                  <span>{row.jugadora.nombre}</span>
                  <span className="text-[10px] font-normal text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded">
                    {row.jugadora.posicion}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                {row.prioridadRazon ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                    {row.prioridadRazon}
                  </span>
                ) : (
                  <span className="text-surface-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {row.wellnessRegistrosValidos > 0 ? (
                  <div className="text-surface-900 font-medium">{row.wellnessRegistrosValidos} regs</div>
                ) : (
                  <div className="text-surface-400">—</div>
                )}
              </td>
              <td className="px-4 py-3 text-right font-medium text-surface-900">
                {row.sRPETraining > 0 ? row.sRPETraining : '—'}
              </td>
              <td className="px-4 py-3 text-right font-medium text-surface-900">
                {row.sRPEMatch !== null ? row.sRPEMatch : '—'}
              </td>
              <td className="px-4 py-3">
                <CompetitiveExposureCard registros={row.rpePartido} fechaCorteISO={endDate} modo="compacto" />
              </td>
              <td className="px-4 py-3">
                {row.qualityIssues > 0 ? (
                  <div className="text-amber-700 font-medium">
                    {row.qualityIssues} {row.qualityIssues === 1 ? 'pendiente' : 'pendientes'}
                  </div>
                ) : (
                  <span className="text-surface-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  {row.qualityIssues > 0 && (
                    <Link to={ROUTES.CALIDAD_DATOS} className="text-primary-600 hover:text-primary-800 font-medium">Resolver</Link>
                  )}
                  <Link to={ROUTES.JUGADORA_PROFILE.replace(':id', row.jugadora.id_jugadora)} className="text-surface-500 hover:text-surface-800">Perfil</Link>
                  <Link to={ROUTES.DECISION_DIARIA} className="text-surface-500 hover:text-surface-800">Decisión</Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
