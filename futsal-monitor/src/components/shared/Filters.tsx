import { useStore } from '@/store/store'

interface FiltersProps {
  showPlayer?: boolean
  showDate?: boolean
  showWeek?: boolean
  showSessionType?: boolean
  showStatus?: boolean
}

export function Filters({
  showPlayer = true,
  showDate = true,
  showWeek = false,
  showSessionType = false,
  showStatus = false,
}: FiltersProps) {
  const { jugadoras, filters, setFilter, resetFilters } = useStore()

  const players = jugadoras.filter((j) => j.activa)

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-white rounded-lg border border-surface-200">
      {showPlayer && (
        <select
          className="text-xs border border-surface-200 rounded px-2 py-1.5 bg-white text-surface-700"
          value={filters.id_jugadora}
          onChange={(e) => setFilter('id_jugadora', e.target.value)}
        >
          <option value="">Todas las jugadoras</option>
          {players.map((j) => (
            <option key={j.id_jugadora} value={j.id_jugadora}>
              {j.nombre}
            </option>
          ))}
        </select>
      )}
      {showDate && (
        <>
          <input
            type="date"
            className="text-xs border border-surface-200 rounded px-2 py-1.5 bg-white text-surface-700"
            value={filters.fecha_desde}
            onChange={(e) => setFilter('fecha_desde', e.target.value)}
            placeholder="Desde"
          />
          <input
            type="date"
            className="text-xs border border-surface-200 rounded px-2 py-1.5 bg-white text-surface-700"
            value={filters.fecha_hasta}
            onChange={(e) => setFilter('fecha_hasta', e.target.value)}
            placeholder="Hasta"
          />
        </>
      )}
      {showWeek && (
        <input
          type="week"
          className="text-xs border border-surface-200 rounded px-2 py-1.5 bg-white text-surface-700"
          value={filters.semana}
          onChange={(e) => setFilter('semana', e.target.value)}
        />
      )}
      {showSessionType && (
        <select
          className="text-xs border border-surface-200 rounded px-2 py-1.5 bg-white text-surface-700"
          value={filters.tipo_sesion}
          onChange={(e) => setFilter('tipo_sesion', e.target.value)}
        >
          <option value="">Todas las sesiones</option>
          <option value="Fisico">Físico</option>
          <option value="Tecnico">Técnico</option>
          <option value="Tactico">Táctico</option>
          <option value="Partido">Partido</option>
          <option value="Recuperacion">Recuperación</option>
          <option value="Preventivo">Preventivo</option>
          <option value="Gimnasio">Gimnasio</option>
        </select>
      )}
      {showStatus && (
        <select
          className="text-xs border border-surface-200 rounded px-2 py-1.5 bg-white text-surface-700"
          value={filters.estado}
          onChange={(e) => setFilter('estado', e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="Disponible">Disponible</option>
          <option value="Lesionada">Lesionada</option>
          <option value="Readaptacion">Readaptación</option>
          <option value="Carga_Gestionada">Carga Gestionada</option>
          <option value="Descanso">Descanso</option>
        </select>
      )}
      <button
        onClick={resetFilters}
        className="text-xs text-surface-500 hover:text-surface-700 px-2 py-1.5"
      >
        Limpiar filtros
      </button>
    </div>
  )
}
