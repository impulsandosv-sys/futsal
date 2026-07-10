# Task 1: Domain Types — sRPE, Readiness, Monotony/Strain

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

This is the first task of Phase 1. It adds the core domain types for:
- Session RPE per player (sRPE) — extends existing RPE_Entreno/RPE_Partido
- Monotony/Strain metrics — team-level weekly load variability
- Readiness — daily traffic-light status per player (verde/ámbar/rojo)

These types will be used by subsequent tasks (DB schema, calculations, store, UI).

---

## Report File

Write your full report to: `.opencode/plans/task-1-report.md`

---

## Work Directory

`C:\Users\olive\OneDrive - Universidade da Coruña\Documentos\New OpenCode Project\futsal-monitor`