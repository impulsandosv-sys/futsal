const SESSION_KEY = 'futsal_session'
const HASH_KEY = 'futsal_password_hash'
const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutos
const DEFAULT_HASH = '1760f50f17f432c11f3f43a3d98b3842120bab6709d17e6f6dc72a882408f36e'

interface SessionData {
  hash: string
  expiresAt: number
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function initializeAuth(): void {
  const existingHash = localStorage.getItem(HASH_KEY)
  if (!existingHash) {
    localStorage.setItem(HASH_KEY, DEFAULT_HASH)
  }
}

export async function verifyPassword(password: string): Promise<boolean> {
  const storedHash = localStorage.getItem(HASH_KEY)
  if (!storedHash) return false
  const inputHash = await hashPassword(password)
  return inputHash === storedHash
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
  const valid = await verifyPassword(oldPassword)
  if (!valid) return false
  const newHash = await hashPassword(newPassword)
  localStorage.setItem(HASH_KEY, newHash)
  return true
}

export function createSession(): void {
  const storedHash = localStorage.getItem(HASH_KEY)
  if (!storedHash) return
  const session: SessionData = {
    hash: storedHash,
    expiresAt: Date.now() + SESSION_TIMEOUT_MS,
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  localStorage.setItem('futsal_auth', 'true')
}

export function isSessionValid(): boolean {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return false
  try {
    const session: SessionData = JSON.parse(raw)
    if (Date.now() > session.expiresAt) {
      clearSession()
      return false
    }
    const storedHash = localStorage.getItem(HASH_KEY)
    return session.hash === storedHash
  } catch {
    clearSession()
    return false
  }
}

export function refreshSession(): void {
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
  sessionStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('futsal_auth')
}

let activityTimer: ReturnType<typeof setTimeout> | null = null

export function startSessionMonitor(onExpire: () => void): void {
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
  if (activityTimer) {
    clearTimeout(activityTimer)
    activityTimer = null
  }
}
