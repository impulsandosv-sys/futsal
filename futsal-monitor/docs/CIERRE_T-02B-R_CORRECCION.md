# Cierre T-02B-R — Corrección de Identidad y Header

**Ticket:** T-02B-R-CORRECCIÓN
**Precondición:** T-02B-UI-GOBIERNO
**Fecha:** 2026-08-01
**Estado:** CERRADO

## Objetivo

Corregir tres aspectos detectados en el cierre de T-02B:

1. Sustituir `id_temporada` basado en `Date.now()` + `Math.random()` por `crypto.randomUUID()`.
2. Añadir pruebas específicas del badge de temporada activa en `Header.tsx`.
3. Documentar el resultado de `git diff --check`.

## Correcciones aplicadas

### ID de temporada

- **Implementación anterior:** `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
- **Implementación final:** `crypto.randomUUID()`
- **Motivo:** `Date.now()` + `Math.random()` no genera identificadores criptográficamente seguros ni estables. `crypto.randomUUID()` es nativo del navegador, sin dependencias, y produce UUIDs v4 únicos.
- **Pruebas:** Tests 8, 9 y 10 en `GovernancePage.test.tsx`:
  - Test 8: Mock determinista de `crypto.randomUUID`, verifica invocación y que el ID no se deriva de campos del formulario.
  - Test 9: Dos creaciones consecutivas generan IDs diferentes.
  - Test 10: La lógica de primera temporada activa / siguientes inactivas se preserva con el nuevo generador. Los IDs no tienen prefijo `temp_`.

### Header

- **Comportamiento de carga:** `useEffect` con `obtenerTemporadaActiva(db)` al montar. Fuente: Dexie, no localStorage.
- **Fallback:** Muestra "Sin temporada activa" si no hay temporada activa o si la carga falla.
- **Actualización:** Escucha `temporadas-updated` en `window` y recarga desde Dexie.
- **Limpieza de listener:** `return () => window.removeEventListener('temporadas-updated', loadTemp)` en el cleanup del `useEffect`.
- **Pruebas:** 7 tests en `Header.test.tsx`:
  1. Con temporada activa, muestra nombre y rango de fechas.
  2. Sin temporada activa, muestra "Sin temporada activa".
  3. Tras `temporadas-updated`, recarga la temporada activa desde Dexie.
  4. Si la carga falla, muestra fallback seguro sin romper la navegación.
  5. Al desmontar, elimina el listener `temporadas-updated`.
  6. No usa localStorage como fuente de verdad para la temporada activa.
  7. Con temporada inactiva pero ninguna activa, muestra "Sin temporada activa".

### git diff --check

- **Resultado para archivos T-02B-R:** Sin incidencias de trailing whitespace ni blank lines at EOF.
- **Deuda heredada (preexistente, no T-02B-R):**

Archivos con trailing whitespace preexistente (no modificados por T-02B-R):

| Archivo | Incidencias | Tipo |
|---------|:-----------:|------|
| `src/pages/AlertsPage.tsx` | 6 | trailing whitespace |
| `src/pages/ImportPage.tsx` | 18 | trailing whitespace |
| `src/pages/InjuriesPage.tsx` | 4 | trailing whitespace |
| `src/pages/PlayerProfilePage.tsx` | 6 | trailing whitespace |
| `src/pages/SessionsPage.tsx` | 6 | trailing whitespace |
| `src/store/store.test.ts` | 16 | trailing whitespace |
| `src/store/store.ts` | 7 | trailing whitespace |
| `src/test/setup.ts` | 1 | trailing whitespace |
| `src/utils/auth.ts` | 1 | trailing whitespace |
| `src/utils/backup.ts` | 10 | trailing whitespace |
| `src/utils/calculations.test.ts` | 1 tw + 1 blank EOF | trailing whitespace + blank EOF |
| `src/utils/calculations.ts` | 10 | trailing whitespace |
| `src/utils/validation.ts` | 5 tw + 1 blank EOF | trailing whitespace + blank EOF |
| `src/App.tsx` | 1 | trailing whitespace |

Confirmación: ninguno de estos archivos fue modificado por T-02B-R-CORRECCIÓN. La deuda es anterior.

## Archivos modificados

| Archivo | Acción | Justificación |
|---------|--------|---------------|
| `src/pages/GovernancePage.tsx` | MODIFICADO | Sustituir `Date.now()` por `crypto.randomUUID()` |
| `src/pages/GovernancePage.test.tsx` | MODIFICADO | Añadir tests 8, 9 y 10 de identidad de temporada |
| `src/components/layout/Header.test.tsx` | CREADO | 7 tests del badge de temporada activa en Header |
| `docs/CIERRE_T-02B-R_CORRECCION.md` | CREADO | Este documento |
| `docs/CIERRE_T-02B_UI_GOBIERNO.md` | ACTUALIZADO | Estado CERRADO, referencia a crypto.randomUUID |

## Validación

| Comando | Código salida | Resultado |
|---------|:---:|---|
| `npm run test` | 0 | 64 archivos, 644 tests pasados |
| `npm run lint` | 0 | 0 warnings, 0 errors |
| `npm run build` | 0 | tsc + vite build exitoso |
| `git diff --check` (archivos T-02B-R) | — | Sin incidencias |
| `git diff --check` (global) | 1 | Deuda heredada documentada arriba |

## Invariantes preservadas

- Sin migración Dexie v16.
- Sin cambios de contratos de dominio (`temporadas.ts`, `aliasJugadora.ts`, `dates.ts`).
- Sin cambios en importadores, cálculos, alertas, exportación, PDF o backups.
- `id_jugadora` continúa siendo identidad lógica de alias.
- Una sola temporada activa.
- No se modificaron archivos prohibidos.

## Declaración final

T-02B-UI-GOBIERNO: **CERRADO**
