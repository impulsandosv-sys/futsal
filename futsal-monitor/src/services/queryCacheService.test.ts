import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getCachedQuery,
  invalidarQueryCache,
  getCacheStats,
  resetCacheStats,
  clearQueryCache,
} from './queryCacheService'

describe('Caché de Consultas Frecuentes (src/services/queryCacheService.ts)', () => {
  beforeEach(() => {
    clearQueryCache()
    resetCacheStats()
    vi.useRealTimers()
  })

  it('devuelve el resultado de la función en el primer llamado (cache miss) y usa el caché en el segundo (cache hit)', () => {
    const queryFn = vi.fn().mockReturnValue([{ id_jugadora: 'J001', nombre: 'Ana' }])

    const res1 = getCachedQuery('jugadoras_activas', queryFn)
    expect(res1).toEqual([{ id_jugadora: 'J001', nombre: 'Ana' }])
    expect(queryFn).toHaveBeenCalledTimes(1)

    const res2 = getCachedQuery('jugadoras_activas', queryFn)
    expect(res2).toEqual([{ id_jugadora: 'J001', nombre: 'Ana' }])
    expect(queryFn).toHaveBeenCalledTimes(1) // ¡No volvió a ejecutarse!

    const stats = getCacheStats()
    expect(stats.hits).toBe(1)
    expect(stats.misses).toBe(1)
  })

  it('expira la entrada de caché cuando transcurre el TTL', () => {
    vi.useFakeTimers()
    const queryFn = vi.fn().mockReturnValue(42)

    getCachedQuery('test_ttl', queryFn, 1000) // 1 segundo de TTL
    expect(queryFn).toHaveBeenCalledTimes(1)

    // Avanzar 500 ms (todavía válido)
    vi.advanceTimersByTime(500)
    getCachedQuery('test_ttl', queryFn, 1000)
    expect(queryFn).toHaveBeenCalledTimes(1)

    // Avanzar otros 600 ms (expiró)
    vi.advanceTimersByTime(600)
    getCachedQuery('test_ttl', queryFn, 1000)
    expect(queryFn).toHaveBeenCalledTimes(2)
  })

  it('invalida el caché cuando se invoca invalidarQueryCache', () => {
    const queryFn = vi.fn().mockReturnValue('datos')

    getCachedQuery('sesiones_J001', queryFn)
    expect(queryFn).toHaveBeenCalledTimes(1)

    invalidarQueryCache('sesiones')
    getCachedQuery('sesiones_J001', queryFn)
    expect(queryFn).toHaveBeenCalledTimes(2)
  })
})
