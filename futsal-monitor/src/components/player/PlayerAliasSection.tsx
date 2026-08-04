import { useState, useEffect, useCallback } from 'react'
import { db } from '@/db/database'
import { agregarAliasJugadora, desactivarAliasJugadora } from '@/domain/alias/aliasJugadora'
import type { AliasJugadora } from '@/types'
import { Modal } from '@/components/shared/Modal'

interface PlayerAliasSectionProps {
  id_jugadora: string
  nombreJugadora: string
}

export function PlayerAliasSection({ id_jugadora, nombreJugadora }: PlayerAliasSectionProps) {
  const [aliases, setAliases] = useState<AliasJugadora[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const hoyLocal = new Date().toISOString().split('T')[0]

  // Formulario de alta (NUNCA expone id_jugadora, id_alias ni activo)
  const [formOrigen, setFormOrigen] = useState<'google_forms' | 'chronojump' | 'manual' | 'otro'>('google_forms')
  const [formValor, setFormValor] = useState('')
  const [formFechaAlta, setFormFechaAlta] = useState(hoyLocal)
  const [formNotas, setFormNotas] = useState('')

  // Modal de desactivación
  const [deactivatingAlias, setDeactivatingAlias] = useState<AliasJugadora | null>(null)
  const [fechaBaja, setFechaBaja] = useState(hoyLocal)

  const loadAliases = useCallback(async () => {
    setLoading(true)
    try {
      const list = await db.alias_jugadora.where('id_jugadora').equals(id_jugadora).toArray()
      setAliases(list)
    } catch {
      setErrorMsg('Error cargando los alias de la jugadora.')
    } finally {
      setLoading(false)
    }
  }, [id_jugadora])

  useEffect(() => {
    if (id_jugadora) {
      loadAliases()
    }
  }, [id_jugadora, loadAliases])

  const handleCrearAlias = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!formValor.trim()) {
      setErrorMsg('El valor del alias es obligatorio.')
      return
    }

    setSubmitting(true)
    try {
      await agregarAliasJugadora(db, {
        id_jugadora,
        origen: formOrigen,
        valor: formValor.trim(),
        activo: true,
        fecha_alta: formFechaAlta || hoyLocal,
        notas: formNotas.trim() || undefined
      })

      setSuccessMsg(`Alias "${formValor.trim()}" (${formOrigen}) añadido con éxito.`)
      setFormValor('')
      setFormNotas('')
      await loadAliases()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar el alias.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmarDesactivar = async () => {
    if (!deactivatingAlias || !deactivatingAlias.id_alias) return
    setErrorMsg('')
    setSuccessMsg('')
    setSubmitting(true)

    try {
      await desactivarAliasJugadora(db, deactivatingAlias.id_alias, fechaBaja || hoyLocal)
      setSuccessMsg(`Alias "${deactivatingAlias.valor}" desactivado correctamente.`)
      setDeactivatingAlias(null)
      await loadAliases()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al desactivar el alias.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold text-surface-700 uppercase tracking-wider">Alias Externos e Identificadores</h2>
          <p className="text-[10px] text-surface-500 mt-0.5">
            Identidad vinculada a {nombreJugadora} (`id_jugadora`: <code className="font-semibold">{id_jugadora}</code>)
          </p>
        </div>
      </div>

      {/* Feedback messages */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg p-3">
          {successMsg}
        </div>
      )}

      {/* Formulario de alta */}
      <div className="bg-white rounded-lg border border-surface-200 p-4 space-y-3">
        <h3 className="text-xs font-bold text-surface-700 uppercase tracking-wider">Vincular Nuevo Alias Externo</h3>
        <form onSubmit={handleCrearAlias} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-medium text-surface-600 block mb-1">Origen del Alias *</label>
              <select
                value={formOrigen}
                onChange={(e) => setFormOrigen(e.target.value as any)}
                className="w-full border border-surface-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary-500 bg-white"
              >
                <option value="google_forms">Google Forms</option>
                <option value="chronojump">Chronojump</option>
                <option value="manual">Manual</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-surface-600 block mb-1">Valor / Identificador Externo *</label>
              <input
                type="text"
                required
                placeholder="Ej. GF-001 o ID-Chronojump"
                value={formValor}
                onChange={(e) => setFormValor(e.target.value)}
                className="w-full border border-surface-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-surface-600 block mb-1">Fecha de Alta * (YYYY-MM-DD)</label>
              <input
                type="date"
                required
                value={formFechaAlta}
                onChange={(e) => setFormFechaAlta(e.target.value)}
                className="w-full border border-surface-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">Notas (Opcionales)</label>
            <input
              type="text"
              placeholder="Notas u observaciones del alias"
              value={formNotas}
              onChange={(e) => setFormNotas(e.target.value)}
              className="w-full border border-surface-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary-500"
            />
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold px-4 py-2 rounded transition-colors disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Añadir Alias'}
            </button>
          </div>
        </form>
      </div>

      {/* Tabla de alias */}
      <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-200 bg-surface-50">
          <h3 className="text-xs font-bold text-surface-700 uppercase tracking-wider">Histórico de Alias Registrados</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-xs text-surface-400">Cargando alias...</div>
        ) : aliases.length === 0 ? (
          <div className="p-8 text-center text-xs text-surface-400">No hay alias vinculados a esta jugadora.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-200 text-[10px] font-bold text-surface-500 bg-surface-50 uppercase">
                  <th className="px-4 py-2.5">Origen</th>
                  <th className="px-4 py-2.5">Valor</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5">Fecha Alta</th>
                  <th className="px-4 py-2.5">Fecha Baja</th>
                  <th className="px-4 py-2.5">Notas</th>
                  <th className="px-4 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-xs">
                {aliases.map((a) => (
                  <tr key={a.id_alias || `${a.origen}-${a.valor}`} className="hover:bg-surface-50">
                    <td className="px-4 py-3 font-semibold text-surface-800">{a.origen}</td>
                    <td className="px-4 py-3 font-mono text-surface-700">{a.valor}</td>
                    <td className="px-4 py-3">
                      {a.activo ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-800 rounded">
                          Activo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-surface-200 text-surface-600 rounded">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-surface-600">{a.fecha_alta}</td>
                    <td className="px-4 py-3 text-surface-600">{a.fecha_baja || '—'}</td>
                    <td className="px-4 py-3 text-surface-500 max-w-xs truncate">{a.notas || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {a.activo && (
                        <button
                          disabled={submitting}
                          onClick={() => {
                            setDeactivatingAlias(a)
                            setFechaBaja(hoyLocal)
                          }}
                          className="px-2.5 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          Desactivar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Desactivar Alias */}
      <Modal open={!!deactivatingAlias} onClose={() => setDeactivatingAlias(null)} title="Desactivar Alias Externo" width="max-w-md">
        {deactivatingAlias && (
          <div className="space-y-4 text-xs">
            <p className="text-surface-700">
              ¿Deseas desactivar el alias <strong className="font-mono text-surface-900">{deactivatingAlias.valor}</strong> ({deactivatingAlias.origen})?
            </p>
            <div>
              <label className="text-[10px] font-medium text-surface-600 block mb-1">Fecha de Baja * (YYYY-MM-DD)</label>
              <input
                type="date"
                required
                value={fechaBaja}
                onChange={(e) => setFechaBaja(e.target.value)}
                className="w-full border border-surface-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary-500"
              />
            </div>
            <p className="text-surface-500 text-[11px]">
              El alias no se borrará físicamente. Permanecerá inactivo en el registro de trazabilidad histórica.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={submitting}
                onClick={() => setDeactivatingAlias(null)}
                className="px-3 py-1.5 border border-surface-200 rounded text-surface-600 hover:bg-surface-50"
              >
                Cancelar
              </button>
              <button
                disabled={submitting}
                onClick={handleConfirmarDesactivar}
                className="px-3 py-1.5 bg-red-600 text-white rounded font-semibold hover:bg-red-700"
              >
                {submitting ? 'Desactivando...' : 'Confirmar Desactivación'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
