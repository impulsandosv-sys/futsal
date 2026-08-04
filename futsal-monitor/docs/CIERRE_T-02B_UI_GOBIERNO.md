# CIERRE — T-02B-UI-GOBIERNO
## Gestión UI de temporadas y alias de jugadoras
## Estado: ✅ CERRADO
## Fecha: 2026-08-01

---

## 1. Objetivo

Implementar una interfaz operativa para gestionar temporadas deportivas y alias externos de jugadoras, reutilizando los servicios de dominio existentes (`temporadas.ts`, `aliasJugadora.ts`, `dates.ts`) y las tablas Dexie v15 (`temporadas`, `alias_jugadora`).

---

## 2. Archivos creados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/pages/GovernancePage.tsx` | Página UI | Gestión completa de temporadas |
| `src/components/player/PlayerAliasSection.tsx` | Componente UI | Gestión de alias en ficha de jugadora |
| `src/pages/GovernancePage.test.tsx` | Test UI | 10 tests para GovernancePage (7 originales + 3 de identidad añadidos en T-02B-R) |
| `src/pages/PlayerProfileAlias.test.tsx` | Test UI | 5 tests para PlayerAliasSection |
| `src/components/layout/Header.test.tsx` | Test UI | 7 tests del badge global de temporada activa (añadido en T-02B-R) |
| `docs/CIERRE_T-02B_UI_GOBIERNO.md` | Documentación | Este documento |

---

## 3. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/constants/routes.ts` | Añadida ruta `TEMPORADAS: '/temporadas'` |
| `src/components/layout/Sidebar.tsx` | Añadido enlace "Temporadas" en navegación |
| `src/App.tsx` | Registrada ruta `/temporadas` con lazy loading de `GovernancePage` |
| `src/components/layout/Header.tsx` | Badge de temporada activa con listener `temporadas-updated` |
| `src/pages/PlayerProfilePage.tsx` | Pestaña "Alias" con integración de `PlayerAliasSection` |

---

## 4. Funcionalidad implementada

### 4.1 Gobierno de temporadas (`GovernancePage`)

- **Banner de temporada activa** con nombre y rango de fechas.
- **Disclaimer obligatorio**: "La temporada activa es una referencia operativa y de gobierno. El filtrado transversal de históricos por temporada queda fuera de T-02B."
- **Tabla de temporadas**: Nombre, Fecha Inicio, Fecha Fin, Estado (`Activa`/`Inactiva`), Notas, Acciones.
- **Formulario de creación**: Solo `nombre`, `fecha_inicio`, `fecha_fin`, `notas`. No expone `id_temporada` ni `activa`.
- **`id_temporada`** generado internamente con `crypto.randomUUID()` (UUID v4, sin dependencias).
- **`activa`**: Se establece `true` solo si no existe otra temporada activa.
- **Activar**: Modal de confirmación → `activarTemporada(db, id)` → refresco.
- **Archivar**: Modal de confirmación → `archivarTemporada(db, id)` → refresco.
- **Evento global**: Despacha `temporadas-updated` en cada mutación para sincronizar el Header.

### 4.2 Alias de jugadoras (`PlayerAliasSection`)

- **Sección en ficha de jugadora** bajo pestaña "Alias externos".
- **Identidad por `id_jugadora`**: El nombre es solo presentación.
- **Tabla de alias**: `origen`, `valor`, `activo` (`Activo`/`Inactivo`), `fecha_alta`, `fecha_baja`, `notas`, acción `Desactivar`.
- **Formulario de creación**: `origen` select (`google_forms`, `chronojump`, `manual`, `otro`), `valor`, `fecha_alta`, `notas`.
- **Soporte para `chronojump`**: Preparado para T-04.
- **Colisión**: Muestra error legible si el par `(origen, valor)` ya existe activo.
- **Desactivar**: Modal con campo `fecha_baja` → `desactivarAliasJugadora(db, id_alias, fecha_baja)` → conserva registro inactivo.

### 4.3 Header

- Badge global mostrando temporada activa: nombre + rango de fechas.
- La carga se realiza desde Dexie mediante `obtenerTemporadaActiva(db)` al montar el componente.
- El Header se actualiza después del evento `temporadas-updated`.
- El fallback "Sin temporada activa" se muestra si no existe una activa o si falla la carga.
- El listener se elimina al desmontar el componente.
- `localStorage` no es fuente de verdad para la temporada activa.

---

## 5. Restricciones respetadas

| Restricción | Cumplimiento |
|-------------|-------------|
| No crear migración Dexie v16 | ✅ Solo tablas v15 |
| No modificar `src/db/database.ts` | ✅ |
| No modificar `src/utils/backup.ts` | ✅ |
| No modificar `src/utils/export.ts` | ✅ |
| No modificar `src/utils/pdf.ts` | ✅ |
| No modificar `src/utils/importEngine.ts` | ✅ |
| No modificar `src/domain/calculations/*` | ✅ |
| No modificar `src/domain/monitoring/*` | ✅ |
| No modificar `src/services/readiness.ts` | ✅ |
| No modificar `src/services/resumenSemanal.ts` | ✅ |
| No modificar `package.json` | ✅ |
| No modificar `vite.config.*` | ✅ |
| No reimplementar lógica de dominio en React | ✅ Delega a servicios |
| Solo `activa: boolean` como estado persistido | ✅ No hay estado "archivada" en DB |
| `id_jugadora` como identidad lógica | ✅ Nombre solo para presentación |
| Desactivar alias = `activo: false` + `fecha_baja` | ✅ Sin borrado físico |

---

## 6. Verificación

### 6.1 Tests específicos T-02B y T-02B-R (22 tests)

```text
GovernancePage.test.tsx — funcionalidad original:
  1. Renderiza estado vacío y aviso obligatorio                              ✅
  2. El formulario no expone id_temporada ni activa                          ✅
  3. Primera temporada se crea como ACTIVA automáticamente                   ✅
  4. Segunda temporada se crea como INACTIVA                                 ✅
  5. Rechaza fecha inicio > fecha fin con mensaje legible                    ✅
  6. Activar requiere modal y desactiva la anterior                          ✅
  7. Archivar solicita confirmación y persiste activa: false                  ✅

GovernancePage.test.tsx — corrección de identidad (T-02B-R):
  8. Usa crypto.randomUUID() y no deriva el ID de campos del formulario      ✅
  9. Dos altas consecutivas generan IDs de temporada distintos               ✅
  10. Mantiene primera temporada activa y siguientes inactivas               ✅

PlayerProfileAlias.test.tsx:
  5 tests de alias (crear, chronojump, colisión, desactivar, estado vacío)   ✅

Header.test.tsx (T-02B-R):
  1. Con temporada activa, muestra nombre y rango de fechas                  ✅
  2. Sin temporada activa, muestra "Sin temporada activa"                    ✅
  3. Tras temporadas-updated, recarga la temporada activa desde Dexie        ✅
  4. Si la carga falla, muestra fallback seguro sin romper navegación        ✅
  5. Al desmontar, elimina el listener temporadas-updated                    ✅
  6. No usa localStorage como fuente de verdad                               ✅
  7. Sin temporada activa, aunque haya inactivas, muestra el fallback        ✅

Total: 7 + 3 + 5 + 7 = 22 tests específicos
```

### 6.2 Suite completa

| Comando | Resultado |
|---------|-----------|
| `npm run test` | **64 archivos, 644 tests pasados** |
| `npm run lint` | **0 warnings, 0 errors** |
| `npm run build` | **tsc + vite build exitoso** |
| `git diff --check` — archivos T-02B/T-02B-R | Sin incidencias de trailing whitespace ni blank lines at EOF |
| `git diff --check` — global | Exit 1 por deuda heredada documentada en `docs/CIERRE_T-02B-R_CORRECCION.md` |

### 6.3 Tests de dominio previos intactos

```text
src/domain/dates/dates.test.ts           — 21 tests ✅
src/domain/temporadas/temporadas.test.ts — 8 tests  ✅
src/domain/alias/aliasJugadora.test.ts   — 8 tests  ✅
src/db/databaseMigrationV15.test.ts      — 4 tests  ✅
```

### 6.4 Corrección posterior T-02B-R

La corrección T-02B-R sustituyó el generador temporal de identificadores por
`crypto.randomUUID()`, añadió cobertura específica para identidad de temporada
y para el badge de Header, y documentó la deuda heredada de whitespace.
Consultar `docs/CIERRE_T-02B-R_CORRECCION.md`.

---

## 7. Servicios de dominio reutilizados (sin modificación)

| Servicio | Archivo |
|----------|---------|
| `validarTemporada` | `src/domain/temporadas/temporadas.ts` |
| `crearTemporada` | `src/domain/temporadas/temporadas.ts` |
| `activarTemporada` | `src/domain/temporadas/temporadas.ts` |
| `archivarTemporada` | `src/domain/temporadas/temporadas.ts` |
| `obtenerTemporadaActiva` | `src/domain/temporadas/temporadas.ts` |
| `agregarAliasJugadora` | `src/domain/alias/aliasJugadora.ts` |
| `desactivarAliasJugadora` | `src/domain/alias/aliasJugadora.ts` |

---

## 8. Riesgos residuales y trabajo futuro

| Riesgo / Pendiente | Mitigación / Ticket |
|---------------------|---------------------|
| Filtrado transversal por temporada | Fuera de alcance T-02B (disclaimer visible en UI) |
| Alias `chronojump` preparado pero sin importador | Ticket T-04 |
| No hay edición de temporadas existentes | Decisión de diseño — solo crear/activar/archivar |
| No hay borrado físico de temporadas ni alias | Por diseño — trazabilidad |
