# Criterios de Cálculos, Semántica de Datos y Alertas Explicables (Fase 2)

Este documento formaliza la semántica de datos, las claves de identidad, las reglas de cálculo y la trazabilidad metodológica en **Futsal Monitor**.

---

## 1. Semántica de Datos de Carga y Disponibilidad

### 1.1. Diferenciación de Estados de Cargas
Para evitar que la ausencia de registro contamine las medias y el criterio del preparador físico, se establecen cuatro estados claramente diferenciados:

1. **`0` Cuantitativo Real (`carga === 0`, `tieneDato === true`)**:
   - Corresponde a un evento medido o prescrito donde la carga realizada es 0 (ejemplo: día de descanso activo prescrito, jugadora no convocada, 0 minutos jugados en partido).
   - **Efecto**: Se contabiliza en los recuentos de asistencia/disponibilidad. En medias de carga representa 0 UA reales.

2. **Dato Ausente / No Registrado (`carga === null`, `tieneDato === false`)**:
   - Corresponde a la omisión de respuesta en el formulario o falta de registro en la sesión.
   - **Efecto**: **NO se convierte en 0 UA**. No altera los promedios ni sumatorios de sesiones reales. En visualizaciones gráficas se representa con un hueco o con el indicador "sin dato".

3. **No Realizado (`estado === 'no_realizado'`, `tieneDato === false`)**:
   - Registro explícito de que la sesión o ejercicio prescrito no fue ejecutado por la jugadora.

4. **No Aplicable / No Convocada**:
   - `no_convocada` en partido o sesión asigna 0 minutos jugados y 0 carga realizada de forma explícita (`tieneDato === true`), lo cual no penaliza el readiness ni cuenta como dato faltante.

### 1.2. Compatibilidad con Matrices EWMA / ACWR
- Para el cálculo matricial continuo de EWMA (Exponentially Weighted Moving Average) y ACWR (Acute:Chronic Workload Ratio), la función agregadora `obtenerArrayCargaDiaria` puede rellenar los días sin registro con `0` UA para mantener el vector temporal continuo de 28 días.
- **Aviso Técnico Obligatorio**:
  - `0 UA` atribuido por vector matricial $\neq$ `0 UA` por descanso prescrito.
  - Las herramientas visuales e indicadores de calidad del dato deben consultar la estructura enriquecida `DailyLoadEntry` y su bandera `tieneDato: true | false`.
  - **Un 0 en la interfaz gráfica nunca debe etiquetarse como "jugadora descansó" si `tieneDato === false` ("sin registro")**.

---

## 2. Fecha Local Deportiva y Sesiones Nocturnas

- **Definición**: La fecha deportiva se expresa en el formato estricto ISO `YYYY-MM-DD` en la zona horaria local del dispositivo del usuario.
- **Regla de Sesiones Nocturnas**: Las marcas de tiempo como `2026-08-05T23:30:00+02:00` o `2026-08-05T23:30` se extraen directamente en base al calendario local del preparador. Una sesión iniciada a las 23:30 del 5 de agosto debe ser registrada como `2026-08-05` en almacenamiento, lectura y UI, sin sufrir conversión a UTC que la desplace al `2026-08-06`.
- **Fechas Futuras**: Se rechazan registros con fechas posteriores a la fecha actual del sistema salvo en la planificación de sesiones futuras.

---

## 3. Claves de Identidad Universales e Idempotencia

Para evitar que reimportaciones del mismo formulario o archivo dupliquen registros o distorsionen acumulados, se definen las siguientes claves unívocas:

| Entidad | Clave de Identidad Lógica / Unívoca |
| :--- | :--- |
| **Jugadora** | `id_jugadora` (código alfanumérico único) |
| **Sesión Grupal** | `id_sesion` |
| **Partido** | `id_partido` |
| **Wellness** | `[id_jugadora + fecha]` |
| **Sesión RPE** | `[id_sesion + id_jugadora]` (o `id` primario) |
| **RPE Partido** | `[id_partido + id_jugadora]` |
| **Test Físico General**| `[id_jugadora + fecha + test]` |
| **Medición CMJ** | `[id_jugadora + fecha + id_protocolo + intento]` |
| **Trabajo Fuerza** | `[id_sesion_fuerza + id_ejercicio]` (v13+) |
| **Resumen Semanal** | `[id_jugadora + semana]` |
| **Readiness** | `[id_jugadora + fecha]` |

**Regla de Idempotencia**: La reimportación de un archivo o lote idéntico identifica los registros coincidentes como `DUPLICADO_IDENTICO` o `ACTUALIZACION_POSIBLE`, impidiendo la duplicación de datos en la base de datos Dexie.

---

## 4. Trazabilidad Metodológica en CMJ y Fuerza

### 4.1. Contexto Metodológico Requerido
Toda medición neuromuscular debe almacenar suficiente contexto metodológico para ser científicamente válida y reutilizable:

- **CMJ (Jump Test)**: `id_jugadora`, `fecha`, `id_protocolo`, `dispositivo` (ej: `plataforma_contacto`, `optojump`, `force_plates`), `unidad` (ej: `cm`, `ms`), `intentos`, `altura_mejor_cm` o `tiempo_vuelo_mejor_ms`.
- **Fuerza (VBT / Dinamometría)**: `id_jugadora`, `fecha`, `id_ejercicio`, `lado`/`lateralidad` (`izquierda` \| `derecha` \| `bilateral`), `unidad` (`kg` \| `N` \| `N.m`), `repeticiones`, `carga_kg` / `fuerza_pico`.

### 4.2. Política sobre Registros Históricos e Inferencias
- En caso de procesar datos históricos que carezcan de metadatos de `unidad`, `dispositivo` o `lateralidad`, las funciones de importación pueden asignar valores por defecto razonables (`cm`, `plataforma_contacto`, `kg`, `bilateral`).
- **Aviso Residual**: Dado que el esquema Dexie v15 no incluye campos de bandera de inferencia para no alterar la compatibilidad con transacciones existentes, **estas inferencias se consideran de carácter strictly técnico y documental. No deben utilizarse como evidencia clínica o toma de decisiones sin la revisión directa del preparador físico.**

---

## 5. Ratio H/Q (Isquiotibiales / Cuádriceps) y Cálculos Derivados

### 5.1. Reglas de Cálculo del Ratio H/Q
El ratio neuromuscular H/Q (Hamstrings to Quadriceps Ratio) evalúa el equilibrio de fuerza entre la musculatura posterior (isquios) y anterior (cuádriceps) del muslo.

$$\text{Ratio H/Q} = \frac{\text{Fuerza Pico Isquiotibiales}}{\text{Fuerza Pico Cuádriceps}}$$

### 5.2. Condición Estricta de Validez
Para que un Ratio H/Q sea válido y se calcule, **deben cumplirse simultáneamente todas las siguientes condiciones**:
1. **Mismo Lado / Lateralidad**: Los valores de Isquiotibiales y Cuádriceps deben provenir de la misma pierna (`izquierda` con `izquierda`, o `derecha` con `derecha`, o ambas `bilateral`).
2. **Misma Sesión / Fecha**: Las mediciones deben pertenecer a la misma fecha o identificador de sesión.
3. **Valores Válidos y Positivos**: Ambas mediciones deben ser números finitos $> 0$.
4. **Denominador No Nulo**: La fuerza de Cuádriceps debe ser $> 0$ (evitando división por cero).

Si alguna de estas condiciones falla, la función devuelve un objeto con `ratio: null` y el estado correspondiente (`'datos_insuficientes'`, `'lado_discordante'`, `'sesion_discordante'`, `'denominador_cero'`).

---

## 6. Alertas Explicables

### 6.1. Estructura de Explicabilidad
Cada alerta generada por el sistema debe registrar los siguientes atributos de trazabilidad:
- `id`: Identificador numérico único de la alerta.
- `tipo` / `origen`: Regla específica aplicada (ej. `wellness_bajo`, `carga_alta`, `lesion`, `datos_faltantes`).
- `datos_sustento`: Cadena explicativa con los valores de entrada y umbrales aplicados.
- `fecha`: Fecha del evento.
- `estado`: Estado de gestión por el staff (`abierta`, `en_revision`, `resuelta`, `descartada`).
- `responsable` y `nota_decision`: Espacio obligatorio para dejar constancia de la decisión humana tomada.

### 6.2. Regla Anti-Falsos Positivos por Datos Ausentes
- Ninguna alerta de carga (`carga_alta`, `acwr`) o de bienestar (`wellness_bajo`) se disparará como consecuencia de tratar datos faltantes (`null`) como si fueran `0`.
- Las alertas de `datos_faltantes` son las únicas destinadas exclusivamente a avisar cuando una jugadora acumula 3 o más días consecutivos sin responder al cuestionario de wellness.
- **Principio Fundamental**: Una alerta es una herramienta de apoyo a la decisión del preparador, nunca un diagnóstico clínico automático.
