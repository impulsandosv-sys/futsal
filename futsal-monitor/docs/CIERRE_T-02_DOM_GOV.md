# CIERRE DE TICKET — T-02-DOM-GOV

## 1. RESUMEN EJECUTIVO

- **Ticket:** `T-02-DOM-GOV` — Gobierno del dominio: Temporada, alias de jugadora y fecha local estricta.
- **Estado:** CERRADO CON ÉXITO Y VALIDACIÓN COMPLETA.
- **Resultado de Tests:** 577/577 PASS across 55 test files.
- **Resultado de Linter:** Oxlint 0 warnings / 0 errors.
- **Resultado de Build:** `tsc -b && vite build` exit exitoso sin errores de tipo ni de empaquetado.

---

## 2. CAMBIOS ARQUITECTÓNICOS Y DE DOMINIO

### 2.1 Modelo de Datos e Interfaces (`src/types/index.ts`)
Se han incorporado las interfaces de gobierno de dominio:
- `Temporada`: `{ id_temporada: string, nombre: string, fecha_inicio: string, fecha_fin: string, activa: boolean, notas?: string }`
- `AliasJugadora`: `{ id_alias?: number, id_jugadora: string, origen: OrigenAlias, valor: string, activo: boolean, fecha_alta: string, fecha_baja?: string, notas?: string }`
- `OrigenAlias`: `'google_forms' | 'chronojump' | 'manual' | 'otro'`
- `FechaLocalISO`: `string` (formato estricto `YYYY-MM-DD`)

### 2.2 Validación de Fecha Local Estricta (`src/domain/dates/dates.ts` & `src/utils/validation.ts`)
- Implementación de `isFechaLocalISO(val: unknown): val is string` y `validateFechaLocalISO(val: unknown, fieldName?: string): string | null`.
- **Reglas validadas:**
  1. Formato exacto `YYYY-MM-DD` mediante expresiones regulares estrictas.
  2. Comprobación calendárica real considerando meses de 30/31 días y años bisiestos (ej. rechazo de `2026-02-30` y `2025-02-29`; aprobación de `2024-02-29`).
  3. Rechazo de cadenas con espacios iniciales/finales (`' 2026-08-01 '`).
  4. Rechazo explícito de objetos `Date`, valores numéricos o nulos.
  5. Rechazo de cadenas ISO con componentes de hora u offset UTC (`2026-08-01T00:00:00.000Z`, `2026-08-01T12:00:00`).
  6. Mensajes de error legibles e inmutabilidad de la variable comprobada.

### 2.3 Servicio de Dominio de Temporadas (`src/domain/temporadas/temporadas.ts`)
- `validarTemporada(t)`: Verifica presencia de IDs, nombres y orden cronológico (`fecha_inicio <= fecha_fin`).
- `crearTemporada(db, t)`: Inserción atómica en Dexie. Si `activa === true`, desactiva automáticamente cualquier otra temporada previa.
- `activarTemporada(db, idTemporada)`: Transacción `'rw'` que garantiza que solo **1 única temporada** esté activa a la vez.
- `archivarTemporada(db, idTemporada)`: Marca `activa = false` conservando el 100% de los datos históricos.
- `obtenerTemporadaActiva(db)`: Recupera la temporada activa actual o `null`.

### 2.4 Servicio de Dominio de Alias de Jugadora (`src/domain/alias/aliasJugadora.ts`)
- Identidad basada exclusivamente en el identificador estable `id_jugadora`. El nombre de la jugadora NUNCA se utiliza como clave lógica.
- `agregarAliasJugadora(db, alias)`: Valida existencia de la jugadora y evita colisiones activas para el mismo par `(origen, valor)`.
- `resolverAliasActivo(db, origen, valor)`: Utiliza el índice compuesto `[origen+valor]` en Dexie y retorna únicamente si `activo === true`.
- `desactivarAliasJugadora(db, idAlias, fechaBaja)`: Desactiva un alias y registra la fecha de baja local.
- **Garantías:** Renombrar a una jugadora no invalida ni modifica sus alias asignados.

### 2.5 Esquema Dexie v15 (`src/db/database.ts` & `src/db/databaseMigrationV15.test.ts`)
- Incorporación de la versión 15 del esquema Dexie en `FutsalDB`:
  ```ts
  this.version(15).stores({
    temporadas:     'id_temporada, activa, fecha_inicio, fecha_fin',
    alias_jugadora: '++id_alias, [origen+valor], id_jugadora, origen, valor, activo'
  })
  ```
- **Preservación:** Esquemas v1..v14 intactos sin modificaciones regresivas.
- **Migración:** Verificada en `src/db/databaseMigrationV15.test.ts` demostrando upgrade limpio de v14 a v15 con 100% de conservación de registros preexistentes (jugadoras, wellness, readiness, rpe_partido, sesion_rpe).

---

## 3. SUITE DE PRUEBAS DEL TICKET

Se han creado 4 suites de pruebas dedicadas a T-02:
1. `src/domain/dates/dates.test.ts`: Cobertura exhaustiva de la validación estricta de fechas locales.
2. `src/domain/temporadas/temporadas.test.ts`: Pruebas de unicidad de temporada activa, transacciones, validación y archivado.
3. `src/domain/alias/aliasJugadora.test.ts`: Pruebas de resolución por `(origen, valor)`, colisiones, inactividad e independencia respecto al nombre.
4. `src/db/databaseMigrationV15.test.ts`: Prueba de migración de esquema v14 -> v15 con datos reales.

---

## 4. MATRIZ DE VERIFICACIÓN FINAL

| Verificación | Comando | Resultado | Estado |
|---|---|---|---|
| Pruebas Unitarias T-02 | `npx vitest run ...` | 38/38 PASS | OK |
| Suite de Pruebas Global | `npm run test` | 577/577 PASS (55 archivos) | OK |
| Análisis Estático | `npm run lint` | 0 warnings, 0 errors | OK |
| Compilación TypeScript / Vite | `npm run build` | Exitoso (`tsc -b && vite build`) | OK |

---

## 5. VEREDICTO

**T-02-DOM-GOV queda CERRADO Y VALIDADO COMPLETAMENTE.** El sistema cuenta con gobierno de dominio robusto para temporadas, alias externos independientes del nombre y validación estricta de fechas locales YYYY-MM-DD.

---

## Nota posterior de verificación de migración

- Ticket: T-02-R-MIGRATION
- Resultado: AUDITORÍA Y VERIFICACIÓN COMPLETA (Escenario A)
- Esquema v15: Migración aditiva 100% segura por diseño de Dexie v4.
- Evidencia: [`docs/CIERRE_T-02-R_MIGRACION_V15.md`](file:///c:/Users/olive/OneDrive%20-%20Universidade%20da%20Coru%C3%B1a/Documentos/New%20OpenCode%20Project/futsal-monitor/docs/CIERRE_T-02-R_MIGRACION_V15.md)

