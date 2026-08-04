# Cierre T-01C-R — Rectificación de alcance Dexie v14

**Ticket:** T-01C-R — Rectificación de alcance Dexie v14 y trazabilidad de T-01C-0  
**Fecha:** 2026-07-31  
**Tipo:** Corrección mínima de migración no liberada  

---

## Objetivo

Eliminar de la definición Dexie v14 el índice compuesto `sesion_rpe [id_jugadora+fecha]`
que fue añadido sin justificación por query productiva real ni warning reproducible.

---

## Hallazgo

T-01C cerró con `version(14).stores()` incluyendo tres tablas:

```typescript
this.version(14).stores({
  readiness:   '++id, [id_jugadora+fecha], id_jugadora, fecha',
  sesion_rpe:  '++id, [id_jugadora+fecha], id_sesion, id_jugadora, fecha',  // ← INCORRECTO
  rpe_partido: '++id, [id_partido+id_jugadora], id_jugadora, id_partido, fecha'
})
```

La justificación de `sesion_rpe` era "simetría con readiness", "prevención futura" y
"coste de índice despreciable". Ninguna de estas razones cumple el criterio de T-01C:
*solo índices respaldados por warning reproducible y consulta productiva real.*

---

## Evidencia

| Tabla | Query real en código | Archivo:línea | Warning compuesto reproducido | Índice v14 anterior | Decisión final |
|-------|---------------------|---------------|------------------------------|---------------------|----------------|
| `readiness` | `where({ id_jugadora, fecha })` | `store.ts:437,496`; `readiness.ts:56`; `readinessMaintenance.ts:110` | **SÍ** | `[id_jugadora+fecha]` | **MANTENER** |
| `rpe_partido` | `where({ id_partido, id_jugadora })` | `store.ts:1160-1161`; `rpePartidoRealDB.test.ts:78,197` | **SÍ** | `[id_partido+id_jugadora]` | **MANTENER** |
| `sesion_rpe` | `where({ id_jugadora })` (1 campo); `where({ id_sesion })` (1 campo); `where('id_sesion').equals()` | `readiness.ts:9`; `store.ts:646`; `sesionRpeRealDB.test.ts:*` | **NO** | `[id_jugadora+fecha]` | **ELIMINAR** |

Búsqueda exhaustiva de queries con dos campos en `sesion_rpe` — resultado: **ninguna encontrada**.

---

## Cambio aplicado

### Esquema v14 antes (incorrecto)

```typescript
this.version(14).stores({
  readiness:   '++id, [id_jugadora+fecha], id_jugadora, fecha',
  sesion_rpe:  '++id, [id_jugadora+fecha], id_sesion, id_jugadora, fecha',
  rpe_partido: '++id, [id_partido+id_jugadora], id_jugadora, id_partido, fecha'
})
```

### Esquema v14 después (correcto)

```typescript
this.version(14).stores({
  readiness:   '++id, [id_jugadora+fecha], id_jugadora, fecha',
  rpe_partido: '++id, [id_partido+id_jugadora], id_jugadora, id_partido, fecha'
})
// sesion_rpe: conserva esquema v13 sin cambio
```

### Índice eliminado

- `sesion_rpe: [id_jugadora+fecha]` — sin justificación

### Índices mantenidos

- `readiness: [id_jugadora+fecha]` — justificado por 4 queries productivas con warning
- `rpe_partido: [id_partido+id_jugadora]` — justificado por query productiva store.ts:1160 + tests reales

### Índices no añadidos

Ningún índice nuevo fue añadido. Solo se eliminó el incorrecto.

---

## Preservación de datos

### Base inicial v13

```typescript
readiness:   '++id, id_jugadora, fecha'
sesion_rpe:  '++id, id_sesion, id_jugadora, fecha'
rpe_partido: '++id, id_jugadora, id_partido, fecha'
```

### Registros de muestra (fixtures del test de migración)

- `readiness`: 3 registros (J1×2 fechas, J2×1 fecha)
- `sesion_rpe`: 3 registros (S1×2 jugadoras, S2×1 jugadora)
- `rpe_partido`: 3 registros (P1×2 jugadoras, P2×1 jugadora)

### Upgrade a v14

Dexie construye los índices nuevos sobre datos existentes automáticamente.
`sesion_rpe` no recibe índice nuevo → sus registros persisten sin transformación.

### Verificaciones (test M-01 a M-08)

| Test | Verificación | Resultado |
|------|-------------|-----------|
| M-01 | `verno === 14` | ✅ |
| M-02 | `readiness` preserva 3/3 registros | ✅ |
| M-03 | `sesion_rpe` preserva 3/3 registros | ✅ |
| M-04 | `rpe_partido` preserva 3/3 registros | ✅ |
| M-05 | `readiness.where('[id_jugadora+fecha]').equals(...)` funciona | ✅ |
| M-05b | `readiness.where({ id_jugadora, fecha })` resuelve | ✅ |
| M-05c | `readiness.where({}).first()` funciona | ✅ |
| M-06 | `sesion_rpe.where('id_sesion').equals('S1')` devuelve 2 registros (índice heredado) | ✅ |
| M-07 | `rpe_partido.where('[id_partido+id_jugadora]').equals(...)` funciona | ✅ |
| M-07b | `rpe_partido.where({ id_partido, id_jugadora })` resuelve | ✅ |
| M-08 | Aislamiento: readiness no mezcla J1 y J2 | ✅ |

---

## Contrato Dexie en tests

### Archivos de test ampliados en T-01C-0

| Archivo | Motivo |
|---------|--------|
| `src/test/setup.ts` | Mock global: añadido `.where().equals().toArray()/.first()` a todas las tablas |
| `src/store/saveRpeBatchAtomicity.test.ts` | Mock local sin `.equals()` → error silencioso en `[2H]` |
| `src/store/importFormResponsesAtomicity.test.ts` | Mock local + `mockReturnValue` sin `.equals()` → error silencioso en `[2H]` |

### Motivo técnico

`evaluarSeguimientoJugadoraDexie` usa `.where('campo').equals(id)`. Mocks sin `.equals()`
causaban `TypeError` capturado silenciosamente por `[2H]`, sin fallar el test pero
dejando el bloque `[2H]` inoperativo durante esos tests. Corregir los mocks elimina el
error silencioso.

### Sin cambios funcionales

No se modificó ninguna regla de negocio, alerta, readiness, carga, UI, rutas, importadores,
backups, exportaciones ni configuración.

---

## Validación

| Comando | Código salida | Resultado |
|---------|:---:|--------|
| `npx vitest run src/db/databaseMigrationV14.test.ts --reporter=verbose` | 0 | ✅ 11/11 PASS |
| `npx vitest run src/store/alertsPosCommit.test.ts --reporter=verbose` | 0 | ✅ 24/24 PASS |
| `npm run test` | 0 | ✅ 545/545 PASS, 52 ficheros |
| `npm run lint` | 0 | ✅ 0 warnings, 0 errors, 128 ficheros |
| `npm run build` | 0 | ✅ Clean build (5.58s) |
| `git diff --check` | 1 | ⚠️ Trailing whitespace preexistente en ficheros ajenos a T-01C-R (ver nota posterior) |

---

## Riesgo y rollback

- **Riesgo residual:** Ninguno. El índice `[id_jugadora+fecha]` en `sesion_rpe` nunca fue
  desplegado en producción (proyecto sin release). Eliminarlo de v14 antes del primer
  despliegue es equivalente a que nunca hubiera existido.
- **Rollback:** Revertir el cambio en `database.ts` restaura la definición anterior.
  No hay datos que migrar ni usuarios afectados.
- **Por qué no se crea v15:** El proyecto no está liberado. Editar v14 directamente es
  correcto y no requiere versión adicional. Crear v15 para "corregir" v14 en un proyecto
  sin datos de producción sería añadir complejidad innecesaria.

---

## Archivos modificados

```text
src/db/database.ts
src/db/databaseMigrationV14.test.ts
docs/CIERRE_T-01C-0_CONTRATO_DEXIE_TESTS.md  (ampliación de alcance)
docs/CIERRE_T-01C_MIGRACION_DEXIE_V14.md     (corrección de sesion_rpe)
docs/CIERRE_T-01C-R_RECTIFICACION_V14.md     (este documento)
```

No se modificó ningún otro archivo.

---

## Declaración final


---

## Nota posterior de higiene de diff

- **Fecha:** 2026-07-31  
- **Comando:** `git diff --check`  
- **Código de salida:** 1  
- **Archivos afectados:** `store.ts`, `setup.ts`, `ImportPage.tsx`, `InjuriesPage.tsx`,
  `PlayerProfilePage.tsx`, `SessionsPage.tsx`, `WeeklySummaryPage.tsx`, `resumenSemanal.ts`,
  `store.test.ts`, `auth.ts`, `backup.ts`, `calculations.test.ts`, `calculations.ts`, `validation.ts`  
- **Atribución:** Preexistente — introducido en tickets T-01A/B/C, ninguno en T-01C-R ni T-01D  
- **Decisión:** Diferido a ticket de housekeeping; no se modifica en T-01C-R ni T-01D
