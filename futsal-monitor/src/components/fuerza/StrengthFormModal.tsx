import { useState, useEffect, useMemo, useRef } from 'react'
import { useStore } from '@/store/store'
import { Modal } from '@/components/shared/Modal'
import {
  validarSesionFuerzaIndividual,
  validarTrabajoFuerza,
  esNumeroFinitoValido,
  normalizarTextoObservacion,
} from '@/domain/neuromuscular/fuerzaEngine'
import type {
  SesionFuerzaIndividual,
  TrabajoFuerzaIndividual,
  SerieFuerzaRealizada,
  FinalidadSesionFuerza,
  PlantillaFuerza,
} from '@/types'

const FINALIDADES: { value: FinalidadSesionFuerza; label: string }[] = [
  { value: 'fuerza_maxima', label: 'Fuerza Máxima' },
  { value: 'hipertrofia', label: 'Hipertrofia' },
  { value: 'potencia', label: 'Potencia' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'prevencion', label: 'Prevención' },
  { value: 'readaptacion', label: 'Readaptación' },
  { value: 'otro', label: 'Otro' },
]

interface DraftSerie {
  id_serie: string
  orden: number
  repeticiones: string
  carga_kg: string
  rpe_serie: string
  observacion: string
}

interface DraftExercise {
  tempId: string
  id_ejercicio: string
  ejercicio_nombre_historico: string
  observacion_staff: string
  series: DraftSerie[]
}

interface StrengthFormModalProps {
  open?: boolean
  isOpen?: boolean
  onClose: () => void
  editingId?: string | null
  templateToApply?: PlantillaFuerza | null
}

export function StrengthFormModal({ open, isOpen, onClose, editingId, templateToApply }: StrengthFormModalProps) {
  const isModalOpen = open ?? isOpen ?? false
  const jugadoras = useStore((s) => s.jugadoras)
  const ejerciciosCatalogo = useStore((s) => s.ejercicios_fuerza)
  const sesiones = useStore((s) => s.sesiones_fuerza_individual)
  const trabajosStore = useStore((s) => s.trabajos_fuerza)
  const addSesionCompleta = useStore((s) => s.addSesionFuerzaCompleta)
  const updateSesionCompleta = useStore((s) => s.updateSesionFuerzaCompleta)

  const [idJugadora, setIdJugadora] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [finalidad, setFinalidad] = useState<FinalidadSesionFuerza | ''>('')
  const [rpeSesion, setRpeSesion] = useState('')
  const [duracionMin, setDuracionMin] = useState('')
  const [observacionStaff, setObservacionStaff] = useState('')

  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [confirmDeleteMessage, setConfirmDeleteMessage] = useState<string | null>(null)
  const [pendingDeleteAction, setPendingDeleteAction] = useState<(() => void) | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)

  // Opciones de jugadoras: en ALTA solo activas; en EDICIÓN conservar histórica
  const jugadorasOptions = useMemo(() => {
    if (!editingId) {
      return jugadoras.filter((j) => j.activa !== false)
    }
    // Si estamos editando, incluimos la jugadora histórica de la sesión aunque esté inactiva
    const targetSesion = sesiones.find((s) => s.id_sesion_fuerza === editingId)
    const targetJugadoraId = targetSesion?.id_jugadora
    return jugadoras.filter((j) => j.activa !== false || j.id_jugadora === targetJugadoraId)
  }, [jugadoras, editingId, sesiones])

  // Ejercicios activos disponibles para seleccionar
  const ejerciciosActivos = useMemo(() => {
    return ejerciciosCatalogo.filter((e) => e.activo)
  }, [ejerciciosCatalogo])

  useEffect(() => {
    if (!isModalOpen) return
    setIsSubmitting(false)
    isSubmittingRef.current = false
    setErrors([])
    setConfirmDeleteMessage(null)
    setPendingDeleteAction(null)

    if (templateToApply) {
      setIdJugadora('')
      setFecha(new Date().toISOString().split('T')[0])
      setFinalidad(templateToApply.finalidad || '')
      setRpeSesion('')
      setDuracionMin('')
      setObservacionStaff('')

      const prefilledExercises: DraftExercise[] = (templateToApply.ejercicios || []).map((ej, idx) => {
        const catEj = ejerciciosCatalogo.find((e) => e.id_ejercicio === ej.id_ejercicio)
        const nombreHistorico = catEj?.nombre || ej.ejercicio_nombre_historico || 'Ejercicio'
        const numSeries = ej.series_propuestas || 1

        const emptySeries: DraftSerie[] = Array.from({ length: numSeries }, (_, sIdx) => ({
          id_serie: `s_draft_${idx}_${sIdx}_${Math.random().toString(36).substr(2, 4)}`,
          orden: sIdx + 1,
          repeticiones: '',
          carga_kg: '',
          rpe_serie: '',
          observacion: '',
        }))

        return {
          tempId: `de_${Date.now()}_${idx}`,
          id_ejercicio: ej.id_ejercicio,
          ejercicio_nombre_historico: nombreHistorico,
          observacion_staff: '',
          series: emptySeries,
        }
      })

      setDraftExercises(prefilledExercises)
      return
    }

    if (editingId) {
      const sesionExistente = sesiones.find((s) => s.id_sesion_fuerza === editingId)
      if (sesionExistente) {
        setIdJugadora(sesionExistente.id_jugadora)
        setFecha(sesionExistente.fecha)
        setFinalidad(sesionExistente.finalidad || '')
        setRpeSesion(sesionExistente.rpe_sesion != null ? String(sesionExistente.rpe_sesion) : '')
        setDuracionMin(sesionExistente.duracion_min != null ? String(sesionExistente.duracion_min) : '')
        setObservacionStaff(sesionExistente.observacion_staff || '')

        const trabajosRelacionados = trabajosStore.filter(
          (t) =>
            t.id_sesion_fuerza === sesionExistente.id_sesion_fuerza ||
            t.id_sesion === sesionExistente.id_sesion_fuerza
        )

        const loadedDrafts: DraftExercise[] = trabajosRelacionados.map((t, idx) => ({
          tempId: t.id_trabajo || `temp_${idx}`,
          id_ejercicio: t.id_ejercicio,
          ejercicio_nombre_historico: t.ejercicio_nombre_historico,
          observacion_staff: t.observacion_staff || '',
          series: (t.realizado || []).map((s, sIdx) => ({
            id_serie: s.id_serie || `s_${sIdx}`,
            orden: s.orden || sIdx + 1,
            repeticiones: s.repeticiones != null ? String(s.repeticiones) : '',
            carga_kg: s.carga_kg != null ? String(s.carga_kg) : '',
            rpe_serie: s.rpe_serie != null ? String(s.rpe_serie) : '',
            observacion: s.observacion || '',
          })),
        }))

        setDraftExercises(loadedDrafts)
        return
      }
    }

    // Alta nueva
    setIdJugadora(jugadorasOptions[0]?.id_jugadora || '')
    setFecha(new Date().toISOString().split('T')[0])
    setFinalidad('')
    setRpeSesion('')
    setDuracionMin('')
    setObservacionStaff('')

    // Ejercicio por defecto si hay catálogo activo
    const primerEjercicio = ejerciciosActivos[0]
    if (primerEjercicio) {
      setDraftExercises([
        {
          tempId: 'ex_0',
          id_ejercicio: primerEjercicio.id_ejercicio,
          ejercicio_nombre_historico: primerEjercicio.nombre,
          observacion_staff: '',
          series: [
            {
              id_serie: 's_0',
              orden: 1,
              repeticiones: '',
              carga_kg: '',
              rpe_serie: '',
              observacion: '',
            },
          ],
        },
      ])
    } else {
      setDraftExercises([])
    }
  }, [open, isModalOpen, editingId, templateToApply, ejerciciosCatalogo, sesiones, trabajosStore, jugadorasOptions, ejerciciosActivos])

  // Recálculo dinámico de tonelaje
  const { totalTonelaje, hayCuantificable, hayNoCuantificable, totalSeriesValidas } = useMemo(() => {
    let sum = 0
    let cuant = false
    let noCuant = false
    let seriesCount = 0

    draftExercises.forEach((ex) => {
      ex.series.forEach((s) => {
        const reps = s.repeticiones.trim() !== '' ? Number(s.repeticiones) : null
        const kg = s.carga_kg.trim() !== '' ? Number(s.carga_kg) : null

        const tieneDato = reps != null || kg != null || s.rpe_serie.trim() !== '' || s.observacion.trim() !== ''
        if (tieneDato) seriesCount++

        if (reps != null && reps >= 0 && kg != null && kg >= 0) {
          sum += reps * kg
          cuant = true
        } else if (reps != null || kg != null) {
          noCuant = true
        }
      })
    })

    return {
      totalTonelaje: sum,
      hayCuantificable: cuant,
      hayNoCuantificable: noCuant,
      totalSeriesValidas: seriesCount,
    }
  }, [draftExercises])

  const handleAddExercise = () => {
    if (ejerciciosActivos.length === 0) return
    const primerEj = ejerciciosActivos[0]
    setDraftExercises((prev) => [
      ...prev,
      {
        tempId: 'ex_' + Date.now() + Math.random(),
        id_ejercicio: primerEj.id_ejercicio,
        ejercicio_nombre_historico: primerEj.nombre,
        observacion_staff: '',
        series: [
          {
            id_serie: 's_' + Date.now(),
            orden: 1,
            repeticiones: '',
            carga_kg: '',
            rpe_serie: '',
            observacion: '',
          },
        ],
      },
    ])
  }

  const handleRemoveExercise = (exerciseTempId: string) => {
    const target = draftExercises.find((e) => e.tempId === exerciseTempId)
    if (!target) return

    const tieneInformacion =
      target.observacion_staff.trim() !== '' ||
      target.series.some(
        (s) =>
          s.repeticiones.trim() !== '' ||
          s.carga_kg.trim() !== '' ||
          s.rpe_serie.trim() !== '' ||
          s.observacion.trim() !== ''
      )

    const removeAction = () => {
      setDraftExercises((prev) => prev.filter((e) => e.tempId !== exerciseTempId))
      setConfirmDeleteMessage(null)
      setPendingDeleteAction(null)
    }

    if (tieneInformacion) {
      setConfirmDeleteMessage(`¿Confirmas eliminar el ejercicio "${target.ejercicio_nombre_historico}" y sus series?`)
      setPendingDeleteAction(() => removeAction)
    } else {
      removeAction()
    }
  }

  const handleAddSerie = (exerciseTempId: string) => {
    setDraftExercises((prev) =>
      prev.map((ex) => {
        if (ex.tempId !== exerciseTempId) return ex
        const nextOrden = ex.series.length > 0 ? Math.max(...ex.series.map((s) => s.orden)) + 1 : 1
        return {
          ...ex,
          series: [
            ...ex.series,
            {
              id_serie: 's_' + Date.now() + Math.random(),
              orden: nextOrden,
              repeticiones: '',
              carga_kg: '',
              rpe_serie: '',
              observacion: '',
            },
          ],
        }
      })
    )
  }

  const handleRemoveSerie = (exerciseTempId: string, serieId: string) => {
    const ex = draftExercises.find((e) => e.tempId === exerciseTempId)
    const serie = ex?.series.find((s) => s.id_serie === serieId)
    if (!serie) return

    const tieneInfo =
      serie.repeticiones.trim() !== '' ||
      serie.carga_kg.trim() !== '' ||
      serie.rpe_serie.trim() !== '' ||
      serie.observacion.trim() !== ''

    const removeAction = () => {
      setDraftExercises((prev) =>
        prev.map((e) => {
          if (e.tempId !== exerciseTempId) return e
          return {
            ...e,
            series: e.series.filter((s) => s.id_serie !== serieId),
          }
        })
      )
      setConfirmDeleteMessage(null)
      setPendingDeleteAction(null)
    }

    if (tieneInfo) {
      setConfirmDeleteMessage(`¿Confirmas eliminar la serie #${serie.orden}?`)
      setPendingDeleteAction(() => removeAction)
    } else {
      removeAction()
    }
  }

  const handleExerciseChange = (exerciseTempId: string, newIdEjercicio: string) => {
    const selectedEx = ejerciciosCatalogo.find((e) => e.id_ejercicio === newIdEjercicio)
    if (!selectedEx) return

    setDraftExercises((prev) =>
      prev.map((ex) => {
        if (ex.tempId !== exerciseTempId) return ex
        return {
          ...ex,
          id_ejercicio: selectedEx.id_ejercicio,
          ejercicio_nombre_historico: selectedEx.nombre,
        }
      })
    )
  }

  const handleSerieChange = (
    exerciseTempId: string,
    serieId: string,
    field: keyof DraftSerie,
    value: string
  ) => {
    setDraftExercises((prev) =>
      prev.map((ex) => {
        if (ex.tempId !== exerciseTempId) return ex
        return {
          ...ex,
          series: ex.series.map((s) => {
            if (s.id_serie !== serieId) return s
            return { ...s, [field]: value }
          }),
        }
      })
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setIsSubmitting(true)
    setErrors([])

    try {
      const errs: string[] = []

      // 1. Validaciones básicas de la sesión
      let parsedRpe: number | null = null
      if (rpeSesion.trim() !== '') {
        const val = Number(rpeSesion)
        if (!esNumeroFinitoValido(val)) {
          errs.push('El sRPE debe ser un número finito válido')
        } else {
          parsedRpe = val
        }
      }

      let parsedDuracion: number | null = null
      if (duracionMin.trim() !== '') {
        const val = Number(duracionMin)
        if (!esNumeroFinitoValido(val)) {
          errs.push('La duración debe ser un número finito válido')
        } else {
          parsedDuracion = val
        }
      }

      const sesionPayload: Omit<SesionFuerzaIndividual, 'createdAt' | 'updatedAt' | 'id_sesion_fuerza'> = {
        id_jugadora: idJugadora,
        fecha,
        finalidad: finalidad !== '' ? finalidad : null,
        rpe_sesion: parsedRpe,
        duracion_min: parsedDuracion,
        observacion_staff: normalizarTextoObservacion(observacionStaff),
        id_plantilla_fuerza_origen: templateToApply?.id_plantilla || null,
      }

      errs.push(...validarSesionFuerzaIndividual(sesionPayload))

      // 2. Comprobar que haya al menos 1 ejercicio y 1 serie válida
      if (draftExercises.length === 0) {
        errs.push('La sesión debe contener al menos un ejercicio.')
      }

      let hasAnyValidSerie = false
      const parsedTrabajos: TrabajoFuerzaIndividual[] = []
      const targetSesionId = editingId || 'sf_' + Date.now()

      for (const exDraft of draftExercises) {
        const parsedSeries: SerieFuerzaRealizada[] = []
        const ordenesVistos = new Set<number>()

        for (const sDraft of exDraft.series) {
          let reps: number | null = null
          if (sDraft.repeticiones.trim() !== '') {
            const val = Number(sDraft.repeticiones)
            if (!esNumeroFinitoValido(val)) {
              errs.push(`Las repeticiones de la serie #${sDraft.orden} contienen un valor no numérico inválido`)
            } else {
              reps = val
            }
          }

          let kg: number | null = null
          if (sDraft.carga_kg.trim() !== '') {
            const val = Number(sDraft.carga_kg)
            if (!esNumeroFinitoValido(val)) {
              errs.push(`La carga de la serie #${sDraft.orden} contiene un valor no numérico inválido`)
            } else {
              kg = val
            }
          }

          let rpeS: number | null = null
          if (sDraft.rpe_serie.trim() !== '') {
            const val = Number(sDraft.rpe_serie)
            if (!esNumeroFinitoValido(val)) {
              errs.push(`El RPE de la serie #${sDraft.orden} contiene un valor no numérico inválido`)
            } else {
              rpeS = val
            }
          }

          if (reps != null && reps < 0) errs.push(`Las repeticiones de la serie #${sDraft.orden} no pueden ser negativas`)
          if (kg != null && kg < 0) errs.push(`La carga de la serie #${sDraft.orden} no puede ser negativa`)
          if (rpeS != null && (rpeS < 0 || rpeS > 10)) errs.push(`El RPE de la serie #${sDraft.orden} debe estar entre 0 y 10`)

          if (ordenesVistos.has(sDraft.orden)) {
            errs.push(`Orden duplicado en serie: ${sDraft.orden} en el ejercicio "${exDraft.ejercicio_nombre_historico}"`)
          }
          ordenesVistos.add(sDraft.orden)

          const tieneContenido = reps != null || kg != null || rpeS != null || sDraft.observacion.trim() !== ''
          if (tieneContenido) {
            hasAnyValidSerie = true
            parsedSeries.push({
              id_serie: sDraft.id_serie,
              orden: sDraft.orden,
              repeticiones: reps,
              carga_kg: kg,
              rpe_serie: rpeS,
              observacion: normalizarTextoObservacion(sDraft.observacion),
            })
          }
        }

        const trabajoObj: TrabajoFuerzaIndividual = {
          id_trabajo: 'tr_' + Date.now() + Math.random(),
          id_sesion_fuerza: targetSesionId,
          id_jugadora: idJugadora,
          id_ejercicio: exDraft.id_ejercicio,
          ejercicio_nombre_historico: exDraft.ejercicio_nombre_historico,
          realizado: parsedSeries,
          estado: parsedSeries.length > 0 ? 'completado' : 'no_realizado',
          observacion_staff: normalizarTextoObservacion(exDraft.observacion_staff),
          updatedAt: new Date().toISOString(),
        }

        errs.push(...validarTrabajoFuerza(trabajoObj))
        parsedTrabajos.push(trabajoObj)
      }

      if (!hasAnyValidSerie) {
        errs.push('La sesión debe incluir al menos una serie con información válida (repeticiones, carga, RPE u observación).')
      }

      if (errs.length > 0) {
        setErrors(Array.from(new Set(errs)))
        return
      }

      const now = new Date().toISOString()
      if (editingId) {
        const sesionExistente = sesiones.find((s) => s.id_sesion_fuerza === editingId)
        const fullSesion: SesionFuerzaIndividual = {
          ...sesionPayload,
          id_sesion_fuerza: editingId,
          createdAt: sesionExistente ? sesionExistente.createdAt : now,
          updatedAt: now,
        }
        await updateSesionCompleta(fullSesion, parsedTrabajos)
      } else {
        const fullSesion: SesionFuerzaIndividual = {
          ...sesionPayload,
          id_sesion_fuerza: targetSesionId,
          createdAt: now,
          updatedAt: now,
        }
        await addSesionCompleta(fullSesion, parsedTrabajos)
      }

      onClose()
    } catch (err: any) {
      setErrors([err?.message || 'Error inesperado al guardar la sesión de fuerza.'])
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <Modal open={isModalOpen} onClose={onClose} title={editingId ? 'Editar Sesión de Fuerza' : 'Registrar Sesión de Fuerza'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-xs space-y-1">
            {errors.map((err, idx) => (
              <p key={idx}>• {err}</p>
            ))}
          </div>
        )}

        {confirmDeleteMessage && (
          <div className="bg-amber-50 border border-amber-300 p-3 rounded-md text-xs space-y-2">
            <p className="font-semibold text-amber-900">{confirmDeleteMessage}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteMessage(null)
                  setPendingDeleteAction(null)
                }}
                className="px-2.5 py-1 text-xs text-surface-600 bg-white border border-surface-200 rounded"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => pendingDeleteAction && pendingDeleteAction()}
                className="px-2.5 py-1 text-xs text-white bg-red-600 hover:bg-red-700 rounded font-medium shadow-sm"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        )}

        {/* Datos Generales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-50 p-3 rounded-md border border-surface-200">
          <div>
            <label className="block text-[11px] font-medium text-surface-600 mb-1">Jugadora *</label>
            <select
              required
              value={idJugadora}
              onChange={(e) => setIdJugadora(e.target.value)}
              className="w-full rounded border-surface-300 text-xs px-2.5 py-1.5"
            >
              {jugadorasOptions.map((j) => (
                <option key={j.id_jugadora} value={j.id_jugadora}>
                  {j.nombre} {j.activa === false ? '(Inactiva)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-surface-600 mb-1">Fecha (YYYY-MM-DD) *</label>
            <input
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded border-surface-300 text-xs px-2.5 py-1.5"
            />
          </div>

          <div>
            <label htmlFor="finalidad-select" className="block text-[11px] font-medium text-surface-600 mb-1">Finalidad</label>
            <select
              id="finalidad-select"
              value={finalidad}
              onChange={(e) => setFinalidad(e.target.value as FinalidadSesionFuerza | '')}
              className="w-full rounded border-surface-300 text-xs px-2.5 py-1.5"
            >
              <option value="">Sin especificar</option>
              {FINALIDADES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-surface-600 mb-1">sRPE (0-10)</label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={rpeSesion}
                onChange={(e) => setRpeSesion(e.target.value)}
                className="w-full rounded border-surface-300 text-xs px-2.5 py-1.5"
                placeholder="Ej. 7"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-surface-600 mb-1">Duración (min)</label>
              <input
                type="number"
                min="1"
                value={duracionMin}
                onChange={(e) => setDuracionMin(e.target.value)}
                className="w-full rounded border-surface-300 text-xs px-2.5 py-1.5"
                placeholder="Ej. 45"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-medium text-surface-600 mb-1">Observación del Staff</label>
            <input
              type="text"
              value={observacionStaff}
              onChange={(e) => setObservacionStaff(e.target.value)}
              className="w-full rounded border-surface-300 text-xs px-2.5 py-1.5"
              placeholder="Notas generales de la sesión..."
            />
          </div>
        </div>

        {/* Resumen dinámico de Tonelaje */}
        <div className="flex justify-between items-center bg-primary-50 border border-primary-200 px-3 py-2 rounded text-xs">
          <span className="font-semibold text-primary-900">Tonelaje Derivado Estimado:</span>
          <span className="font-bold text-primary-700">
            {!hayCuantificable
              ? '—'
              : hayNoCuantificable
              ? `Tonelaje parcial (${totalTonelaje.toLocaleString()} kg)`
              : `${totalTonelaje.toLocaleString()} kg`}
          </span>
        </div>

        {/* Bloque de Ejercicios y Series */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-surface-900">Ejercicios y Series ({draftExercises.length})</h4>
            <button
              type="button"
              onClick={handleAddExercise}
              disabled={ejerciciosActivos.length === 0}
              className="px-3 py-1 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded disabled:opacity-50"
            >
              + Añadir Ejercicio
            </button>
          </div>

          {draftExercises.length === 0 ? (
            <p className="text-xs text-surface-400 italic text-center py-4">
              Agrega al menos un ejercicio para completar el registro.
            </p>
          ) : (
            draftExercises.map((ex, exIdx) => (
              <div key={ex.tempId} className="border border-surface-200 rounded-md p-3 space-y-3 bg-white">
                <div className="flex justify-between items-center gap-2 border-b border-surface-100 pb-2">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-xs font-bold text-surface-500">#{exIdx + 1}</span>
                    <select
                      value={ex.id_ejercicio}
                      onChange={(e) => handleExerciseChange(ex.tempId, e.target.value)}
                      className="w-full sm:w-64 rounded border-surface-300 text-xs font-semibold px-2 py-1"
                    >
                      {ejerciciosCatalogo.map((catEx) => (
                        <option key={catEx.id_ejercicio} value={catEx.id_ejercicio} disabled={!catEx.activo && catEx.id_ejercicio !== ex.id_ejercicio}>
                          {catEx.nombre} {!catEx.activo ? '(Inactivo)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveExercise(ex.tempId)}
                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    Eliminar Ejercicio
                  </button>
                </div>

                {/* Series table for this exercise */}
                <div className="space-y-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="text-[10px] text-surface-500 bg-surface-50 border-b border-surface-200">
                          <th className="p-1.5 w-12 text-center">Serie</th>
                          <th className="p-1.5">Reps</th>
                          <th className="p-1.5">Carga (kg)</th>
                          <th className="p-1.5">RPE Serie</th>
                          <th className="p-1.5">Observación</th>
                          <th className="p-1.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {ex.series.map((s) => (
                          <tr key={s.id_serie}>
                            <td className="p-1 text-center font-bold text-surface-600">#{s.orden}</td>
                            <td className="p-1">
                              <input
                                type="number"
                                min="0"
                                value={s.repeticiones}
                                onChange={(e) => handleSerieChange(ex.tempId, s.id_serie, 'repeticiones', e.target.value)}
                                className="w-16 rounded border-surface-300 text-xs p-1"
                                placeholder="—"
                              />
                            </td>
                            <td className="p-1">
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={s.carga_kg}
                                onChange={(e) => handleSerieChange(ex.tempId, s.id_serie, 'carga_kg', e.target.value)}
                                className="w-20 rounded border-surface-300 text-xs p-1"
                                placeholder="—"
                              />
                            </td>
                            <td className="p-1">
                              <input
                                type="number"
                                min="0"
                                max="10"
                                step="0.5"
                                value={s.rpe_serie}
                                onChange={(e) => handleSerieChange(ex.tempId, s.id_serie, 'rpe_serie', e.target.value)}
                                className="w-16 rounded border-surface-300 text-xs p-1"
                                placeholder="—"
                              />
                            </td>
                            <td className="p-1">
                              <input
                                type="text"
                                value={s.observacion}
                                onChange={(e) => handleSerieChange(ex.tempId, s.id_serie, 'observacion', e.target.value)}
                                className="w-full rounded border-surface-300 text-xs p-1"
                                placeholder="Nota serie..."
                              />
                            </td>
                            <td className="p-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveSerie(ex.tempId, s.id_serie)}
                                className="text-red-500 hover:text-red-700 text-xs font-bold"
                                title="Eliminar serie"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddSerie(ex.tempId)}
                    className="text-[11px] text-primary-600 hover:text-primary-800 font-medium"
                  >
                    + Añadir Serie
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-surface-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-surface-600 hover:bg-surface-200 rounded"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={totalSeriesValidas === 0 || isSubmitting}
            className="px-4 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar Sesión'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
