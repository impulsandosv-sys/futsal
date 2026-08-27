# Fase 2B: Visualización de Exposición Competitiva (UI)

## 1. Alcance
Se ha integrado el módulo puro `matchExposure` dentro de la interfaz gráfica sin duplicar la lógica de negocio ni modificar los estados globales. La información sobre la exposición competitiva de las jugadoras ahora fluye hacia las tres pantallas operativas designadas, aplicando estrictamente el formateo visual y las jerarquías acordadas.

## 2. Archivos Modificados
- `src/pages/PlayerProfilePage.tsx`: Integración del widget de Exposición en la pestaña "Resumen".
- `src/pages/WeeklySummaryPage.tsx`: Ampliación de la tabla de resumen semanal con columnas de minutos y convocatorias en ventana de 7 días.
- `src/pages/DailyDecisionPage.tsx`: Inclusión compacta de las métricas de competición junto con la carga sRPE, con su propia gestión visual de calidad.

## 3. Decisiones de UX y Accesibilidad
1. **Formato de datos ausentes**: Los `null` (por ejemplo, ratio no calculable o datos `insuficientes` sin minutos computables) se renderizan con el carácter tipográfico de omisión (`—`), **nunca** como `0`.
2. **Jerarquía Visual de Calidad**:
   - `completa`: Verde suave, denota confianza absoluta (e.g. `bg-green-50 text-green-700`).
   - `parcial`: Ámbar, indica inferencia de datos antiguos o información deducida.
   - `insuficiente`: Rojo/Warning. Utilizado **únicamente** para denotar falta de datos obligatorios (`Datos competitivos incompletos`), no para indicar niveles de rendimiento clínico o físico.
   - `sin_competicion`: Gris neutro, distinguiendo claramente los periodos de descanso de los vacíos de información. Visualmente separado de `insuficiente`.
3. **No alarmismo**: Se ha evitado el uso del color rojo en escenarios de sobreexposición de minutos. Los minutos altos o los ratios superiores a 1.5 se muestran de color primario destacado, no como error o peligro (dado que los minutos no son una alerta de lesión per se).
4. **Accesibilidad de Tooltips**: 
   - Se emplea `tabIndex={0}` para hacerlos enfocables mediante teclado.
   - Usan `aria-describedby` para enlazarlos a la descripción oculta (ID único).
   - Poseen lógica nativa en `onKeyDown` para cerrar el tooltip (hacer blur sobre sí mismos) al presionar la tecla `Escape`.
   - Se usa la clase `peer-focus:block` de Tailwind para que los tooltips se desplieguen por CSS puramente al recibir el foco del teclado.

## 4. Auditoría de Dominio
- **WeeklySummaryPage**: Usa correctamente la función `getWeekEndDateISO(semanaActual)` (el domingo de la semana) como fecha de corte, y envía a `calcularExposicionCompetitiva` todos los registros de partido filtrados por jugadora (su historial histórico completo), cumpliendo el requisito.
- **Tests de Calidad Parcial**: El test "mantiene referencia y ratio con calidad parcial si hay un null aislado" (`matchExposure.test.ts`) certifica que, si hay una base suficiente de minutos en la ventana de 28d y sólo un valor parcial (como 20 min null), la calidad se reporta como "parcial" y no se anula el cálculo de la ratio ni de la referencia.
- **DailyDecisionPage**: Inyecta los cálculos a nivel de vista, sin pasar por `construirDecisionDiaria`. Esto garantiza que los criterios estructurales (ordenación, alertas, sugerencia principal) no se vean alterados inadvertidamente por la competición, separando visualización de decisión.

## 5. Pruebas y Verificación
- `npm run typecheck`: Validó correctamente que la integración tipográfica de `ExposicionCompetitiva` es perfecta.
- `npm run lint`: Sin avisos nuevos en la interfaz.
- `npm test`: Las suites pasaron sin incidentes (93 suites, 882 tests), confirmando que las páginas y la lógica de motor de partido mantienen los contratos exigidos.
- `npm run build`: Proceso finalizado sin problemas.

## 6. Comprobaciones Manuales Pendientes
1. **Dispositivos móviles (DailyDecisionPage)**: Comprobar visualmente que el badge insertado en "Carga y Exposición (7d)" en la versión móvil (Viewport < 480px) se adapta bien (flex-wrap ya implementado, pero requiere test manual real).
2. **Lectores de pantalla (VoiceOver/NVDA)**: Confirmar que al tabular hacia "Ratio de cambio" o "Calidad de dato", el lector enuncia los descriptores de "aria-describedby" y respeta la cancelación con Escape.
3. **Flujo completo (Importación -> UI)**: Realizar una prueba end-to-end importando un Excel con RPE de partidos (con y sin minutos) y verificar que los componentes cambian sus métricas en vivo.
