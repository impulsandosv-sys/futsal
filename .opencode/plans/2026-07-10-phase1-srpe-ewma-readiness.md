# Phase 1: sRPE + EWMA ACWR + Readiness Traffic Light Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session RPE (sRPE) with monotony/strain, EWMA-based ACWR (28-day chronic load), and daily readiness traffic-light indicator on Dashboard for solo coach/physio workflow.

**Architecture:** Extend existing session RPE flow, add EWMA calculation service, compute daily readiness per player, surface on DashboardPage. Follow existing Zustand/Dexie/TypeScript patterns. No new dependencies.

**Tech Stack:** React 19, TypeScript (erasableSyntaxOnly), Zustand 5, Dexie (IndexedDB), Recharts, date-fns, oxlint

## Global Constraints

- TypeScript: `erasableSyntaxOnly: true` — no enums, namespaces, parameter properties; use union types, `const` objects
- Path alias: `@/` → `src/` — all imports use `@/types`, `@/utils`, `@/components`, etc.
- Domain language: Spanish — types, routes, UI text, comments
- Auth: hardcoded `futsal2024` local login only
- Data: 100% local IndexedDB via Dexie — no backend/API
- Lint: `npm run lint` (oxlint) — no eslint config exists
- Build: `npm run build` (tsc -b && vite build) — must pass
- No test framework configured — manual verification via `npm run dev`

---

## File Map (Existing → Modified)

| File | Responsibility | Changes |
|------|----------------|---------|
| `src/types/index.ts` | Domain types | Add `SesionRPE`, `Readiness`, `MonotonyStrain` types |
| `src/db/database.ts` | Dexie schema | Add `sesion_rpe` table, `readiness` table (version 4) |
| `src/utils/calculations.ts` | Math utilities | Add `calcularMonotonyStrain`, `calcularACWREWMA`, `calcularReadinessDiaria` |
| `src/utils/calculations.test.ts` | Unit tests | Add tests for new functions |
| `src/store/store.ts` | Zustand store | Add `sesion_rpe`, `readiness` state + CRUD actions |
| `src/pages/SessionsPage.tsx` | Session management | Add sRPE entry modal per session |
| `src/pages/DashboardPage.tsx` | Main dashboard | Add ReadinessTrafficLight widget |
| `src/components/dashboard/ReadinessTrafficLight.tsx` | New component | Daily readiness per player (rojo/ámbar/verde) |
| `src/components/dashboard/KPICards.tsx` | KPI cards | Add monotony/strain KPIs |
| `src/components/shared/Modal.tsx` | Reusable modal | Use existing for sRPE entry |
| `src/utils/validation.ts` | Validation | Add `validateSesionRPE` |
| `src/utils/seed.ts` | Demo data | Add sample sRPE data |
| `src/services/readiness.ts` | New service | Readiness recalculation logic |

---

## Task 1: Domain Types — sRPE, Readiness, Monotony/Strain

**Files:**
- Modify: `src/types/index.ts` (after line 112)

**Interfaces to add:**

```typescript
// Add after RPE_Partido (line ~111)

export interface SesionRPE {
  id?: number
  id_sesion: string
  id_jugadora: string
  rpe: number                    // 1-10
  duracion_min: number
  carga_ua: number               // rpe * duracion_min
  fecha: string                  // ISO date
  monotonia?: number             // media / desviación típica cargas semanales
  strain?: number                // carga_semanal * monotonia
}

export interface MonotonyStrain {
  monotonia: number
  strain: number
  carga_semanal_media: number
  carga_semanal_std: number
}

export type ReadinessNivel = 'verde' | 'ambar' | 'rojo'

export interface Readiness {
  id?: number
  id_jugadora: string
  fecha: string                  // ISO date
  nivel: ReadinessNivel
  score: number                  // 0-100 composite
  factores: {
    wellness: number             // 0-10
    acwr: number
    carga_aguda: number
    carga_cronica: number
    dias_desde_ultimo_wellness: number
  }
  creada: string
}
```

- [ ] **Step 1.1:** Add imports if needed (none new)
- [ ] **Step 1.2:** Insert `SesionRPE` interface after `RPE_Partido`
- [ ] **Step 1.3:** Insert `MonotonyStrain` interface
- [ ] **Step 1.4:** Insert `ReadinessNivel` union type
- [ ] **Step 1.5:** Insert `Readiness` interface
- [ ] **Step 1.6:** Run `npm run build` — verify no type errors

---

## Task 2: Database Schema — sesion_rpe + readiness tables

**Files:**
- Modify: `src/db/database.ts` (version 4)

**Changes:**

```typescript
// In constructor, add version 4 after version 3
this.version(4).stores({
  // Existing tables copied from v3...
  jugadoras: 'id_jugadora, nombre, posicion, activa',
  formulario_respuestas: '++id, id_jugadora, fecha',
  wellness: '++id, id_jugadora, fecha',
  sesiones: 'id_sesion, fecha, tipo_sesion',
  partidos: 'id_partido, fecha',
  lesiones: 'id_lesion, id_jugadora, fecha_inicio, disponible, fase_rtp',
  tests_fisicos: '++id, id_jugadora, fecha, test',
  rpe_entreno: '++id, id_jugadora, id_sesion, fecha',
  rpe_partido: '++id, id_jugadora, id_partido, fecha',
  resumen_semanal: '++id, id_jugadora, semana, estado',
  alertas: '++id, id_jugadora, tipo, leida',
  
  // NEW TABLES
  sesion_rpe: '++id, id_sesion, id_jugadora, fecha',           // composite idx for lookup
  readiness: '++id, id_jugadora, fecha',                       // one per player per day
})
```

- [ ] **Step 2.1:** Add `version(4).stores({...})` with all v3 tables + new tables
- [ ] **Step 2.2:** Add `sesion_rpe!: Dexie.Table<SesionRPE, number>` and `readiness!: Dexie.Table<Readiness, number>` to class properties
- [ ] **Step 2.3:** Import new types from `@/types`
- [ ] **Step 2.4:** Run `npm run build` — verify schema compiles

---

## Task 3: Calculations — Monotony/Strain, EWMA ACWR, Daily Readiness

**Files:**
- Modify: `src/utils/calculations.ts`
- Modify: `src/utils/calculations.test.ts`

### 3.1 `calcularMonotonyStrain(cargasDiarias: number[]): MonotonyStrain`

```typescript
export function calcularMonotonyStrain(cargasDiarias: number[]): MonotonyStrain {
  if (cargasDiarias.length === 0) return { monotonia: 0, strain: 0, carga_semanal_media: 0, carga_semanal_std: 0 }
  
  const media = cargasDiarias.reduce((a, b) => a + b, 0) / cargasDiarias.length
  const varianza = cargasDiarias.reduce((a, b) => a + Math.pow(b - media, 2), 0) / cargasDiarias.length
  const std = Math.sqrt(varianza)
  const monotonia = std > 0 ? Math.round((media / std) * 100) / 100 : 0
  const cargaSemanal = cargasDiarias.reduce((a, b) => a + b, 0)
  const strain = Math.round(cargaSemanal * monotonia * 10) / 10
  
  return { monotonia, strain, carga_semanal_media: Math.round(media * 10) / 10, carga_semanal_std: Math.round(std * 10) / 10 }
}
```

### 3.2 `calcularACWREWMA(cargaDiaria: number[], lambda = 2/29): number`

```typescript
export function calcularACWREWMA(cargaDiaria: number[], lambda = 2 / 29): number {
  if (cargaDiaria.length === 0) return 0
  
  // EWMA: carga_cronica = lambda * carga_hoy + (1 - lambda) * carga_cronica_ayer
  let cronica = cargaDiaria[0]
  for (let i = 1; i < cargaDiaria.length; i++) {
    cronica = lambda * cargaDiaria[i] + (1 - lambda) * cronica
  }
  const aguda = cargaDiaria[cargaDiaria.length - 1] // carga de hoy
  return cronica > 0 ? Math.round((aguda / cronica) * 100) / 100 : 1
}
```

### 3.3 `calcularReadinessDiaria(params): Readiness`

```typescript
interface ReadinessInput {
  id_jugadora: string
  fecha: string
  wellness: Wellness | null
  acwr: number
  cargaAguda: number
  cargaCronica: number
  diasDesdeWellness: number
}

export function calcularReadinessDiaria(input: ReadinessInput): Readiness {
  const { wellness, acwr, cargaAguda, cargaCronica, diasDesdeWellness } = input
  
  let score = 100
  const factores = { wellness: 0, acwr: 0, carga_aguda: cargaAguda, carga_cronica: cargaCronica, dias_desde_ultimo_wellness: diasDesdeWellness }
  
  // Wellness component (0-40 pts)
  if (wellness) {
    const wScore = wellness.score_wellness // 1-10
    factores.wellness = Math.round(wScore * 10) // 10-100 → scale to 40 max
    score -= (10 - wScore) * 4 // each point below 10 costs 4 pts
  } else {
    score -= 40 // no wellness = max penalty
  }
  
  // ACWR component (0-30 pts)
  if (acwr > 1.5) score -= 30
  else if (acwr > 1.3) score -= 20
  else if (acwr > 1.0) score -= 10
  else if (acwr < 0.8) score -= 15 // undertraining
  factores.acwr = acwr
  
  // Data freshness penalty (0-20 pts)
  if (diasDesdeWellness > 3) score -= 20
  else if (diasDesdeWellness > 1) score -= 10
  
  score = Math.max(0, Math.min(100, score))
  
  let nivel: ReadinessNivel = 'verde'
  if (score < 50) nivel = 'rojo'
  else if (score < 75) nivel = 'ambar'
  
  return {
    id_jugadora: input.id_jugadora,
    fecha: input.fecha,
    nivel,
    score: Math.round(score),
    factores,
    creada: new Date().toISOString(),
  }
}
```

- [ ] **Step 3.1:** Add three functions to `calculations.ts`
- [ ] **Step 3.2:** Add unit tests in `calculations.test.ts`:
  - `calcularMonotonyStrain` with known arrays
  - `calcularACWREWMA` with synthetic 28-day load
  - `calcularReadinessDiaria` for verde/ámbar/rojo scenarios
- [ ] **Step 3.3:** Run `npm run build` — verify

---

## Task 4: Store — State + Actions for sRPE & Readiness

**Files:**
- Modify: `src/store/store.ts`

### 4.1 Add state properties

```typescript
// After rpe_partido (line ~145)
sesion_rpe: SesionRPE[]
readiness: Readiness[]
```

### 4.2 Add to `loadAll()` Promise.all

```typescript
// Add to destructuring
sesion_rpe, readiness

// Add to Promise.all
db.sesion_rpe.toArray(),
db.readiness.toArray(),

// Add to set()
sesion_rpe: sesion_rpe.sort((a, b) => b.fecha.localeCompare(a.fecha)),
readiness: readiness.sort((a, b) => b.fecha.localeCompare(a.fecha)),
```

### 4.3 Add actions

```typescript
// After addRPE_Partido (line ~253)
addSesionRPE: async (srpe: SesionRPE) => {
  const errors = validateSesionRPE(srpe)
  if (errors.length > 0) throw new Error(formatValidationErrors(errors))
  await db.sesion_rpe.put(srpe)
  set((state) => ({ sesion_rpe: [srpe, ...state.sesion_rpe] }))
  // Trigger readiness recalc for this player+date
  dispararReadiness(srpe.id_jugadora, srpe.fecha)
},

updateSesionRPE: async (srpe: SesionRPE) => {
  await db.sesion_rpe.put(srpe)
  set((state) => ({
    sesion_rpe: state.sesion_rpe.map(r => r.id === srpe.id ? srpe : r),
  }))
  dispararReadiness(srpe.id_jugadora, srpe.fecha)
},

deleteSesionRPE: async (id: number) => {
  await db.sesion_rpe.delete(id)
  set((state) => ({ sesion_rpe: state.sesion_rpe.filter(r => r.id !== id) }))
},

recalculateReadiness: async (jugadoraId: string, fecha?: string) => {
  // Recompute readiness for player (specific date or last 28 days)
  await dispararReadiness(jugadoraId, fecha)
  await get().loadAll()
},
```

### 4.4 Add helper `dispararReadiness`

```typescript
const dispararReadiness = async (jugadoraId: string, fecha?: string): Promise<void> => {
  try {
    await recalcularReadinessJugadora(jugadoraId, fecha)
  } catch (error) {
    console.error(`Error recalculating readiness for ${jugadoraId}:`, error)
  }
}
```

### 4.5 Import new validation function (create in Task 5) and service

- [ ] **Step 4.1:** Add state properties
- [ ] **Step 4.2:** Extend `loadAll()`
- [ ] **Step 4.3:** Add `addSesionRPE`, `updateSesionRPE`, `deleteSesionRPE`, `recalculateReadiness`
- [ ] **Step 4.4:** Add `dispararReadiness` helper
- [ ] **Step 4.5:** Run `npm run build`

---

## Task 5: Validation — SesionRPE

**Files:**
- Modify: `src/utils/validation.ts`
- Modify: `src/utils/validation.test.ts`

```typescript
// Add to validation.ts
export function validateSesionRPE(srpe: SesionRPE): ValidationError[] {
  const errors: ValidationError[] = []
  if (!srpe.id_sesion?.trim()) errors.push({ field: 'id_sesion', message: 'ID de sesión requerido' })
  if (!srpe.id_jugadora?.trim()) errors.push({ field: 'id_jugadora', message: 'Jugadora requerida' })
  if (srpe.rpe < 1 || srpe.rpe > 10) errors.push({ field: 'rpe', message: 'RPE debe ser 1-10' })
  if (srpe.duracion_min <= 0) errors.push({ field: 'duracion_min', message: 'Duración debe ser > 0' })
  if (!srpe.fecha) errors.push({ field: 'fecha', message: 'Fecha requerida' })
  return errors
}
```

- [ ] **Step 5.1:** Add `validateSesionRPE` to `validation.ts`
- [ ] **Step 5.2:** Add tests in `validation.test.ts`
- [ ] **Step 5.3:** Export from `validation.ts`
- [ ] **Step 5.4:** Run `npm run build`

---

## Task 6: Service — Readiness Recalculation (28-day EWMA)

**Files:**
- Create: `src/services/readiness.ts`

```typescript
import { db } from '@/db/database'
import { calcularACWREWMA, calcularReadinessDiaria, calcularMonotonyStrain } from '@/utils/calculations'
import type { Readiness, SesionRPE, Wellness, ResumenSemanal } from '@/types'
import { parseISO, subDays, format, addDays } from 'date-fns'

export async function recalcularReadinessJugadora(jugadoraId: string, fechaObjetivo?: string): Promise<void> {
  const [sesionesRPE, wellness, resumenes] = await Promise.all([
    db.sesion_rpe.where({ id_jugadora: jugadoraId }).toArray(),
    db.wellness.where({ id_jugadora: jugadoraId }).toArray(),
    db.resumen_semanal.where({ id_jugadora: jugadoraId }).toArray(),
  ])

  // Build daily load map for last 28 days
  const hoy = fechaObjetivo ? parseISO(fechaObjetivo) : new Date()
  const hace28 = subDays(hoy, 27)
  
  const cargaDiariaMap = new Map<string, number>()
  for (const rpe of sesionesRPE) {
    const d = rpe.fecha
    if (d >= format(hace28, 'yyyy-MM-dd') && d <= format(hoy, 'yyyy-MM-dd')) {
      cargaDiariaMap.set(d, (cargaDiariaMap.get(d) || 0) + rpe.carga_ua)
    }
  }

  // Fill missing days with 0
  const cargaDiaria: number[] = []
  for (let d = hace28; d <= hoy; d = addDays(d, 1)) {
    const key = format(d, 'yyyy-MM-dd')
    cargaDiaria.push(cargaDiariaMap.get(key) || 0)
  }

  const acwr = calcularACWREWMA(cargaDiaria)
  const cargaAguda = cargaDiaria[cargaDiaria.length - 1]
  const cargaCronica = cargaDiaria.reduce((a, b) => a + b, 0) / 28

  // Determine date range to compute readiness
  const fechas = fechaObjetivo ? [fechaObjetivo] : Array.from(cargaDiariaMap.keys()).slice(-7)

  for (const fecha of fechas) {
    const w = wellness.find(w => w.fecha === fecha) || null
    const diasDesdeWellness = w ? 0 : wellness.length > 0 
      ? Math.ceil((new Date(fecha).getTime() - new Date(wellness[0].fecha).getTime()) / 86400000)
      : 99

    const readiness = calcularReadinessDiaria({
      id_jugadora: jugadoraId,
      fecha,
      wellness: w,
      acwr,
      cargaAguda,
      cargaCronica,
      diasDesdeWellness,
    })

    await db.readiness.put(readiness)
  }
}
```

**Imports needed:** `parseISO`, `subDays`, `format`, `addDays` from `date-fns`

- [ ] **Step 6.1:** Create `src/services/readiness.ts`
- [ ] **Step 6.2:** Import in `store.ts` and use in `dispararReadiness`
- [ ] **Step 6.3:** Run `npm run build`

---

## Task 7: SessionsPage — sRPE Entry Modal

**Files:**
- Modify: `src/pages/SessionsPage.tsx`

**Changes:**
- Add "RPE" button column in DataTable for each session
- Click opens modal to enter RPE per player for that session
- Pre-fill duration from session, compute carga_ua = rpe * duracion

```typescript
// New state
const [rpeModalOpen, setRpeModalOpen] = useState(false)
const [rpeSession, setRpeSession] = useState<Sesion | null>(null)
const [rpeEntries, setRpeEntries] = useState<Record<string, { rpe: number }>>({})

// In DataTable actions column:
<button onClick={() => openRpeModal(s)} className="text-[10px] text-primary-600 hover:underline mr-2">
  RPE
</button>

// openRpeModal(sesion):
// - Fetch active players
// - Load existing sesion_rpe for this session
// - Pre-populate rpeEntries
// - Open modal

// Modal: grid of players with RPE input (1-10), save all on submit
// Calls addSesionRPE for each player with rpe > 0
```

- [ ] **Step 7.1:** Add state for RPE modal
- [ ] **Step 7.2:** Add RPE button to actions column
- [ ] **Step 7.3:** Create `openRpeModal` function
- [ ] **Step 7.4:** Build RPE modal UI (player list + RPE inputs)
- [ ] **Step 7.5:** Handle save → call `addSesionRPE` for each entry
- [ ] **Step 7.6:** Test in dev server

---

## Task 8: Dashboard — ReadinessTrafficLight Component

**Files:**
- Create: `src/components/dashboard/ReadinessTrafficLight.tsx`
- Modify: `src/pages/DashboardPage.tsx`

### 8.1 ReadinessTrafficLight.tsx

```tsx
import { useStore } from '@/store/store'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

export function ReadinessTrafficLight() {
  const { jugadoras, readiness } = useStore()

  const hoy = useMemo(() => new Date().toISOString().split('T')[0], [])
  const readinessHoy = useMemo(() => 
    readiness.filter(r => r.fecha === hoy), [readiness, hoy])

  const jugadoresConReadiness = jugadoras
    .filter(j => j.activa)
    .map(j => {
      const r = readinessHoy.find(r => r.id_jugadora === j.id_jugadora)
      return { jugadora: j, readiness: r }
    })
    .sort((a, b) => {
      const orden = { rojo: 0, ambar: 1, verde: 2, sin_datos: 3 }
      const na = a.readiness?.nivel || 'sin_datos'
      const nb = b.readiness?.nivel || 'sin_datos'
      return orden[na] - orden[nb]
    })

  return (
    <div className="bg-white rounded-lg border border-surface-200 p-4">
      <h3 className="text-xs font-semibold text-surface-700 mb-3">Readiness Diaria ({hoy})</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {jugadoresConReadiness.map(({ jugadora, readiness }) => {
          const nivel = readiness?.nivel || 'sin_datos'
          const color = nivel === 'rojo' ? 'bg-red-500' : nivel === 'ambar' ? 'bg-amber-500' : nivel === 'verde' ? 'bg-green-500' : 'bg-surface-300'
          const label = nivel === 'rojo' ? '🔴' : nivel === 'ambar' ? '🟡' : nivel === 'verde' ? '🟢' : '⚪'
          
          return (
            <Link key={jugadora.id_jugadora} to={`/jugadoras/${jugadora.id_jugadora`} className="block">
              <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full {color}"></span>
                  <span className="text-xs font-medium text-surface-800">{jugadora.nombre}</span>
                  <span className="text-[10px] text-surface-500">{jugadora.posicion}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span>{label}</span>
                  {readiness && (
                    <span className="font-mono text-surface-600">{readiness.score}</span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

### 8.2 Add to DashboardPage.tsx

```tsx
// Import
import { ReadinessTrafficLight } from '@/components/dashboard/ReadinessTrafficLight'

// In JSX, add to grid (after AlertsWidget or new row)
<div className="col-span-1 lg:col-span-2">
  <ReadinessTrafficLight />
</div>
```

- [ ] **Step 8.1:** Create `ReadinessTrafficLight.tsx`
- [ ] **Step 8.2:** Import and add to `DashboardPage.tsx`
- [ ] **Step 8.3:** Adjust grid layout if needed
- [ ] **Step 8.4:** Test in dev server

---

## Task 9: KPI Cards — Monotony & Strain

**Files:**
- Modify: `src/components/dashboard/KPICards.tsx`

```tsx
// Add to KPICards grid (import useStore)
const { sesion_rpe } = useStore()

// Compute weekly monotony/strain for team
const cargasDiariasEquipo = useMemo(() => {
  const map = new Map<string, number>()
  for (const r of sesion_rpe) {
    const d = r.fecha
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    if (new Date(d) >= weekAgo) {
      map.set(d, (map.get(d) || 0) + r.carga_ua)
    }
  }
  return Array.from(map.values())
}, [sesion_rpe])

const { monotonia, strain } = calcularMonotonyStrain(cargasDiariasEquipo)

// Add KPICard
<KPICard label="Monotonía (7d)" value={monotonia.toFixed(2)} icon="📊" />
<KPICard label="Strain (7d)" value={Math.round(strain)} subtitle="UA" icon="⚡" />
```

- [ ] **Step 9.1:** Import `calcularMonotonyStrain` and `useStore`
- [ ] **Step 9.2:** Compute team daily loads for last 7 days
- [ ] **Step 9.3:** Add two KPICards
- [ ] **Step 9.4:** Test in dev server

---

## Task 10: PlayerProfile — Show Readiness History

**Files:**
- Modify: `src/pages/PlayerProfilePage.tsx`

```tsx
// In 'resumen' or new 'readiness' tab
const readinessJug = readiness.filter(r => r.id_jugadora === id).sort((a,b) => b.fecha.localeCompare(a.fecha)).slice(0, 14)

// Add tab to tabs array: { key: 'readiness', label: 'Readiness' }

// Render 14-day history with colored dots
<div className="space-y-1">
  {readinessJug.map(r => (
    <div key={r.fecha} className="flex items-center justify-between px-2 py-1.5 text-xs border-b border-surface-100">
      <span>{r.fecha.slice(5)}</span>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${r.nivel === 'rojo' ? 'bg-red-500' : r.nivel === 'ambar' ? 'bg-amber-500' : r.nivel === 'verde' ? 'bg-green-500' : 'bg-surface-300'}`}></span>
        <span className="font-mono">{r.score}</span>
        <span className="text-[10px] text-surface-500">ACWR: {r.factores.acwr.toFixed(2)}</span>
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 10.1:** Import `readiness` from store
- [ ] **Step 10.2:** Add 'readiness' tab
- [ ] **Step 10.3:** Render 14-day readiness history
- [ ] **Step 10.4:** Test in dev server

---

## Task 11: Auto-Readiness on Data Changes

**Files:**
- Modify: `src/store/store.ts`

```typescript
// In addWellness, updateWellness, addSesionRPE, addRPE_Entreno, addRPE_Partido:
// After successful DB write, call dispararReadiness(jugadoraId, fecha)

// In addWellness:
dispararReadiness(w.id_jugadora, w.fecha)

// In addSesionRPE:
dispararReadiness(srpe.id_jugadora, srpe.fecha)

// In addRPE_Entreno:
dispararReadiness(r.id_jugadora, r.fecha)

// In addRPE_Partido:
dispararReadiness(r.id_jugadora, r.fecha)
```

- [ ] **Step 11.1:** Add `dispararReadiness` calls to all relevant mutations
- [ ] **Step 11.2:** Test: enter wellness → check readiness updates
- [ ] **Step 11.3:** Test: enter sRPE → check readiness updates

---

## Task 12: Build Verification & Manual Testing

- [ ] **Step 12.1:** Run `npm run lint` — fix any oxlint errors
- [ ] **Step 12.2:** Run `npm run build` — must pass
- [ ] **Step 12.3:** Run `npm run dev` — manual verification:
  1. Login with `futsal2024`
  2. Create session → click RPE button → enter RPE for 3 players
  3. Go to Dashboard → verify ReadinessTrafficLight shows colors
  4. Verify KPI cards show Monotonía/Strain
  5. Go to player profile → verify Readiness tab shows 14-day history
  6. Add wellness for a player → verify readiness recalculates
  7. Export weekly summary → verify no regressions

---

## Task 13: Seed Data — Add Sample sRPE

**Files:**
- Modify: `src/utils/seed.ts`

```typescript
// In seedDatabase(), after creating sessions:
const sesionesCreadas = await db.sesiones.toArray()
for (const sesion of sesionesCreadas.slice(0, 5)) {
  for (const jug of jugadoras.filter(j => j.activa).slice(0, 3)) {
    await db.sesion_rpe.put({
      id_sesion: sesion.id_sesion,
      id_jugadora: jug.id_jugadora,
      rpe: Math.floor(Math.random() * 4) + 6, // 6-10
      duracion_min: sesion.duracion_min,
      carga_ua: 0, // will be computed
      fecha: sesion.fecha,
    })
  }
}
```

- [ ] **Step 13.1:** Add sRPE seed data
- [ ] **Step 13.2:** Run `seedDemoData` from Dashboard → verify data loads

---

## Summary Checklist

| Task | Component | Verification |
|------|-----------|--------------|
| 1 | Types | `npm run build` passes |
| 2 | DB Schema v4 | `npm run build` passes |
| 3 | Calculations | Unit tests pass |
| 4 | Store | `npm run build` passes |
| 5 | Validation | Unit tests pass |
| 6 | Readiness Service | `npm run build` passes |
| 7 | SessionsPage RPE Modal | Manual: enter RPE per player |
| 8 | ReadinessTrafficLight | Dashboard shows colored dots |
| 9 | KPI Monotony/Strain | Dashboard shows values |
| 10 | PlayerProfile Readiness tab | 14-day history visible |
| 11 | Auto-readiness | Wellness/sRPE → readiness updates |
| 12 | Full Build + Lint | Clean |
| 13 | Seed Data | Demo data loads |

---

## Notes for Implementation

1. **Order matters:** Tasks 1-6 are foundations (types, DB, calculations, store). Tasks 7-11 are UI. Do 1-6 first completely.

2. **date-fns imports:** Use named imports: `import { parseISO, subDays, format, addDays } from 'date-fns'`

3. **TypeScript strictness:** No `any`. Use `SesionRPE`, `Readiness` types everywhere.

4. **Dexie async:** All DB calls return promises. Use `await` in store actions.

5. **Zustand updates:** Always return new arrays/objects for reactivity: `[newItem, ...state.items]`

6. **Spanish UI:** All labels, tooltips, messages in Spanish.

7. **No new dependencies:** Recharts, date-fns, zustand, dexie already installed.

8. **Manual testing:** Since no test runner, verify each feature in browser at `http://localhost:5173`