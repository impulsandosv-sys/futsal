import { useStore } from '@/store/store'
import { Modal } from '@/components/shared/Modal'
import { calcularVolumenTrabajoFuerza, calcularResumenSesionFuerza } from '@/domain/neuromuscular/fuerzaEngine'
import type { FinalidadSesionFuerza } from '@/types'

const FINALIDADES_MAP: Record<FinalidadSesionFuerza, string> = {
  fuerza_maxima: 'Fuerza Máxima',
  hipertrofia: 'Hipertrofia',
  potencia: 'Potencia',
  mantenimiento: 'Mantenimiento',
  prevencion: 'Prevención',
  readaptacion: 'Readaptación',
  otro: 'Otro',
}

interface StrengthDetailModalProps {
  open: boolean
  onClose: () => void
  sesionId: string | null
  onEdit?: (sesionId: string) => void
  readOnly?: boolean
}

export function StrengthDetailModal({ open, onClose, sesionId, onEdit, readOnly }: StrengthDetailModalProps) {
  const sesiones = useStore((s) => s.sesiones_fuerza_individual)
  const trabajosStore = useStore((s) => s.trabajos_fuerza)
  const jugadoras = useStore((s) => s.jugadoras)

  if (!sesionId) return null

  const sesion = sesiones.find((s) => s.id_sesion_fuerza === sesionId)
  if (!sesion) return null

  const jugadora = jugadoras.find((j) => j.id_jugadora === sesion.id_jugadora)
  const trabajos = trabajosStore.filter(
    (t) => t.id_sesion_fuerza === sesion.id_sesion_fuerza || t.id_sesion === sesion.id_sesion_fuerza
  )

  const summary = calcularResumenSesionFuerza(trabajos)
  const tonelajeTexto = summary.tonelajeLabel
  const finalidadTexto = sesion.finalidad ? FINALIDADES_MAP[sesion.finalidad] || sesion.finalidad : '—'

  return (
    <Modal open={open} onClose={onClose} title="Detalle de Sesión de Fuerza">
      <div className="space-y-6">
        {/* Cabecera resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-50 p-3 rounded-md border border-surface-200 text-xs">
          <div>
            <span className="text-[10px] text-surface-400 font-medium block">Jugadora</span>
            <span className="font-bold text-surface-900">{jugadora ? jugadora.nombre : sesion.id_jugadora}</span>
          </div>
          <div>
            <span className="text-[10px] text-surface-400 font-medium block">Fecha</span>
            <span className="font-semibold text-surface-800">{sesion.fecha}</span>
          </div>
          <div>
            <span className="text-[10px] text-surface-400 font-medium block">Finalidad</span>
            <span className="font-medium text-surface-800">{finalidadTexto}</span>
          </div>
          <div>
            <span className="text-[10px] text-surface-400 font-medium block">Tonelaje Total</span>
            <span className="font-semibold text-primary-700">{tonelajeTexto}</span>
          </div>
        </div>

        {/* Detalles secundarios */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-surface-500 font-medium">sRPE Sesión:</span>{' '}
            <span className="font-semibold text-surface-800">
              {sesion.rpe_sesion != null ? `${sesion.rpe_sesion} / 10` : '—'}
            </span>
          </div>
          <div>
            <span className="text-surface-500 font-medium">Duración:</span>{' '}
            <span className="font-semibold text-surface-800">
              {sesion.duracion_min != null ? `${sesion.duracion_min} min` : '—'}
            </span>
          </div>
          <div>
            <span className="text-surface-500 font-medium">Ejercicios:</span>{' '}
            <span className="font-semibold text-surface-800">{trabajos.length}</span>
          </div>
        </div>

        {sesion.observacion_staff && (
          <div className="text-xs bg-amber-50/50 p-2.5 rounded border border-amber-200/60">
            <span className="font-semibold text-amber-900 block mb-0.5">Observación del Staff:</span>
            <p className="text-amber-800">{sesion.observacion_staff}</p>
          </div>
        )}

        {/* Trabajos / Ejercicios */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-surface-900 border-b border-surface-200 pb-1">
            Ejercicios Registrados
          </h4>

          {trabajos.length === 0 ? (
            <p className="text-xs text-surface-400 italic">No hay ejercicios registrados en esta sesión.</p>
          ) : (
            trabajos.map((trabajo, index) => {
              const volTrabajo = calcularVolumenTrabajoFuerza(trabajo)
              return (
                <div key={trabajo.id_trabajo || index} className="bg-white rounded border border-surface-200 p-3 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-surface-800">
                      {index + 1}. {trabajo.ejercicio_nombre_historico}
                    </span>
                    <span className="text-[11px] text-surface-500">
                      Volumen:{' '}
                      <strong className="text-surface-800">
                        {volTrabajo != null ? `${volTrabajo.toLocaleString()} kg` : '—'}
                      </strong>
                    </span>
                  </div>

                  {trabajo.observacion_staff && (
                    <p className="text-[11px] text-surface-500 italic">
                      Nota: {trabajo.observacion_staff}
                    </p>
                  )}

                  {/* Tabla de Series */}
                  {trabajo.realizado && trabajo.realizado.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-surface-50 text-surface-500 border-b border-surface-200">
                            <th className="py-1 px-2 font-medium">Serie</th>
                            <th className="py-1 px-2 font-medium">Repeticiones</th>
                            <th className="py-1 px-2 font-medium">Carga (kg)</th>
                            <th className="py-1 px-2 font-medium">RPE Serie</th>
                            <th className="py-1 px-2 font-medium">Tonelaje</th>
                            <th className="py-1 px-2 font-medium">Observación</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                          {trabajo.realizado.map((serie) => {
                            const tonSerie =
                              serie.repeticiones != null && serie.carga_kg != null
                                ? serie.repeticiones * serie.carga_kg
                                : null
                            return (
                              <tr key={serie.id_serie || serie.orden}>
                                <td className="py-1 px-2 font-medium text-surface-700">#{serie.orden}</td>
                                <td className="py-1 px-2 text-surface-900">
                                  {serie.repeticiones != null ? serie.repeticiones : '—'}
                                </td>
                                <td className="py-1 px-2 text-surface-900">
                                  {serie.carga_kg != null ? `${serie.carga_kg} kg` : '—'}
                                </td>
                                <td className="py-1 px-2 text-surface-700">
                                  {serie.rpe_serie != null ? serie.rpe_serie : '—'}
                                </td>
                                <td className="py-1 px-2 font-medium text-primary-700">
                                  {tonSerie != null ? `${tonSerie} kg` : '—'}
                                </td>
                                <td className="py-1 px-2 text-surface-500">{serie.observacion || '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-[11px] text-surface-400 italic py-1">Sin series especificadas.</p>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Pie y acciones */}
        <div className="flex justify-end gap-2 pt-2 border-t border-surface-200">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-surface-700 bg-surface-100 hover:bg-surface-200 rounded"
          >
            Cerrar
          </button>
          {!readOnly && onEdit && (
            <button
              onClick={() => {
                onClose()
                onEdit(sesion.id_sesion_fuerza)
              }}
              className="px-4 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded shadow-sm"
            >
              Editar Sesión
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
