import { NavLink } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'

const navItems = [
  { to: ROUTES.DASHBOARD, label: 'Dashboard', icon: '⊞' },
  { to: ROUTES.CALIDAD_DATOS, label: 'Calidad de Datos', icon: '✓' },
  { to: ROUTES.SEGUIMIENTO, label: 'Panel Hoy', icon: '◈' },
  { to: ROUTES.DECISION_DIARIA, label: 'Decisión diaria', icon: '⚡' },
  { to: ROUTES.JUGADORAS, label: 'Jugadoras', icon: '◉' },
  { to: ROUTES.WELLNESS, label: 'Wellness', icon: '◐' },
  { to: ROUTES.SESIONES, label: 'Sesiones', icon: '◗' },
  { to: ROUTES.PARTIDOS, label: 'Partidos', icon: '◤' },
  { to: ROUTES.CARGA_COMPETITIVA, label: 'Carga Competitiva', icon: '⚡' },
  { to: ROUTES.LESIONES, label: 'Lesiones', icon: '◕' },
  { to: ROUTES.TESTS, label: 'Tests', icon: '◖' },
  { to: ROUTES.CMJ, label: 'CMJ', icon: '⇡' },
  { to: ROUTES.FUERZA, label: 'Fuerza', icon: '🏋' },
  { to: ROUTES.PLANTILLAS_FUERZA, label: 'Plantillas Fuerza', icon: '📋' },
  { to: ROUTES.SEMANAL, label: 'Resumen Semanal', icon: '◍' },
  { to: ROUTES.ALERTAS, label: 'Alertas', icon: '◉' },
  { to: ROUTES.TEMPORADAS, label: 'Temporadas', icon: '🗓' },
  { to: ROUTES.IMPORTAR, label: 'Importar', icon: '⇧' },
]

export function Sidebar() {
  return (
    <aside className="w-56 bg-surface-900 text-white flex flex-col h-screen fixed left-0 top-0 z-40">
      <div className="px-5 py-5 border-b border-surface-700">
        <h1 className="text-sm font-bold tracking-tight text-white">Futsal Monitor</h1>
        <p className="text-[10px] text-surface-400 mt-0.5">Staff Tool v1</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white border-r-2 border-white'
                  : 'text-surface-300 hover:bg-surface-800 hover:text-white'
              }`
            }
          >
            <span className="text-sm w-4 text-center">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-3 border-t border-surface-700 text-[10px] text-surface-500">
        Uso interno · Staff técnico
      </div>
    </aside>
  )
}
