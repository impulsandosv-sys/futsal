import { useStore } from '@/store/store'
import { useState, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend, ComposedChart, ScatterChart, Scatter, ZAxis, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'
import { getWellnessLevel, getWellnessThreshold, getLoadStatus, calcularCargaDiariaUltimosDias, calcularEdad, obtenerListaReadinessDeterminista } from '@/domain/monitoring/monitoring'
import { calcularScoreWellness } from '@/domain/calculations/loadCalculations'
import { formatWeek, getTodayLocalISO } from '@/domain/dates/dates'
import { Modal } from '@/components/shared/Modal'
import { StrengthDetailModal } from '@/components/fuerza/StrengthDetailModal'
import { calcularResumenSesionFuerza } from '@/domain/neuromuscular/fuerzaEngine'
import { calcularExposicionCompetitiva } from '@/domain/exposure/matchExposure'
import type { Wellness, FinalidadSesionFuerza } from '@/types'

import { PlayerAliasSection } from '@/components/player/PlayerAliasSection'

const FINALIDADES_MAP: Record<FinalidadSesionFuerza, string> = {
  fuerza_maxima: 'Fuerza Máxima',
  hipertrofia: 'Hipertrofia',
  potencia: 'Potencia',
  mantenimiento: 'Mantenimiento',
  prevencion: 'Prevención',
  readaptacion: 'Readaptación',
  otro: 'Otro',
}

export function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()

  const initialTabParam = (searchParams.get('tab') || (location.state as { tab?: string })?.tab) as any

  const {
    jugadoras, wellness, lesiones, tests, rpe_partido, resumen_semanal, readiness, 
    updateWellness, addTest, sesion_rpe, sesiones,
    ciclo_menstrual, carga_gps, fuerza_vbt, hidratacion, test_psicologico,
    pruebas_cmj, sesiones_fuerza_individual, trabajos_fuerza, ejercicios_fuerza,
    addCicloMenstrual, addCargaGPS, addFuerzaVBT, addHidratacion, addTestPsicologico
  } = useStore()

  const hoyStr = useMemo(() => getTodayLocalISO(), [])
  const [wellnessRange, setWellnessRange] = useState<7 | 28>(7)

  const jugadora = jugadoras.find((j) => j.id_jugadora === id)
  const [activeTabCache, setActiveTabCache] = useState<Record<string, string>>({})
  const tab = (activeTabCache[id || ''] as 'resumen' | 'wellness' | 'carga' | 'tests' | 'lesiones' | 'semanal' | 'readiness' | 'ciclo' | 'gps' | 'vbt' | 'hidratacion' | 'psicologia' | 'cmj' | 'fuerza' | 'alias') || (initialTabParam && ['resumen', 'wellness', 'carga', 'tests', 'lesiones', 'semanal', 'readiness', 'ciclo', 'gps', 'vbt', 'hidratacion', 'psicologia', 'cmj', 'fuerza', 'alias'].includes(initialTabParam) ? initialTabParam : 'resumen')
  const [editWellness, setEditWellness] = useState<Wellness | null>(null)
  const [wellnessForm, setWellnessForm] = useState<Wellness | null>(null)
  const [newTestOpen, setNewTestOpen] = useState(false)
  const [testForm, setTestForm] = useState({ fecha: '', momento: 'Pretemporada', test: '', resultado: 0, unidad: '', notas: '' })

  const [fuerzaFilters, setFuerzaFilters] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    finalidad: '',
    id_ejercicio: '',
  })
  const [fuerzaDetailId, setFuerzaDetailId] = useState<string | null>(null)

  const [newCicloOpen, setNewCicloOpen] = useState(false)
  const [cicloForm, setCicloForm] = useState<any>({ fecha: '', fase: 'Menstruacion', sintomas: '', notas: '' })
  
  const [newGPSOpen, setNewGPSOpen] = useState(false)
  const [gpsForm, setGpsForm] = useState<any>({ fecha: '', distancia_total: 0, distancia_hsr: 0, aceleraciones: 0, deceleraciones: 0, player_load: 0 })

  const [newVBTOpen, setNewVBTOpen] = useState(false)
  const [vbtForm, setVbtForm] = useState<any>({ fecha: '', ejercicio: 'Sentadilla', carga_kg: 0, velocidad_media: 0, velocidad_pico: 0, perdida_velocidad: 0 })

  const [newHidratacionOpen, setNewHidratacionOpen] = useState(false)
  const [hidratacionForm, setHidratacionForm] = useState<any>({ fecha: '', peso_pre: 0, peso_post: 0, liquido_ingerido_ml: 0, tasa_sudoracion: 0 })

  const [newPsicologiaOpen, setNewPsicologiaOpen] = useState(false)
  const [psicologiaForm, setPsicologiaForm] = useState<any>({ fecha: '', tension: 0, depresion: 0, ira: 0, vigor: 0, fatiga_mental: 0, confusion: 0, notas: '' })

  const rpeEntrenoJug = useMemo(() => sesion_rpe.filter((r) => r.id_jugadora === id), [sesion_rpe, id])
  const rpePartidoJug = useMemo(() => rpe_partido.filter((r) => r.id_jugadora === id), [rpe_partido, id])


  const cargaDiaria = useMemo(() => {
    return calcularCargaDiariaUltimosDias(rpeEntrenoJug, rpePartidoJug, 14, hoyStr, sesiones)
  }, [rpeEntrenoJug, rpePartidoJug, hoyStr, sesiones])

  const exposicionCompetitiva = useMemo(() => {
    return calcularExposicionCompetitiva(rpePartidoJug, hoyStr)
  }, [rpePartidoJug, hoyStr])

  const wellnessJug = useMemo(() => wellness.filter((w) => w.id_jugadora === id).sort((a, b) => b.fecha.localeCompare(a.fecha)), [wellness, id])
  const lesionesJug = useMemo(() => lesiones.filter((l) => l.id_jugadora === id).sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio)), [lesiones, id])
  const testsJug = useMemo(() => tests.filter((t) => t.id_jugadora === id).sort((a, b) => b.fecha.localeCompare(a.fecha)), [tests, id])
  const resumenJug = useMemo(() => resumen_semanal.filter((rs) => rs.id_jugadora === id).sort((a, b) => b.semana.localeCompare(a.semana)), [resumen_semanal, id])
  const cicloJug = useMemo(() => ciclo_menstrual.filter((c) => c.id_jugadora === id).sort((a, b) => b.fecha.localeCompare(a.fecha)), [ciclo_menstrual, id])
  const gpsJug = useMemo(() => carga_gps.filter((g) => g.id_jugadora === id).sort((a, b) => a.fecha.localeCompare(b.fecha)), [carga_gps, id])
  const vbtJug = useMemo(() => fuerza_vbt.filter((v) => v.id_jugadora === id).sort((a, b) => a.fecha.localeCompare(b.fecha)), [fuerza_vbt, id])
  const hidratacionJug = useMemo(() => hidratacion.filter((h) => h.id_jugadora === id).sort((a, b) => a.fecha.localeCompare(b.fecha)), [hidratacion, id])
  const psicoJug = useMemo(() => test_psicologico.filter((t) => t.id_jugadora === id).sort((a, b) => a.fecha.localeCompare(b.fecha)), [test_psicologico, id])
  const cmjJug = useMemo(() => pruebas_cmj.filter((p) => p.id_jugadora === id).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.createdAt.localeCompare(a.createdAt)), [pruebas_cmj, id])
  const fuerzaJug = useMemo(() => sesiones_fuerza_individual.filter((s) => s.id_jugadora === id).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.createdAt.localeCompare(a.createdAt)), [sesiones_fuerza_individual, id])

  const filteredFuerzaJug = useMemo(() => {
    return fuerzaJug.filter((s) => {
      if (fuerzaFilters.fecha_desde && s.fecha < fuerzaFilters.fecha_desde) return false
      if (fuerzaFilters.fecha_hasta && s.fecha > fuerzaFilters.fecha_hasta) return false
      if (fuerzaFilters.finalidad && s.finalidad !== fuerzaFilters.finalidad) return false
      if (fuerzaFilters.id_ejercicio) {
        const tieneEjercicio = trabajos_fuerza.some(
          (t) =>
            (t.id_sesion_fuerza === s.id_sesion_fuerza || t.id_sesion === s.id_sesion_fuerza) &&
            t.id_ejercicio === fuerzaFilters.id_ejercicio
        )
        if (!tieneEjercicio) return false
      }
      return true
    })
  }, [fuerzaJug, trabajos_fuerza, fuerzaFilters])

  const wellnessGrafico = useMemo(() => wellnessJug.slice().reverse().slice(-wellnessRange), [wellnessJug, wellnessRange])

  if (!jugadora) {
    return (
      <div className="text-center py-12">
        <p className="text-surface-500 text-sm">Jugadora no encontrada</p>
        <button onClick={() => navigate('/jugadoras')} className="text-primary-600 text-xs mt-2 hover:underline">
          Volver a jugadoras
        </button>
      </div>
    )
  }

  const edad = jugadora.fecha_nacimiento
    ? calcularEdad(jugadora.fecha_nacimiento, hoyStr)
    : null

  const lesionActiva = lesionesJug.find((l) => !l.disponible)

  const ultimoWellness = wellnessJug[0]
  const ultimoRS = resumenJug[0]

  const tabs = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'wellness', label: 'Wellness' },
    { key: 'carga', label: 'Carga' },
    { key: 'readiness', label: 'Readiness' },
    { key: 'ciclo', label: 'Ciclo' },
    { key: 'gps', label: 'GPS' },
    { key: 'vbt', label: 'VBT' },
    { key: 'hidratacion', label: 'Hidratación' },
    { key: 'psicologia', label: 'Psicología' },
    { key: 'tests', label: 'Tests' },
    { key: 'cmj', label: 'CMJ' },
    { key: 'fuerza', label: 'Fuerza' },
    { key: 'lesiones', label: 'Lesiones' },
    { key: 'semanal', label: 'Semanal' },
    { key: 'alias', label: 'Alias' },
  ] as const

  const handleSaveWellness = async () => {
    if (wellnessForm) {
      const score = calcularScoreWellness(wellnessForm)
      await updateWellness({ ...wellnessForm, score_wellness: score })
      setEditWellness(null)
    }
  }

  const handleAddTest = async () => {
    await addTest({
      ...testForm,
      id_jugadora: id!,
      resultado: Number(testForm.resultado),
    })
    setNewTestOpen(false)
    setTestForm({ fecha: '', momento: 'Pretemporada', test: '', resultado: 0, unidad: '', notas: '' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/jugadoras')} className="text-surface-400 hover:text-surface-600 text-sm">&larr;</button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-surface-800">{jugadora.nombre}</h1>
              {jugadora.activa === false && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-surface-200 text-surface-600 rounded">
                  Archivada
                </span>
              )}
            </div>
            <p className="text-[10px] text-surface-500">{jugadora.posicion} · {jugadora.id_jugadora}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <div className="bg-white rounded-lg border border-surface-200 p-3">
          <span className="text-[10px] text-surface-500 block">Edad</span>
          <span className="text-sm font-semibold">{edad !== null ? `${edad} años` : '—'}</span>
        </div>
        <div className="bg-white rounded-lg border border-surface-200 p-3">
          <span className="text-[10px] text-surface-500 block">Altura/Peso</span>
          <span className="text-sm font-semibold">{jugadora.altura_cm} cm / {jugadora.peso_kg} kg</span>
        </div>
        <div className="bg-white rounded-lg border border-surface-200 p-3">
          <span className="text-[10px] text-surface-500 block">IMC</span>
          <span className="text-sm font-semibold">{jugadora.imc}</span>
        </div>
        <div className="bg-white rounded-lg border border-surface-200 p-3">
          <span className="text-[10px] text-surface-500 block">% Grasa</span>
          <span className="text-sm font-semibold">{jugadora.grasa}%</span>
        </div>
        <div className="bg-white rounded-lg border border-surface-200 p-3">
          <span className="text-[10px] text-surface-500 block">Experiencia</span>
          <span className="text-sm font-semibold">{jugadora.anos_experiencia_futsal} años</span>
        </div>
      </div>

      {lesionActiva && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-red-700">Lesión activa · {lesionActiva.tipo}</span>
              <p className="text-[10px] text-red-600 mt-0.5">{lesionActiva.localizacion} · Fase: {lesionActiva.fase_rtp}</p>
            </div>
            <button
              onClick={() => navigate('/lesiones')}
              className="text-[10px] text-red-700 underline"
            >
              Ver detalle
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-surface-200 pb-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTabCache(prev => ({ ...prev, [id || '']: t.key }))}
            className={`text-xs px-3 py-2 border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-600 font-semibold'
                : 'border-transparent text-surface-500 hover:text-surface-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <h3 className="text-xs font-semibold text-surface-700 mb-3">Wellness reciente</h3>
            {ultimoWellness ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-surface-500">Score</span>
                  <span className={`text-lg font-bold ${getWellnessThreshold(getWellnessLevel(ultimoWellness.score_wellness)).color.split(' ')[0]}`}>
                    {ultimoWellness.score_wellness}
                  </span>
                </div>
                {[
                  { label: 'Sueño', v: ultimoWellness.calidad_sueno },
                  { label: 'Fatiga', v: ultimoWellness.fatiga },
                  { label: 'Dolor muscular', v: ultimoWellness.dolor_muscular },
                  { label: 'Estrés', v: ultimoWellness.estres },
                  { label: 'Ánimo', v: ultimoWellness.estado_animo },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-[10px]">
                    <span className="text-surface-500">{item.label}</span>
                    <span className="text-surface-700 font-medium">{item.v}/10</span>
                  </div>
                ))}
                {ultimoWellness.dolor_especifico && (
                  <p className="text-[10px] text-amber-600 mt-1">Dolor: {ultimoWellness.dolor_especifico}</p>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-surface-400">Sin datos</p>
            )}
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <h3 className="text-xs font-semibold text-surface-700 mb-3">Carga semanal (ACWR)</h3>
            {ultimoRS ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-surface-500">ACWR</span>
                  <span className={`text-lg font-bold ${getLoadStatus(ultimoRS.acwr).color.split(' ')[0]}`}>
                    {ultimoRS.acwr.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-surface-500">Carga total</span>
                  <span className="text-surface-700 font-medium">{ultimoRS.carga_total} UA</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-surface-500">Carga crónica</span>
                  <span className="text-surface-700 font-medium">{ultimoRS.carga_cronica} UA</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-surface-500">Sesiones</span>
                  <span className="text-surface-700 font-medium">{ultimoRS.num_sesiones}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-surface-500">Wellness medio</span>
                  <span className="text-surface-700 font-medium">{ultimoRS.wellness_medio}</span>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-surface-400">Sin datos</p>
            )}
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <h3 className="text-xs font-semibold text-surface-700 mb-3">Tests recientes</h3>
            {testsJug.length > 0 ? (
              <div className="space-y-1">
                {testsJug.slice(0, 5).map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-surface-100 last:border-0">
                    <span className="text-surface-500">{t.test}</span>
                    <span className="text-surface-700">{t.resultado} {t.unidad}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-surface-400">Sin tests registrados</p>
            )}
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <h3 className="text-xs font-semibold text-surface-700 mb-3">Historial lesional</h3>
            {jugadora.historial_lesional ? (
              <p className="text-[10px] text-surface-600">{jugadora.historial_lesional}</p>
            ) : (
              <p className="text-[10px] text-surface-400">Sin historial registrado</p>
            )}
            {lesionesJug.length > 0 && (
              <div className="mt-2">
                <span className="text-[10px] font-medium text-surface-500">Últimas lesiones:</span>
                {lesionesJug.slice(0, 3).map((l) => (
                  <div key={l.id_lesion} className="text-[10px] text-surface-600 mt-0.5">
                    {l.tipo} ({l.fecha_inicio})
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-surface-700">Fuerza reciente</h3>
              <button
                onClick={() => setActiveTabCache((prev) => ({ ...prev, [id || '']: 'fuerza' }))}
                className="text-[10px] text-primary-600 hover:underline font-medium"
              >
                Ver historial de fuerza
              </button>
            </div>
            {fuerzaJug.length > 0 ? (
              <div className="space-y-2">
                {fuerzaJug.slice(0, 3).map((sesion) => {
                  const sesTrabajos = trabajos_fuerza.filter(
                    (t) => t.id_sesion_fuerza === sesion.id_sesion_fuerza || t.id_sesion === sesion.id_sesion_fuerza
                  )
                  const summary = calcularResumenSesionFuerza(sesTrabajos)

                  return (
                    <div key={sesion.id_sesion_fuerza} className="flex items-center justify-between text-[10px] py-1 border-b border-surface-100 last:border-0">
                      <div>
                        <span className="font-semibold text-surface-800">{sesion.fecha}</span>
                        <span className="text-surface-400 ml-1.5 font-normal">
                          ({summary.ejerciciosCount} ej / {summary.seriesCount} series)
                        </span>
                      </div>
                      <span className="font-medium text-primary-700">{summary.tonelajeLabel}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-[10px] text-surface-400">Sin sesiones de fuerza registradas</p>
            )}
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-surface-700">Exposición competitiva</h3>
              <div className="relative group">
                <span 
                  className={`px-2 py-0.5 rounded text-[10px] font-medium peer ${exposicionCompetitiva.motivosCalidadDato.length > 0 ? 'cursor-help' : ''} ${
                  exposicionCompetitiva.calidadDato === 'completa' ? 'bg-green-50 text-green-700 border border-green-200' :
                  exposicionCompetitiva.calidadDato === 'parcial' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  exposicionCompetitiva.calidadDato === 'insuficiente' ? 'bg-red-50 text-red-700 border border-red-200' :
                  'bg-surface-100 text-surface-600 border border-surface-200'
                }`}
                  tabIndex={exposicionCompetitiva.motivosCalidadDato.length > 0 ? 0 : undefined}
                  aria-describedby={exposicionCompetitiva.motivosCalidadDato.length > 0 ? "tooltip-calidad" : undefined}
                  onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur() }}
                >
                  {exposicionCompetitiva.calidadDato === 'sin_competicion' ? 'Sin competición' : 
                   exposicionCompetitiva.calidadDato === 'insuficiente' ? 'Datos competitivos incompletos' :
                   exposicionCompetitiva.calidadDato.charAt(0).toUpperCase() + exposicionCompetitiva.calidadDato.slice(1)}
                </span>
                {exposicionCompetitiva.motivosCalidadDato.length > 0 && (
                  <div id="tooltip-calidad" className="absolute right-0 bottom-full mb-1 hidden group-hover:block peer-focus:block w-48 p-2 bg-surface-800 text-white text-[10px] rounded shadow-lg z-10" role="tooltip">
                    <ul className="list-disc pl-3">
                      {exposicionCompetitiva.motivosCalidadDato.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-surface-500">Minutos (7d / 28d)</span>
                <span className="text-sm font-semibold text-surface-800">
                  {exposicionCompetitiva.minutos7d ?? '—'} / {exposicionCompetitiva.minutos28d ?? '—'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-surface-500">Partidos (7d / 28d)</span>
                <span className="text-xs font-medium text-surface-700">
                  {exposicionCompetitiva.partidosJugados7d} / {exposicionCompetitiva.partidosJugados28d}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-surface-500">Convocatorias (7d / 28d)</span>
                <span className="text-xs font-medium text-surface-700">
                  {exposicionCompetitiva.convocatorias7d} / {exposicionCompetitiva.convocatorias28d}
                </span>
              </div>

              {exposicionCompetitiva.convocadaSinMinutos28d > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-surface-500">Conv. sin minutos (28d)</span>
                  <span className="text-xs font-medium text-amber-600">
                    {exposicionCompetitiva.convocadaSinMinutos28d}
                  </span>
                </div>
              )}

              {exposicionCompetitiva.porcentajeExposicion7d !== null && (
                <div className="flex items-center justify-between pt-2 border-t border-surface-100">
                  <span className="text-[10px] text-surface-500">% Exposición (7d)</span>
                  <span className="text-xs font-semibold text-primary-700">
                    {Math.round(exposicionCompetitiva.porcentajeExposicion7d)}%
                  </span>
                </div>
              )}

              {exposicionCompetitiva.referenciaSemanal28d !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-surface-500">Referencia 28d</span>
                  <span className="text-xs font-medium text-surface-700">
                    {Math.round(exposicionCompetitiva.referenciaSemanal28d)} min/sem
                  </span>
                </div>
              )}

              {exposicionCompetitiva.ratioCambioExposicion !== null && (
                <div className="flex items-center justify-between relative group/ratio">
                  <span 
                    className="peer text-[10px] text-surface-500 cursor-help border-b border-dashed border-surface-300" 
                    tabIndex={0} 
                    aria-describedby="tooltip-ratio"
                    onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur() }}
                  >
                    Ratio de cambio
                  </span>
                  <span className={`text-xs font-semibold ${
                    exposicionCompetitiva.ratioCambioExposicion > 1.5 ? 'text-primary-700' :
                    exposicionCompetitiva.ratioCambioExposicion < 0.5 ? 'text-surface-500' :
                    'text-surface-800'
                  }`}>
                    {exposicionCompetitiva.ratioCambioExposicion.toFixed(2)}
                  </span>
                  <div id="tooltip-ratio" className="absolute right-0 bottom-full mb-1 hidden group-hover/ratio:block peer-focus:block w-48 p-2 bg-surface-800 text-white text-[10px] rounded shadow-lg z-10" role="tooltip">
                    Comparativa de minutos de los últimos 7 días respecto a la media semanal de los últimos 28 días.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'wellness' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-surface-700">Evolución componentes de wellness</h3>
              <div className="flex gap-1 bg-surface-100 p-0.5 rounded border border-surface-200">
                <button
                  onClick={() => setWellnessRange(7)}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors ${wellnessRange === 7 ? 'bg-white text-surface-800 font-medium shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}
                >
                  7 días
                </button>
                <button
                  onClick={() => setWellnessRange(28)}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors ${wellnessRange === 28 ? 'bg-white text-surface-800 font-medium shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}
                >
                  28 días
                </button>
              </div>
            </div>
            {wellnessGrafico.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={wellnessGrafico} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                  <Line type="monotone" dataKey="score_wellness" stroke="#1a6dff" strokeWidth={3} name="Score" dot={{ r: 3 }} connectNulls={true} />
                  <Line type="monotone" dataKey="calidad_sueno" stroke="#3b82f6" strokeWidth={1.5} name="Sueño" strokeDasharray="3 3" dot={{ r: 2 }} connectNulls={true} />
                  <Line type="monotone" dataKey="fatiga" stroke="#f59e0b" strokeWidth={1.5} name="Fatiga" strokeDasharray="3 3" dot={{ r: 2 }} connectNulls={true} />
                  <Line type="monotone" dataKey="dolor_muscular" stroke="#ef4444" strokeWidth={1.5} name="Dolor Musc." strokeDasharray="3 3" dot={{ r: 2 }} connectNulls={true} />
                  <Line type="monotone" dataKey="estres" stroke="#a855f7" strokeWidth={1.5} name="Estrés" strokeDasharray="3 3" dot={{ r: 2 }} connectNulls={true} />
                  <Line type="monotone" dataKey="estado_animo" stroke="#10b981" strokeWidth={1.5} name="Ánimo" strokeDasharray="3 3" dot={{ r: 2 }} connectNulls={true} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-surface-400 text-center py-8">Sin datos de wellness</p>
            )}
          </div>
          <div className="text-xs text-surface-500 mb-2">Registros de wellness</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200">
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Fecha</th>
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Sueño</th>
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Fatiga</th>
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Dolor</th>
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Estrés</th>
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Ánimo</th>
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Score</th>
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Dolor específico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {wellnessJug.map((w) => (
                <tr
                  key={w.id}
                  className="hover:bg-surface-50 cursor-pointer"
                  onClick={() => {
                    setEditWellness(w)
                    setWellnessForm({ ...w })
                  }}
                >
                  <td className="px-3 py-2 text-surface-700">{w.fecha}</td>
                  <td className="px-3 py-2">{(w.calidad_sueno !== null && w.calidad_sueno !== undefined) ? w.calidad_sueno : '—'}</td>
                  <td className="px-3 py-2">{(w.fatiga !== null && w.fatiga !== undefined) ? w.fatiga : '—'}</td>
                  <td className="px-3 py-2">{(w.dolor_muscular !== null && w.dolor_muscular !== undefined) ? w.dolor_muscular : '—'}</td>
                  <td className="px-3 py-2">{(w.estres !== null && w.estres !== undefined) ? w.estres : '—'}</td>
                  <td className="px-3 py-2">{(w.estado_animo !== null && w.estado_animo !== undefined) ? w.estado_animo : '—'}</td>
                  <td className={`px-3 py-2 font-semibold ${getWellnessThreshold(getWellnessLevel(w.score_wellness)).color.split(' ')[0]}`}>
                    {w.score_wellness}
                  </td>
                  <td className="px-3 py-2 text-surface-500">{w.dolor_especifico || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'carga' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <h3 className="text-xs font-semibold text-surface-700 mb-3">Carga diaria (14 días)</h3>
            {cargaDiaria.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={cargaDiaria} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="carga" fill="#0052e6" radius={[2, 2, 0, 0]} name="Carga (UA)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-surface-400 text-center py-8">Sin datos de carga</p>
            )}
          </div>
        </div>
      )}

      {tab === 'readiness' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <h3 className="text-xs font-semibold text-surface-700 mb-3">Historial de Readiness (14 días)</h3>
            {(() => {
              const readinessJug = obtenerListaReadinessDeterminista(readiness, id)
                .sort((a, b) => b.fecha.localeCompare(a.fecha))
                .slice(0, 14)
              if (readinessJug.length === 0) return <p className="text-xs text-surface-400 text-center py-8">Sin datos de readiness</p>
              return (
                <div className="space-y-1">
                  {readinessJug.map(r => {
                    const dotColor = r.nivel === 'rojo' ? 'bg-red-500' : r.nivel === 'ambar' ? 'bg-amber-500' : 'bg-green-500'
                    return (
                      <div key={r.fecha} className="flex items-center justify-between px-2 py-1.5 text-xs border-b border-surface-100">
                        <span className="text-surface-600">{r.fecha.slice(5)}</span>
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                          <span className="font-mono text-surface-800 font-medium">{r.score}</span>
                          <span className="text-[10px] text-surface-500">ACWR: {r.factores.acwr.toFixed(2)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {tab === 'ciclo' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setNewCicloOpen(true)} className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700">
              + Añadir Ciclo
            </button>
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <h3 className="text-xs font-semibold text-surface-700 mb-3">Historial de Ciclo Menstrual</h3>
            {cicloJug.length > 0 ? (
              <table className="w-full text-xs">
                <thead><tr className="bg-surface-50 border-b border-surface-200"><th className="text-left px-3 py-2">Fecha</th><th className="text-left px-3 py-2">Fase</th><th className="text-left px-3 py-2">Síntomas</th></tr></thead>
                <tbody>{cicloJug.map(c => <tr key={c.id} className="border-b"><td className="px-3 py-2">{c.fecha}</td><td className="px-3 py-2">{c.fase}</td><td className="px-3 py-2">{c.sintomas}</td></tr>)}</tbody>
              </table>
            ) : <p className="text-xs text-surface-400 text-center py-8">Sin datos de ciclo</p>}
          </div>
        </div>
      )}

      {tab === 'gps' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setNewGPSOpen(true)} className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700">
              + Añadir GPS
            </button>
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <h3 className="text-xs font-semibold text-surface-700 mb-3">Carga Externa GPS</h3>
            {gpsJug.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={gpsJug}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="distancia_total" fill="#3b82f6" name="Dist. Total (m)" />
                  <Line yAxisId="right" type="monotone" dataKey="distancia_hsr" stroke="#ef4444" name="HSR (m)" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-surface-400 text-center py-8">Sin datos GPS</p>}
          </div>
        </div>
      )}

      {tab === 'vbt' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setNewVBTOpen(true)} className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700">
              + Añadir VBT
            </button>
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <h3 className="text-xs font-semibold text-surface-700 mb-3">Perfil Fuerza-Velocidad (VBT)</h3>
            {vbtJug.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid />
                  <XAxis type="number" dataKey="carga_kg" name="Carga" unit="kg" />
                  <YAxis type="number" dataKey="velocidad_media" name="Vel. Media" unit="m/s" />
                  <ZAxis type="category" dataKey="fecha" name="Fecha" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Legend />
                  <Scatter name="Sentadilla" data={vbtJug.filter(v => v.ejercicio === 'Sentadilla')} fill="#8884d8" />
                </ScatterChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-surface-400 text-center py-8">Sin datos VBT</p>}
          </div>
        </div>
      )}

      {tab === 'hidratacion' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setNewHidratacionOpen(true)} className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700">
              + Añadir Peso
            </button>
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <h3 className="text-xs font-semibold text-surface-700 mb-3">Control Peso / Hidratación</h3>
            {hidratacionJug.length > 0 ? (
               <ResponsiveContainer width="100%" height={200}>
                 <BarChart data={hidratacionJug}>
                   <CartesianGrid strokeDasharray="3 3" />
                   <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                   <YAxis tick={{ fontSize: 10 }} />
                   <Tooltip />
                   <Legend />
                   <Bar dataKey="peso_pre" fill="#10b981" name="Peso Pre (kg)" />
                   <Bar dataKey="peso_post" fill="#3b82f6" name="Peso Post (kg)" />
                 </BarChart>
               </ResponsiveContainer>
            ) : <p className="text-xs text-surface-400 text-center py-8">Sin datos de peso</p>}
          </div>
        </div>
      )}

      {tab === 'psicologia' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setNewPsicologiaOpen(true)} className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700">
              + Añadir Test (POMS)
            </button>
          </div>
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <h3 className="text-xs font-semibold text-surface-700 mb-3">Perfil de Estados de Ánimo (Último Test)</h3>
            {psicoJug.length > 0 ? (
               <ResponsiveContainer width="100%" height={250}>
                 <RadarChart cx="50%" cy="50%" outerRadius="80%" data={
                    [
                      { subject: 'Tensión', A: psicoJug[psicoJug.length - 1].tension, fullMark: 10 },
                      { subject: 'Depresión', A: psicoJug[psicoJug.length - 1].depresion, fullMark: 10 },
                      { subject: 'Ira', A: psicoJug[psicoJug.length - 1].ira, fullMark: 10 },
                      { subject: 'Vigor', A: psicoJug[psicoJug.length - 1].vigor, fullMark: 10 },
                      { subject: 'Fatiga', A: psicoJug[psicoJug.length - 1].fatiga_mental, fullMark: 10 },
                      { subject: 'Confusión', A: psicoJug[psicoJug.length - 1].confusion, fullMark: 10 }
                    ]
                 }>
                   <PolarGrid />
                   <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                   <PolarRadiusAxis angle={30} domain={[0, 10]} />
                   <Radar name="POMS" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                   <Tooltip />
                 </RadarChart>
               </ResponsiveContainer>
            ) : <p className="text-xs text-surface-400 text-center py-8">Sin datos psicológicos</p>}
          </div>
        </div>
      )}

      {tab === 'tests' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setNewTestOpen(true)}
              className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700"
            >
              + Nuevo test
            </button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200">
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Fecha</th>
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Momento</th>
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Test</th>
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Resultado</th>
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Unidad</th>
                <th className="text-left px-3 py-2 font-semibold text-surface-600">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {testsJug.map((t) => (
                <tr key={t.id} className="hover:bg-surface-50">
                  <td className="px-3 py-2 text-surface-700">{t.fecha}</td>
                  <td className="px-3 py-2">{t.momento}</td>
                  <td className="px-3 py-2 font-medium">{t.test}</td>
                  <td className="px-3 py-2">{t.resultado}</td>
                  <td className="px-3 py-2">{t.unidad}</td>
                  <td className="px-3 py-2 text-surface-500">{t.notas || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'cmj' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-surface-800">Pruebas CMJ Recientes</h3>
            <button 
              onClick={() => navigate('/pruebas-cmj')}
              className="text-xs text-primary-600 hover:underline font-medium"
            >
              Ver todas las pruebas &rarr;
            </button>
          </div>
          
          {cmjJug.length === 0 ? (
            <p className="text-xs text-surface-400 text-center py-8 bg-surface-50 rounded-lg">Sin pruebas CMJ registradas</p>
          ) : (
            <div className="space-y-6">
              {Array.from(new Set(cmjJug.map(c => c.id_protocolo))).map(protocoloId => {
                const medicionesDeProtocolo = cmjJug.filter(c => c.id_protocolo === protocoloId).slice(0, 5)
                const nombreProtocolo = medicionesDeProtocolo[0].protocolo_nombre_historico
                
                return (
                  <div key={protocoloId} className="bg-white rounded-lg border border-surface-200 overflow-hidden">
                    <div className="bg-surface-50 px-4 py-2 border-b border-surface-200">
                      <h4 className="text-xs font-semibold text-surface-700">{nombreProtocolo}</h4>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-surface-200 text-surface-500">
                          <th className="text-left px-4 py-2 font-medium">Fecha</th>
                          <th className="text-left px-4 py-2 font-medium">Finalidad</th>
                          <th className="text-right px-4 py-2 font-medium">Altura Máx (cm)</th>
                          <th className="text-right px-4 py-2 font-medium">Vuelo (ms)</th>
                          <th className="text-center px-4 py-2 font-medium">Intentos Válidos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {medicionesDeProtocolo.map(m => (
                          <tr key={m.id_medicion} className="hover:bg-surface-50">
                            <td className="px-4 py-2.5 text-surface-700">{m.fecha}</td>
                            <td className="px-4 py-2.5 capitalize">{m.finalidad?.replace('_', ' ') || '—'}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-surface-900">
                              {m.altura_mejor_cm != null ? m.altura_mejor_cm : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right text-surface-600">
                              {m.tiempo_vuelo_mejor_ms != null ? m.tiempo_vuelo_mejor_ms : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-center text-surface-500">
                              {m.intentos.filter(i => i.valido).length} / {m.intentos.length}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'fuerza' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-surface-200">
            <div>
              <h3 className="text-sm font-bold text-surface-900">Historial de fuerza</h3>
              <p className="text-xs text-surface-500 mt-0.5">
                Sesiones individuales de fuerza registradas para esta jugadora.
              </p>
            </div>
            <button
              onClick={() => navigate(`/fuerza?jugadora=${id}`)}
              className="text-xs text-primary-600 hover:underline font-medium"
            >
              Ver todas en Fuerza
            </button>
          </div>

          {/* Filtros locales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-white p-4 rounded-lg border border-surface-200">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Desde</label>
              <input
                type="date"
                className="w-full rounded border-surface-300 text-xs p-1.5"
                value={fuerzaFilters.fecha_desde}
                onChange={(e) => setFuerzaFilters({ ...fuerzaFilters, fecha_desde: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Hasta</label>
              <input
                type="date"
                className="w-full rounded border-surface-300 text-xs p-1.5"
                value={fuerzaFilters.fecha_hasta}
                onChange={(e) => setFuerzaFilters({ ...fuerzaFilters, fecha_hasta: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Finalidad</label>
              <select
                className="w-full rounded border-surface-300 text-xs p-1.5"
                value={fuerzaFilters.finalidad}
                onChange={(e) => setFuerzaFilters({ ...fuerzaFilters, finalidad: e.target.value })}
              >
                <option value="">Todas</option>
                {Object.entries(FINALIDADES_MAP).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">Ejercicio</label>
              <select
                className="w-full rounded border-surface-300 text-xs p-1.5"
                value={fuerzaFilters.id_ejercicio}
                onChange={(e) => setFuerzaFilters({ ...fuerzaFilters, id_ejercicio: e.target.value })}
              >
                <option value="">Todos</option>
                {ejercicios_fuerza.map((ex) => (
                  <option key={ex.id_ejercicio} value={ex.id_ejercicio}>
                    {ex.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() =>
                  setFuerzaFilters({
                    fecha_desde: '',
                    fecha_hasta: '',
                    finalidad: '',
                    id_ejercicio: '',
                  })
                }
                className="w-full py-1.5 text-xs text-surface-600 bg-surface-100 hover:bg-surface-200 rounded border border-surface-200"
              >
                Restablecer filtros
              </button>
            </div>
          </div>

          {/* Listado / Estados vacíos */}
          {fuerzaJug.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white rounded-lg border border-surface-200">
              <p className="text-sm text-surface-500 font-medium mb-3">
                Sin sesiones de fuerza registradas
              </p>
              <button
                onClick={() => navigate(`/fuerza?jugadora=${id}`)}
                className="px-4 py-2 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm"
              >
                Ver registro de fuerza
              </button>
            </div>
          ) : filteredFuerzaJug.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white rounded-lg border border-surface-200">
              <p className="text-sm text-surface-500 font-medium">
                No hay sesiones que coincidan con los filtros
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-50 text-surface-500 border-b border-surface-200">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">Fecha</th>
                    <th className="py-2.5 px-3 font-medium">Finalidad</th>
                    <th className="py-2.5 px-3 font-medium">Ejercicios</th>
                    <th className="py-2.5 px-3 font-medium">Series</th>
                    <th className="py-2.5 px-3 font-medium">Tonelaje</th>
                    <th className="py-2.5 px-3 font-medium">RPE</th>
                    <th className="py-2.5 px-3 font-medium">Duración</th>
                    <th className="py-2.5 px-3 font-medium text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {filteredFuerzaJug.map((sesion) => {
                    const sesTrabajos = trabajos_fuerza.filter(
                      (t) => t.id_sesion_fuerza === sesion.id_sesion_fuerza || t.id_sesion === sesion.id_sesion_fuerza
                    )
                    const summary = calcularResumenSesionFuerza(sesTrabajos)
                    const finalidadLabel = sesion.finalidad
                      ? FINALIDADES_MAP[sesion.finalidad] || sesion.finalidad
                      : '—'

                    return (
                      <tr key={sesion.id_sesion_fuerza} className="hover:bg-surface-50">
                        <td className="py-2.5 px-3 font-semibold text-surface-900">{sesion.fecha}</td>
                        <td className="py-2.5 px-3 text-surface-700">{finalidadLabel}</td>
                        <td className="py-2.5 px-3 text-surface-700">{summary.ejerciciosCount}</td>
                        <td className="py-2.5 px-3 text-surface-700">{summary.seriesCount}</td>
                        <td className="py-2.5 px-3 font-medium text-primary-700">{summary.tonelajeLabel}</td>
                        <td className="py-2.5 px-3 text-surface-700">
                          {sesion.rpe_sesion != null ? `${sesion.rpe_sesion}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-surface-700">
                          {sesion.duracion_min != null ? `${sesion.duracion_min} min` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setFuerzaDetailId(sesion.id_sesion_fuerza)}
                            className="text-primary-600 hover:text-primary-800 font-medium"
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <StrengthDetailModal
            open={!!fuerzaDetailId}
            onClose={() => setFuerzaDetailId(null)}
            sesionId={fuerzaDetailId}
            readOnly={true}
          />
        </div>
      )}

      {tab === 'lesiones' && (
        <div className="space-y-4">
          {lesionesJug.length === 0 ? (
            <p className="text-xs text-surface-400 text-center py-8">Sin historial de lesiones</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  <th className="text-left px-3 py-2 font-semibold text-surface-600">Inicio</th>
                  <th className="text-left px-3 py-2 font-semibold text-surface-600">Fin</th>
                  <th className="text-left px-3 py-2 font-semibold text-surface-600">Tipo</th>
                  <th className="text-left px-3 py-2 font-semibold text-surface-600">Localización</th>
                  <th className="text-left px-3 py-2 font-semibold text-surface-600">Días baja</th>
                  <th className="text-left px-3 py-2 font-semibold text-surface-600">Fase RTP</th>
                  <th className="text-left px-3 py-2 font-semibold text-surface-600">Disponible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {lesionesJug.map((l) => (
                  <tr key={l.id_lesion} className="hover:bg-surface-50">
                    <td className="px-3 py-2 text-surface-700">{l.fecha_inicio}</td>
                    <td className="px-3 py-2 text-surface-500">{l.fecha_fin || '—'}</td>
                    <td className="px-3 py-2">{l.tipo}</td>
                    <td className="px-3 py-2">{l.localizacion}</td>
                    <td className="px-3 py-2">{l.severidad_dias_baja}</td>
                    <td className="px-3 py-2">{l.fase_rtp}</td>
                    <td className="px-3 py-2">
                      {l.disponible ? (
                        <span className="text-green-600">Sí</span>
                      ) : (
                        <span className="text-red-600">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'semanal' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <h3 className="text-xs font-semibold text-surface-700 mb-3">Resumen semanal</h3>
            {resumenJug.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200">
                    <th className="text-left px-3 py-2 font-semibold text-surface-600">Semana</th>
                    <th className="text-left px-3 py-2 font-semibold text-surface-600">Carga entreno</th>
                    <th className="text-left px-3 py-2 font-semibold text-surface-600">Carga partido</th>
                    <th className="text-left px-3 py-2 font-semibold text-surface-600">Carga total</th>
                    <th className="text-left px-3 py-2 font-semibold text-surface-600">Carga crónica</th>
                    <th className="text-left px-3 py-2 font-semibold text-surface-600">ACWR</th>
                    <th className="text-left px-3 py-2 font-semibold text-surface-600">Wellness</th>
                    <th className="text-left px-3 py-2 font-semibold text-surface-600">Sesiones</th>
                    <th className="text-left px-3 py-2 font-semibold text-surface-600">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {resumenJug.map((rs) => (
                    <tr key={rs.id} className="hover:bg-surface-50">
                      <td className="px-3 py-2 text-surface-500 text-[10px]">{formatWeek(rs.semana)}</td>
                      <td className="px-3 py-2">{Math.round(rs.carga_entreno)}</td>
                      <td className="px-3 py-2">{Math.round(rs.carga_partido)}</td>
                      <td className="px-3 py-2 font-medium">{Math.round(rs.carga_total)}</td>
                      <td className="px-3 py-2">{Math.round(rs.carga_cronica)}</td>
                      <td className={`px-3 py-2 font-semibold ${getLoadStatus(rs.acwr).color.split(' ')[0]}`}>
                        {rs.acwr.toFixed(2)}
                      </td>
                      <td className="px-3 py-2">{rs.wellness_medio}</td>
                      <td className="px-3 py-2">{rs.num_sesiones}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          getLoadStatus(rs.acwr).color
                        }`}>
                          {getLoadStatus(rs.acwr).label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-surface-400 text-center py-8">Sin datos semanales</p>
            )}
          </div>
        </div>
      )}

      {tab === 'alias' && (
        <PlayerAliasSection id_jugadora={id!} nombreJugadora={jugadora?.nombre || id!} />
      )}

      <Modal open={!!editWellness} onClose={() => setEditWellness(null)} title="Editar registro de wellness">
        {wellnessForm && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-medium text-surface-600 block mb-1">Fecha</label>
              <input
                type="date"
                className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs text-surface-700 bg-white"
                value={wellnessForm.fecha}
                onChange={(e) => setWellnessForm({ ...wellnessForm, fecha: e.target.value })}
              />
            </div>
            {[
              { key: 'calidad_sueno', label: 'Calidad de sueño', minLabel: 'muy malo', maxLabel: 'excelente' },
              { key: 'fatiga', label: 'Fatiga', minLabel: 'nada', maxLabel: 'extremo' },
              { key: 'dolor_muscular', label: 'Dolor muscular', minLabel: 'nada', maxLabel: 'extremo' },
              { key: 'estres', label: 'Estrés', minLabel: 'nada', maxLabel: 'extremo' },
              { key: 'estado_animo', label: 'Estado de ánimo', minLabel: 'muy bajo', maxLabel: 'excelente' },
            ].map((field) => (
              <div key={field.key}>
                <label className="text-[10px] font-medium text-surface-600 block mb-1">{field.label}</label>
                <select
                  className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs bg-white text-surface-700"
                  value={wellnessForm[field.key as keyof Wellness] ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : Number(e.target.value)
                    const updated = {
                      ...wellnessForm,
                      [field.key]: val,
                    }
                    setWellnessForm({
                      ...updated,
                      score_wellness: calcularScoreWellness(updated),
                    })
                  }}
                >
                  <option value="">No respondido</option>
                  <option value={1}>1 - {field.minLabel}</option>
                  {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                  <option value={10}>10 - {field.maxLabel}</option>
                </select>
              </div>
            ))}
            <div className="col-span-2">
              <label className="text-[10px] font-medium text-surface-600 block mb-1">Dolor específico</label>
              <input
                className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
                value={wellnessForm.dolor_especifico}
                onChange={(e) => setWellnessForm({ ...wellnessForm, dolor_especifico: e.target.value })}
              />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setEditWellness(null)} className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded">
            Cancelar
          </button>
          <button onClick={handleSaveWellness} className="text-xs text-white bg-primary-600 px-3 py-1.5 rounded hover:bg-primary-700">
            Guardar
          </button>
        </div>
      </Modal>

      <Modal open={newTestOpen} onClose={() => setNewTestOpen(false)} title="Nuevo test físico" width="max-w-md">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Fecha</label>
            <input
              type="date"
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={testForm.fecha}
              onChange={(e) => setTestForm({ ...testForm, fecha: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Momento</label>
            <select
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={testForm.momento}
              onChange={(e) => setTestForm({ ...testForm, momento: e.target.value })}
            >
              <option value="Pretemporada">Pretemporada</option>
              <option value="Precompeticion">Precompetición</option>
              <option value="Medio_temporada">Medio temporada</option>
              <option value="Post_temporada">Post temporada</option>
              <option value="Mensual">Mensual</option>
              <option value="Semanal">Semanal</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Test</label>
            <input
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={testForm.test}
              onChange={(e) => setTestForm({ ...testForm, test: e.target.value })}
              placeholder="Ej: CMJ, Sprint 30m, Yo-Yo..."
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Resultado</label>
            <input
              type="number"
              step="0.01"
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={testForm.resultado}
              onChange={(e) => setTestForm({ ...testForm, resultado: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Unidad</label>
            <input
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={testForm.unidad}
              onChange={(e) => setTestForm({ ...testForm, unidad: e.target.value })}
              placeholder="cm, s, ml/kg/min..."
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Notas</label>
            <input
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={testForm.notas}
              onChange={(e) => setTestForm({ ...testForm, notas: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setNewTestOpen(false)} className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded">
            Cancelar
          </button>
          <button onClick={handleAddTest} className="text-xs text-white bg-primary-600 px-3 py-1.5 rounded hover:bg-primary-700">
            Añadir test
          </button>
        </div>
      </Modal>

      <Modal open={newCicloOpen} onClose={() => setNewCicloOpen(false)} title="Nuevo registro de ciclo">
        <div className="space-y-4">
          <input type="date" className="w-full border p-2 text-xs" value={cicloForm.fecha} onChange={e => setCicloForm({...cicloForm, fecha: e.target.value})} />
          <select className="w-full border p-2 text-xs" value={cicloForm.fase} onChange={e => setCicloForm({...cicloForm, fase: e.target.value})}>
            <option value="Menstruacion">Menstruación</option>
            <option value="Folicular">Folicular</option>
            <option value="Ovulacion">Ovulación</option>
            <option value="Lutea">Lútea</option>
          </select>
          <input type="text" placeholder="Síntomas" className="w-full border p-2 text-xs" value={cicloForm.sintomas} onChange={e => setCicloForm({...cicloForm, sintomas: e.target.value})} />
          <button onClick={() => { addCicloMenstrual({...cicloForm, id_jugadora: id!}); setNewCicloOpen(false) }} className="w-full bg-primary-600 text-white py-2 rounded text-xs">Guardar</button>
        </div>
      </Modal>

      <Modal open={newGPSOpen} onClose={() => setNewGPSOpen(false)} title="Nuevo registro GPS">
        <div className="space-y-4">
          <input type="date" className="w-full border p-2 text-xs" value={gpsForm.fecha} onChange={e => setGpsForm({...gpsForm, fecha: e.target.value})} />
          <input type="number" placeholder="Distancia Total (m)" className="w-full border p-2 text-xs" value={gpsForm.distancia_total} onChange={e => setGpsForm({...gpsForm, distancia_total: Number(e.target.value)})} />
          <input type="number" placeholder="Distancia HSR (m)" className="w-full border p-2 text-xs" value={gpsForm.distancia_hsr} onChange={e => setGpsForm({...gpsForm, distancia_hsr: Number(e.target.value)})} />
          <button onClick={() => { addCargaGPS({...gpsForm, id_jugadora: id!}); setNewGPSOpen(false) }} className="w-full bg-primary-600 text-white py-2 rounded text-xs">Guardar</button>
        </div>
      </Modal>

      <Modal open={newVBTOpen} onClose={() => setNewVBTOpen(false)} title="Nuevo registro VBT">
        <div className="space-y-4">
          <input type="date" className="w-full border p-2 text-xs" value={vbtForm.fecha} onChange={e => setVbtForm({...vbtForm, fecha: e.target.value})} />
          <input type="number" placeholder="Carga Kg" className="w-full border p-2 text-xs" value={vbtForm.carga_kg} onChange={e => setVbtForm({...vbtForm, carga_kg: Number(e.target.value)})} />
          <input type="number" placeholder="Velocidad Media (m/s)" className="w-full border p-2 text-xs" value={vbtForm.velocidad_media} onChange={e => setVbtForm({...vbtForm, velocidad_media: Number(e.target.value)})} />
          <button onClick={() => { addFuerzaVBT({...vbtForm, id_jugadora: id!}); setNewVBTOpen(false) }} className="w-full bg-primary-600 text-white py-2 rounded text-xs">Guardar</button>
        </div>
      </Modal>

      <Modal open={newHidratacionOpen} onClose={() => setNewHidratacionOpen(false)} title="Nuevo registro Peso">
        <div className="space-y-4">
          <input type="date" className="w-full border p-2 text-xs" value={hidratacionForm.fecha} onChange={e => setHidratacionForm({...hidratacionForm, fecha: e.target.value})} />
          <input type="number" placeholder="Peso Pre (kg)" className="w-full border p-2 text-xs" value={hidratacionForm.peso_pre} onChange={e => setHidratacionForm({...hidratacionForm, peso_pre: Number(e.target.value)})} />
          <input type="number" placeholder="Peso Post (kg)" className="w-full border p-2 text-xs" value={hidratacionForm.peso_post} onChange={e => setHidratacionForm({...hidratacionForm, peso_post: Number(e.target.value)})} />
          <button onClick={() => { addHidratacion({...hidratacionForm, id_jugadora: id!}); setNewHidratacionOpen(false) }} className="w-full bg-primary-600 text-white py-2 rounded text-xs">Guardar</button>
        </div>
      </Modal>

      <Modal open={newPsicologiaOpen} onClose={() => setNewPsicologiaOpen(false)} title="Nuevo Test POMS (1-10)">
        <div className="space-y-4">
          <input type="date" className="w-full border p-2 text-xs" value={psicologiaForm.fecha} onChange={e => setPsicologiaForm({...psicologiaForm, fecha: e.target.value})} />
          <input type="number" placeholder="Tensión (1-10)" className="w-full border p-2 text-xs" value={psicologiaForm.tension} onChange={e => setPsicologiaForm({...psicologiaForm, tension: Number(e.target.value)})} />
          <input type="number" placeholder="Depresión (1-10)" className="w-full border p-2 text-xs" value={psicologiaForm.depresion} onChange={e => setPsicologiaForm({...psicologiaForm, depresion: Number(e.target.value)})} />
          <input type="number" placeholder="Ira (1-10)" className="w-full border p-2 text-xs" value={psicologiaForm.ira} onChange={e => setPsicologiaForm({...psicologiaForm, ira: Number(e.target.value)})} />
          <input type="number" placeholder="Vigor (1-10)" className="w-full border p-2 text-xs" value={psicologiaForm.vigor} onChange={e => setPsicologiaForm({...psicologiaForm, vigor: Number(e.target.value)})} />
          <input type="number" placeholder="Fatiga (1-10)" className="w-full border p-2 text-xs" value={psicologiaForm.fatiga_mental} onChange={e => setPsicologiaForm({...psicologiaForm, fatiga_mental: Number(e.target.value)})} />
          <input type="number" placeholder="Confusión (1-10)" className="w-full border p-2 text-xs" value={psicologiaForm.confusion} onChange={e => setPsicologiaForm({...psicologiaForm, confusion: Number(e.target.value)})} />
          <button onClick={() => { addTestPsicologico({...psicologiaForm, id_jugadora: id!}); setNewPsicologiaOpen(false) }} className="w-full bg-primary-600 text-white py-2 rounded text-xs">Guardar</button>
        </div>
      </Modal>
    </div>
  )
}
