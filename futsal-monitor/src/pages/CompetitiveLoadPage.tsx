import { useState, useMemo } from 'react'
import { useStore } from '@/store/store'
import { format } from 'date-fns'
import { DataTable, DataRow, DataCell } from '@/components/shared/DataTable'
import { calcularCargaCompetitivaPlantilla } from '@/domain/monitoring/competitiveLoad'

export function CompetitiveLoadPage() {
  const { jugadoras, partidos, rpe_partido } = useStore()
  const [rangoDias, setRangoDias] = useState<number | undefined>(undefined)
  const [jugadoraSeleccionada, setJugadoraSeleccionada] = useState<string>('todas')
  const [sortBy, setSortBy] = useState<'minutos' | 'srpe' | 'srpe_ultimo'>('srpe')
  
  const today = format(new Date(), 'yyyy-MM-dd')

  const metricasPlantilla = useMemo(() => {
    return calcularCargaCompetitivaPlantilla(jugadoras, partidos, rpe_partido, {
      fechaReferencia: today,
      rangoDias: rangoDias
    })
  }, [jugadoras, partidos, rpe_partido, rangoDias, today])

  const datosOrdenados = useMemo(() => {
    return [...metricasPlantilla].sort((a, b) => {
      if (sortBy === 'minutos') return b.minutosTotales - a.minutosTotales
      if (sortBy === 'srpe') return b.sRpeTotal - a.sRpeTotal
      return b.sRpeUltimo - a.sRpeUltimo
    })
  }, [metricasPlantilla, sortBy])

  const metricasJugadora = jugadoraSeleccionada !== 'todas' 
    ? metricasPlantilla.find(m => m.jugadora.id_jugadora === jugadoraSeleccionada) 
    : null

  const formatParticipacion = (part: string) => {
    switch (part) {
      case 'completa': return 'Completa'
      case 'parcial': return 'Parcial'
      case 'modificada': return 'Modificada'
      case 'convocada_sin_minutos': return 'Conv. sin min.'
      case 'no_convocada': return 'No convocada'
      default: return '—'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-surface-900">Carga Competitiva</h1>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-surface-200 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-surface-600 mb-1">Periodo</label>
          <select 
            className="w-48 border border-surface-300 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary-500"
            value={rangoDias === undefined ? 'all' : rangoDias.toString()}
            onChange={(e) => setRangoDias(e.target.value === 'all' ? undefined : Number(e.target.value))}
          >
            <option value="all">Temporada completa</option>
            <option value="7">Últimos 7 días</option>
            <option value="14">Últimos 14 días</option>
            <option value="28">Últimos 28 días</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-surface-600 mb-1">Vista</label>
          <select 
            className="w-48 border border-surface-300 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary-500"
            value={jugadoraSeleccionada}
            onChange={(e) => setJugadoraSeleccionada(e.target.value)}
          >
            <option value="todas">Plantilla completa</option>
            {jugadoras.filter(j => j.activa !== false).map(j => (
              <option key={j.id_jugadora} value={j.id_jugadora}>{j.nombre}</option>
            ))}
          </select>
        </div>
        
        {jugadoraSeleccionada === 'todas' && (
          <div>
            <label className="block text-xs font-medium text-surface-600 mb-1">Ordenar por</label>
            <select 
              className="w-48 border border-surface-300 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary-500"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="srpe">sRPE Total</option>
              <option value="minutos">Minutos Jugados</option>
              <option value="srpe_ultimo">sRPE Último partido</option>
            </select>
          </div>
        )}
      </div>

      {jugadoraSeleccionada === 'todas' ? (
        <DataTable
          headers={['Jugadora', 'Partidos (Reg.)', 'Minutos Totales', 'Minutos Medios', 'RPE Medio', 'sRPE Total (UA)', 'sRPE Último (UA)', 'Pendientes']}
          emptyMessage="No hay datos de carga competitiva."
        >
          {datosOrdenados.map((m) => (
            <DataRow key={m.jugadora.id_jugadora}>
              <DataCell className="font-medium text-surface-900">{m.jugadora.nombre}</DataCell>
              <DataCell>{m.partidosJugados} ({m.partidosConRegistro})</DataCell>
              <DataCell className="font-mono">{m.minutosTotales}'</DataCell>
              <DataCell className="font-mono">{m.minutosMedios}'</DataCell>
              <DataCell className="font-mono text-surface-600">{m.rpeMedio || '—'}</DataCell>
              <DataCell className="font-mono font-medium text-primary-700">{m.sRpeTotal}</DataCell>
              <DataCell className="font-mono text-surface-600">{m.sRpeUltimo}</DataCell>
              <DataCell>
                {m.datosPendientes > 0 ? (
                  <span className="text-amber-600 font-medium">{m.datosPendientes} pendientes</span>
                ) : (
                  <span className="text-green-600 text-xs">Al día</span>
                )}
              </DataCell>
            </DataRow>
          ))}
        </DataTable>
      ) : metricasJugadora ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-surface-200">
              <div className="text-xs text-surface-500 mb-1">Minutos Totales</div>
              <div className="text-2xl font-bold font-mono text-surface-900">{metricasJugadora.minutosTotales}'</div>
              <div className="text-xs text-surface-500 mt-1">Media: {metricasJugadora.minutosMedios}'/partido</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-surface-200">
              <div className="text-xs text-surface-500 mb-1">sRPE Total</div>
              <div className="text-2xl font-bold font-mono text-primary-700">{metricasJugadora.sRpeTotal} UA</div>
              <div className="text-xs text-surface-500 mt-1">
                Media: {metricasJugadora.partidosJugados > 0 ? Math.round(metricasJugadora.sRpeTotal / metricasJugadora.partidosJugados) : 0} UA/partido
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-surface-200">
              <div className="text-xs text-surface-500 mb-1">RPE Medio</div>
              <div className="text-2xl font-bold font-mono text-surface-900">{metricasJugadora.rpeMedio || '—'}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-surface-200">
              <div className="text-xs text-surface-500 mb-1">Datos Pendientes</div>
              <div className={`text-2xl font-bold font-mono ${metricasJugadora.datosPendientes > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {metricasJugadora.datosPendientes}
              </div>
              <div className="text-xs text-surface-500 mt-1">partidos sin completar</div>
            </div>
          </div>

          <h3 className="text-sm font-bold text-surface-800 uppercase tracking-wide mt-8">Desglose de Partidos</h3>
          <DataTable
            headers={['Fecha', 'Rival', 'Participación', 'Minutos', 'RPE', 'sRPE (UA)', 'Nota']}
            emptyMessage="No hay partidos registrados para esta jugadora."
          >
            {metricasJugadora.registros.map((r, i) => {
              const rpe = r.rpePartido
              const isZero = rpe.participacion === 'no_convocada' || rpe.participacion === 'convocada_sin_minutos'
              const minVal = rpe.minutos_jugados
              const rpeVal = rpe.rpe
              
              return (
                <DataRow key={r.partido.id_partido + i.toString()}>
                  <DataCell className="text-surface-600">{r.partido.fecha}</DataCell>
                  <DataCell className="font-medium">{r.partido.rival}</DataCell>
                  <DataCell>{formatParticipacion(rpe.participacion || '')}</DataCell>
                  <DataCell className="font-mono">
                    {isZero ? "0'" : (minVal !== null && minVal !== undefined ? `${minVal}'` : '—')}
                  </DataCell>
                  <DataCell className="font-mono">
                    {isZero ? '—' : (rpeVal !== null && rpeVal !== undefined ? rpeVal : '—')}
                  </DataCell>
                  <DataCell className="font-mono font-medium text-primary-700">
                    {isZero ? '0' : (rpe.carga_ua !== null && rpe.carga_ua !== undefined ? rpe.carga_ua : '—')}
                  </DataCell>
                  <DataCell className="text-xs text-surface-500 truncate max-w-[200px]">
                    <div title={rpe.comentario_staff || rpe.motivo_participacion_reducida}>
                      {rpe.motivo_participacion_reducida ? (
                        <span className="text-red-600 font-medium block">Motivo: {rpe.motivo_participacion_reducida}</span>
                      ) : null}
                      {rpe.comentario_staff}
                    </div>
                  </DataCell>
                </DataRow>
              )
            })}
          </DataTable>
        </div>
      ) : null}
    </div>
  )
}
