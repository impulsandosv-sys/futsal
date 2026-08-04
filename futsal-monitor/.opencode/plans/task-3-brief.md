# Task 3: Calculations — Monotony/Strain, EWMA ACWR, Daily Readiness

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

This is Task 3 of Phase 1. It implements the mathematical utilities for the new sRPE + EWMA ACWR + readiness system:

1. **`calcularMonotonyStrain`** — Team weekly load variability (mean/std × weekly load)
2. **`calcularACWREWMA`** — Exponentially weighted moving average ACWR (lambda = 2/29)
3. **`calcularReadinessDiaria`** — Daily player readiness score (0-100, verde/ámbar/rojo)

These functions will be used by:
- **Task 4:** Zustand store readiness recalculation
- **Task 6:** Readiness service (28-day EWMA)
- **Task 8:** Dashboard widget and KPI cards

Follow existing calculation patterns in this file exactly.

---

## Report File

Write your full report to: `.opencode/plans/task-3-report.md`

---

## Work Directory

`C:\Users\olive\OneDrive - Universidade da Coruña\Documentos\New OpenCode Project\futsal-monitor`