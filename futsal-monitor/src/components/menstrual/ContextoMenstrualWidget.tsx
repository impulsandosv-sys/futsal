import { useStore } from '@/store/store'
import { getTodayLocalISO } from '@/domain/dates/dates'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DecisionMenstrualModal } from './DecisionMenstrualModal'

export function ContextoMenstrualWidget() {
  const { jugadoras, registros_menstruales, alertas } = useStore()
  const hoyStr = useMemo(() => getTodayLocalISO(), [])

  const iniciosHoy = useMemo(() => {
    return registros_menstruales
      .filter(r => r.fecha_inicio === hoyStr)
      .map(r => {
        const j = jugadoras.find(x => x.id_jugadora === r.id_jugadora)
        return { registro: r, jugadora: j }
      })
      .filter(x => x.jugadora)
  }, [registros_menstruales, jugadoras, hoyStr])

  const alertasActivas = useMemo(() => {
    return alertas
      .filter(a => a.tipo === 'MENSTRUACION_PROXIMA_ESTIMADA' && a.estado === 'abierta')
      .map(a => {
        const j = jugadoras.find(x => x.id_jugadora === a.id_jugadora)
        const ultimoRegistro = registros_menstruales
          .filter(r => r.id_jugadora === a.id_jugadora)
          .sort((x, y) => y.fecha_inicio.localeCompare(x.fecha_inicio))[0]

        return { alerta: a, jugadora: j, ultimoRegistro }
      })
      .filter(x => x.jugadora && x.ultimoRegistro)
  }, [alertas, jugadoras, registros_menstruales])

  const [modalOpen, setModalOpen] = useState(false)
  const [modalData, setModalData] = useState<{ id: number; name: string } | null>(null)

  const openModal = (id: number, name: string) => {
    setModalData({ id, name })
    setModalOpen(true)
  }

  if (iniciosHoy.length === 0 && alertasActivas.length === 0) {
    return (
      <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm">
        <h3 className="text-xs font-semibold text-surface-800 mb-2">Contexto menstrual del día</h3>
        <p className="text-xs text-surface-500 text-center py-4">No hay contexto menstrual operativo para hoy.</p>
      </div>
    )
  }

  return (
    <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm space-y-4">
      <h3 className="text-xs font-semibold text-surface-800 border-b border-surface-100 pb-2">Contexto menstrual del día</h3>

      {iniciosHoy.length > 0 && (
        <div>
          <h4 className="text-[10px] uppercase font-bold text-surface-500 mb-2 tracking-wider">Inicios comunicados hoy</h4>
          <div className="space-y-2">
            {iniciosHoy.map(({ registro, jugadora }) => (
              <div key={registro.id} className="flex items-center justify-between p-2 bg-surface-50 rounded-lg border border-surface-100">
                <div className="flex flex-col">
                  <Link to={`/jugadoras/${jugadora!.id_jugadora}`} className="text-xs font-medium text-primary-700 hover:underline">
                    {jugadora!.nombre}
                  </Link>
                  <span className="text-[10px] text-surface-500">Impacto percibido: {registro.impacto_percibido}/10</span>
                  {registro.accion_ajuste && (
                    <span className="text-[10px] font-medium text-surface-600 bg-surface-200 px-1.5 py-0.5 rounded w-fit mt-1">Decisión registrada</span>
                  )}
                </div>
                <button
                  onClick={() => openModal(registro.id!, jugadora!.nombre)}
                  className="px-2 py-1 bg-white border border-surface-300 text-surface-700 text-[10px] font-medium rounded hover:bg-surface-100 transition-colors"
                >
                  Registrar decisión
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {alertasActivas.length > 0 && (
        <div>
          <h4 className="text-[10px] uppercase font-bold text-surface-500 mb-2 tracking-wider">Recordatorios estimados activos</h4>
          <div className="space-y-2">
            {alertasActivas.map(({ alerta, jugadora, ultimoRegistro }) => (
              <div key={alerta.id} className="flex items-center justify-between p-2 bg-surface-50 rounded-lg border border-surface-100">
                <div className="flex flex-col">
                  <Link to={`/jugadoras/${jugadora!.id_jugadora}`} className="text-xs font-medium text-primary-700 hover:underline">
                    {jugadora!.nombre}
                  </Link>
                  <span className="text-[10px] text-surface-500">Ventana estimada activa ({alerta.fecha})</span>
                  {ultimoRegistro!.accion_ajuste && (
                    <span className="text-[10px] font-medium text-surface-600 bg-surface-200 px-1.5 py-0.5 rounded w-fit mt-1">Decisión registrada</span>
                  )}
                </div>
                <button
                  onClick={() => openModal(ultimoRegistro!.id!, jugadora!.nombre)}
                  className="px-2 py-1 bg-white border border-surface-300 text-surface-700 text-[10px] font-medium rounded hover:bg-surface-100 transition-colors"
                >
                  Registrar decisión
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {modalData && (
        <DecisionMenstrualModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          registroId={modalData.id}
          jugadoraName={modalData.name}
        />
      )}
    </div>
  )
}
