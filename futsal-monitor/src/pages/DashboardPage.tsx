import { useStore } from '@/store/store'
import { KPICard } from '@/components/dashboard/KPICards'
import { WellnessChart } from '@/components/dashboard/WellnessChart'
import { LoadChart } from '@/components/dashboard/LoadChart'
import { AlertsWidget } from '@/components/dashboard/AlertsWidget'
import { ReadinessTrafficLight } from '@/components/dashboard/ReadinessTrafficLight'
import { TodayWidget } from '@/components/dashboard/TodayWidget'
import { OnboardingGuide } from '@/components/dashboard/OnboardingGuide'
import { useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { filtrarYCalcularResumenDashboard } from '@/domain/monitoring/monitoring'

import { getTodayLocalISO } from '@/domain/dates/dates'

export function DashboardPage() {
  const {
    jugadoras, wellness, resumen_semanal, lesiones, alertas, sesion_rpe,
  } = useStore()
  const navigate = useNavigate()

  const hoyStr = useMemo(() => getTodayLocalISO(), [])

  const metrics = useMemo(() => {
    return filtrarYCalcularResumenDashboard(
      jugadoras,
      wellness,
      resumen_semanal,
      alertas,
      lesiones,
      sesion_rpe,
      hoyStr
    )
  }, [jugadoras, wellness, resumen_semanal, alertas, lesiones, sesion_rpe, hoyStr])

  const {
    wellnessMedio,
    jugConAlertasCount,
    cargaSemanalTotal,
    acwrMedio,
    monotonia,
    strain
  } = metrics

  const jugConAlertas = jugConAlertasCount
  const activas = useMemo(() => jugadoras.filter((j) => j.activa !== false), [jugadoras])
  const lesionadasActivas = useMemo(() => lesiones.filter((l) => !l.disponible), [lesiones])



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-surface-800">Dashboard</h1>
        <span className="text-[10px] text-surface-400">{new Date().toLocaleDateString('es-ES')}</span>
      </div>

      <OnboardingGuide />

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <div className="grid grid-cols-6 gap-3">
            <KPICard label="Jugadoras" value={activas.length} icon="◉" />
            <KPICard label="Lesionadas" value={lesionadasActivas.length} icon="◕" color={lesionadasActivas.length > 0 ? 'text-red-600' : 'text-surface-800'} />
            <KPICard label="Wellness medio (7d)" value={wellnessMedio > 0 ? wellnessMedio.toFixed(1) : '—'} icon="◐" />
            <KPICard label="Con alertas" value={jugConAlertas} icon="◉" color={jugConAlertas > 0 ? 'text-amber-600' : 'text-surface-800'} />
            <KPICard label="Carga semanal total" value={Math.round(cargaSemanalTotal)} subtitle="UA" icon="◗" />
            <KPICard label="ACWR medio" value={acwrMedio.toFixed(2)} icon="◍" color={acwrMedio > 1.3 ? 'text-amber-600' : 'text-surface-800'} />
          </div>
          <div className="grid grid-cols-6 gap-3 mt-3">
            <KPICard label="Monotonía (7d)" value={monotonia.toFixed(2)} icon="📊" />
            <KPICard label="Strain (7d)" value={Math.round(strain)} subtitle="UA" icon="⚡" />
          </div>
        </div>
        <div className="col-span-1">
          <TodayWidget />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-surface-200 p-4">
          <h3 className="text-xs font-semibold text-surface-700 mb-3">Evolución Wellness (últimos 14 días)</h3>
          <WellnessChart data={wellness} />
        </div>
        <div className="bg-white rounded-lg border border-surface-200 p-4">
          <h3 className="text-xs font-semibold text-surface-700 mb-3">Carga semanal equipo (UA)</h3>
          <LoadChart data={resumen_semanal} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-surface-200 p-4">
          <h3 className="text-xs font-semibold text-surface-700 mb-3">Alertas recientes</h3>
          <button onClick={() => navigate('/alertas')} className="text-[10px] text-primary-600 hover:underline">
            Ver todas
          </button>
          <AlertsWidget />
        </div>

        <div className="bg-white rounded-lg border border-surface-200 p-4">
          <h3 className="text-xs font-semibold text-surface-700 mb-3">Readiness Diaria</h3>
          <ReadinessTrafficLight />
        </div>

        <div className="bg-white rounded-lg border border-surface-200 p-4">
          <h3 className="text-xs font-semibold text-surface-700 mb-3">Acceso rápido a jugadoras</h3>
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {activas.map((j) => (
              <button
                key={j.id_jugadora}
                onClick={() => navigate(`/jugadoras/${j.id_jugadora}`)}
                className="flex items-center justify-between w-full px-2 py-1.5 text-xs hover:bg-surface-50 rounded transition-colors"
              >
                <span className="text-surface-700">{j.nombre}</span>
                <span className="text-[10px] text-surface-400">{j.posicion}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
