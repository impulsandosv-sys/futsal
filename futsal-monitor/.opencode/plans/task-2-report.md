# Task 2 Report: Database Schema — sesion_rpe + readiness tables (Dexie v4)

## Summary

Successfully extended the Dexie database schema from version 3 to version 4, adding two new tables:

1. **`sesion_rpe`** table — Stores per-session RPE entries (one per player per session)
2. **`readiness`** table — Daily readiness scores (one per player per day)

The new tables follow existing Dexie patterns with auto-increment primary keys (`++id`) and useful composite indexes for lookups.

## Changes Made

**File Modified:** `src/db/database.ts`

1. **Import Updates:** Added `SesionRPE` and `Readiness` to the existing import from `@/types`

2. **Database Schema Versioning:** 
   - Added version 4: `this.version(4).stores({...})`
   - Maintained all existing definitions from v3
   - Added new tables with appropriate composite indexes

3. **Table Property Declarations:** Added new property declarations inside the class:
   ```typescript
   sesion_rpe!: Dexie.Table<SesionRPE, number>
   readiness!: Dexie.Table<Readiness, number>
   ```

## Verification

- **Build:** `npm run build` — ✓ passes (tsc -b + vite build)
- **Lint:** `npm run lint` (oxlint) — ✓ passes (0 warnings, 0 errors)

## Compliance with Constraints

- ✅ TypeScript `erasableSyntaxOnly: true` — no enums, namespaces, or parameter properties; used union types and `const` objects
- ✅ Path alias `@/` → `src/` — imports use `@/types`
- ✅ Domain language: Spanish — all types, fields, comments in Spanish
- ✅ Dexie patterns: followed existing schema structure exactly
- ✅ No breaking changes: maintained compatibility with previous versions

## Commit

`363b98e` — feat(types): add sRPE, MonotonyStrain, Readiness domain types (Task 1) + dexie schema v4 (Task 2)

## Notes

- The new tables enable storing sRPE and daily readiness data for Tasks 3-13
- Follow existing Dexie pattern: `++id` primary key + composite indexes
- Ready for implementation in Tasks 3-13

## Tasks Ready for Implementation

- **Task 3:** Calculations — Monotony/Strain, EWMA ACWR, Daily Readiness
- **Task 4:** Store — Zustand state + actions
- **Task 5:** Validation — SesionRPE validation
- **Task 6:** Service — Readiness recalculation
- **Task 7:** SessionsPage — RPE entry modal
- **Task 8:** Dashboard — ReadinessTrafficLight widget
- **Task 9:** KPI Cards — Monotony/Strain KPIs
- **Task 10:** PlayerProfile — Readiness history tab
- **Task 11:** Auto-readiness triggers
- **Task 12:** Build verification
- **Task 13:** Seed data