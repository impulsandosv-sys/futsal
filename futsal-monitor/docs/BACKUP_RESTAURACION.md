# Sistema de Backup y Restauración de Futsal Monitor

Este documento describe la arquitectura, política de seguridad, contratos de datos y procedimientos de restauración del sistema de gestión de copias de seguridad de **Futsal Monitor (v15)**.

---

## 1. Contenido y Cobertura de la Copia de Seguridad

Cada copia de seguridad generada exporta el **100% de las 29 tablas activas** de IndexedDB (Dexie v15):

| Categoría | Tablas Incluidas |
| :--- | :--- |
| **Tablas Críticas** | `jugadoras`, `sesiones`, `partidos`, `lesiones`, `temporadas` |
| **Tablas Deportivas y Trazabilidad** | `wellness`, `formulario_respuestas`, `sesion_rpe`, `rpe_partido`, `tests_fisicos`, `ciclo_menstrual`, `carga_gps`, `fuerza_vbt`, `hidratacion`, `rtp_checklist`, `test_psicologico`, `protocolos_cmj`, `pruebas_cmj`, `ejercicios_fuerza`, `trabajos_fuerza`, `plantillas_fuerza`, `sesiones_fuerza_individual` |
| **Alertas y Configuración** | `alertas` (preservando decisiones humanas: responsable, nota decision, estado), `plantillas_importacion`, `alias_jugadora`, `historial_importaciones`, `historial_copias` |
| **Tablas Derivadas (Recalculadas)** | `readiness`, `resumen_semanal` (regeneradas automáticamente tras restaurar) |

---

## 2. Cómo Exportar una Copia de Seguridad

1. Navega a la vista **Importar / Copias de seguridad** en la aplicación.
2. En la sección superior derecha, haz clic en **"Crear y Descargar Copia de Seguridad"**.
3. Se generará y descargará automáticamente un archivo JSON versionado con el formato:  
   `futsal_backup_manual_YYYY-MM-DD_v15.json`

---

## 3. Modos de Restauración: REPLACE vs MERGE

El sistema separa estrictamente dos operaciones de restauración distintas para prevenir pérdidas accidentales de datos:

### A) Modo REPLACE (Reemplazo Total)
- **Propósito**: Sustituir por completo la base de datos local por el contenido del backup.
- **Flujo de Seguridad**:
  1. Validación completa del archivo de backup.
  2. Muestreo y resumen por entidad de los datos entrantes.
  3. **Descarga obligatoria de copia preventiva de la base actual** (`forceExternalBackup('previo_restauracion')`).
  4. Confirmación explícita requiriendo al usuario escribir la palabra exactas **`REEMPLAZAR`**.
  5. **Ejecución Atómica**: Reemplazo en una única transacción de lectura/escritura Dexie (`db.transaction('rw', ...)`).
  6. Si el usuario cancela o cierra la ventana en cualquier momento, **0 escrituras/0 modificaciones** son aplicadas a la base local.
  7. En caso de fallo durante la transacción, Dexie ejecuta **rollback físico 100%**, dejando la base original intacta.

### B) Modo MERGE (Fusión Selectiva)
- **Propósito**: Incorporar nuevos registros a la base local sin borrar los datos existentes.
- **Flujo de Seguridad**:
  1. Análisis previo pre-restauración (`analyzeBackupMergePreview`) sin alterar IndexedDB.
  2. Muestra un panel resumen indicando el recuento de registros **Nuevos**, **Conflictivos** y **Huérfanos**.
  3. Selección obligatoria de estrategia ante conflictos (no se permite overwrite silencioso).
  4. Inserción **idempotente**: Reimportar la misma copia múltiples veces no genera duplicados.

---

## 4. Estrategias de Fusión: SKIP vs OVERWRITE

| Estrategia | Comportamiento | Usar cuando... |
| :--- | :--- | :--- |
| **`skip` (Omitir - Recomendado)** | Inserta los registros nuevos y **conserva el valor local** intacto cuando detecta un conflicto de clave de identidad. | Deseas proteger tus datos locales actuales frente a copias de seguridad más antiguas. |
| **`overwrite` (Sobrescribir)** | Inserta los registros nuevos y **actualiza los registros locales conflictivos** con la versión del backup. | Deseas actualizar datos locales con correcciones realizadas en una copia oficial externa. |

---

## 5. Validaciones Previas (Antes de Modificar IndexedDB)

Antes de iniciar cualquier escritura en la base de datos local, `validateBackupData` comprueba:

1. **Formato JSON**: Estructura JSON válida y legible.
2. **Versión de Formato**: `backupFormatVersion === 1`.
3. **Versión de Esquema**:
   - **Backup de Versión Futura (`v > 15`)**: Rechazado con el mensaje *"El archivo de copia de seguridad fue creado con una versión futura de la aplicación. Se requiere una versión más reciente de la aplicación."*
   - **Versión Incompatible (`v != 15`)**: Rechazado con indicación de incompatibilidad.
4. **Tablas Críticas Faltantes**: Bloquea si falta `jugadoras`, `sesiones`, `partidos`, `lesiones` o `temporadas`.
5. **Integridad Relacional**: Rechaza el backup si detecta registros huérfanos críticos (ej. RPE o tests que referencien a una jugadora inexistente en el dataset del backup).

---

## 6. Guía de Solución ante Errores

| Síntoma / Mensaje de Error | Causa Raíz | Acción Correctiva |
| :--- | :--- | :--- |
| *"Se requiere una versión más reciente de la aplicación"* | El backup fue creado con una versión futura del esquema de la app. | Actualiza la aplicación Futsal Monitor a la última versión antes de restaurar. |
| *"Falta la tabla crítica X en la copia de seguridad"* | El JSON de backup está truncado o dañado. | Genera un nuevo backup válido desde la fuente original. |
| *"Relación huérfana detectada"* | El backup contiene registros secundarios referenciando jugadoras o sesiones inexistentes. | Revisa el archivo JSON o restaura en modo merge omitiendo registros huérfanos. |
| *"No se pudo generar o descargar la copia de seguridad previa obligatoria"* | El navegador bloqueó la descarga en modo Replace. | Permite las descargas en el navegador y vuelve a intentar el reemplazo. |
