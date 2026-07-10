import { useStore } from '@/store/store'
import { Link, useNavigate } from 'react-router-dom'
import {
  getWellnessLevel, getWellnessThreshold, getLoadStatus,
  calcularTendenciaACWR, calcularTendenciaWellness
} from '@/utils/calculations'
import { Filters } from '@/components/shared/Filters'
import { exportToExcel } from '@/utils/export'

export function RiskDashboardPage() {
  const { jugadoras, wellness, resumen_semanal, lesiones, filters } = useStore()
  const navigate = useNavigate()

  const activas = jugadoras.filter((j) => j.activa)

  const riesgoJugadoras = activas
    .filter((j) => !filters.id_jugadora || j.id_jugadora === filters.id_jugadora)
    .map((j) => {
    const wellnessJug = wellness.filter((w) => w.id_jugadora === j.id_jugadora).sort((a, b) => b.fecha.localeCompare(a.fecha))
    const resumenJug = resumen_semanal.filter((rs) => rs.id_jugadora === j.id_jugadora).sort((a, b) => b.semana.localeCompare(a.semana))
    const lesionActiva = lesiones.find((l) => l.id_jugadora === j.id_jugadora && !l.disponible)

    const ultimoWellness = wellnessJug[0]
    const ultimoRS = resumenJug[0]
    const rsSemanaActual = resumenJug[0]
    const rsSemanaPasada = resumenJug[1]

    const wellnessScores = wellnessJug.slice(0, 7).map(w => w.score_wellness)
    const tendenciaWellness = wellnessScores.length > 1 ? calcularTendenciaWellness(wellnessScores) : wellnessScores[0] || 0

    const cargasSemanales = resumenJug.slice(0, 5).map(rs => rs.carga_total)
    const tendenciaACWR = cargasSemanales.length > 1 ? calcularTendenciaACWR(cargasSemanales) : cargasSemanales[0] || 0

    let nivelRiesgo: 'critico' | 'alto' | 'medio' | 'bajo' = 'bajo'
    const factores: string[] = []

    if (lesionActiva) {
      nivelRiesgo = 'critico'
      factores.push('Lesión activa')
    }
    if (ultimoWellness && ultimoWellness.score_wellness < 5) {
      nivelRiesgo = nivelRiesgo === 'bajo' ? 'alto' : nivelRiesgo
      factores.push(`Wellness bajo (${ultimoWellness.score_wellness})`)
    } else if (ultimoWellness && ultimoWellness.score_wellness < 6.5) {
      if (nivelRiesgo === 'bajo') nivelRiesgo = 'medio'
      factores.push(`Wellness descendiendo (${ultimoWellness.score_wellness})`)
    }
    if (ultimoRS && ultimoRS.acwr > 1.5) {
      nivelRiesgo = 'critico'
      factores.push(`ACWR crítico (${ultimoRS.acwr})`)
    } else if (ultimoRS && ultimoRS.acwr > 1.3) {
      if (nivelRiesgo !== 'critico') nivelRiesgo = 'alto'
      factores.push(`ACWR elevado (${ultimoRS.acwr})`)
    }
    if (rsSemanaActual && rsSemanaPasada && rsSemanaActual.carga_total > rsSemanaPasada.carga_total * 1.25) {
      if (nivelRiesgo !== 'critico') nivelRiesgo = nivelRiesgo === 'bajo' ? 'medio' : 'alto'
      factores.push(`Carga +${Math.round((rsSemanaActual.carga_total / rsSemanaPasada.carga_total - 1) * 100)}% vs semana anterior`)
    }
    if (tendenciaWellness < 5.5 && wellnessScores.length >= 3) {
      if (nivelRiesgo === 'bajo') nivelRiesgo = 'medio'
      factores.push('Tendencia wellness descendente')
    }

    return {
      jugadora: j,
      nivelRiesgo,
      factores,
      ultimoWellness,
      ultimoRS,
      lesionActiva,
      tendenciaWellness,
      tendenciaACWR,
      rsSemanaActual,
      rsSemanaPasada,
    }
  })

  const ordenRiesgo = { critico: 0, alto: 1, medio: 2, bajo: 3 }
  riesgoJugadoras.sort((a, b) => ordenRiesgo[a.nivelRiesgo] - ordenRiesgo[b.nivelRiesgo])

  const criticas = riesgoJugadoras.filter(r => r.nivelRiesgo === 'critico').length
  const altas = riesgoJugadoras.filter(r => r.nivelRiesgo === 'alto').length
  const medias = riesgoJugadoras.filter(r => r.nivelRiesgo === 'medio').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-surface-800">Dashboard de Riesgo</h1>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-surface-400">{new Date().toLocaleDateString('es-ES')}</span>
          <button
            onClick={() => {
              const data = riesgoJugadoras.map((r) => ({
                Jugadora: r.jugadora.nombre,
                Posición: r.jugadora.posicion,
                Riesgo: r.nivelRiesgo,
                Factores: r.factores.join(', '),
                Wellness: r.ultimoWellness?.score_wellness ?? '—',
                ACWR: r.ultimoRS?.acwr.toFixed(2) ?? '—',
                Carga: r.rsSemanaActual ? `${Math.round(r.rsSemanaActual.carga_total)} UA` : '—',
                'Tendencia Wellness': r.tendenciaWellness.toFixed(1),
                'Tendencia ACWR': r.tendenciaACWR.toFixed(2),
              }))
              exportToExcel(data, `riesgo_${new Date().toISOString().split('T')[0]}`)
            }}
            className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700"
          >
            Exportar a Excel
          </button>
        </div>
      </div>

      <Filters showPlayer showDate={false} showWeek={false} showSessionType={false} showStatus={false} />

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-[10px] font-medium text-red-700 uppercase">Críticas</div>
          <div className="text-2xl font-bold text-red-600">{criticas}</div>
          <div className="text-[10px] text-red-500">Acción inmediata</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="text-[10px] font-medium text-orange-700 uppercase">Alto riesgo</div>
          <div className="text-2xl font-bold text-orange-600">{altas}</div>
          <div className="text-[10px] text-orange-500">Monitorizar 24-48h</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="text-[10px] font-medium text-amber-700 uppercase">Medio riesgo</div>
          <div className="text-2xl font-bold text-amber-600">{medias}</div>
          <div className="text-[10px] text-amber-500">Revisar esta semana</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-[10px] font-medium text-green-700 uppercase">Sin riesgo</div>
          <div className="text-2xl font-bold text-green-600">{riesgoJugadoras.filter(r => r.nivelRiesgo === 'bajo').length}</div>
          <div className="text-[10px] text-green-500">Seguimiento rutinario</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-200 bg-surface-50">
          <h3 className="text-xs font-semibold text-surface-700">Jugadoras ordenadas por nivel de riesgo</h3>
        </div>
        <div className="divide-y divide-surface-200">
          {riesgoJugadoras.map((r) => (
            <div
              key={r.jugadora.id_jugadora}
              className={`px-4 py-3 hover:bg-surface-50 transition-colors ${
                r.nivelRiesgo === 'critico' ? 'bg-red-50 border-l-4 border-l-red-500' :
                r.nivelRiesgo === 'alto' ? 'bg-orange-50 border-l-4 border-l-orange-500' :
                r.nivelRiesgo === 'medio' ? 'bg-amber-50 border-l-4 border-l-amber-500' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                      r.nivelRiesgo === 'critico' ? 'bg-red-600 text-white' :
                      r.nivelRiesgo === 'alto' ? 'bg-orange-600 text-white' :
                      r.nivelRiesgo === 'medio' ? 'bg-amber-600 text-white' : 'bg-green-600 text-white'
                    }`}>
                      {r.nivelRiesgo === 'critico' ? '!' : r.nivelRiesgo === 'alto' ? '⚠' : r.nivelRiesgo === 'medio' ? '▲' : '✓'}
                    </span>
                    <Link
                      to={`/jugadoras/${r.jugadora.id_jugadora}`}
                      className="font-medium text-surface-800 hover:text-primary-600 truncate"
                    >
                      {r.jugadora.nombre}
                    </Link>
                    <span className="text-[10px] text-surface-500 px-1.5 py-0.5 rounded bg-surface-100">{r.jugadora.posicion}</span>
                  </div>
                  {r.lesionActiva && (
                    <span className="text-[10px] font-medium text-red-600 px-2 py-0.5 rounded bg-red-50">
                      Lesión: {r.lesionActiva.tipo} ({r.lesionActiva.fase_rtp})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 ml-4 shrink-0">
                  {r.ultimoWellness && (
                    <div className="text-right">
                      <div className="text-[10px] text-surface-500">Wellness</div>
                      <div className={`text-sm font-bold ${getWellnessThreshold(getWellnessLevel(r.ultimoWellness.score_wellness)).color.split(' ')[0]}`}>
                        {r.ultimoWellness.score_wellness}
                      </div>
                    </div>
                  )}
                  {r.ultimoRS && (
                    <div className="text-right">
                      <div className="text-[10px] text-surface-500">ACWR</div>
                      <div className={`text-sm font-bold ${getLoadStatus(r.ultimoRS.acwr).color.split(' ')[0]}`}>
                        {r.ultimoRS.acwr.toFixed(2)}
                      </div>
                    </div>
                  )}
                  <div className="text-right">
                    <div className="text-[10px] text-surface-500">Carga</div>
                    <div className="text-sm font-medium text-surface-700">
                      {r.rsSemanaActual ? `${Math.round(r.rsSemanaActual.carga_total)} UA` : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {r.factores.length > 0 && (
                <div className="mt-2 pt-2 border-t border-surface-100">
                  <div className="flex flex-wrap gap-1.5">
                    {r.factores.map((f, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                          r.nivelRiesgo === 'critico' ? 'bg-red-100 text-red-700' :
                          r.nivelRiesgo === 'alto' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-2 flex items-center justify-between text-[10px] text-surface-500">
                <div className="flex items-center gap-3">
                  <span>Tendencia wellness: <span className={`font-medium ${r.tendenciaWellness >= 6.5 ? 'text-green-600' : r.tendenciaWellness >= 5.5 ? 'text-amber-600' : 'text-red-600'}`}>{r.tendenciaWellness.toFixed(1)}</span></span>
                  <span>Tendencia ACWR: <span className={`font-medium ${r.tendenciaACWR <= 1.2 ? 'text-green-600' : r.tendenciaACWR <= 1.4 ? 'text-amber-600' : 'text-red-600'}`}>{r.tendenciaACWR.toFixed(2)}</span></span>
                </div>
                <button
                  onClick={() => navigate(`/jugadoras/${r.jugadora.id_jugadora}`)}
                  className="text-primary-600 hover:underline font-medium"
                >
                  Ver perfil →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}