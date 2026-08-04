# Cierre T-01D-RC — Conciliación de recuento de tests

**Ticket:** T-01D-RC — Conciliación de recuento de tests T-01D / T-01D-R  
**Fecha:** 2026-08-01  
**Tipo:** Verificación y rectificación documental exclusiva  
**Precondición:** T-01D-R cerrado  

---

## Objetivo

Resolver y conciliar la discrepancia detectada entre los informes de cierre T-01D, T-01D-R y la ejecución real de la suite de pruebas Vitest.

---

## Discrepancia detectada

| Fuente | Tests `wellnessAtomicity.test.ts` | Tests globales (`npm run test`) | Ficheros de test |
|--------|----------------------------------:|--------------------------------:|-----------------:|
| Cierre T-01C | *(sin cambios en file)* | 545 | 52 |
| Cierre T-01D | 8 | 546 | 52 |
| Cierre T-01D-R (tabla informe) | 10 | 546 *(erróneo)* | 52 |
| **Ejecución real actual** | **10** | **548** | **52** |

---

## Evidencia estructural del archivo `src/store/wellnessAtomicity.test.ts`

Recuento directo de bloques `it(...)` en `src/store/wellnessAtomicity.test.ts`:

| Test | Estado | Incluido en Vitest | Observación |
|------|--------|-------------------|-------------|
| 1. addWellness declara las 4 tablas exactas | PASS | SÍ | Heredado de T-01B |
| 2. updateWellness declara las 4 tablas exactas... | PASS | SÍ | Heredado de T-01B (refresco `[4B]` sin error) |
| 3. loadAll no se invoca tras addWellness... | PASS | SÍ | Heredado de T-01B |
| 4. updateWellness sin id rechaza... | PASS | SÍ | Heredado de T-01B |
| 5. updateWellness con id inexistente rechaza... | PASS | SÍ | Heredado de T-01B |
| 6. addWellness con jugadora inexistente rechaza... | PASS | SÍ | Heredado de T-01B |
| 7. updateWellness con jugadora destino inexistente... | PASS | SÍ | Heredado de T-01B |
| 8. El flujo pos-commit [2H] no emite error silencioso... | PASS | SÍ | **Añadido en T-01D (+1 test: 545 → 546)** |
| 9. Demostración de filtrado semántico y aislamiento... | PASS | SÍ | **Añadido en T-01D-R (+1 test: 546 → 547)** |
| 10. Demostración de consulta por objeto semántica... | PASS | SÍ | **Añadido en T-01D-R (+1 test: 547 → 548)** |

Total estructural en el archivo: **10 tests**. Ninguno omitido (`skip`), deshabilitado (`todo`) ni condicional (`only`).

---

## Evidencia de la suite global (`npm run test`)

Salida literal de ejecución en terminal:

```text
 Test Files  52 passed (52)
      Tests  548 passed (548)
   Start at  19:26:55
   Duration  71.26s (transform 12.83s, setup 49.75s, import 671.88s, tests 34.93s, environment 200.42s)
```

---

## Explicación verificada

- **Origen de la discrepancia (Caso A):**
  En el ticket T-01D-R, la ejecución real de Vitest registró `548 passed (548)`. Sin embargo, la tabla del informe final en markdown transcribió por error de copia `546/546 PASS` heredando la cifra de la tabla de T-01D.
- **Progresión real del recuento:**
  - Post T-01C: **545 tests** (52 ficheros)
  - Post T-01D (añadido test 8): **546 tests** (52 ficheros, +1)
  - Post T-01D-R (añadidos tests 9 y 10): **548 tests** (52 ficheros, +2)
- No existió sustitución de tests, ni omisión por configuración, ni alteración de reporter.

---

## Rectificación documental aplicada

- Documento `docs/CIERRE_T-01D-R_SEMANTICA_MOCK_WELLNESS.md`:
  - Corregida la tabla de validación marcando `548/548 PASS` (era 546).
  - Añadida sección `## Nota posterior de conciliación de recuento`.
- Documento `docs/CIERRE_T-01D_MOCK_WELLNESS_ATOMICITY.md`:
  - Añadida referencia cruzada a este documento de conciliación en la nota de sustitución.

---

## Validación

| Comando | Código salida | Resultado |
|---------|:---:|--------|
| `npx vitest run src/store/wellnessAtomicity.test.ts --reporter=verbose` | 0 | ✅ **10/10 PASS** |
| `npm run test` | 0 | ✅ **548/548 PASS** (52 ficheros) |
| `npm run lint` | 0 | ✅ **0 warnings, 0 errors** (128 ficheros) |
| `npm run build` | 0 | ✅ **Clean build** |
| `git diff --check -- docs/` | 0 | ✅ **0 trailing whitespace introducido** |

---

## Archivos modificados

```text
docs/CIERRE_T-01D-RC_CONCILIACION_RECUENTO_TESTS.md (este documento)
docs/CIERRE_T-01D-R_SEMANTICA_MOCK_WELLNESS.md
docs/CIERRE_T-01D_MOCK_WELLNESS_ATOMICITY.md
```

Sin cambios en código, tests ni configuración.

---

## Declaración final

**T-01D-RC: CERRADO**
