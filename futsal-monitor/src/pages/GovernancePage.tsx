import { useState, useEffect } from 'react'
import { db } from '@/db/database'
import {
  obtenerTemporadaActiva,
  crearTemporada,
  activarTemporada,
  archivarTemporada,
  validarTemporada
} from '@/domain/temporadas/temporadas'
import type { Temporada } from '@/types'
import { Modal } from '@/components/shared/Modal'

export function GovernancePage() {
  const [temporadas, setTemporadas] = useState<Temporada[]>([])
  const [temporadaActiva, setTemporadaActiva] = useState<Temporada | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Formulario de creación (NUNCA expone id_temporada ni activa al usuario)
  const [formNombre, setFormNombre] = useState('')
  const [formFechaInicio, setFormFechaInicio] = useState('')
  const [formFechaFin, setFormFechaFin] = useState('')
  const [formNotas, setFormNotas] = useState('')

  // Modales de confirmación
  const [confirmActivar, setConfirmActivar] = useState<Temporada | null>(null)
  const [confirmArchivar, setConfirmArchivar] = useState<Temporada | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const allTemp = await db.temporadas.toArray()
      setTemporadas(allTemp)
      const activeTemp = await obtenerTemporadaActiva(db)
      setTemporadaActiva(activeTemp)
    } catch {
      setErrorMsg('Error cargando las temporadas desde persistencia.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const notifyChange = () => {
    window.dispatchEvent(new Event('temporadas-updated'))
  }

  const handleCrearTemporada = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setSubmitting(true)

    try {
      const hayActiva = temporadas.some((t) => t.activa)
      const nuevaTemporada: Temporada = {
        id_temporada: crypto.randomUUID(),
        nombre: formNombre.trim(),
        fecha_inicio: formFechaInicio,
        fecha_fin: formFechaFin,
        activa: !hayActiva, // Activa por defecto solo si no existe otra activa
        notas: formNotas.trim() || undefined
      }

      const errores = validarTemporada(nuevaTemporada)
      if (errores.length > 0) {
        setErrorMsg(errores.join('. '))
        setSubmitting(false)
        return
      }

      await crearTemporada(db, nuevaTemporada)
      setSuccessMsg(`Temporada "${nuevaTemporada.nombre}" creada correctamente.`)
      setFormNombre('')
      setFormFechaInicio('')
      setFormFechaFin('')
      setFormNotas('')
      await loadData()
      notifyChange()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar la temporada en la base de datos.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmarActivar = async () => {
    if (!confirmActivar) return
    setErrorMsg('')
    setSuccessMsg('')
    setSubmitting(true)
    try {
      await activarTemporada(db, confirmActivar.id_temporada)
      setSuccessMsg(`Temporada "${confirmActivar.nombre}" activada con éxito.`)
      setConfirmActivar(null)
      await loadData()
      notifyChange()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al activar la temporada.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmarArchivar = async () => {
    if (!confirmArchivar) return
    setErrorMsg('')
    setSuccessMsg('')
    setSubmitting(true)
    try {
      await archivarTemporada(db, confirmArchivar.id_temporada)
      setSuccessMsg('Temporada archivada')
      setConfirmArchivar(null)
      await loadData()
      notifyChange()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al archivar la temporada.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-surface-800">Gobierno de Temporadas</h1>
          <p className="text-xs text-surface-500">Gestión de periodos competitivos y gobernanza operativa del equipo</p>
        </div>
      </div>

      {/* Banner de temporada activa */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-primary-900 block">Temporada Activa Operativa</span>
          {temporadaActiva ? (
            <p className="text-sm font-bold text-primary-700 mt-0.5">
              {temporadaActiva.nombre} ({temporadaActiva.fecha_inicio} a {temporadaActiva.fecha_fin})
            </p>
          ) : (
            <p className="text-xs text-amber-700 font-medium mt-0.5">Sin temporada activa</p>
          )}
        </div>
        {temporadaActiva && (
          <span className="px-2.5 py-1 text-xs font-bold bg-primary-600 text-white rounded-full">
            ACTIVA
          </span>
        )}
      </div>

      {/* Descargo literal obligatorio */}
      <div className="bg-surface-50 border border-surface-200 rounded-lg p-3 text-xs text-surface-600">
        <p className="font-semibold text-surface-700">Aviso de alcance operativo:</p>
        <p className="mt-0.5">
          La temporada activa es una referencia operativa y de gobierno. El filtrado transversal de históricos por temporada queda fuera de T-02B.
        </p>
      </div>

      {/* Alertas globales de feedback */}
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

      {/* Formulario de creación */}
      <div className="bg-white rounded-lg border border-surface-200 p-4 space-y-4">
        <h2 className="text-xs font-bold text-surface-700 uppercase tracking-wider">Crear Nueva Temporada</h2>
        <form onSubmit={handleCrearTemporada} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-medium text-surface-600 block mb-1">
                Nombre de Temporada *
                <input
                  type="text"
                  required
                  placeholder="Ej. 2026-2027"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  className="w-full border border-surface-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary-500 mt-1 font-normal"
                />
              </label>
            </div>
            <div>
              <label className="text-[10px] font-medium text-surface-600 block mb-1">
                Fecha de Inicio * (YYYY-MM-DD)
                <input
                  type="date"
                  required
                  value={formFechaInicio}
                  onChange={(e) => setFormFechaInicio(e.target.value)}
                  className="w-full border border-surface-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary-500 mt-1 font-normal"
                />
              </label>
            </div>
            <div>
              <label className="text-[10px] font-medium text-surface-600 block mb-1">
                Fecha de Fin * (YYYY-MM-DD)
                <input
                  type="date"
                  required
                  value={formFechaFin}
                  onChange={(e) => setFormFechaFin(e.target.value)}
                  className="w-full border border-surface-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary-500 mt-1 font-normal"
                />
              </label>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-surface-600 block mb-1">
              Notas (Opcionales)
              <input
                type="text"
                placeholder="Notas generales o contexto de la temporada"
                value={formNotas}
                onChange={(e) => setFormNotas(e.target.value)}
                className="w-full border border-surface-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary-500 mt-1 font-normal"
              />
            </label>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold px-4 py-2 rounded transition-colors disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Crear Temporada'}
            </button>
          </div>
        </form>
      </div>

      {/* Tabla de temporadas */}
      <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-200 bg-surface-50">
          <h2 className="text-xs font-bold text-surface-700 uppercase tracking-wider">Histórico y Estado de Temporadas</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-xs text-surface-400">Cargando temporadas...</div>
        ) : temporadas.length === 0 ? (
          <div className="p-8 text-center text-xs text-surface-400">No hay temporadas registradas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-200 text-[10px] font-bold text-surface-500 bg-surface-50 uppercase">
                  <th className="px-4 py-2.5">Nombre</th>
                  <th className="px-4 py-2.5">Fecha Inicio</th>
                  <th className="px-4 py-2.5">Fecha Fin</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5">Notas</th>
                  <th className="px-4 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-xs">
                {temporadas.map((t) => (
                  <tr key={t.id_temporada} className="hover:bg-surface-50">
                    <td className="px-4 py-3 font-semibold text-surface-800">{t.nombre}</td>
                    <td className="px-4 py-3 text-surface-600">{t.fecha_inicio}</td>
                    <td className="px-4 py-3 text-surface-600">{t.fecha_fin}</td>
                    <td className="px-4 py-3">
                      {t.activa ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-800 rounded">
                          Activa
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-surface-200 text-surface-600 rounded">
                          Inactiva
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-surface-500 max-w-xs truncate">{t.notas || '—'}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {!t.activa && (
                        <button
                          disabled={submitting}
                          onClick={() => setConfirmActivar(t)}
                          className="px-2.5 py-1 text-xs bg-primary-50 text-primary-700 border border-primary-200 rounded hover:bg-primary-100 transition-colors disabled:opacity-50"
                        >
                          Activar
                        </button>
                      )}
                      <button
                        disabled={submitting}
                        onClick={() => setConfirmArchivar(t)}
                        className="px-2.5 py-1 text-xs bg-surface-100 text-surface-700 border border-surface-200 rounded hover:bg-surface-200 transition-colors disabled:opacity-50"
                      >
                        Archivar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Confirmar Activar */}
      <Modal open={!!confirmActivar} onClose={() => setConfirmActivar(null)} title="Confirmar Activación de Temporada" width="max-w-md">
        {confirmActivar && (
          <div className="space-y-4 text-xs">
            <p className="text-surface-700">
              ¿Deseas activar la temporada <strong className="font-semibold text-surface-900">{confirmActivar.nombre}</strong> ({confirmActivar.fecha_inicio} a {confirmActivar.fecha_fin})?
            </p>
            <p className="text-surface-500 text-[11px]">
              Al activar esta temporada, cualquier otra temporada actualmente activa pasará a estar inactiva. No se alterarán datos deportivos históricos.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={submitting}
                onClick={() => setConfirmActivar(null)}
                className="px-3 py-1.5 border border-surface-200 rounded text-surface-600 hover:bg-surface-50"
              >
                Cancelar
              </button>
              <button
                disabled={submitting}
                onClick={handleConfirmarActivar}
                className="px-3 py-1.5 bg-primary-600 text-white rounded font-semibold hover:bg-primary-700"
              >
                {submitting ? 'Activando...' : 'Confirmar Activación'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Confirmar Archivar */}
      <Modal open={!!confirmArchivar} onClose={() => setConfirmArchivar(null)} title="Confirmar Archivado de Temporada" width="max-w-md">
        {confirmArchivar && (
          <div className="space-y-4 text-xs">
            <p className="text-surface-700">
              ¿Deseas archivar la temporada <strong className="font-semibold text-surface-900">{confirmArchivar.nombre}</strong>?
            </p>
            <p className="text-surface-500 text-[11px]">
              Esta acción no borrará ninguna temporada ni dato deportivo. La temporada pasará a estar inactiva en el registro.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={submitting}
                onClick={() => setConfirmArchivar(null)}
                className="px-3 py-1.5 border border-surface-200 rounded text-surface-600 hover:bg-surface-50"
              >
                Cancelar
              </button>
              <button
                disabled={submitting}
                onClick={handleConfirmarArchivar}
                className="px-3 py-1.5 bg-amber-600 text-white rounded font-semibold hover:bg-amber-700"
              >
                {submitting ? 'Archivando...' : 'Confirmar Archivado'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
