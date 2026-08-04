import { describe, it, expect } from 'vitest'
import { calcularEtiquetaMD, canDeleteSession } from './planningEngine'
import type { Partido, SesionRPE } from '@/types'

describe('planningEngine', () => {
  describe('calcularEtiquetaMD', () => {
    it('devuelve null si no hay partidos', () => {
      expect(calcularEtiquetaMD('2024-01-10', [])).toBeNull()
    })

    it('calcula MD correcto para 1 partido en la semana', () => {
      const partidos: Partido[] = [{ id_partido: 'p1', fecha: '2024-01-13', rival: 'A', competicion: 'Liga', resultado: '', lugar: 'Local' }]
      
      expect(calcularEtiquetaMD('2024-01-10', partidos)).toBe('MD-3')
      expect(calcularEtiquetaMD('2024-01-13', partidos)).toBe('MD')
      expect(calcularEtiquetaMD('2024-01-14', partidos)).toBe('MD+1')
    })

    it('devuelve MD si la sesión coincide con uno de múltiples partidos, y vacío en caso contrario para evitar ambigüedad', () => {
      const partidos: Partido[] = [
        { id_partido: 'p1', fecha: '2024-01-10', rival: 'A', competicion: 'Copa', resultado: '', lugar: 'Local' },
        { id_partido: 'p2', fecha: '2024-01-13', rival: 'B', competicion: 'Liga', resultado: '', lugar: 'Visitante' }
      ]
      
      expect(calcularEtiquetaMD('2024-01-10', partidos)).toBe('MD')
      expect(calcularEtiquetaMD('2024-01-13', partidos)).toBe('MD')
      
      // Ambigüedades
      expect(calcularEtiquetaMD('2024-01-11', partidos)).toBeNull()
      expect(calcularEtiquetaMD('2024-01-12', partidos)).toBeNull()
    })
  })

  describe('canDeleteSession', () => {
    it('no permite eliminar si el estado es realizada', () => {
      expect(canDeleteSession('s1', 'realizada', [])).toBe(false)
    })

    it('permite eliminar si el estado es planificada y no hay RPEs con datos reales', () => {
      const rpes: SesionRPE[] = [
        { id_sesion: 's1', id_jugadora: 'j1', fecha: '2024-01-10', asistencia: 'sin_registrar' }
      ]
      expect(canDeleteSession('s1', 'planificada', rpes)).toBe(true)
    })

    it('no permite eliminar si hay RPEs con carga, RPE o asistencia distinta a sin_registrar', () => {
      const rpesCarga: SesionRPE[] = [{ id_sesion: 's1', id_jugadora: 'j1', fecha: '2024-01-10', carga_ua: 100 }]
      const rpesRpe: SesionRPE[] = [{ id_sesion: 's1', id_jugadora: 'j1', fecha: '2024-01-10', rpe: 5 }]
      const rpesAsistencia: SesionRPE[] = [{ id_sesion: 's1', id_jugadora: 'j1', fecha: '2024-01-10', asistencia: 'completa' }]
      
      expect(canDeleteSession('s1', 'planificada', rpesCarga)).toBe(false)
      expect(canDeleteSession('s1', 'planificada', rpesRpe)).toBe(false)
      expect(canDeleteSession('s1', 'planificada', rpesAsistencia)).toBe(false)
    })
  })
})
