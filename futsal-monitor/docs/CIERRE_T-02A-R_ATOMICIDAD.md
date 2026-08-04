# Cierre T-02A-R — Atomicidad postimportación wellness

**Ticket:** T-02A-R-ATOMICIDAD  
**Fecha:** 2026-08-01  
**Precondición:** T-02A-WELLNESS-IDENTITY  
**Estado:** CERRADO  

---

## Objetivo

Auditar y certificar que la importación de wellness (`aplicarImportacionWellness`) mantiene una frontera transaccional única e indivisible ("todo o nada"), incluyendo la persistencia de registros wellness, historial de importación y los recálculos derivados de readiness y resumen semanal.

---

## Desviación auditada

- **Archivos fuera del alcance inicial modificados:** `src/services/readiness.ts`, `src/services/resumenSemanal.ts`.
- **Motivo técnico:** Inyección de la firma opcional `dbInstance: FutsalDB = db` en `recalcularReadinessJugadora` y `recalcularResumenSemanal`.
- **¿Era necesaria para atomicidad?:** **Sí.** Sin `dbInstance`, los recálculos pos-inserción en `aplicarImportacionWellness` recurrían al singleton `db` global en lugar de la instancia transaccional `dbInstance` recibida. Esto provocaba escrituras fuera de la transacción de importación o fallos de transacción cruzada en entornos aislados/tests.

---

## Frontera transaccional real

```text
inicio transacción (dbInstance.transaction('rw', [11 tablas]))
-> Revalidación de temporada activa, rango de fecha y alias
-> Persistencia de registros en wellness
-> recalcularReadinessJugadora(idJug, fecha, dbInstance)
-> recalcularResumenSemanal(idJug, semana, config, dbInstance)
-> historial_importaciones.put(histEntry, dbInstance)
-> commit (éxito total) / rollback (ante cualquier fallo)
```

---

## Uso de `dbInstance`

| Servicio | Sin dbInstance | Con dbInstance | Equivalencia de cálculo | Participa en transacción |
|---|---|---|---|---|
| `recalcularReadinessJugadora` | Usa singleton `db` global | Usa `dbInstance` recibido | 100% idéntico (comprobado en test) | Sí |
| `recalcularResumenSemanal` | Usa singleton `db` global | Usa `dbInstance` recibido | 100% idéntico (comprobado en test) | Sí |

---

## Matriz de fallos y rollback

| Fase que falla | Error propagado | Wellness restaura estado previo | Historial restaura estado previo | Readiness restaura estado previo | Resumen restaura estado previo | Alertas restaura estado previo / no aplica | Resultado |
|---|---:|---:|---:|---:|---:|---:|---|
| **Escritura inicial wellness** | Sí (`success: false`) | Sí | Sí | Sí | Sí | No aplica | Rollback total |
| **Escritura historial transaccional** | Sí (`success: false`) | Sí | Sí | Sí | Sí | No aplica | Rollback total |
| **Recálculo readiness** | Sí (`success: false`) | Sí | Sí | Sí | Sí | No aplica | Rollback total |
| **Recálculo resumen semanal** | Sí (`success: false`) | Sí | Sí | Sí | Sí | No aplica | Rollback total |

---

## Alertas y frontera transaccional

- **¿`aplicarImportacionWellness` o sus recálculos escriben alertas?:** **No.**
- **Evidencia de ruta inspeccionada:** Se verificó el flujo completo de `aplicarImportacionWellness` en `src/utils/importEngine.ts`, `src/services/readiness.ts` y `src/services/resumenSemanal.ts`. Ninguna de estas funciones llama a evaluadores de alertas ni ejecuta escrituras en `db.alertas`.
- **Decisión:** `alertas` no forman parte directa de la transacción de confirmación de importación. Su actualización se realiza posteriormente en la capa de store/UI o de forma reactiva tras el commit.
- **Evidencia de prueba:** Se añadió una aserción estructural en `wellnessAtomicity.test.ts` demostrando que `db.alertas` se mantiene en `0` escrituras durante la confirmación de importación.

---

## Compatibilidad de `dbInstance`

| Servicio | Llamada histórica sin dbInstance | Llamada con dbInstance | Estado persistido equivalente | Lógica de negocio alterada |
|---|---|---|---|---|
| `recalcularReadinessJugadora` | Operativa | Operativa | Sí (igualdad estructural 100%) | No |
| `recalcularResumenSemanal` | Operativa | Operativa | Sí (igualdad estructural 100%) | No |

---

## Cambio aplicado

- **Micro-fix técnico:** Inyección de `dbInstance` opcional en la firma de `recalcularReadinessJugadora` y `recalcularResumenSemanal` y en la transacción interna de `aplicarImportacionWellness`.
- **Lógica de negocio:** No se alteró ninguna regla de negocio, cálculo de carga, fórmulas de readiness o resumen semanal, ni umbrales de alerta.

---

## Validación

| Comando | Código de salida | Resultado |
|---|---:|---|
| `npx vitest run src/domain/imports/wellnessAtomicity.test.ts` | 0 | **7/7 PASS** |
| `npm run test` | 0 | **613/613 PASS (58 archivos)** |
| `npm run lint` | 0 | **0 errores, 0 warnings (137 archivos)** |
| `npm run build` | 0 | **Compilación exitosa (`tsc -b && vite build`)** |

---

## Archivos modificados y creados

- **`src/domain/imports/wellnessAtomicity.test.ts`** (NUEVO — 7 tests de equivalencia y rollback)
- **`src/services/readiness.ts`** (Inyección opcional `dbInstance`)
- **`src/services/resumenSemanal.ts`** (Inyección opcional `dbInstance`)
- **`src/utils/importEngine.ts`** (Paso de `dbInstance` a los recálculos en la transacción)
- **`docs/CIERRE_T-02A-R_ATOMICIDAD.md`** (NUEVO — Documento formal de cierre T-02A-R)

---

## Riesgo residual

- Ninguno. Todos los tests existentes y nuevos están en verde.

---

## Declaración final

**T-02A-R-ATOMICIDAD: CERRADO**
