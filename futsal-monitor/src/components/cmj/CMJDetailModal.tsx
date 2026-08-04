import { Modal } from '@/components/shared/Modal'
import { useStore } from '@/store/store'

interface Props {
  medicionId: string | null
  onClose: () => void
}

export function CMJDetailModal({ medicionId, onClose }: Props) {
  const pruebas = useStore(state => state.pruebas_cmj)
  const jugadoras = useStore(state => state.jugadoras)

  const medicion = medicionId ? pruebas.find(p => p.id_medicion === medicionId) : null
  if (!medicion) return null

  const jugadora = jugadoras.find(j => j.id_jugadora === medicion.id_jugadora)
  const nombreJugadora = jugadora ? jugadora.nombre : 'Jugadora Desconocida'

  return (
    <Modal open={!!medicionId} onClose={onClose} title="Detalle de Medición CMJ" width="max-w-3xl">
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-surface-50 p-4 rounded-lg border border-surface-200">
          <div>
            <span className="block text-xs font-medium text-surface-500 mb-1">Jugadora</span>
            <span className="text-sm text-surface-900 font-medium">{nombreJugadora}</span>
          </div>
          <div>
            <span className="block text-xs font-medium text-surface-500 mb-1">Fecha</span>
            <span className="text-sm text-surface-900">{medicion.fecha}</span>
          </div>
          <div>
            <span className="block text-xs font-medium text-surface-500 mb-1">Protocolo</span>
            <span className="text-sm text-surface-900">{medicion.protocolo_nombre_historico}</span>
          </div>
          <div>
            <span className="block text-xs font-medium text-surface-500 mb-1">Finalidad</span>
            <span className="text-sm text-surface-900 capitalize">{medicion.finalidad?.replace('_', ' ') || '—'}</span>
          </div>
          <div>
            <span className="block text-xs font-medium text-surface-500 mb-1">Mejor Altura</span>
            <span className="text-sm font-bold text-primary-700">
              {medicion.altura_mejor_cm != null ? `${medicion.altura_mejor_cm} cm` : '—'}
            </span>
          </div>
          <div>
            <span className="block text-xs font-medium text-surface-500 mb-1">Mejor Vuelo</span>
            <span className="text-sm font-medium text-surface-700">
              {medicion.tiempo_vuelo_mejor_ms != null ? `${medicion.tiempo_vuelo_mejor_ms} ms` : '—'}
            </span>
          </div>
          <div>
            <span className="block text-xs font-medium text-surface-500 mb-1">Fuente</span>
            <span className="text-sm text-surface-900 capitalize">{medicion.fuente}</span>
          </div>
        </div>

        {medicion.observacion_staff && (
          <div>
            <h4 className="text-sm font-medium text-surface-800 mb-2">Observaciones</h4>
            <div className="text-sm text-surface-700 bg-surface-50 p-3 rounded-lg border border-surface-200">
              {medicion.observacion_staff}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium text-surface-800 mb-3">Intentos</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-surface-200 text-sm text-surface-500 bg-surface-50">
                  <th className="py-2 px-3 font-medium rounded-tl-lg">Orden</th>
                  <th className="py-2 px-3 font-medium">Estado</th>
                  <th className="py-2 px-3 font-medium">Altura (cm)</th>
                  <th className="py-2 px-3 font-medium">Vuelo (ms)</th>
                  <th className="py-2 px-3 font-medium rounded-tr-lg">Motivo de Anulación</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-surface-100">
                {medicion.intentos.sort((a,b) => a.orden - b.orden).map(intento => {
                  const esMejor = intento.id_intento === medicion.mejor_intento_valido_id
                  return (
                    <tr key={intento.id_intento} className={esMejor ? 'bg-primary-50' : ''}>
                      <td className="py-3 px-3 font-medium">
                        {intento.orden}
                        {esMejor && <span className="ml-2 text-xs bg-primary-100 text-primary-800 px-1.5 py-0.5 rounded">Mejor</span>}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${intento.valido ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {intento.valido ? 'Válido' : 'Inválido'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {intento.altura_cm != null ? intento.altura_cm : '—'}
                      </td>
                      <td className="py-3 px-3">
                        {intento.tiempo_vuelo_ms != null ? intento.tiempo_vuelo_ms : '—'}
                      </td>
                      <td className="py-3 px-3 text-surface-600">
                        {intento.valido ? '—' : (intento.motivo_no_valido || 'No especificado')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-surface-700 bg-surface-100 hover:bg-surface-200 rounded-md"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  )
}
