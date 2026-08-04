# Cierre T-01D-R — Semántica de mock Dexie y refresco wellness

**Ticket:** T-01D-R — Semántica de mock Dexie y eliminación de stderr [4B] en wellness atomicity  
**Fecha:** 2026-08-01  
**Tipo:** Micro-fix exclusivo de tests  
**Precondición:** T-01D cerrado parcialmente  

---

## Objetivo

Rectificar el mock local de Dexie en `src/store/wellnessAtomicity.test.ts` sustituyendo las respuestas estáticas (`[]`, `null`) por un mock semántico determinista que filtra realmente los registros por campos/valores pasados a `.where('campo').equals(valor)` y `.where({ campo1, campo2 })`.

Eliminar el stderr `[4B] Inconsistencia en refresco incremental` del escenario de éxito en los tests de wellness atomicity proporcionando fixtures deterministas para `readiness` y `wellness`.

---

## Hallazgo en T-01D

En T-01D, el helper `mkWhere()` devolvía siempre un array vacío `[]` o `null`. Si bien resolvió el `TypeError: .equals is not a function`, presentaba dos limitaciones:

1. No filtraba datos ni demostraba aislamiento real entre jugadoras.
2. Provocaba un stderr `[4B] Inconsistencia en refresco incremental` durante el test de `updateWellness`, porque `db.readiness.where({ id_jugadora: 'J1', fecha: '2026-05-10' }).first()` devolvía `null`, lo que activaba el fallback de recuperación con `loadAll()`.

---

## Causa raíz

### Mock sintáctico pero no semántico

En T-01D, `.where().equals()` devolvía siempre respuestas vacías estáticas. No evaluaba los valores recibidos contra la colección de registros.

### Causa de `[4B]`

Durante `updateWellness(w)`, el store invoca `sincronizarWellnessEditadoIncremental`, el cual realiza la consulta:

```ts
db.readiness.where({ id_jugadora: 'J1', fecha: '2026-05-10' }).first()
```

Al devolver `null` el mock estático, el store detectó ausencia de readiness para la jugadora y emitió:

```
[4B] Inconsistencia en refresco incremental (wellness o readiness ausente), ejecutando loadAll de recuperación.
```

---

## Contrato Dexie emulado

El helper `createMockTable` emula el comportamiento de IndexedDB / Dexie mediante una colección dinámica de registros en memoria:

| Patrón | Soporte | Semántica comprobada |
|--------|---------|----------------------|
| `where('campo').equals(valor).toArray()` | SÍ | Filtra el array `rows` por `item[campo] === valor` y retorna coincidencia |
| `where('campo').equals(valor).first()` | SÍ | Retorna la primera coincidencia por `item[campo] === valor` o `null` |
| `where({ campoA, campoB }).toArray()` | SÍ | Filtra `rows` exigiendo coincidencia en todos los pares clave-valor |
| `where({ campoA, campoB }).first()` | SÍ | Retorna la primera coincidencia objeto o `null` |
| `get(id)` | SÍ | Busca por `id` o `id_jugadora` |
| `put(item)` | SÍ | Inserta o actualiza por id / clave compuesta `(id_jugadora, fecha)` |
| `toArray()` | SÍ | Retorna copia inmutable del array completo |

---

## Fixtures

Fixtures deterministas de 2 jugadoras definidos mediante `vi.hoisted()`:

| Tabla | Registro | Propósito |
|-------|----------|-----------|
| `jugadoras` | `J1`, `J2` | Permitir pruebas de aislamiento multijugadora |
| `wellness` | `J1` (`id: 10`, `fecha: '2026-05-10'`), `J2` (`id: 20`, `fecha: '2026-05-10'`) | Registros iniciales para `updateWellness` y filtrado |
| `readiness` | `J1` (`fecha: '2026-05-10'`, `score: 85`), `J2` (`fecha: '2026-05-10'`, `score: 92`) | Registro requerido para refresco incremental exitoso sin `[4B]` |
| `resumen_semanal` | `J1` (`acwr: 1.2`), `J2` (`acwr: 1.0`) | Datos de soporte pos-commit `[2H]` |
| `ciclo_menstrual` | `J1` (`fase: 'Folicular'`), `J2` (`fase: 'Folicular'`) | Datos de soporte pos-commit `[2H]` |

---

## Pruebas de regresión

### Filtro `equals`

Test 9 verifica que `db.wellness.where('id_jugadora').equals('J1').toArray()` devuelve únicamente el registro de J1.

### Query por objeto

Test 10 verifica que `db.readiness.where({ id_jugadora: 'J1', fecha: '2026-05-10' }).first()` devuelve el registro de J1 y `fecha: '2099-01-01'` devuelve `null`.

### Aislamiento multijugadora

Test 9 confirma que las consultas de J1 no contienen ningún dato pertenenciente a J2.

### Éxito sin `[4B]`

Test 2 confirma que `updateWellness` ejecuta la transacción y el refresco incremental sin emitir el aviso `[4B]` y sin invocar `loadAll()`.

### Ausencia de `[2H]` y `TypeError`

Test 8 verifica que `addWellness` no genera warnings `[2H]` ni `TypeError` de `.equals is not a function`.

### Atomicidad

Tests 1 a 7 verifican las garantías de atomicidad (declaración de 4 tablas, rechazo sin escritura, sin invocación no deseada de `loadAll`).

---

## Validación

| Comando | Código salida | Resultado |
|---------|:---:|--------|
| `npx vitest run src/store/wellnessAtomicity.test.ts --reporter=verbose` | 0 | ✅ 10/10 PASS — sin warnings `[4B]`, `[2H]` ni `TypeError` |
| `npx vitest run src/store/alertsPosCommit.test.ts --reporter=verbose` | 0 | ✅ 24/24 PASS |
| `npm run test` | 0 | ✅ **548/548 PASS** (corregido de 546/546), 52 ficheros |
| `npm run lint` | 0 | ✅ 0 warnings, 0 errors, 128 ficheros |
| `npm run build` | 0 | ✅ Clean build (5.45s) |
| `git diff --check -- src/store/wellnessAtomicity.test.ts docs/CIERRE_T-01D_MOCK_WELLNESS_ATOMICITY.md docs/CIERRE_T-01D-R_SEMANTICA_MOCK_WELLNESS.md` | 0 | ✅ Limpio — 0 trailing whitespace introducido |

---

## Archivos modificados

```text
src/store/wellnessAtomicity.test.ts
docs/CIERRE_T-01D_MOCK_WELLNESS_ATOMICITY.md  (actualizada nota de sustitución)
docs/CIERRE_T-01D-R_SEMANTICA_MOCK_WELLNESS.md (este documento)
```

No se modificó ningún otro archivo.

---

## Riesgo residual

- Ninguno. El mock emula fielmente el contrato Dexie requerido y los tests no presentan fallos silenciosos ni warnings engañosos.

---

## Declaración final

**T-01D-R: CERRADO**

---

## Nota posterior de conciliación de recuento

- **Fecha:** 2026-08-01  
- **Ticket:** T-01D-RC  
- **Tests locales verificados:** 10/10 PASS  
- **Suite global verificada:** 548/548 PASS (52 ficheros)  
- **Explicación:** El informe original transcribió erróneamente `546/546 PASS` en la tabla por copia de T-01D, mientras que la ejecución real en terminal dio `548 passed (548)` al incorporar los dos nuevos tests (9 y 10).  
- **Documento de evidencia:** `docs/CIERRE_T-01D-RC_CONCILIACION_RECUENTO_TESTS.md`

