# Task 6: Dashboard — ReadinessTrafficLight Component

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Create: `src/components/dashboard/ReadinessTrafficLight.tsx` (new file)

### 6.1 Create ReadinessTrafficLight Component

**New Component File:** `src/components/dashboard/ReadinessTrafficLight.tsx`

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
            <Link key={jugadora.id_jugadora} to={`/jugadoras/${jugadora.id_jugadora}`} className="block">
              <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${color}`}></span>
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

### 6.2 Add to DashboardPage.tsx

**Changes to:** `src/pages/DashboardPage.tsx`

```tsx
// Import
import { ReadinessTrafficLight } from '@/components/dashboard/ReadinessTrafficLight'

// In JSX, add to grid (after AlertsWidget or new row)
<div className="col-span-1 lg:col-span-2">
  <ReadinessTrafficLight />
</div>
```

- [ ] **Step 6.1:** Create `ReadinessTrafficLight.tsx` file in `src/components/dashboard/`
- [ ] **Step 6.2:** Import in `DashboardPage.tsx`
- [ ] **Step 6.3:** Add to DashboardPage JSX (find existing grid section, add new row/column)
- [ ] **Step 6.4:** Run `npm run build` — verify no type errors
- [ ] **Step 6.5:** Test in dev server — verify ReadinessTrafficLight displays correctly

---

## Global Constraints (from plan)

- TypeScript: `erasableSyntaxOnly: true` — no enums, namespaces, parameter properties; use union types, `const` objects
- Path alias: `@/` → `src/` — all imports use `@/types`, `@/utils`, `@/components`, etc.
- Domain language: Spanish — types, routes, UI text, comments
- Auth: hardcoded `futsal2024` local login only
- Data: 100% local IndexedDB via Dexie — no backend/API
- Lint: `npm run lint` (oxlint) — no eslint config exists
- Build: `npm run build` (tsc -b && vite build) — must pass
- No test framework configured — manual verification via `npm run dev`

---

## Context

This is Task 6 of Phase 1. It adds the daily readiness traffic-light indicator to the main Dashboard.

**Purpose:** Show quick daily readiness overview for all active players:
- Green (🟢) = Good readiness (score 75-100)
- Yellow (🟡) = Medium (score 50-74)
- Red (🔴) = Low (score 0-49) or No data
- Left-aligned by risk level
- Links to player profile for full details
- Updated automatically via auto-readiness triggers

Follow existing Dashboard component patterns exactly.

---

## Report File

Write your full report to: `.opencode/plans/task-6-report.md`

---

## Work Directory

`C:\Users\olive\OneDrive - Universidade da Coruña\Documentos\New OpenCode Project\futsal-monitor`