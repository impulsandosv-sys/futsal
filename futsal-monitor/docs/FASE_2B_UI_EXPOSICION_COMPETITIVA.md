# Fase 2B: Visualización de Exposición Competitiva (UI)

## 1. Alcance
Se ha integrado el módulo puro `matchExposure` dentro de la interfaz gráfica sin duplicar la lógica de negocio ni modificar los estados globales. La información sobre la exposición competitiva de las jugadoras ahora fluye hacia las tres pantallas operativas designadas, aplicando estrictamente el formateo visual y las jerarquías acordadas.

## 2. Archivos Modificados
- `src/components/exposure/CompetitiveExposureCard.tsx` (y su test): Componente reutilizable.
- `src/pages/PlayerProfilePage.tsx`: Integración del widget en modo completo.
- `src/pages/WeeklySummaryPage.tsx`: Integración en la tabla en modo fila.
- `src/pages/DailyDecisionPage.tsx`: Integración en modo compacto.

## 3. Decisiones de UX y Accesibilidad
1. **Formato de datos ausentes**: Cuando la `calidadDato` es `sin_registros_competitivos` o `insuficiente`, las métricas no interpretables (como minutos, partidos y convocatorias) se presentan como el carácter ortotipográfico `—` y no como 0. Mostrar 0 implicaría que hubo competición y la jugadora jugó 0 minutos, lo cual es un dato engañoso.
2. **Jerarquía Visual de Calidad**:
   - `completa`: Verde suave (`bg-green-50 text-green-700`). Muestra los datos reales (incluso si son 0, como en `convocada_sin_minutos`).
   - `parcial`: Ámbar, indica inferencia de datos o información deducida (`bg-amber-50 text-amber-700`).
   - `insuficiente`: Gris neutro/Warning leve. Se etiqueta como "Datos competitivos incompletos".
   - `sin_registros_competitivos`: Gris neutro, distinguiendo periodos sin registros. Etiqueta: "Sin registros competitivos".
3. **No alarmismo**: Se ha evitado el uso del color rojo para ratios o alta exposición. Es un indicador descriptivo, no una predicción de riesgo.
4. **Accesibilidad de Tooltips**:
   - Implementado un tooltip accesible reutilizable (`role="tooltip"`).
   - Enfocable mediante teclado (`tabIndex={0}`).
   - Vinculado con `aria-describedby` a un ID único.
   - Visible mediante hover y focus, y se cierra con la tecla Escape.

## 4. Tests y Validación
Se aplicó TDD estricto:
- `CompetitiveExposureCard.test.tsx`: Verifica modos, formato de datos ausentes (garantizando el uso estricto del marcador `—`) y accesibilidad de tooltips (aria-describedby, focus, escape).
- Pruebas de integración en pantallas sin modificar RPE o Wellness.
