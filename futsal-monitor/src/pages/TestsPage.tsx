import { useState } from 'react'
import { useStore } from '@/store/store'
import { DataTable, DataRow, DataCell } from '@/components/shared/DataTable'
import { Filters } from '@/components/shared/Filters'
import { Modal } from '@/components/shared/Modal'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useNavigate } from 'react-router-dom'

export function TestsPage() {
  const { tests, jugadoras, filters, addTest } = useStore()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    momento: 'Pretemporada', id_jugadora: '', test: '', resultado: 0, unidad: '', notas: '',
  })

  const filtered = tests.filter((t) => {
    if (filters.id_jugadora && t.id_jugadora !== filters.id_jugadora) return false
    if (filters.fecha_desde && t.fecha < filters.fecha_desde) return false
    if (filters.fecha_hasta && t.fecha > filters.fecha_hasta) return false
    return true
  })

  const testsByName = filtered.reduce<Record<string, { nombre: string; data: { jugadora: string; resultado: number }[] }>>((acc, t) => {
    if (!acc[t.test]) acc[t.test] = { nombre: t.test, data: [] }
    const jug = jugadoras.find((j) => j.id_jugadora === t.id_jugadora)
    acc[t.test].data.push({ jugadora: jug?.nombre || t.id_jugadora, resultado: t.resultado })
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-surface-800">Tests Físicos</h1>
        <button onClick={() => setModalOpen(true)}
          className="bg-primary-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-primary-700"
        >
          + Nuevo test
        </button>
      </div>

      <Filters showPlayer showDate />

      {Object.values(testsByName).slice(0, 4).map((grupo) => (
        <div key={grupo.nombre} className="bg-white rounded-lg border border-surface-200 p-4">
          <h3 className="text-xs font-semibold text-surface-700 mb-3">{grupo.nombre}</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={grupo.data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="jugadora" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="resultado" fill="#1a6dff" radius={[2, 2, 0, 0]} name={grupo.nombre} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ))}

      <DataTable
        headers={['Fecha', 'Momento', 'Jugadora', 'Test', 'Resultado', 'Unidad', 'Notas']}
        emptyMessage="No hay tests registrados"
      >
        {filtered.map((t) => {
          const jug = jugadoras.find((j) => j.id_jugadora === t.id_jugadora)
          return (
            <DataRow key={t.id} onClick={() => navigate(`/jugadoras/${t.id_jugadora}`)}>
              <DataCell className="text-surface-500">{t.fecha}</DataCell>
              <DataCell>{t.momento}</DataCell>
              <DataCell className="font-medium">{jug?.nombre || t.id_jugadora}</DataCell>
              <DataCell className="font-medium">{t.test}</DataCell>
              <DataCell className="font-semibold">{t.resultado}</DataCell>
              <DataCell>{t.unidad}</DataCell>
              <DataCell className="text-surface-500 max-w-[150px] truncate">{t.notas || '—'}</DataCell>
            </DataRow>
          )
        })}
      </DataTable>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo test físico" width="max-w-md">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Fecha</label>
            <input type="date" className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Momento</label>
            <select className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.momento} onChange={(e) => setForm({ ...form, momento: e.target.value })}>
              <option value="Pretemporada">Pretemporada</option>
              <option value="Precompeticion">Precompetición</option>
              <option value="Medio_temporada">Medio temporada</option>
              <option value="Post_temporada">Post temporada</option>
              <option value="Mensual">Mensual</option>
              <option value="Semanal">Semanal</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Jugadora</label>
            <select className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.id_jugadora} onChange={(e) => setForm({ ...form, id_jugadora: e.target.value })}>
              <option value="">Seleccionar</option>
              {jugadoras.map((j) => <option key={j.id_jugadora} value={j.id_jugadora}>{j.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Test</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.test} onChange={(e) => setForm({ ...form, test: e.target.value })}
              placeholder="CMJ, Sprint, Yo-Yo..." />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Resultado</label>
            <input type="number" step="0.01" className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.resultado} onChange={(e) => setForm({ ...form, resultado: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Unidad</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })}
              placeholder="cm, s, ml/kg/min..." />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Notas</label>
            <input className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setModalOpen(false)} className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded">Cancelar</button>
          <button onClick={async () => {
            await addTest({ ...form, id_jugadora: form.id_jugadora, resultado: Number(form.resultado) })
            setModalOpen(false)
            setForm({ fecha: '', momento: 'Pretemporada', id_jugadora: '', test: '', resultado: 0, unidad: '', notas: '' })
          }} className="text-xs text-white bg-primary-600 px-3 py-1.5 rounded hover:bg-primary-700">Añadir test</button>
        </div>
      </Modal>
    </div>
  )
}
