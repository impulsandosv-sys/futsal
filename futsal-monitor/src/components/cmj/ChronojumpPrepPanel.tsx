import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/db/database'
import {
  obtenerPreparacionChronojump,
  type PreparacionChronojumpResumen,
  type PreparacionChronojumpJugadora,
} from '@/domain/alias/chronojumpPrepService'

import type { FutsalDB } from '@/db/database'

interface ChronojumpPrepPanelProps {
  dbOverride?: FutsalDB
  onPrepChange?: (resumen: PreparacionChronojumpResumen) => void
}

export function ChronojumpPrepPanel({ dbOverride, onPrepChange }: ChronojumpPrepPanelProps) {
  const navigate = useNavigate()
  const [resumen, setResumen] = useState<PreparacionChronojumpResumen | null>(null)
  const [cargando, setCargando] = useState(true)
  const [mostrarListaCompleta, setMostrarListaCompleta] = useState(false)

  const cargarPreparacion = useCallback(async () => {
    setCargando(true)
    try {
      const database = dbOverride || db
      const data = await obtenerPreparacionChronojump(database)
      setResumen(data)
      if (onPrepChange) {
        onPrepChange(data)
      }
    } catch {
      // Error silencioso en fallback
    } finally {
      setCargando(false)
    }
  }, [dbOverride, onPrepChange])

  useEffect(() => {
    cargarPreparacion()
  }, [cargarPreparacion])

  if (cargando && !resumen) {
    return (
      <div className="p-4 bg-surface-50 border border-surface-200 rounded-lg text-xs text-surface-500 animate-pulse">
        Cargando preparación Chronojump...
      </div>
    )
  }

  if (!resumen || resumen.totalActivas === 0) {
    return (
      <div className="p-4 bg-surface-50 border border-surface-200 rounded-lg text-xs text-surface-500">
        No hay jugadoras activas registradas en la plantilla.
      </div>
    )
  }

  const todasListas = resumen.totalRequierenCorreccion === 0
  const jugadorasAMostrar = todasListas && !mostrarListaCompleta ? [] : resumen.jugadoras

  return (
    <div className="bg-white border border-surface-200 rounded-lg p-4 space-y-3 text-xs shadow-sm">
      {/* Header del Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-100 pb-3">
        <div>
          <h3 className="font-semibold text-sm text-surface-900 flex items-center gap-2">
            Preparación Chronojump
            {todasListas ? (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-800 rounded">
                ✓ 100% Preparado
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                {resumen.totalRequierenCorreccion} requieren atención
              </span>
            )}
          </h3>
          <p className="text-surface-500 text-[11px]">
            Comprueba los aliases antes de medir o importar una sesión grupal.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[11px] bg-surface-50 px-2.5 py-1 rounded border border-surface-200">
            <span className="text-surface-600">
              Activas: <strong className="text-surface-900">{resumen.totalActivas}</strong>
            </span>
            <span className="text-surface-300">|</span>
            <span className="text-green-700">
              Listas: <strong>{resumen.totalListas}</strong>
            </span>
            <span className="text-surface-300">|</span>
            <span className={resumen.totalRequierenCorreccion > 0 ? 'text-amber-700 font-bold' : 'text-surface-600'}>
              Corrección: <strong>{resumen.totalRequierenCorreccion}</strong>
            </span>
          </div>

          <button
            onClick={cargarPreparacion}
            title="Refrescar estado de preparación"
            className="p-1 text-surface-400 hover:text-surface-600 transition-colors"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Estado 100% Listo Compacto */}
      {todasListas && (
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md text-green-900">
          <div className="flex items-center gap-2">
            <span className="text-base">🎉</span>
            <div>
              <p className="font-semibold text-[12px]">Todas las jugadoras activas están listas para Chronojump</p>
              <p className="text-[11px] text-green-700">
                Las {resumen.totalActivas} jugadoras activas disponen de un único alias activo de origen{' '}
                <code className="bg-green-100 px-1 py-0.5 rounded font-mono">chronojump</code>.
              </p>
            </div>
          </div>
          <button
            onClick={() => setMostrarListaCompleta(!mostrarListaCompleta)}
            className="px-2.5 py-1 text-[11px] font-medium border border-green-300 text-green-800 hover:bg-green-100 rounded"
          >
            {mostrarListaCompleta ? 'Ocultar lista' : 'Ver lista completa'}
          </button>
        </div>
      )}

      {/* Listado de Jugadoras */}
      {jugadorasAMostrar.length > 0 && (
        <div className="divide-y divide-surface-100 border border-surface-200 rounded-md overflow-hidden max-h-72 overflow-y-auto">
          {jugadorasAMostrar.map((j) => (
            <div
              key={j.idJugadora}
              className={`p-2.5 flex items-center justify-between gap-3 ${
                j.estado !== 'lista' ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-surface-50'
              }`}
            >
              <div className="flex items-center gap-3">
                {renderBadgeEstado(j.estado)}
                <div>
                  <span className="font-medium text-surface-900 text-[12px]">{j.nombreVisible}</span>
                  <p className="text-[11px] text-surface-500">{j.mensaje}</p>
                </div>
              </div>

              {j.estado !== 'lista' && (
                <button
                  onClick={() => navigate(`/jugadoras/${j.idJugadora}?tab=alias`)}
                  className="px-2.5 py-1 text-[11px] font-medium bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded shrink-0 shadow-sm"
                >
                  Gestionar alias
                </button>
              )}

              {j.estado === 'lista' && (
                <span className="text-[11px] font-mono bg-surface-100 px-2 py-0.5 rounded text-surface-700">
                  {j.aliasOperativo}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function renderBadgeEstado(estado: PreparacionChronojumpJugadora['estado']) {
  switch (estado) {
    case 'lista':
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-800 rounded shrink-0">
          Lista
        </span>
      )
    case 'sin_alias':
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 rounded shrink-0">
          Sin alias
        </span>
      )
    case 'alias_inactivo':
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded shrink-0">
          Inactivo
        </span>
      )
    case 'alias_duplicado':
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-900 rounded shrink-0">
          Duplicado
        </span>
      )
  }
}
