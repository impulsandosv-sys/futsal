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

  const players = jugadoras.filter((j) => j.activa !== false)

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
      {showPlayer && (
        <select
          aria-label="Seleccionar jugadora"
          className="text-xs border border-surface-300 dark:border-surface-700 rounded px-2.5 py-1.5 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-50 font-medium focus:ring-2 focus:ring-primary-500/20"
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
            aria-label="Fecha desde"
            className="text-xs border border-surface-300 dark:border-surface-700 rounded px-2.5 py-1.5 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-50 font-medium placeholder-surface-500"
            value={filters.fecha_desde}
            onChange={(e) => setFilter('fecha_desde', e.target.value)}
            placeholder="Desde"
          />
          <input
            type="date"
            aria-label="Fecha hasta"
            className="text-xs border border-surface-300 dark:border-surface-700 rounded px-2.5 py-1.5 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-50 font-medium placeholder-surface-500"
            value={filters.fecha_hasta}
            onChange={(e) => setFilter('fecha_hasta', e.target.value)}
            placeholder="Hasta"
          />
        </>
      )}
      {showWeek && (
        <input
          type="week"
          aria-label="Semana"
          className="text-xs border border-surface-300 dark:border-surface-700 rounded px-2.5 py-1.5 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-50 font-medium"
          value={filters.semana}
          onChange={(e) => setFilter('semana', e.target.value)}
        />
      )}
      {showSessionType && (
        <select
          aria-label="Tipo de sesión"
          className="text-xs border border-surface-300 dark:border-surface-700 rounded px-2.5 py-1.5 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-50 font-medium"
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
          aria-label="Estado"
          className="text-xs border border-surface-300 dark:border-surface-700 rounded px-2.5 py-1.5 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-50 font-medium"
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
        className="text-xs text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 font-medium px-2.5 py-1.5"
      >
        Limpiar filtros
      </button>
    </div>
  )
}
