# CIERRE DE TICKET — T-02A-WELLNESS-IDENTITY

## 1. RESUMEN DE EJECUCIÓN

**Ticket:** T-02A-WELLNESS-IDENTITY — Integración de temporada activa y alias explícitos en importación de wellness  
**Estado:** CERRADO  
**Fecha:** 2026-08-01  
**Tipo:** Integración de Dominio + Importación Atómica  

---

## 2. OBJETIVOS CUMPLIDOS

1. **Resolución de Identidad por Alias Explícito (`google_forms`):**
   - La resolución de jugadora en la importación de respuestas de Google Forms pasa exclusivamente por la tabla `alias_jugadora` donde `origen = 'google_forms'`.
   - Se convierte la clave externa recibida (`alias_jugadora.valor`) a la clave lógica interna estable (`alias_jugadora.id_jugadora`).
   - Se eliminó cualquier mecanismo de fallback basado en coincidencia por nombre visible o creación automática de jugadoras/alias.

2. **Gobierno de Temporada Activa:**
   - La importación exige la existencia de exactamente una temporada activa en `db.temporadas` (`obtenerTemporadaActiva(db)`).
   - Se valida de forma inclusiva que la fecha de cada fila cumpla: `fecha_inicio <= fecha_fila <= fecha_fin`.
   - Si no existe temporada activa o la fecha está fuera de rango, la prevalidación marca la fila como `ERROR` y la transacción de confirmación aborta.

3. **Formato de Fecha Local Estricto:**
   - Validaciones estrictas con `validateFechaLocalISO` (`YYYY-MM-DD`).
   - Rechazo explícito de timestamps UTC ISO (con `T`/`Z`), texto con hora, fechas nulas o vacías y días inexistentes en el calendario (ej. 2026-02-30).

4. **Trazabilidad y Persistencia Atómica en Dexie:**
   - Al confirmar la importación, los nuevos registros en `db.wellness` se persisten etiquetados con:
     - `id_temporada` (ID de la temporada activa)
     - `origen_alias = 'google_forms'`
     - `alias_origen` (valor externo original ingresado en el formulario)
   - Revalidación autoritativa dentro de la transacción atómica Dexie (cubriendo `wellness`, `historial_importaciones`, `jugadoras`, `temporadas`, `alias_jugadora`, `sesion_rpe`, `readiness`, `sesiones`, `partidos`, `rpe_partido`, `resumen_semanal`).

---

## 3. TRAZABILIDAD DE ARCHIVOS MODIFICADOS Y CREADOS

| Archivo | Rol en T-02A |
|---|---|
| `src/types/index.ts` | Extensión de interfaces `Wellness`, `MappedWellnessRow` y `PreviewRow` con `id_temporada?`, `origen_alias?` y `alias_origen?`. |
| `src/domain/imports/wellnessIdentity.ts` | Creación de funciones de dominio `resolverIdentidadFilaWellness` y `validarRangoTemporadaWellness`. |
| `src/domain/imports/wellnessIdentity.test.ts` | Suite unitaria (10 tests) para validaciones de resolución de alias y rango de temporada. |
| `src/utils/importEngine.ts` | Integración en `ValidationContext`, `obtenerContextoValidacionWellness`, `validarFilaWellness`, `construirVistaPrevia` y `aplicarImportacionWellness`. |
| `src/utils/importEngineWellness.test.ts` | Suite de integración en fake-indexeddb (16 tests) cubriendo el flujo completo de prevalidación, alias, temporada y persistencia transaccional. |
| `src/services/readiness.ts` | Soporte de `dbInstance` opcional en recalculación de readiness. |
| `src/services/resumenSemanal.ts` | Soporte de `dbInstance` opcional en recalculación de resumen semanal. |
| `src/domain/temporadas/temporadas.ts` | Comprobación de seguridad en `obtenerTemporadaActiva`. |
| `src/utils/importEngineReferential.test.ts` | Adaptación de mock de base de datos y aserciones. |

---

## 4. MATRIZ DE VERIFICACIÓN DE CALIDAD

| Comando | Resultado | Detalles |
|---|---|---|
| `npx vitest run src/domain/imports/wellnessIdentity.test.ts src/utils/importEngineWellness.test.ts` | **PASS (26/26)** | 10 tests de dominio + 16 de integración T-02A. |
| `npm run test` | **PASS (606/606)** | 57 archivos de test del proyecto en verde. |
| `npm run lint` | **PASS (0 errores, 0 warnings)** | Oxlint superado sin advertencias. |
| `npm run build` | **PASS** | TypeScript compile (`tsc -b`) + Vite bundle exitoso. |

---

## 5. CONCLUSIÓN

T-02A ha sido completado con éxito sin romper compatibilidad histórica ni lógica productiva ajena al módulo de importación wellness. El gobierno del dominio se encuentra operativo y validado mediante pruebas automatizadas.

---

## Nota posterior de atomicidad

- Ticket: T-02A-R-ATOMICIDAD
- Resultado: CERRADO
- Garantía: Frontera transaccional única confirmada con rollback total en todas las tablas afectadas ante fallos en wellness, historial, readiness o resumen semanal.
- Evidencia: `docs/CIERRE_T-02A-R_ATOMICIDAD.md`

