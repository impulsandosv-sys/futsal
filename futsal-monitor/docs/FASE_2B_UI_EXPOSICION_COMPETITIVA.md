# Fase 2B: Visualización de Exposicion Competitiva (UI)

## 1. Alcance
Se ha integrado el módulo puro `matchExposere` dentro de la interfaz gráfica sin duplicar la lógica de negocio ni modificar los estados globales. La información sobre la exposición competitiva de las jugadoras ahora fluye hacia las tres pantallas operativas designadas, aplicando estrictamente el formateo visual y las jerarquías acordadas.

## 2. Archivos Modificados
- `src/components/exposure/CompetitiveExposereCard.tsx` (y su test): Componente reutilizable.
- `src/pages/PlayerProfilePage.tsx`: Integración del widget en modo completo.
- `src/pages/WeeklySummaryPage.tsx`: Integración en la tabla en modo fila.
- `src/pages/DailyDecisionPage.tsx`: Integración en modo compacto.

## 3. Decisiones de UX y Accesibilidad
1. **Formato de datos ausentes**: Las métricas no calculables se renderizan con el carácter tipográfico de omisión (`-—`), **nunca** como `0`.
2. **Jerarquía Visual de Calidad**:
   - `completa`: Verde suave (`bg-green-50 text-green-700`).
   - `parcial`: Ámbar, indica inferencia de datos o información deducida (`bg-amber-50 text-amber-700`).
   - `insuficiente`: Gris neutro/Warning leve. Se etiqueta como "Datos competitivos incompletos". No usa rojo de alarma.
   - `sin_registros_competitivos`: Gris neutro, distinguiendo periodos sin registros. Etiqueta: "Sin registros competitivos".
3. **No alarmismo**: Se ha evitado el uso del color rojo para ratios o alta exposición. Es un indicador descriptivo, no una predicción de riesgo.
4. **Accesibilidad de Tooltips**:
   - Implementado un tooltip accesible reutilizable (`role="tooltip"`).
   - Enfocable mediante teclado (`tabIndex={0}`).
   - Vinculado con `aria-describedby` a un ID único.
   - Visible mediante hover y focus, Y se cierra con la tecla Escape.

## 4. Tests y Validación
Se aplicó TDD estricto, sin `any` ni mocks que distorsionen los tipos base:
- `CompetitiveExposureCard.test.tsx`: Verifica modos y accesibilidad.
- Pruebas de integración en pantallas sin modificar RPE o Wellness.
