import { Component } from 'react'
import type { ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[40vh] p-8">
          <div className="text-center max-w-md">
            <div className="text-3xl mb-3">⚠</div>
            <h2 className="text-sm font-semibold text-surface-800 mb-2">Algo salió mal</h2>
            <p className="text-[10px] text-surface-500 mb-4 break-words">
              {this.state.error?.message || 'Error inesperado'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="text-xs bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
