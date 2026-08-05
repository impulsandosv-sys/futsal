import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '@/store/store'
import { StrengthFormModal } from '@/components/fuerza/StrengthFormModal'
import { StrengthDetailModal } from '@/components/fuerza/StrengthDetailModal'
import { ExerciseManagerModal } from '@/components/fuerza/ExerciseManagerModal'
import { calcularResumenSesionFuerza } from '@/domain/neuromuscular/fuerzaEngine'
import type { FinalidadSesionFuerza, SesionFuerzaIndividual } from '@/types'

const FINALIDADES: { value: FinalidadSesionFuerza; label: string }[] = [
  { value: 'fuerza_maxima', label: 'Fuerza Máxima' },
  { value: 'hipertrofia', label: 'Hipertrofia' },
  { value: 'potencia', label: 'Potencia' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'prevencion', label: 'Prevención' },
  { value: 'readaptacion', label: 'Readaptación' },
  { value: 'otro', label: 'Otro' },
]

export function StrengthPage() {
  const sesiones = useStore((s) => s.sesiones_fuerza_individual)
  const trabajos = useStore((s) => s.trabajos_fuerza)
  const jugadoras = useStore((s) => s.jugadoras)
  const ejercicios = useStore((s) => s.ejercicios_fuerza)

  const [searchParams, setSearchParams] = useSearchParams()
  const jugadoraParam = searchParams.get('jugadora') || ''
  const jugadoraValida = useMemo(
    () => jugadoras.some((j) => j.id_jugadora === jugadoraParam),
    [jugadoras, jugadoraParam]
  )

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [exerciseManagerOpen, setExerciseManagerOpen] = useState(false)

  const [filters, setFilters] = useState({
    id_jugadora: jugadoraValida ? jugadoraParam : '',
    fecha_desde: '',
    fecha_hasta: '',
    id_ejercicio: '',
    finalidad: '',
  })

  useEffect(() => {
    setFilters((prev) => ({ ...prev, id_jugadora: jugadoraValida ? jugadoraParam : '' }))
  }, [jugadoraParam, jugadoraValida])

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const handleNew = () => {
    setEditingId(null)
    setFormOpen(true)
  }

  const handleEdit = (id: string) => {
    setEditingId(id)
    setFormOpen(true)
  }

  const handleView = (id: string) => {
    setDetailId(id)
  }

  const resetFilters = () => {
    setFilters({
      id_jugadora: '',
      fecha_desde: '',
      fecha_hasta: '',
      id_ejercicio: '',
      finalidad: '',
    })
    if (searchParams.has('jugadora')) {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('jugadora')
      setSearchParams(newParams)
    }
    setCurrentPage(1)
  }

  // Filtrado puro
  const filtered = useMemo(() => {
    return sesiones
      .filter((s) => {
        if (filters.id_jugadora && s.id_jugadora !== filters.id_jugadora) return false
        if (filters.fecha_desde && s.fecha < filters.fecha_desde) return false
        if (filters.fecha_hasta && s.fecha > filters.fecha_hasta) return false
        if (filters.finalidad && s.finalidad !== filters.finalidad) return false

        // Filtro por ejercicio si está especificado
        if (filters.id_ejercicio) {
          const tieneEjercicio = trabajos.some(
            (t) =>
              (t.id_sesion_fuerza === s.id_sesion_fuerza || t.id_sesion === s.id_sesion_fuerza) &&
              t.id_ejercicio === filters.id_ejercicio
          )
          if (!tieneEjercicio) return false
        }

        return true
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.createdAt.localeCompare(a.createdAt))
  }, [sesiones, trabajos, filters])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Cálculo descriptivo por fila de sesión
  const getSessionRowSummary = (sesion: SesionFuerzaIndividual) => {
    const sessionTrabajos = trabajos.filter(
      (t) => t.id_sesion_fuerza === sesion.id_sesion_fuerza || t.id_sesion === sesion.id_sesion_fuerza
    )
    return calcularResumenSesionFuerza(sessionTrabajos)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Entrenamiento de Fuerza</h1>
          <p className="text-surface-500 mt-1">Registro descriptivo y trazabilidad de sesiones individuales</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setExerciseManagerOpen(true)}
            className="px-4 py-2 text-sm font-medium text-surface-700 bg-surface-100 hover:bg-surface-200 border border-surface-200 rounded-md shadow-sm"
          >
            Gestión de Ejercicios
          </button>
          <button
            onClick={handleNew}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm"
          >
            + Registrar Sesión de Fuerza
          </button>
        </div>
      </div>

      {/* Filtros Puros */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 bg-white p-4 rounded-lg shadow-sm border border-surface-200">
        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Jugadora</label>
          <select
            className="w-full rounded border-surface-300 text-xs p-1.5"
            value={filters.id_jugadora}
            onChange={(e) => {
              setFilters({ ...filters, id_jugadora: e.target.value })
              setCurrentPage(1)
            }}
          >
            <option value="">Todas</option>
            {jugadoras.map((j) => (
              <option key={j.id_jugadora} value={j.id_jugadora}>
                {j.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Desde</label>
          <input
            type="date"
            className="w-full rounded border-surface-300 text-xs p-1.5"
            value={filters.fecha_desde}
            onChange={(e) => {
              setFilters({ ...filters, fecha_desde: e.target.value })
              setCurrentPage(1)
            }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Hasta</label>
          <input
            type="date"
            className="w-full rounded border-surface-300 text-xs p-1.5"
            value={filters.fecha_hasta}
            onChange={(e) => {
              setFilters({ ...filters, fecha_hasta: e.target.value })
              setCurrentPage(1)
            }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Ejercicio</label>
          <select
            className="w-full rounded border-surface-300 text-xs p-1.5"
            value={filters.id_ejercicio}
            onChange={(e) => {
              setFilters({ ...filters, id_ejercicio: e.target.value })
              setCurrentPage(1)
            }}
          >
            <option value="">Todos</option>
            {ejercicios.map((ex) => (
              <option key={ex.id_ejercicio} value={ex.id_ejercicio}>
                {ex.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Finalidad</label>
          <select
            className="w-full rounded border-surface-300 text-xs p-1.5"
            value={filters.finalidad}
            onChange={(e) => {
              setFilters({ ...filters, finalidad: e.target.value })
              setCurrentPage(1)
            }}
          >
            <option value="">Todas</option>
            {FINALIDADES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={resetFilters}
            className="w-full py-1.5 text-xs text-surface-600 bg-surface-100 hover:bg-surface-200 rounded border border-surface-200"
          >
            Restablecer Filtros
          </button>
        </div>
      </div>

      {/* Tabla Cronológica Descendente */}
      <div className="bg-white rounded-lg shadow-sm border border-surface-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-sm text-surface-500 font-medium mb-3">
              Aún no hay sesiones de fuerza registradas
            </p>
            <button
              onClick={handleNew}
              className="px-4 py-2 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm"
            >
              Registrar sesión de fuerza
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-50 text-surface-500 border-b border-surface-200">
                  <tr>
                    <th className="py-3 px-4 font-medium">Fecha</th>
                    <th className="py-3 px-4 font-medium">Jugadora</th>
                    <th className="py-3 px-4 font-medium">Finalidad</th>
                    <th className="py-3 px-4 font-medium">Ejercicios</th>
                    <th className="py-3 px-4 font-medium">Series</th>
                    <th className="py-3 px-4 font-medium">Tonelaje Total</th>
                    <th className="py-3 px-4 font-medium">sRPE</th>
                    <th className="py-3 px-4 font-medium">Duración</th>
                    <th className="py-3 px-4 font-medium">Observación</th>
                    <th className="py-3 px-4 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {paginated.map((sesion) => {
                    const jugadora = jugadoras.find((j) => j.id_jugadora === sesion.id_jugadora)
                    const summary = getSessionRowSummary(sesion)
                    const finalidadLabel = sesion.finalidad
                      ? FINALIDADES.find((f) => f.value === sesion.finalidad)?.label || sesion.finalidad
                      : '—'

                    return (
                      <tr key={sesion.id_sesion_fuerza} className="hover:bg-surface-50/50">
                        <td className="py-3 px-4 font-semibold text-surface-900">{sesion.fecha}</td>
                        <td className="py-3 px-4 font-medium text-surface-800">
                          {jugadora ? jugadora.nombre : sesion.id_jugadora}
                        </td>
                        <td className="py-3 px-4 text-surface-600">{finalidadLabel}</td>
                        <td className="py-3 px-4 text-surface-700">{summary.ejerciciosCount}</td>
                        <td className="py-3 px-4 text-surface-700">{summary.seriesCount}</td>
                        <td className="py-3 px-4 font-medium text-primary-700">{summary.tonelajeLabel}</td>
                        <td className="py-3 px-4 text-surface-700">
                          {sesion.rpe_sesion != null ? `${sesion.rpe_sesion}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-surface-700">
                          {sesion.duracion_min != null ? `${sesion.duracion_min} min` : '—'}
                        </td>
                        <td className="py-3 px-4 text-surface-500 max-w-xs truncate">
                          {sesion.observacion_staff || '—'}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleView(sesion.id_sesion_fuerza)}
                            className="text-primary-600 hover:text-primary-800 font-medium"
                          >
                            Ver detalle
                          </button>
                          <button
                            onClick={() => handleEdit(sesion.id_sesion_fuerza)}
                            className="text-surface-600 hover:text-surface-900 font-medium"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center p-3 border-t border-surface-200 text-xs">
                <span className="text-surface-500">
                  Página {currentPage} de {totalPages} ({filtered.length} registros)
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 text-surface-600 bg-surface-100 rounded disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 text-surface-600 bg-surface-100 rounded disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modales */}
      <StrengthFormModal open={formOpen} onClose={() => setFormOpen(false)} editingId={editingId} />
      <StrengthDetailModal open={!!detailId} onClose={() => setDetailId(null)} sesionId={detailId} onEdit={handleEdit} />
      <ExerciseManagerModal open={exerciseManagerOpen} onClose={() => setExerciseManagerOpen(false)} />
    </div>
  )
}
