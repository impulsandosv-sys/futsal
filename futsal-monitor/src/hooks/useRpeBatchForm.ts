import { useState, useCallback } from 'react'
import type { ParticipacionPartido, RPE_Partido } from '@/types'

export type PlayerForm = {
  participacion: ParticipacionPartido | ''
  minutos_jugados: number | ''
  rpe: number | ''
  motivo_participacion_reducida: string
  comentario_staff: string
}

export function useRpeBatchForm() {
  const [batchForm, setBatchForm] = useState<Record<string, PlayerForm>>({})

  const initializeForm = useCallback((
    activePlayers: { id_jugadora: string }[],
    existingRpes: RPE_Partido[]
  ) => {
    const initialForm: Record<string, PlayerForm> = {}
    activePlayers.forEach(j => {
      const existing = existingRpes.find(r => r.id_jugadora === j.id_jugadora)
      if (existing) {
        initialForm[j.id_jugadora] = {
          participacion: existing.participacion || '',
          minutos_jugados: existing.minutos_jugados ?? '',
          rpe: existing.rpe ?? '',
          motivo_participacion_reducida: existing.motivo_participacion_reducida || '',
          comentario_staff: existing.comentario_staff || ''
        }
      } else {
        initialForm[j.id_jugadora] = {
          participacion: '',
          minutos_jugados: '',
          rpe: '',
          motivo_participacion_reducida: '',
          comentario_staff: ''
        }
      }
    })
    setBatchForm(initialForm)
  }, [])

  const handleUpdatePlayerForm = useCallback((id: string, key: keyof PlayerForm, value: any) => {
    setBatchForm(prev => {
      const current = prev[id]
      if (!current) return prev

      const updated = { ...current, [key]: value }

      if (key === 'participacion') {
        if (value === 'completa') {
          // Duration could be read from config, but keeping 40 for backward compatibility
          updated.minutos_jugados = 40
        } else if (value === 'no_convocada' || value === 'convocada_sin_minutos') {
          updated.minutos_jugados = 0
          updated.rpe = ''
        }
      } else if (key === 'minutos_jugados') {
        if (updated.participacion === 'modificada' && value === 0) {
          updated.rpe = ''
        }
      }
      
      return { ...prev, [id]: updated }
    })
  }, [])

  const buildBatchToSave = useCallback((partidoId: string, fecha: string): RPE_Partido[] => {
    const toSave: RPE_Partido[] = []
    
    for (const [id_jugadora, data] of Object.entries(batchForm)) {
      if (data.participacion || data.minutos_jugados !== '' || data.rpe !== '') {
        const isZero = data.participacion === 'no_convocada' || data.participacion === 'convocada_sin_minutos'
        const min = isZero ? 0 : (data.minutos_jugados === '' ? null : Number(data.minutos_jugados))
        const rpeVal = isZero ? null : (data.rpe === '' ? null : Number(data.rpe))
        const carga = isZero ? 0 : ((rpeVal !== null && min !== null) ? rpeVal * min : null)
        
        toSave.push({
          id_partido: partidoId,
          id_jugadora,
          fecha,
          participacion: (data.participacion as ParticipacionPartido) || undefined,
          minutos_jugados: min,
          rpe: rpeVal,
          carga_ua: carga,
          motivo_participacion_reducida: data.motivo_participacion_reducida || undefined,
          comentario_staff: data.comentario_staff || undefined
        })
      }
    }
    
    return toSave
  }, [batchForm])

  return {
    batchForm,
    initializeForm,
    handleUpdatePlayerForm,
    buildBatchToSave,
    setBatchForm
  }
}
