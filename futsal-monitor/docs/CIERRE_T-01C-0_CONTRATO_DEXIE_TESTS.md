# CIERRE T-01C-0 — Contrato Dexie en Tests

**Ticket:** T-01C-0 — Saneamiento final de contrato Dexie en tests  
**Fecha de cierre:** 2026-07-31  
**Precondición:** T-01A-1, T-01A-2, T-01B, T-01B-R cerrados  

---

## Objetivo

Eliminar del código productivo los fallbacks `typeof db.table?.where === 'function'`
y `toArray().then(items => items.filter(...))` introducidos en T-01B-R, sustituyéndolos
por llamadas Dexie indexadas directas. Actualizar mocks de Vitest para que representen
el contrato real de Dexie con soporte de `.where('campo').equals(valor)`.

---

## Cambios implementados

### `src/store/store.ts` — `evaluarSeguimientoJugadoraDexie`

**Antes (T-01B-R):**
```ts
const resumenItems = typeof db.resumen_semanal?.where === 'function'
  ? await db.resumen_semanal.where('id_jugadora').equals(jugadoraId).toArray()
  : await db.resumen_semanal.toArray().then(items => items.filter(...))
```

**Después (T-01C-0):**
```ts
const resumenItems = await db.resumen_semanal.where('id_jugadora').equals(jugadoraId).toArray()
const wellnessItems = await db.wellness.where('id_jugadora').equals(jugadoraId).toArray()
const cicloItems    = await db.ciclo_menstrual.where('id_jugadora').equals(jugadoraId).toArray()
const alertasItems  = await db.alertas.where('id_jugadora').equals(jugadoraId).toArray()
```

Garantía mantenida: **ningún dato de jugadora X puede mezclarse con datos de jugadora Y**.

### `src/test/setup.ts` — `mockWhereClause`

Añadido helper `mockWhereClause` que provee a todos los mocks de tablas Dexie
la cadena `.where(campo).equals(valor).toArray()` y `.first()`, representando
el contrato real de `WhereClause` de Dexie.

Tablas actualizadas: `jugadoras`, `wellness`, `sesiones`, `partidos`, `lesiones`,
`tests_fisicos`, `rpe_partido`, `resumen_semanal`, `alertas`, `sesion_rpe`,
`readiness`, `ciclo_menstrual`.

### Archivos de test con mocks locales actualizados

- `src/store/saveRpeBatchAtomicity.test.ts` — añadido `equals()` a todos los `where()`
- `src/store/importFormResponsesAtomicity.test.ts` — añadido `equals()` a todos los `where()` y `mockReturnValue`

---

## Validación

| Comando | Resultado |
|---------|-----------|
| `npx vitest run src/store/alertsPosCommit.test.ts` | ✅ 24/24 PASS |
| `npx vitest run src/store/saveRpeBatchAtomicity.test.ts` | ✅ 3/3 PASS |
| `npx vitest run src/store/importFormResponsesAtomicity.test.ts` | ✅ 6/6 PASS |
| `npm run test` | ✅ 534/534 PASS |
| `npm run lint` | ✅ 0 warnings, 0 errors |
| `npm run build` | ✅ Clean build |

---

## Invariante central preservado

> Una alerta evaluada para `id_jugadora = X` solo puede usar datos pertenecientes a `X`.

Los tests T-2H-13 (Aislamiento Multijugadora Estricto) y T-2H-14 (Evaluación Jugadora C sin registros) confirman el aislamiento completo.

---

## Veredicto

**T-01C-0: CERRADO**

---

## Ampliación de alcance documentada

### Archivos adicionales modificados (más allá del plan original)

Demandados por la eliminación de los fallbacks en `store.ts`, que ahora exige
el contrato real `.where(campo).equals(valor)` en lugar de `.toArray()` simple:

| Archivo | Tipo de cambio | Razón |
|---------|---------------|--------|
| `src/test/setup.ts` | Mock compartido | Añadido `mockWhereClause`: `.where().equals().toArray()` y `.first()` para todas las tablas |
| `src/store/saveRpeBatchAtomicity.test.ts` | Mock local | Los mocks de `resumen_semanal`, `alertas`, `sesion_rpe`, `readiness`, `wellness`, `ciclo_menstrual` no exponían `.equals()` |
| `src/store/importFormResponsesAtomicity.test.ts` | Mock local + `mockReturnValue` | Los mocks locales y cuatro llamadas `vi.mocked(db.wellness.where).mockReturnValue(...)` no incluían `.equals()` |

### Motivo técnico

El código productivo `evaluarSeguimientoJugadoraDexie` fue refactorizado para usar
directamente `.where('id_jugadora').equals(jugadoraId).toArray()`. Cuando un test
usa `vi.mock` local que solo provee `.where(...) => { toArray }` (sin `.equals()`),
el código productivo lanza `TypeError: db.tabla.where(...).equals is not a function`.
Este error es capturado por el `try/catch` del bloque `[2H]`, por lo que los tests
seguían pasando, pero el bloque `[2H]` operaba en modo error silencioso.

Los tests `T-2H-13` y `T-2H-14` que verifican aislamiento por jugadora no dependían
de los mocks locales de estos archivos, por lo que permanecían verdes. Sin embargo,
arreglar los mocks locales elimina el error silencioso y garantiza que `[2H]` funcione
correctamente bajo las condiciones de aislamiento esperadas.

### Resultado de tests tras la ampliación

| Archivo | Tests relevantes |
|---------|------------------|
| `src/store/saveRpeBatchAtomicity.test.ts` | 3/3 PASS (sin errores silenciosos) |
| `src/store/importFormResponsesAtomicity.test.ts` | 6/6 PASS (sin errores silenciosos) |
| `src/store/alertsPosCommit.test.ts` | 24/24 PASS |

### Sin cambios funcionales

No se modificó ninguna regla de negocio, umbral, cálculo de alertas, readiness,
carga, ACWR, EWMA, monotony, strain, UI, rutas, importadores, backups,
exportaciones ni configuración.
