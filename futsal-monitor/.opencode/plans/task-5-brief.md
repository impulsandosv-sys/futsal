# Task 5: Validation — SesionRPE

**Files:**
- Modify: `src/utils/validation.ts`
- Modify: `src/utils/validation.test.ts`

### 5.1 `validateSesionRPE(srpe: SesionRPE): ValidationError[]`

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

This is Task 5 of Phase 1. It adds validation function for the new `SesionRPE` type, following existing validation patterns in the codebase.

The validation function must check:
- Required fields: `id_sesion`, `id_jugadora`, `rpe`, `duracion_min`, `fecha`
- Range validation: `rpe` (1-10), `duracion_min` (> 0)
- Follow existing validation patterns and use Spanish error messages

This validation will be used by Task 4's `addSesionRPE` and `updateSesionRPE` actions.

---

## Report File

Write your full report to: `.opencode/plans/task-5-report.md`

---

## Work Directory

`C:\Users\olive\OneDrive - Universidade da Coruña\Documentos\New OpenCode Project\futsal-monitor`