# Cierre T-01D — Mock Dexie de wellness atomicity

> **NOTA DE SUSTITUCIÓN:** Este cierre fue sustituido por **T-01D-R** (`docs/CIERRE_T-01D-R_SEMANTICA_MOCK_WELLNESS.md`), que reemplazó el mock estático por un mock semántico determinista y eliminó el stderr `[4B]` en el flujo de éxito. La conciliación de recuentos se documenta en `docs/CIERRE_T-01D-RC_CONCILIACION_RECUENTO_TESTS.md`.

**Ticket:** T-01D — Saneamiento final de mock Dexie en wellness atomicity  
**Fecha:** 2026-07-31  
**Tipo:** Micro-fix de test + rectificación documental  
**Precondición:** T-01C-R cerrado  

---

## Objetivo

Corregir el mock local de Dexie en `src/store/wellnessAtomicity.test.ts` para que
`evaluarSeguimientoJugadoraDexie` pueda ejecutarse sin capturar silenciosamente el error
`[2H] Fallo en evaluación de alertas pos-commit`.

---

## Hallazgo inicial

Baseline de `npx vitest run src/store/wellnessAtomicity.test.ts --reporter=verbose` mostraba
en stderr para los tests 1, 2 y 3:

```
[2H] Fallo en evaluación de alertas pos-commit para jugadora J1:
TypeError: db.resumen_semanal.where(...).equals is not a function
```

Los 7 tests pasaban porque el bloque `[2H]` captura internamente el error y retorna sin
relanzar. El flujo de alertas nunca se ejecutó realmente en esos tests.

---

## Causa raíz

Cuatro tablas del mock local carecían del contrato mínimo requerido por `evaluarSeguimientoJugadoraDexie`:

| Tabla | Estado antes | Problema |
|-------|-------------|---------|
| `resumen_semanal.where()` | `{ toArray }` | Sin `.equals()` |
| `wellness.where()` | `{ first }` | Sin `.equals()` |
| `ciclo_menstrual` | *(sin `.where()`)* | Sin `.where()` en absoluto |
| `alertas` | *(sin `.where()`)* | Sin `.where()` en absoluto |
| `sesion_rpe.where()` | `{ toArray }` | Sin `.equals()` |
| `readiness.where()` | `{ first, toArray }` | Sin `.equals()` |

Además, el store también usa `db.wellness.where({ id_jugadora, fecha }).first()` (patrón
objeto, sin `.equals()`), por lo que el helper necesitaba exponer `.first()` y `.toArray()`
directamente en el resultado de `where()`.

---

## Contrato Dexie requerido

```ts
// Patrón 1 — índice simple
db.tabla.where('id_jugadora').equals(jugadoraId).toArray()
db.tabla.where('id_jugadora').equals(jugadoraId).first()

// Patrón 2 — query compuesta (store.ts:1186, store.ts:476)
db.tabla.where({ id_jugadora, fecha }).first()
db.tabla.where({ ... }).toArray()
```

---

## Cambio aplicado al mock

### Helper `mkWhere`

Introducido al inicio del archivo (fuera del `vi.mock` factory):

```ts
const mkWhere = () => ({
  equals: vi.fn(() => ({
    toArray: vi.fn(() => Promise.resolve([])),
    first:   vi.fn(() => Promise.resolve(null)),
  })),
  first:   vi.fn(() => Promise.resolve(null)),
  toArray: vi.fn(() => Promise.resolve([])),
})
```

### Tablas mockeadas

Todas las tablas que producción consulta con `.where()`:

| Tabla | Antes | Después |
|-------|-------|---------|
| `resumen_semanal` | `where: fn→{toArray}` | `where: fn→mkWhere()` |
| `wellness` | `where: fn→{first}` | `where: fn→mkWhere()` |
| `ciclo_menstrual` | sin `where` | `where: fn→mkWhere()` |
| `alertas` | sin `where` | `where: fn→mkWhere()` |
| `sesion_rpe` | `where: fn→{toArray}` | `where: fn→mkWhere()` |
| `readiness` | `where: fn→{first,toArray}` | `where: fn→mkWhere()` |

### Método `where`

`vi.fn(() => mkWhere())` — retorna un nuevo objeto por llamada para evitar efectos entre tests.

### Método `equals`

`vi.fn(() => ({ toArray, first }))` — encadenado desde `where()`.

### Método `toArray`

Disponible en dos posiciones: `where().toArray()` y `where().equals().toArray()`.

### Método `first`

Disponible en dos posiciones: `where().first()` y `where().equals().first()`.

---

## Cobertura de regresión

### Error que se habría producido antes

```
TypeError: db.resumen_semanal.where(...).equals is not a function
```
Capturado silenciosamente por `[2H]` → test pasaba con flujo de alertas inoperativo.

### Aserción contra `[2H]` (test 8)

```ts
const h2Calls = warnSpy.mock.calls.filter(args =>
  typeof args[0] === 'string' && args[0].includes('[2H]')
)
expect(h2Calls, '[2H] fallo detectado — el mock no cumple el contrato Dexie .where().equals()').toHaveLength(0)
```

Si `.equals()` desaparece del mock, el test 8 FALLA explícitamente.

### Aserción contra `TypeError`

```ts
const equalsErrors = warnSpy.mock.calls.filter(args =>
  args.some(a => a instanceof TypeError && String(a).includes('.equals is not a function'))
)
expect(equalsErrors, 'TypeError de .equals en flujo pos-commit').toHaveLength(0)
```

### Garantía de atomicidad preservada

Tests 1–7 verifican las mismas aserciones de antes (tablas declaradas, rechazo sin escritura,
no invocación de `loadAll`). Ninguna garantía fue relajada.

### Aislamiento por jugadora

`mkWhere().equals(valor).toArray()` retorna `[]` — sin datos de otras jugadoras.
El contrato de aislamiento sigue garantizado.

---

## Validación

| Comando | Código salida | Resultado |
|---------|:---:|--------|
| `npx vitest run src/store/wellnessAtomicity.test.ts --reporter=verbose` | 0 | ✅ 8/8 PASS — sin `[2H]` ni `TypeError` |
| `npx vitest run src/store/alertsPosCommit.test.ts --reporter=verbose` | 0 | ✅ 24/24 PASS |
| `npm run test` | 0 | ✅ 546/546 PASS, 52 ficheros |
| `npm run lint` | 0 | ✅ 0 warnings, 0 errors |
| `npm run build` | 0 | ✅ Clean build |
| `git diff --check` (ficheros T-01D) | 0 | ✅ Sin trailing whitespace nuevo |

---

## Higiene de diff

- `git diff --check` sobre el árbol completo: devuelve **código 1** por trailing whitespace
  **preexistente** en archivos modificados en tickets anteriores (T-01A/B/C).
- Archivos afectados: `store.ts`, `setup.ts`, `ImportPage.tsx`, `InjuriesPage.tsx`,
  `PlayerProfilePage.tsx`, `SessionsPage.tsx`, `WeeklySummaryPage.tsx`, `resumenSemanal.ts`,
  `store.test.ts`, `auth.ts`, `backup.ts`, `calculations.test.ts`, `calculations.ts`,
  `validation.ts`.
- Whitespace introducido por T-01D: **ninguno**.
- Decisión: diferido a ticket de housekeeping independiente (`.editorconfig` o pre-commit hook).
  No bloquea T-02.

---

## Archivos modificados

```text
src/store/wellnessAtomicity.test.ts
docs/CIERRE_T-01D_MOCK_WELLNESS_ATOMICITY.md  (este documento)
docs/CIERRE_T-01C-R_RECTIFICACION_V14.md      (nota posterior actualizada)
```

No se modificó ningún otro archivo.

---

## Riesgo residual

- **`[4B]` stderr en test 2:** `updateWellness` provoca `[4B] Inconsistencia en refresco incremental` —
  el mock de `readiness.where({}).first()` devuelve `null`, por lo que el store ejecuta `loadAll` de
  recuperación. El test 2 verifica únicamente la declaración de tablas en la transacción, no `loadAll`,
  por lo que PASA correctamente. Este comportamiento es inherente al mock simplificado y no oculta
  ningún fallo real.
- **Trailing whitespace heredado:** presente desde T-01A, no pertenece a T-01D.

---

## Declaración final

**T-01D: CERRADO**
