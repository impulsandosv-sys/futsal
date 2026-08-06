# Guía de Operativa Diaria y Auditoría de Cambios — Futsal Monitor

Esta guía define el flujo de trabajo estándar del preparador físico y del cuerpo técnico en la operativa diaria con **Futsal Monitor**.

---

## 1. Flujo Diario de Trabajo

```
[ 08:30 - Importación ]  -->  [ 09:00 - Pantalla "Hoy" ]  -->  [ 09:30 - Ficha / Decisión ]  -->  [ Fin de Semana - CSV ]
  Importar cuestionarios       Revisar completitud,           Analizar jugadoras con         Exportar reporte
  Google Forms/Sheets          alertas y calidad de datos     alertas / adaptar cargas       para reunión de staff
```

---

## 2. Importación y Corrección de Datos

### 2.1. Importación de Cuestionarios (Google Forms)
1. **Frecuencia**: Diaria antes del primer entrenamiento del equipo (típicamente 08:30–09:00).
2. **Procedimiento**:
   - Acceder al módulo **Importar Datos**.
   - Cargar el archivo CSV o Excel descargado de Google Forms.
   - Descargar obligatoriamente la copia de seguridad preventiva antes de confirmar.
   - Verificar la vista previa: los registros idénticos se marcarán como `DUPLICADO_IDENTICO` y no se duplicarán.
   - Confirmar la importación.

### 2.2. Política de Corrección y Edición de Datos
- **Corrección de Errores de Entrada**: Si una jugadora se equivoca al responder una escala en el formulario (ej: marcar 1 en lugar de 10 por error), el preparador puede editar el registro desde la aplicación.
- **Trazabilidad de la Auditoría**: Toda modificación de carga, sRPE, wellness, disponibilidad o alertas requiere registrar:
  - **Quién** realiza el cambio.
  - **Cuándo** se efectúa (marca temporal automática).
  - **Qué valor** fue sustituido (valor anterior vs. valor nuevo).
  - **Motivo** o justificación de la edición.
- **Inmutabilidad**: Los registros del historial de auditoría de cambios son **estrictamente de solo lectura**. No se pueden editar ni eliminar desde la interfaz de usuario.

---

## 3. Uso de la Pantalla "Hoy" (Decisión Diaria)

La pantalla **Decisión Diaria / Hoy** sintetiza el estado operativo del equipo para la planificación previa a la sesión:

1. **Panel de Completitud**: Muestra cuántas jugadoras activas han enviado su cuestionario de wellness y cuántas tienen datos pendientes.
2. **Calidad del Dato**: Muestra la carga reciente (últimos 3-7 días) diferenciando claramente los días con datos medidos (`tieneDato: true`) de los días sin registro (`tieneDato: false`), evitando interpretar huecos como descansos prescritos.
3. **Alertas Nuevas**: Muestra las alertas automáticas pendientes de revisión (`wellness_bajo`, `carga_alta`, `lesion`, `datos_faltantes`).
4. **Decisiones Sugeridas**:
   - `modificar_carga`: Si el ACWR o la fatiga sugieren reducir el volumen de la sesión.
   - `limitar_participacion`: Si existe una lesión activa o una Fase RTP en curso.
   - `observar`: Si el wellness presenta puntuaciones bajas en dolor muscular o estrés.
   - `normal`: Jugadora disponible sin alertas activas.

---

## 4. Gestión y Archivo de Alertas

- **Ciclo de Vida de una Alerta**:
  - `abierta`: Alerta recién generada por el sistema.
  - `en_revision`: Alerta evaluada por el preparador físico durante la reunión previa.
  - `resuelta`: Acción aplicada (ej: descanso otorgado, ajuste de minutos o tratamiento fisioterápico completado).
  - `descartada`: Identificada como falso positivo o variación explicada sin riesgo clínico.
- **Criterio de Archivo**: Una alerta nunca se borra de la base de datos. Pasa al estado `resuelta` o `descartada` con la nota de decisión del preparador y la firma del responsable.

---

## 5. Ficha de Jugadora y Trazabilidad Neuromuscular

La ficha individual (**Perfil de Jugadora**) permite analizar el contexto completo de rendimiento y salud:

- **Carga y Disponibilidad**: Evolución de carga semanal, minutos jugados, estado de disponibilidad y fase RTP.
- **Tests Neuromusculares (CMJ y Fuerza)**:
  - Conserva el contexto metodológico obligatorio: **protocolo, dispositivo de medición, unidad y lateralidad** (izquierda, derecha o bilateral).
  - En Ratio H/Q (Isquiotibiales / Cuádriceps), solo se presentan comparaciones válidas entre mediciones del **mismo lado y la misma sesión**.
- **Notas del Staff**: Registro histórico de comentarios y decisiones del cuerpo técnico.

---

## 6. Exportación Semanal en CSV para Reuniones de Staff

- **Propósito**: Generar una plantilla estable y limpia para la reunión semanal del cuerpo técnico.
- **Columnas Fijas de la Plantilla**:
  1. `Jugadora`: Nombre y apellidos de la jugadora.
  2. `Fecha`: Fecha del registro o de la semana.
  3. `Carga_UA`: Carga total acumulada (Unidades Arbitrarias).
  4. `Minutos_Jugados`: Minutos reales de competición o entrenamiento.
  5. `Disponibilidad`: Estado deportivo (`Disponible`, `Lesionada`, `Readaptacion`, `Carga_Gestionada`).
  6. `Score_Wellness`: Promedio de bienestar (1-10).
  7. `Dolor_Especifico`: Zona o molestia reportada.
  8. `Alertas_Activas`: Resumen de alertas abiertas durante la semana.
  9. `Comentarios_Staff`: Notas y decisiones del cuerpo técnico.
- **Protección de Privacidad**: La exportación excluye identificadores internos de base de datos, DNI, datos de contacto o información médica privada sensible.
