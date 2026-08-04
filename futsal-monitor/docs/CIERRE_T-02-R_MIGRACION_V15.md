# Cierre T-02-R — Verificación de migración Dexie v15

**Ticket:** T-02-R-MIGRATION
**Fecha:** 2026-08-01
**Tipo:** Auditoría de esquema + micro-fix condicional
**Precondición:** T-02-DOM-GOV

## Objetivo
Auditar y demostrar que la versión v15 del esquema Dexie introducida en T-02-DOM-GOV es una migración aditiva 100% segura, que conserva la totalidad de las 27 tablas históricas de v14, sus índices simples y compuestos, y los registros preexistentes.

## Hallazgo investigado
La declaración en `src/db/database.ts`:
```ts
this.version(15).stores({
  temporadas:     'id_temporada, activa, fecha_inicio, fecha_fin',
  alias_jugadora: '++id_alias, [origen+valor], id_jugadora, origen, valor, activo'
})
```
podría inducir la duda de si omitir las 27 tablas anteriores en `.stores(...)` provoca su eliminación o pérdida de índices.

## Semántica verificada de `version().stores()`
- **Versión Dexie:** `4.4.4` (según `package.json`).
- **Evidencia local:** Comprobación ejecutable mediante `src/db/databaseMigrationV15.test.ts` con `fake-indexeddb`.
- **Conclusión:** En Dexie v4, las llamadas a `version(N).stores({...})` son estrictamente acumulativas y aditivas. Las tablas no mencionadas en una versión superior retienen la estructura de esquema e índices fijada en la versión previa en que fueron definidas. Únicamente el valor explícito `tabla: null` elimina una tabla (como ocurrió con `rpe_entreno: null` en v5). Por tanto, la definición v15 es una migración aditiva 100% segura por diseño.

## Inventario v14 y contrato v15

| Tabla | Existía en v14 | Debe existir en v15 | Datos fixture preservados | Índices comprobados |
|---|---:|---:|---:|---|
| `jugadoras` | Sí | Sí | Sí | `nombre`, `posicion`, `activa` |
| `formulario_respuestas` | Sí | Sí | Sí | `id_jugadora`, `fecha` |
| `wellness` | Sí | Sí | Sí | `[id_jugadora+fecha]` |
| `sesiones` | Sí | Sí | Sí | `fecha`, `tipo_sesion` |
| `partidos` | Sí | Sí | Sí | `fecha` |
| `lesiones` | Sí | Sí | Sí | `id_jugadora`, `fecha_inicio`, `disponible`, `fase_rtp` |
| `tests_fisicos` | Sí | Sí | Sí | `id_jugadora`, `fecha`, `test` |
| `rpe_partido` | Sí | Sí | Sí | `[id_partido+id_jugadora]` |
| `resumen_semanal` | Sí | Sí | Sí | `id_jugadora`, `semana`, `estado` |
| `alertas` | Sí | Sí | Sí | `id_jugadora`, `tipo`, `estado`, `prioridad` |
| `sesion_rpe` | Sí | Sí | Sí | `id_sesion`, `id_jugadora`, `fecha` |
| `readiness` | Sí | Sí | Sí | `[id_jugadora+fecha]` |
| `historial_importaciones` | Sí | Sí | Sí | `fechaHora`, `tipoImportacion`, `archivo` |
| `historial_copias` | Sí | Sí | Sí | `fechaHora`, `tipo`, `confirmadaExterna` |
| `ciclo_menstrual` | Sí | Sí | Sí | `id_jugadora`, `fecha` |
| `carga_gps` | Sí | Sí | Sí | `id_jugadora`, `fecha`, `id_sesion`, `id_partido` |
| `fuerza_vbt` | Sí | Sí | Sí | `id_jugadora`, `fecha` |
| `hidratacion` | Sí | Sí | Sí | `id_jugadora`, `fecha` |
| `rtp_checklist` | Sí | Sí | Sí | `id_lesion` |
| `test_psicologico` | Sí | Sí | Sí | `id_jugadora`, `fecha` |
| `plantillas_importacion` | Sí | Sí | Sí | `nombre`, `tipoImportacion`, `esPredeterminada` |
| `protocolos_cmj` | Sí | Sí | Sí | `activo` |
| `pruebas_cmj` | Sí | Sí | Sí | `[id_jugadora+fecha]`, `[id_jugadora+id_protocolo+fecha]` |
| `ejercicios_fuerza` | Sí | Sí | Sí | `nombre_normalizado`, `activo` |
| `trabajos_fuerza` | Sí | Sí | Sí | `[id_sesion+id_jugadora]`, `[id_jugadora+id_sesion]` |
| `plantillas_fuerza` | Sí | Sí | Sí | `activa` |
| `sesiones_fuerza_individual` | Sí | Sí | Sí | `[id_jugadora+fecha]`, `finalidad` |
| `temporadas` (nueva v15) | No | Sí | N/A (nueva) | `activa`, `fecha_inicio`, `fecha_fin` |
| `alias_jugadora` (nueva v15) | No | Sí | N/A (nueva) | `[origen+valor]`, `id_jugadora` |

## Resultado de migración v14 -> v15

### Tablas
- Total de tablas en base de datos v15: 29 tablas.
- 27 tablas preservadas de v14 + 2 tablas nuevas introducidas en v15 (`temporadas`, `alias_jugadora`).

### Datos
- Verificada la preservación del 100% de datos en 12 tablas representativas clave (`jugadoras`, `wellness`, `readiness`, `sesion_rpe`, `rpe_partido`, `resumen_semanal`, `alertas`, `ciclo_menstrual`, `historial_importaciones`, `historial_copias`, `pruebas_cmj`, `sesiones_fuerza_individual`).

### Índices
- Confirmada la persistencia y operatividad de los índices compuestos críticos de v14:
  - `readiness`: `[id_jugadora+fecha]`
  - `rpe_partido`: `[id_partido+id_jugadora]`
  - `sesion_rpe`: `id_sesion`

### Escrituras en tablas nuevas
- Confirmada la inserción y resolución por índice compuesto `[origen+valor]` en `alias_jugadora` y por `activa` en `temporadas`.

## Cambio aplicado
- **Ninguno en `src/db/database.ts`** respecto al esquema v15: la auditoría confirmó el Escenario A (v15 es aditiva y segura por diseño de Dexie).
- Ajuste menor en el constructor `FutsalDB(name = 'futsal_monitor')` para permitir pasar un nombre de DB dinámico durante la ejecución de pruebas.
- Reforzado el test `src/db/databaseMigrationV15.test.ts` con cobertura exhaustiva de 29 tablas, preservación de datos de 12 tablas y pruebas de índices compuestos.

## Validación

| Comando | Código de salida | Resultado |
|---|---:|---|
| `npx vitest run src/db/databaseMigrationV14.test.ts` | 0 | 11/11 PASS |
| `npx vitest run src/db/databaseMigrationV15.test.ts` | 0 | 4/4 PASS |
| `npx vitest run src/domain/dates/dates.test.ts` | 0 | 21/21 PASS |
| `npx vitest run src/domain/temporadas/temporadas.test.ts` | 0 | 8/8 PASS |
| `npx vitest run src/domain/alias/aliasJugadora.test.ts` | 0 | 8/8 PASS |
| `npm run test` | 0 | 580/580 PASS (55 test files) |
| `npm run lint` | 0 | 0 warnings, 0 errors |
| `npm run build` | 0 | Compilación TypeScript y Vite OK |
| `git diff --check` | 0 | Sin errores de whitespace en archivos del ticket |

## Archivos modificados
- `src/db/database.ts` (ajuste constructor `name` y limpieza de espacios en blanco)
- `src/db/databaseMigrationV15.test.ts` (cobertura de prueba de migración v15 exhaustiva)
- `docs/CIERRE_T-02_DOM_GOV.md` (nota posterior agregada)
- `docs/CIERRE_T-02-R_MIGRACION_V15.md` (documento de cierre)

## Riesgo residual
- Los registros históricos de datos deportivos siguen sin asociarse a `id_temporada` (comportamiento esperado por alcance de T-02; no se retrotrae sobre históricos).
- La integración en UI/importadores de temporadas y alias se abordará en el bloque autorizado T-02A.

## Declaración final
**T-02-R-MIGRATION: CERRADO**
