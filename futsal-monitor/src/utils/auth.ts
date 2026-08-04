const SESSION_KEY = 'futsal_session'
const HASH_KEY = 'futsal_password_hash'
const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutos
// Default hash para 'futsal2024' usando PBKDF2 y un salt fijo pre-generado
const DEFAULT_SALT = 'e6490333246231267b1404e1be92ba94'
const DEFAULT_HASH = 'adeb781133dac9b8f470d53ff4a1a0fa55417aa373bc4fd55c5dda44477e93df'

function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined' && typeof sessionStorage !== 'undefined'
}

interface SessionData {
  hash: string
  expiresAt: number
}

interface StoredHashData {
  hash: string
  salt: string
}

export async function hashPassword(password: string, existingSaltHex?: string): Promise<{ hash: string; salt: string }> {
  const encoder = new TextEncoder()
  const salt = existingSaltHex 
    ? new Uint8Array(existingSaltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
    : crypto.getRandomValues(new Uint8Array(16))

  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )

  const rawKey = await crypto.subtle.exportKey('raw', derivedKey)
  const hashHex = Array.from(new Uint8Array(rawKey)).map((b) => b.toString(16).padStart(2, '0')).join('')
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('')

  return { hash: hashHex, salt: saltHex }
}

export function initializeAuth(): void {
  if (!isBrowserEnvironment()) return
  const existing = localStorage.getItem(HASH_KEY)
  if (!existing) {
    const data: StoredHashData = { hash: DEFAULT_HASH, salt: DEFAULT_SALT }
    localStorage.setItem(HASH_KEY, JSON.stringify(data))
  }
}

export async function verifyPassword(password: string): Promise<boolean> {
  if (!isBrowserEnvironment()) return false
  const storedRaw = localStorage.getItem(HASH_KEY)
  if (!storedRaw) return false
  try {
    const stored: StoredHashData = JSON.parse(storedRaw)
    const result = await hashPassword(password, stored.salt)
    return result.hash === stored.hash
  } catch {
    // Fallback por si acaso era texto plano o SHA-256 antiguo
    return false
  }
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
  if (!isBrowserEnvironment()) return false
  const valid = await verifyPassword(oldPassword)
  if (!valid) return false
  const result = await hashPassword(newPassword)
  localStorage.setItem(HASH_KEY, JSON.stringify(result))
  return true
}

export function createSession(): void {
  if (!isBrowserEnvironment()) return
  const storedRaw = localStorage.getItem(HASH_KEY)
  if (!storedRaw) return
  try {
    const stored: StoredHashData = JSON.parse(storedRaw)
    const session: SessionData = {
      hash: stored.hash,
      expiresAt: Date.now() + SESSION_TIMEOUT_MS,
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    localStorage.setItem('futsal_auth', 'true')
  } catch {
    // ignore
  }
}

export function isSessionValid(): boolean {
  if (!isBrowserEnvironment()) return false
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return false
  try {
    const session: SessionData = JSON.parse(raw)
    if (Date.now() > session.expiresAt) {
      clearSession()
      return false
    }
    const storedRaw = localStorage.getItem(HASH_KEY)
    if (!storedRaw) return false
    const stored: StoredHashData = JSON.parse(storedRaw)
    return session.hash === stored.hash
  } catch {
    clearSession()
    return false
  }
}

export function refreshSession(): void {
  if (!isBrowserEnvironment()) return
  if (!isSessionValid()) return
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return
  try {
    const session: SessionData = JSON.parse(raw)
    session.expiresAt = Date.now() + SESSION_TIMEOUT_MS
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // ignore
  }
}

export function clearSession(): void {
  if (!isBrowserEnvironment()) return
  sessionStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('futsal_auth')
}

let activityTimer: ReturnType<typeof setTimeout> | null = null

export function startSessionMonitor(onExpire: () => void): void {
  if (!isBrowserEnvironment()) return
  const checkInterval = 60_000

  const check = () => {
    if (!isSessionValid()) {
      onExpire()
      return
    }
    activityTimer = setTimeout(check, checkInterval)
  }

  const resetOnActivity = () => {
    refreshSession()
  }

  window.addEventListener('mousemove', resetOnActivity, { passive: true })
  window.addEventListener('keydown', resetOnActivity, { passive: true })
  window.addEventListener('click', resetOnActivity, { passive: true })
  window.addEventListener('scroll', resetOnActivity, { passive: true })

  check()
}

export function stopSessionMonitor(): void {
  if (!isBrowserEnvironment()) return
  if (activityTimer) {
    clearTimeout(activityTimer)
    activityTimer = null
  }
}
