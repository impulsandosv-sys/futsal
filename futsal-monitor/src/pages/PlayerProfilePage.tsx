import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '@/store/store'
import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts'
import { getWellnessLevel, getWellnessThreshold, getLoadStatus, formatWeek, calcularScoreWellness } from '@/utils/calculations'
import { Modal } from '@/components/shared/Modal'
import type { Wellness } from '@/types'

export function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { jugadoras, wellness, lesiones, tests, rpe_entreno, rpe_partido, resumen_semanal, updateWellness, addTest } = useStore()

  const jugadora = jugadoras.find((j) => j.id_jugadora === id)
  const [activeTabCache, setActiveTabCache] = useState<Record<string, string>>({})
  const tab = (activeTabCache[id || ''] as 'resumen' | 'wellness' | 'carga' | 'tests' | 'lesiones' | 'semanal') || 'resumen'
  const [editWellness, setEditWellness] = useState<Wellness | null>(null)
  const [wellnessForm, setWellnessForm] = useState<Wellness | null>(null)
  const [newTestOpen, setNewTestOpen] = useState(false)
  const [testForm, setTestForm] = useState({ fecha: '', momento: 'Pretemporada', test: '', resultado: 0, unidad: '', notas: '' })

  const rpeEntrenoJug = rpe_entreno.filter((r) => r.id_jugadora === id)
  const rpePartidoJug = rpe_partido.filter((r) => r.id_jugadora === id)

  const cargaDiaria = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rpeEntrenoJug) {
      map.set(r.fecha, (map.get(r.fecha) || 0) + r.carga_ua)
    }
    for (const r of rpePartidoJug) {
      map.set(r.fecha, (map.get(r.fecha) || 0) + r.carga_ua)
    }
    return Array.from(map.entries())
      .map(([fecha, carga]) => ({ fecha: fecha.slice(5), carga }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(-14)
  }, [rpeEntrenoJug, rpePartidoJug])

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
    ? Math.floor((Date.now() - new Date(jugadora.fecha_nacimiento).getTime()) / 31557600000)
    : null

  const wellnessJug = wellness.filter((w) => w.id_jugadora === id).sort((a, b) => b.fecha.localeCompare(a.fecha))
  const lesionesJug = lesiones.filter((l) => l.id_jugadora === id).sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
  const testsJug = tests.filter((t) => t.id_jugadora === id).sort((a, b) => b.fecha.localeCompare(a.fecha))
  const resumenJug = resumen_semanal.filter((rs) => rs.id_jugadora === id).sort((a, b) => b.semana.localeCompare(a.semana))

  const wellnessGrafico = wellnessJug.slice().reverse().slice(-14)

  const lesionActiva = lesionesJug.find((l) => !l.disponible)

  const ultimoWellness = wellnessJug[0]
  const ultimoRS = resumenJug[0]

  const tabs = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'wellness', label: 'Wellness' },
    { key: 'carga', label: 'Carga' },
    { key: 'tests', label: 'Tests' },
    { key: 'lesiones', label: 'Lesiones' },
    { key: 'semanal', label: 'Semanal' },
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
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/jugadoras')} className="text-surface-400 hover:text-surface-600 text-sm">&larr;</button>
        <div>
          <h1 className="text-lg font-bold text-surface-800">{jugadora.nombre}</h1>
          <p className="text-[10px] text-surface-500">{jugadora.posicion} · {jugadora.id_jugadora}</p>
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
        </div>
      )}

      {tab === 'wellness' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-surface-200 p-4">
            <h3 className="text-xs font-semibold text-surface-700 mb-3">Evolución wellness (14 días)</h3>
            {wellnessGrafico.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={wellnessGrafico} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="score_wellness" stroke="#1a6dff" strokeWidth={2} name="Wellness" dot={{ r: 3 }} />
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
                  <td className="px-3 py-2">{w.calidad_sueno}</td>
                  <td className="px-3 py-2">{w.fatiga}</td>
                  <td className="px-3 py-2">{w.dolor_muscular}</td>
                  <td className="px-3 py-2">{w.estres}</td>
                  <td className="px-3 py-2">{w.estado_animo}</td>
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

      <Modal open={!!editWellness} onClose={() => setEditWellness(null)} title="Editar registro de wellness">
        {wellnessForm && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-medium text-surface-600 block mb-1">Fecha</label>
              <input
                type="date"
                className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
                value={wellnessForm.fecha}
                onChange={(e) => setWellnessForm({ ...wellnessForm, fecha: e.target.value })}
              />
            </div>
            {[
              { key: 'calidad_sueno', label: 'Calidad de sueño' },
              { key: 'fatiga', label: 'Fatiga' },
              { key: 'dolor_muscular', label: 'Dolor muscular' },
              { key: 'estres', label: 'Estrés' },
              { key: 'estado_animo', label: 'Estado de ánimo' },
            ].map((field) => (
              <div key={field.key}>
                <label className="text-[10px] font-medium text-surface-600 block mb-1">{field.label} (1-10)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
                  value={wellnessForm[field.key as keyof Wellness] as number}
                  onChange={(e) => {
                    const updated = {
                      ...wellnessForm,
                      [field.key]: Number(e.target.value),
                    }
                    setWellnessForm({
                      ...updated,
                      score_wellness: calcularScoreWellness(updated),
                    })
                  }}
                />
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
    </div>
  )
}
