# Fase 2B: Visualizaci�n de Exposici�n Competitiva (UI)

## 1. Alcance
Se ha integrado el m�dulo puro `matchExposure` dentro de la interfaz gr�fica sin duplicar la l�gica de negocio ni modificar los estados globales. La informaci�n sobre la exposici�n competitiva de las jugadoras ahora fluye hacia las tres pantallas operativas designadas, aplicando estrictamente el formateo visual y las jerarqu�as acordadas.

## 2. Archivos Modificados
- `src/components/exposure/CompetitiveExposureCard.tsx` (y su test): Componente reutilizable.
- `src/pages/PlayerProfilePage.tsx`: Integraci�n del widget en modo completo.
- `src/pages/WeeklySummaryPage.tsx`: Integraci�n en la tabla en modo fila.
- `src/pages/DailyDecisionPage.tsx`: Integraci�n en modo compacto.

## 3. Decisiones de UX y Accesibilidad
1. **Formato de datos ausentes**: Cuando la `calidadDato` es `sin_registros_competitivos` o `insuficiente`, las m�tricas no interpretables (como minutos, partidos y convocatorias) se presentan como el car�cter ortotipogr�fico `�` y no como 0. Mostrar 0 implicar�a que hubo competici�n y la jugadora jug� 0 minutos, lo cual es un dato enga�oso.
2. **Jerarqu�a Visual de Calidad**:
   - `completa`: Verde suave (`bg-green-50 text-green-700`). Muestra los datos reales (incluso si son 0, como en `convocada_sin_minutos`).
   - `parcial`: �mbar, indica inferencia de datos o informaci�n deducida (`bg-amber-50 text-amber-700`).
   - `insuficiente`: Gris neutro/Warning leve. Se etiqueta como "Datos competitivos incompletos".
   - `sin_registros_competitivos`: Gris neutro, distinguiendo periodos sin registros. Etiqueta: "Sin registros competitivos".
3. **No alarmismo**: Se ha evitado el uso del color rojo para ratios o alta exposici�n. Es un indicador descriptivo, no una predicci�n de riesgo.
4. **Accesibilidad de Tooltips**:
   - Implementado un tooltip accesible reutilizable (`role="tooltip"`).
   - Enfocable mediante teclado (`tabIndex={0}`).
   - Vinculado con `aria-describedby` a un ID �nico.
   - Visible mediante hover y focus, y se cierra con la tecla Escape.

## 4. Tests y Validaci�n
Se aplic� TDD estricto:
- `CompetitiveExposureCard.test.tsx`: Verifica modos, formato de datos ausentes y accesibilidad de tooltips (aria-describedby, focus, escape).
- Pruebas de integraci�n en pantallas sin modificar RPE o Wellness.
