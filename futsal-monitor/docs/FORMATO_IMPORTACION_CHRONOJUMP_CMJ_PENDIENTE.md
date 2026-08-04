# Estado de Importación Chronojump CMJ — Contrato Inicial Implementado (T-04B)

**Ticket de Origen:** T-04B-CHRONO-CMJ-CSV-REAL / T-04B-R-IDENTIDAD-Y-CIERRE
**Fecha de emisión:** 2026-08-02
**Estado:** Importador nativo, masivo, previsualizable y atómico implementado y verificado con fixture estructural de Chronojump y fixture complementario de aliases controlados `CJ-xx`. Pendiente únicamente la validación de campo con una exportación real anonimizada antes del uso en producción.

---

## 1. Contrato CSV Validado (T-04B)

- **Versión objetivo:** Chronojump Desktop Windows 2.6.0-072.
- **Sección de datos:** Exclusivamente la sección `+ SALTOS SIMPLES`. Las secciones `+ SESIÓN` y `+ PERSONAS` se usan como metadatos informativos.
- **Delimitador de campos:** `;`.
- **Separador decimal:** Coma `,` (ej. `40,068` cm -> `40.068` cm, `0,572` s -> `572` ms).
- **Nombre de la persona:** Se interpreta estrictamente como alias de origen `chronojump` registrado en la ficha de la jugadora.
- **ID de la persona:** Se conserva como trazabilidad secundaria; no se usa para resolver la identidad lógica de la jugadora.
- **Filtro de tipo:** Solo se procesan filas cuyo `Tipo` (tras trim y mayúsculas) sea exactamente `CMJ`. Filas de otros tipos (ej. `SJ`, `DJ`) se clasifican como `omitidas`.
- **Métricas:**
  - **Altura:** Columna `Altura` en cm (`alturaSaltoCm`).
  - **Tiempo de vuelo:** Columna `TV` en segundos, convertida a milisegundos (`tiempoVueloMs`).
- **Fecha:** Columna `Fecha` de cada fila en formato local estricto `YYYY-MM-DD`.
- **Tiempo (Hora):** Columna `Tiempo` (`HH:MM:SS`) utilizada exclusivamente para derivar el orden ascendente de intento (intento 1, 2, 3...) dentro de cada grupo jugadora/fecha/protocolo.

---

## 2. Requisito Estricto de Identidad y Alias

- **Resolución estricta:** `resolverAliasActivo(db, 'chronojump', valorAlias)`.
- **Seguridad de identidad:**
  - **Prohibido:** Fallback por nombre real, apellidos, dorsal o coincidencia parcial de texto.
  - **Prohibido:** Creación automática de jugadoras o asignación automática de aliases ante fallos de coincidencia.
  - Si un alias en el archivo no existe o está inactivo en Futsal Monitor, el registro resulta en `error` de identidad explícito y bloquea la confirmación del lote.
- El fixture estructural inicial `SIMULATED_jumps_2023-2-27.csv` contiene valores de nombre no controlados y se utiliza exclusivamente para verificar la estructura exportada de Chronojump. La resolución positiva de identidad se prueba con un fixture complementario que usa aliases `CJ-01`, `CJ-02`, etc.
- El alias operativo debe existir previamente en Futsal Monitor, estar activo y tener origen `chronojump`. El valor de `Nombre de la persona` no se interpreta como nombre visible de la deportista.

---

## 3. Política de Previsualización y Confirmación

- **Revisión de plausibilidad:** Banda técnica `10 cm <= alturaSaltoCm <= 70 cm`. Valores fuera de banda resultan en `requiere_revision` (elegibles para inserción pero no seleccionados como mejor intento automáticamente).
- **Duplicados idénticos:** Clave lógica idéntica (`idJugadora + fecha + idProtocolo + intento`) con mismos valores -> clasificado como `duplicado` (no se inserta).
- **Conflictos:** Clave lógica idéntica con valores distintos -> clasificado como `conflicto` (bloquea la confirmación del lote).
- **Errores:** Alias inactivo/inexistente, fecha inválida, altura <= 0 -> clasificado como `error` (bloquea la confirmación del lote).
- **Regla de confirmación:** El botón "Confirmar importación" está habilitado únicamente si `errores === 0` y `conflictos === 0` y existe al menos 1 registro elegible (`valido` o `requiere_revision`).

---

## 4. Atomicidad y Reimportación Idempotente

- La inserción se ejecuta en una única transacción atómica Dexie sobre `pruebas_cmj` e `historial_importaciones`.
- Si ocurre cualquier error durante la transacción, se realiza rollback automático completo (0 escrituras parciales).
- Reimportar el mismo archivo no genera registros duplicados ni altera los mejores intentos.

---

## 5. Limitación Residual y Próximo Ticket

> [!WARNING]
> El fixture `SIMULATED_jumps_2023-2-27.csv` contiene registros con `Simulado: Sí`; demuestra el contrato estructural de exportación, pero no sustituye una exportación anonimizada obtenida durante una sesión de campo. La validación de producción queda diferida a T-04C.
>
> **Próximo ticket propuesto:** `T-04C-CHRONO-CMJ-VALIDACION-CAMPO` (solo tras obtener CSV real anonimizado de una sesión de campo).

---

## 6. Roadmap de Adaptadores Chronojump Futuros

1. **CMJ bilateral, manos en caderas:** T-04A (Dominio listo) -> T-04B (Importador CSV real implementado) -> T-04B-R-IDENTIDAD-Y-CIERRE (Cierre técnico verificable) -> T-04C (Validación campo).
2. **CMJ unilateral:** ticket futuro independiente, condicionado a una definición explícita de lateralidad, protocolo propio y fixture real.
3. **Squat Jump (SJ):** Ticket futuro condicionado a fixture real.
4. **Drop Jump (DJ):** Ticket futuro condicionado a fixture real.
5. **Isométrico / IMTP:** Ticket futuro condicionado a fixture real.
6. **Velocidad y Fotocélulas:** Ticket futuro condicionado a fixture real.
7. **Encoder Lineal / VBT:** Ticket futuro condicionado a fixture real.
8. **Galga Enco / Celda de Carga:** Ticket futuro condicionado a fixture real.
