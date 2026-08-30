# Fase 2A: Exposición Competitiva Individual

## 1. Alcance
Se ha implementado el módulo de dominio puro para el cálculo de métricas de exposición competitiva individual (`matchExposure`), operando sobre ventanas móviles de 7 y 28 días desde una fecha de corte dada. La implementación se adhiere 100% al diseño arquitectónico y no interactúa con componentes de estado global (Dexie/Zustand), UI o alarmas (ACWR).

## 2. Archivos Afectados/Creados
* `src/domain/exposure/matchExposure.ts` (Nuevo)
* `src/domain/exposure/matchExposure.test.ts` (Nuevo)

## 3. Comportamiento Semántico de Datos
El algoritmo se atiene de manera absoluta a la semántica de la capa persistente, separando la disponibilidad del cálculo de la calidad/confianza del dato:
* **no_convocada**: Produce exactamente `0` minutos. No computa como partido ni suma convocatorias, pero el registro certifica evaluación válida (aporta a la calidad `'completa'`).
* **convocada_sin_minutos**: Produce exactamente `0` minutos. Tampoco es un partido *jugado*, pero **SÍ** suma en la cuenta de total de convocatorias.
* **Valores parciales/completos**: Agregan a la bolsa de minutos, suman convocatorias y partidos jugados.
* **Datos Nulos o Faltantes (sin participación)**:
  - `minutos 1-39`: Se infiere como participación 'parcial' (para no bloquear el cálculo) pero se degrada la `calidadDato` a `'parcial'`.
  - `minutos 40`: Se infiere como participación 'completa' pero degrada la `calidadDato` a `'parcial'`.
  - `minutos > 40`: Se considera inconsistente (falta regla explícita de prórroga) y degrada la calidad a `'insuficiente'`.
  - `minutos 0`: No se infiere `no_convocada` ni `convocada_sin_minutos`. Se degrada a `'insuficiente'` (se cuenta como dato ausente/inválido).
  - `minutos null`: Degrada la `calidadDato` a `'insuficiente'` y no se calcula.

## 4. Métricas de Exposición Resultantes
- `minutos7d` y `minutos28d`
- `partidosJugados7d` y `partidosJugados28d`
- `convocatorias7d` y `convocatorias28d`
- `convocadaSinMinutos7d` y `convocadaSinMinutos28d`
- `calidadDato`: Puede ser `'completa'`, `'parcial'`, `'insuficiente'` o `'sin_registros_competitivos'`. Actúa como nivel de confianza del dato.
- `porcentajeExposicion7d`: Sólo computa si hay convocatorias en los últimos 7 días. Representa la fracción de exposición real sobre la máxima posible.
- `referenciaSemanal28d`: Se calcula (media simple `/4`) siempre que la `calidadDato` en la ventana de 28 días sea `'completa'` o `'parcial'`.
- `ratioCambioExposicion`: Representa el aumento o descarga (`minutos7d / referenciaSemanal28d`). Exige que exista exposición (`referencia > 0`) y que la calidad sea al menos `'parcial'`.

## 5. Riesgos Residuales (Mitigados)
1. **Datos Históricos Incompletos**:
   Al permitir el cálculo de `referenciaSemanal28d` con calidad `'parcial'`, se flexibiliza enormemente la herramienta. Si hay un registro con `mins=20` pero sin estado de participación (legacy data), ahora entra en el sumatorio, se refleja en la UI que la calidad es 'parcial', pero **no se pierde** la analítica de tendencia general como ocurría en la versión estricta anterior.
2. **Semana Sin Competición vs. Falta de Datos**:
   Se ha introducido el estado explícito `'sin_registros_competitivos'`. Significa exactamente: "No existen registros RPE_Partido disponibles en la ventana de 28 días; no se puede inferir si hubo o no competición."
