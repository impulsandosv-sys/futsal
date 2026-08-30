# Auditoría Operativa - Fase 4B: Contexto Menstrual y Decisión Manual

## 1. Finalidad y límites del módulo
La finalidad de esta fase es evolucionar el módulo menstrual ya existente para convertirlo en una herramienta de **contexto operativo diario** para el preparador físico, sin entrar en automatismos clínicos ni de carga. Sirve para revisar rápidamente quién ha reportado un inicio hoy, o quién se encuentra en una ventana estimada, y permite registrar una decisión manual si procede.

## 2. Modelo legado vs modelo nuevo
- **Modelo legado:** Se utilizaba el tipo `CicloMenstrual` y la tabla `ciclo_menstrual` para registrar fases sintomáticas.
- **Modelo nuevo (Fase 4A):** Se introdujo `RegistroMenstrual` (tabla `registro_menstrual`) con fecha_inicio, impacto_percibido, comentario y nota_ajuste, dejando atrás las fases clínicas.
- **Modelo nuevo (Fase 4B):** Se amplía la interfaz de `RegistroMenstrual` añadiendo `accion_ajuste` (una enumeración estructurada) y `fecha_decision` (la fecha en que el profesional toma la decisión).
Ambos (Fase 4A y 4B) se preservan y conviven en la misma tabla. Los registros históricos sin los nuevos campos se comportan como nulos para la decisión. No se ha requerido crear migración de esquema en IndexedDB dado que los nuevos campos no son índices de búsqueda directa y Dexie almacena objetos flexibles.

## 3. Reglas de estimación y alertas
- Se requieren al menos 2 registros reales de una jugadora para estimar su próximo inicio.
- Se genera una alerta de tipo MENSTRUACION_PROXIMA_ESTIMADA cuando la fecha local entra en la ventana [-3 días, +7 días] de la fecha estimada.
- No se han modificado estas reglas en la Fase 4B, sólo se utilizan como origen de datos para los **Recordatorios estimados activos**.

## 4. Qué muestra el panel diario
El panel "Contexto menstrual del día" se visualiza en "Decisión diaria" y en el "Dashboard". Muestra dos bloques:
1. **Inicios comunicados hoy**: Muestra las jugadoras que han comunicado su inicio exactamente en la fecha actual, con su impacto percibido.
2. **Recordatorios estimados activos**: Muestra alertas abiertas de proximidad menstrual, con la fecha de la estimación.

**El panel NO muestra:**
- Comentarios privados de las jugadoras.
- Notas de ajuste.
- Fases del ciclo.
- Riesgos o predicciones clínicas.
- Alertas descartadas o resueltas.

## 5. Qué significa una decisión manual
Registrar una decisión manual es simplemente el acto de documentar qué acción ha tomado el preparador físico en respuesta al contexto comunicado (ej. "AJUSTE_VOLUMEN", "CONVERSACION_MANTENIDA", "SIN_CAMBIOS").
Esta acción se asocia al RegistroMenstrual de la jugadora. No desencadena ningún evento en cascada ni modifica la planificación global.

## 6. Qué no hace el sistema (Red Lines)
- NO calcula ni muestra fases del ciclo menstrual (folicular, lútea, etc).
- NO recomienda reglas automáticas de carga ni sugiere descanso.
- NO predice rendimiento, riesgo lesional ni fertilidad.
- NO modifica automáticamente los estados de Wellness, Readiness, Carga, RPE, ni disponibilidad de la jugadora.
- NO envía notificaciones, push, ni emails automáticos.

## 7. Checklist de prueba manual
- [x] Crear dos inicios en el historial para activar estimación.
- [x] Comprobar alerta de estimación en -3 días.
- [x] Comprobar aparición del recordatorio en el panel diario/dashboard.
- [x] Registrar un inicio con fecha "hoy" y verificar que sale en "Inicios comunicados hoy".
- [x] Registrar acción y nota desde el modal de decisión.
- [x] Comprobar en el perfil y el historial que la decisión se refleja correctamente sin mostrar nota en panel inicial.
- [x] Crear backup de seguridad comprobando su correcta persistencia.
- [x] Restaurar en base de prueba comprobando que no se pierden la acción ni la fecha.
- [x] Confirmar exclusión correcta de registro_menstrual, accion_ajuste y notas en exportaciones (staff PDF, DTO ordinario).

## 8. Criterios de cierre y limitaciones de evidencia
- Cumplimiento estricto del principio de **no intervención automática** en la carga o el riesgo.
- Las estimaciones siguen siendo una referencia opcional del profesional, dependientes 100% del reporte manual de inicios.
- Los tests unitarios cubren la exclusión del export staff y la robustez del modal frente a fechas futuras. Todo funciona de forma local off-line.
