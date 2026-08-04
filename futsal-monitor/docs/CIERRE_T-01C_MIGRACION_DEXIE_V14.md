# CIERRE T-01C — Migración Dexie v14 — Índices Compuestos

**Ticket:** T-01C — Migración Dexie v14 de índices compuestos justificados  
**Fecha de cierre original:** 2026-07-31  
**Rectificación (T-01C-R):** 2026-07-31 — Eliminado índice no justificado en `sesion_rpe`  
**Precondición:** T-01C-0 cerrado  

---

## Objetivo

Añadir índices compuestos Dexie en las **dos** tablas que producían warnings de consola
por consultas `where({ key1, key2 })` sin índice compuesto existente. Verificar que
la migración preserva al 100% todos los datos existentes y que las nuevas consultas
funcionan sin degradación.

> **Nota de rectificación:** La definición inicial de T-01C incluía erróneamente
> `sesion_rpe` con `[id_jugadora+fecha]`. Ninguna query productiva usa esa combinación
> compuesta en `sesion_rpe`. Dicho índice fue eliminado en T-01C-R. Ver
> `docs/CIERRE_T-01C-R_RECTIFICACION_V14.md`.

---

## Evidencia de warnings (pre-v14)

Auditoría T-01C (Agente C) identificó:

| Tabla | Consulta con warning | Código |
|-------|---------------------|--------|
| `readiness` | `where({ id_jugadora, fecha })` | `store.ts:437,496`, `readiness.ts:56`, `readinessMaintenance.ts:110` |
| `rpe_partido` | `where({ id_partido, id_jugadora })` | `store.ts:1160-1161`, `rpePartidoRealDB.test.ts:78,197` |
| `sesion_rpe` | `where({ id_jugadora })` — **clave única, sin warning** | `readiness.ts:9` |

`wellness` ya tenía `[id_jugadora+fecha]` en v11 → sin warning.

`sesion_rpe` usa `where({ id_sesion })` y `where('id_sesion').equals()` → índices simples existentes, sin warning compuesto reproducible.

---

## Cambio en `src/db/database.ts`

```typescript
// Versión 14.0 - Índices compuestos para readiness y rpe_partido
this.version(14).stores({
  readiness:   '++id, [id_jugadora+fecha], id_jugadora, fecha',
  rpe_partido: '++id, [id_partido+id_jugadora], id_jugadora, id_partido, fecha'
})
// sesion_rpe excluida: ninguna query productiva usa { id_jugadora, fecha } compuesto
```

**Sin callback `upgrade()`** — Dexie construye los B-Tree automáticamente sobre registros existentes al abrir la BD con la nueva versión.

---

## Test de migración: `src/db/databaseMigrationV14.test.ts`

11 tests implementados con `fake-indexeddb/auto`:

| Test | Descripción |
|------|-------------|
| M-01 | BD migra a `verno === 14` |
| M-02 | `readiness` preserva todos los registros, valores y fechas |
| M-03 | `sesion_rpe` preserva todos los registros, valores y fechas (índice heredado v13) |
| M-04 | `rpe_partido` preserva todos los registros, valores y fechas |
| M-05 | `readiness.where('[id_jugadora+fecha]').equals([id, fecha])` funciona |
| M-05b | `readiness.where({ id_jugadora, fecha })` resuelve por índice compuesto |
| M-05c | `readiness.where({}).first()` funciona para búsqueda puntual |
| M-06 | `sesion_rpe` conserva índice heredado `id_sesion` tras migración v14 (NO recibe compuesto) |
| M-07 | `rpe_partido.where('[id_partido+id_jugadora]').equals([id_p, id_j])` funciona |
| M-07b | `rpe_partido.where({ id_partido, id_jugadora })` resuelve por índice compuesto |
| M-08 | Aislamiento: índice compuesto de readiness no mezcla datos de jugadoras distintas |

---

## Validación (post T-01C-R)

| Comando | Resultado |
|---------|-----------|
| `npx vitest run src/db/databaseMigrationV14.test.ts --reporter=verbose` | ✅ 11/11 PASS |
| `npm run test` | ✅ 545/545 PASS |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm run build` | ✅ Clean build |

---

## Matriz de índices post-v14 (versión final)

| Tabla | Índice compuesto v14 | Consultas cubiertas | Decisión |
|-------|---------------------|---------------------|---------|
| `readiness` | `[id_jugadora+fecha]` | `where({ id_jugadora, fecha })` en store.ts y readiness.ts | **AÑADIDO** |
| `rpe_partido` | `[id_partido+id_jugadora]` | `where({ id_partido, id_jugadora })` en store.ts:1160 | **AÑADIDO** |
| `sesion_rpe` | *(ninguno nuevo)* | Solo `where({ id_sesion })` y `where('id_sesion').equals()` — sin warning | **EXCLUIDA** |
| `wellness` | ya existía `[id_jugadora+fecha]` desde v11 | no modificada | **SIN CAMBIO** |

---

## Veredicto

**T-01C: CERRADO** *(con rectificación T-01C-R aplicada)*
