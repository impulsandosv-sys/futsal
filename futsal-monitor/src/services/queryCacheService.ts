interface CacheItem<T> {
  value: T
  expiresAt: number
}

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutos por defecto
const cacheMap = new Map<string, CacheItem<any>>()

let hits = 0
let misses = 0

export function getCachedQuery<T>(key: string, queryFn: () => T, ttlMs: number = DEFAULT_TTL_MS): T {
  const now = Date.now()
  const cached = cacheMap.get(key)

  if (cached && cached.expiresAt > now) {
    hits++
    return cached.value
  }

  misses++
  const value = queryFn()
  cacheMap.set(key, {
    value,
    expiresAt: now + ttlMs,
  })

  return value
}

export function invalidarQueryCache(patronKey?: string): void {
  if (!patronKey) {
    cacheMap.clear()
    return
  }
  for (const key of cacheMap.keys()) {
    if (key.includes(patronKey)) {
      cacheMap.delete(key)
    }
  }
}

export function clearQueryCache(): void {
  cacheMap.clear()
}

export function getCacheStats() {
  return {
    hits,
    misses,
    size: cacheMap.size,
  }
}

export function resetCacheStats(): void {
  hits = 0
  misses = 0
}
