import { useStore } from '@/store/store'
import { KPICard } from '@/components/dashboard/KPICards'
import { WellnessChart } from '@/components/dashboard/WellnessChart'
import { LoadChart } from '@/components/dashboard/LoadChart'
import { AlertsWidget } from '@/components/dashboard/AlertsWidget'
import { TodayWidget } from '@/components/dashboard/TodayWidget'
import { OnboardingGuide } from '@/components/dashboard/OnboardingGuide'
import { useNavigate } from 'react-router-dom'

export function DashboardPage() {
  const {
    jugadoras, wellness, resumen_semanal, lesiones, alertas,
  } = useStore()
  const navigate = useNavigate()

  const activas = jugadoras.filter((j) => j.activa)
  const lesionadasActivas = lesiones.filter((l) => !l.disponible)

  const wellnessReciente = wellness.filter((w) => {
    const d = new Date(w.fecha)
    const semanaAtras = new Date()
    semanaAtras.setDate(semanaAtras.getDate() - 7)
    return d >= semanaAtras
  })

  const wellnessMedio = wellnessReciente.length > 0
    ? Math.round(wellnessReciente.reduce((s, w) => s + w.score_wellness, 0) / wellnessReciente.length * 10) / 10
    : 0

  const jugConAlertas = new Set(alertas.filter((a) => !a.leida).map((a) => a.id_jugadora)).size

  const ultimoRS = resumen_semanal
    .filter((rs) => rs.semana)
    .sort((a, b) => b.semana.localeCompare(a.semana))

  const cargaSemanalTotal = ultimoRS.length > 0
    ? ultimoRS.filter((rs) => rs.semana === ultimoRS[0].semana).reduce((s, rs) => s + rs.carga_total, 0)
    : 0

  const acwrMedio = ultimoRS.length > 0
    ? Math.round(ultimoRS.filter((rs) => rs.semana === ultimoRS[0].semana).reduce((s, rs) => s + rs.acwr, 0) / 
        Math.max(1, ultimoRS.filter((rs) => rs.semana === ultimoRS[0].semana).length) * 100) / 100
    : 0

  const estados = new Map<string, number>()
  jugadoras.filter(j => j.activa).forEach(j => {
    const lesion = lesionadasActivas.find(l => l.id_jugadora === j.id_jugadora)
    const estado = lesion ? 'Lesionada' : 'Disponible'
    estados.set(estado, (estados.get(estado) || 0) + 1)
  })

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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-surface-700">Alertas recientes</h3>
            <button onClick={() => navigate('/alertas')} className="text-[10px] text-primary-600 hover:underline">
              Ver todas
            </button>
          </div>
          <AlertsWidget />
        </div>

        <div className="bg-white rounded-lg border border-surface-200 p-4">
          <h3 className="text-xs font-semibold text-surface-700 mb-3">Distribución estados</h3>
          {Array.from(estados.entries()).map(([estado, count]) => (
            <div key={estado} className="flex items-center justify-between py-1.5 border-b border-surface-100 last:border-0">
              <span className="text-xs text-surface-600">{estado}</span>
              <span className="text-xs font-semibold text-surface-800">{count}</span>
            </div>
          ))}
          {estados.size === 0 && <div className="text-xs text-surface-400 text-center py-4">Sin datos</div>}
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
