# Task 4: Store — State + Actions for sRPE & Readiness

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

### 4.5 Import new validation function (Task 5) and readiness service (Task 6)

- [ ] **Step 4.1:** Add state properties
- [ ] **Step 4.2:** Extend `loadAll()`
- [ ] **Step 4.3:** Add `addSesionRPE`, `updateSesionRPE`, `deleteSesionRPE`, `recalculateReadiness`
- [ ] **Step 4.4:** Add `dispararReadiness` helper
- [ ] **Step 4.5:** Run `npm run build`

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

This is Task 4 of Phase 1. It adds state and actions for the sRPE and readiness features:

1. **`sesion_rpe`** state — Session RPE entries (computed from SessionsPage modal)
2. **`readiness`** state — Daily readiness scores (computed by Task 6 service)
3. **Actions** — CRUD for SesionRPE and readiness recalculation
4. **Auto-readiness triggers** — Recalculate readiness when:
   - Wellness is updated (`addWellness`, `updateWellness`)
   - RPE Entreno is updated (`addRPE_Entreno`)
   - RPE Partido is updated (`addRPE_Partido`)
   - Session RPE is updated (`addSesionRPE`)

Follow existing Zustand patterns in this file exactly.

---

## Report File

Write your full report to: `.opencode/plans/task-4-report.md`

---

## Work Directory

`C:\Users\olive\OneDrive - Universidade da Coruña\Documentos\New OpenCode Project\futsal-monitor`