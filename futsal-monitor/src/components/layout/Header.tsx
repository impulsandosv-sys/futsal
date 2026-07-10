import { useState, useRef } from 'react'
import { useStore } from '@/store/store'
import { useNavigate } from 'react-router-dom'
import { changePassword } from '@/utils/auth'
import { Modal } from '@/components/shared/Modal'
import { getStoredTheme, toggleTheme } from '@/constants/theme'

export function Header() {
  const { jugadoras, alertas, lesiones, logout } = useStore()
  const navigate = useNavigate()
  const [showPwd, setShowPwd] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [search, setSearch] = useState('')
  const [theme, setTheme] = useState(getStoredTheme())
  const searchRef = useRef<HTMLDivElement>(null)

  const alertasNoLeidas = alertas.filter((a) => !a.leida).length
  const lesionadasActivas = lesiones.filter((l) => !l.disponible).length

  const handleChangePassword = async () => {
    setPwdMsg('')
    if (newPwd.length < 6) { setPwdMsg('La contraseña debe tener al menos 6 caracteres'); return }
    const ok = await changePassword(oldPwd, newPwd)
    if (ok) {
      setPwdMsg('')
      setShowPwd(false)
      setOldPwd('')
      setNewPwd('')
    } else {
      setPwdMsg('Contraseña actual incorrecta')
    }
  }

  const searchResults = search.trim()
    ? jugadoras.filter((j) =>
        j.nombre.toLowerCase().includes(search.toLowerCase()) ||
        j.id_jugadora.toLowerCase().includes(search.toLowerCase()) ||
        j.posicion.toLowerCase().includes(search.toLowerCase())
      )
    : []

  return (
    <header className="h-12 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4 flex-1">
        <div ref={searchRef} className="relative w-64">
          <input
            type="text"
            placeholder="Buscar jugadora..."
            className="w-full text-xs border border-surface-200 dark:border-surface-700 rounded px-2.5 py-1.5 bg-surface-50 dark:bg-surface-800 text-surface-700 dark:text-surface-200 placeholder-surface-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
              {searchResults.length === 0 ? (
                <div className="px-3 py-2 text-xs text-surface-400">Sin resultados</div>
              ) : (
                searchResults.map((j) => (
                  <button
                    key={j.id_jugadora}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-surface-50 dark:hover:bg-surface-700 flex items-center justify-between"
                    onClick={() => { setSearch(''); navigate(`/jugadoras/${j.id_jugadora}`) }}
                  >
                    <span className="text-surface-700 dark:text-surface-200">{j.nombre}</span>
                    <span className="text-[10px] text-surface-400">{j.posicion}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {lesionadasActivas > 0 && (
          <span className="text-[10px] text-red-600 font-medium bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded">
            {lesionadasActivas} lesionada{lesionadasActivas > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => { const t = toggleTheme(); setTheme(t) }}
          className="text-xs text-surface-400 hover:text-surface-600 transition-colors"
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <button
          onClick={() => navigate('/alertas')}
          className="relative text-xs text-surface-600 dark:text-surface-300 hover:text-surface-900 transition-colors"
        >
          Alertas
          {alertasNoLeidas > 0 && (
            <span className="absolute -top-1.5 -right-3 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {alertasNoLeidas}
            </span>
          )}
        </button>
        <button
          onClick={() => setShowPwd(true)}
          className="text-xs text-surface-400 hover:text-surface-600 transition-colors"
        >
          Cambiar contraseña
        </button>
        <button
          onClick={() => { logout(); navigate('/login') }}
          className="text-xs text-surface-400 hover:text-surface-600 transition-colors"
        >
          Salir
        </button>
      </div>

      <Modal open={showPwd} onClose={() => setShowPwd(false)} title="Cambiar contraseña" width="max-w-sm">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Contraseña actual</label>
            <input
              type="password"
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Nueva contraseña</label>
            <input
              type="password"
              className="w-full border border-surface-200 rounded px-2 py-1.5 text-xs"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
            />
          </div>
          {pwdMsg && <p className="text-xs text-red-600">{pwdMsg}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowPwd(false)} className="text-xs text-surface-600 px-3 py-1.5 border border-surface-200 rounded">
              Cancelar
            </button>
            <button onClick={handleChangePassword} className="text-xs text-white bg-primary-600 px-3 py-1.5 rounded hover:bg-primary-700">
              Guardar
            </button>
          </div>
        </div>
      </Modal>
    </header>
  )
}
