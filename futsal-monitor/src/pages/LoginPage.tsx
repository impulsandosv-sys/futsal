import { useState } from 'react'
import { useStore } from '@/store/store'

export function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useStore((s) => s.login)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const ok = await login(password)
      if (ok) {
        window.location.href = '/'
      } else {
        setError('Contraseña incorrecta')
      }
    } catch {
      setError('Error al verificar credenciales')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="bg-white rounded-lg border border-surface-200 shadow-sm p-8 w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-surface-800">Futsal Monitor</h1>
          <p className="text-xs text-surface-500 mt-1">Panel del preparador físico</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-surface-700 block mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              className="w-full border border-surface-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
              autoFocus
              disabled={loading}
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-primary-600 text-white text-sm font-medium py-2 rounded hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verificando...' : 'Acceder'}
          </button>
        </form>
        <p className="text-[10px] text-surface-400 mt-4 text-center">Acceso restringido al staff técnico</p>
      </div>
    </div>
  )
}
