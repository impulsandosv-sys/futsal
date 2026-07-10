import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useStore } from '@/store/store'

export function Layout({ children }: { children: ReactNode }) {
  const loading = useStore((s) => s.loading)

  return (
    <div className="flex min-h-screen bg-surface-50">
      <Sidebar />
      <div className="ml-56 flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full min-h-[60vh]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-surface-400">Cargando datos...</p>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}
