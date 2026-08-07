# Auditoría: Flujo de Minutos Jugados y Carga de Partido

Este documento traza el ciclo de vida de los datos de `RPE_Partido`, los `minutos_jugados` y el cálculo de `carga_ua` asociada, detallando cómo se integran en el sistema, dónde se visualizan, cómo se validan y los riesgos operativos conocidos, incluyendo su mitigación.

---

## 1. Creación y Validación de RPE_Partido

- **Creación en el Store**: La inserción o actualización de un registro se realiza a través de las funciones `addRPE_Partido` y `updateRPE_Partido` en el archivo `src/store/store.ts`.
- **Inferencia (Migraciones y Legacy)**: Antes de la validación, los registros que carecen de la propiedad `participacion` pasan por `inferirParticipacionPartido` (en `src/utils/validation.ts`) para asignarles un estado semántico ("completa", "parcial", "convocada_sin_minutos") basado en el valor crudo de `minutos_jugados`.
- **Validación de Dominio**: Centralizada en `validateRPE_Partido` (`src/utils/validation.ts`). Esta función impone el contrato de estados de participación:
  - Validaciones dependientes del estado para `minutos_jugados` (e.g., exactamente 0, exactamente 40, o rangos de 1-39).
  - Condicionales de obligatoriedad para el campo `RPE`, exigiéndose siempre que existan minutos mayores a cero y limitándolo al rango 1-10.
  - Exigencia de `motivo_participacion_reducida` si el estado es "modificada".

## 2. Cálculo de la Carga (carga_ua)

- **Fórmula Base**: La carga de una sesión o partido se define aritméticamente como `RPE * minutos_jugados` o `RPE * duración`.
- **Cálculo en Interfaz**: Se muestra de manera reactiva en modales o vistas al multiplicar ambos valores (por ejemplo, en `src/pages/MatchesPage.tsx`).
- **Persistencia**: Históricamente se guarda en la propiedad `carga_ua` del objeto `RPE_Partido`, pero el motor de agregación principal reevalúa y normaliza estas cargas de manera dinámica.

## 3. Integración en el Motor de Datos (Readiness, Semanal, ACWR/EWMA)

El nodo central que une la carga de un partido con el ecosistema de la jugadora es `src/domain/calculations/dailyLoad.ts` (específicamente, `calculateDailyLoad`).

- **Carga Diaria (`dailyLoad.ts`)**: Recolecta todos los registros del día para una jugadora (Sesiones de entrenamiento + Partidos).
  - **Semántica del Cero Real**: Si un registro de partido tiene `minutos_jugados === 0` (o estado "no_convocada"/"convocada_sin_minutos"), el sistema genera explícitamente un objeto de carga con `carga: 0` y `tieneDato: true`. Esto evita que un día de partido sin participación se confunda con un día de ausencia de reporte.
- **Resumen Semanal (`resumenSemanal.ts`)**: Suma las cargas diarias. Como las cargas a cero tienen `tieneDato: true`, cuentan a favor de la completitud de la semana (aumentando la fidelidad de los datos semanales).
- **Readiness (`readiness.ts`)**: Utiliza la carga agregada de los últimos días para proyectar fatiga.
- **Monitorización y Ratios (ACWR/EWMA)**: Se apoyan en el flujo de `dailyLoad.ts` para extraer cargas crudas e integrarlas en los modelos exponenciales (EWMA) y de ratio de carga aguda-crónica (ACWR) calculados en `loadCalculations.ts`.

## 4. Visualización (Pantallas)

Actualmente, los `minutos_jugados` y la participación de partido se consumen principalmente en:
1. **Página de Partidos (`MatchesPage.tsx`)**: Modal de edición y creación de RPE de partido, mostrando la participación, los minutos y el RPE de cada jugadora en un listado o diálogo.
2. **Tableros de Monitorización / Dashboard (`Dashboard.tsx`, `PlayerProfile.tsx`)**: Donde se exponen las cargas diarias agregadas. (Aquí se ve la *carga total* resultante, no siempre los minutos crudos desglosados).
3. **Exportación (CSV)**: En `src/utils/export.ts`, mediante `exportarCSVPartidos`, que plasma columnas específicas de `Minutos_Jugados`, `Participacion`, `Participacion_Inferida` y `Motivo_Participacion_Reducida`.

## 5. Cobertura de Tests

El flujo está blindado por múltiples niveles de testing:
- **Validación Pura**: `src/utils/validation.test.ts` (Reglas de la semántica de participación, 0 minutos, y transiciones).
- **Atomicidad y Zustand**: `src/store/rpePartidoAtomicity.test.ts` y `src/store/rpePartidoIncremental4C.test.ts` (Garantizan que las inserciones o caídas en cascada guarden íntegramente en Dexie y en la store en memoria de Zustand).
- **Integración de Carga**: `src/domain/calculations/dailyLoad.test.ts` y `src/domain/calculations/dailyLoadIntegration.test.ts` (Prueban la deduplicación y que un valor nulo/cero se incorpore correctamente al historial).

## 6. Riesgos de Doble Contabilización y Mitigaciones

### El Problema (Double Counting)
El preparador físico puede dar de alta un partido de dos maneras complementarias que, si no se ligan, generan doble carga en el mismo día para la misma jugadora:
1. Creando una **Sesión** cuyo `tipo_sesion` es `"Partido"` y pidiendo a la jugadora un RPE genérico en `sesion_rpe`.
2. Completando el formulario específico del partido (`RPE_Partido`), con los `minutos_jugados` exactos de ese partido.

### Mecanismo de Mitigación (Deduplicación)
En `dailyLoad.ts`, existe un motor de deduplicación: si el sistema detecta que una sesión de tipo partido (y su respectivo `sesion_rpe`) tiene vinculado el mismo `id_partido` que el registro de `RPE_Partido`, **descarta la carga de `sesion_rpe` y da prioridad absoluta a `RPE_Partido`**, pues contiene los minutos reales desglosados.

### Riesgo Residual y Corrección
Si una sesión de tipo "Partido" se creaba **sin vincularla al ID de un partido real** (campo `id_partido` vacío), el deduplicador no podía emparejarlos. Resultado: se sumaba la carga de la Sesión-Partido y la del Partido de forma independiente.
* **Solución Aplicada**: Se implementó una comprobación de integridad referencial. Al crear o editar una Sesión, si el `tipo_sesion` es "Partido", **es obligatorio** seleccionar un `id_partido` válido. Esto sella la brecha de la doble contabilización.
