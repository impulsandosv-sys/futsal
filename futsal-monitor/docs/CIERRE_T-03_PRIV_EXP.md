# Cierre T-03 — Privacidad en exportaciones staff

**Ticket:** T-03-PRIV-EXP  
**Fecha:** 2026-08-01  
**Precondición:** T-02A-R-ATOMICIDAD  
**Estado:** CERRADO  

---

## Objetivo

Implementar privacidad por defecto para todas las exportaciones reales dirigidas al cuerpo técnico (“staff”) mediante la adopción de **DTOs tipados con allowlist positiva**, garantizando que la información sensible (ciclo menstrual, psicología, diagnóstico médico, notas clínicas, dolor específico, comentarios wellness y texto libre no clasificado) quede excluida de cualquier archivo exportado.

---

## Inventario de rutas

| Salida | Ruta | Formato | Decisión A/B/C | DTO concreto | Prueba |
|---|---|---|---|---|---|
| **Resumen semanal Excel** | `src/pages/WeeklySummaryPage.tsx` | XLSX | Decisión A | `DTOStaffFilaResumenSemanal` | `src/utils/export.test.ts` |
| **Resumen semanal PDF** | `src/pages/WeeklySummaryPage.tsx` | PDF | Decisión A | `DatosStaffPDFResumen` | `src/utils/pdf.test.ts` |
| **Seguimiento diario Excel** | `src/pages/FollowUpDashboardPage.tsx` | XLSX | Decisión A | `DTOStaffFilaSeguimientoDiario` | `src/utils/export.test.ts` |
| **Reporte Validación Importación** | `src/pages/ImportPage.tsx` | CSV | Decisión B (Técnica) | N/A (Log técnico de columnas/alias) | `src/utils/importEngine.test.ts` |
| **Historial Importaciones JSON** | `src/pages/ImportPage.tsx` | JSON | Decisión B (Técnica) | N/A (Log técnico de lotes) | `src/utils/importEngine.test.ts` |
| **Backup técnico base datos** | `src/utils/backup.ts` | JSON | Decisión B (Técnica) | Excluido de T-03 | `src/utils/backup.test.ts` |

---

## Política de privacidad

### Datos permitidos
- Datos operativos explícitamente declarados propiedad por propiedad en los DTOs:
  - `id_jugadora`, `nombre`, `posicion`, `fecha`, `semana`
  - `carga_entreno`, `carga_partido`, `carga_total`, `carga_cronica`, `acwr`, `wellness_medio`, `num_sesiones`, `estado`
  - `disponibilidad` (estructurada: `disponible`, `parcial`, `no_disponible`, `disponible_modificado`)
  - `estadoWellness`, `prioridad`, `motivos` (alerta operativa estructurada), `adherencia7d`, `adherencia28d`

### Datos excluidos
- Ciclo menstrual (`ciclo_menstrual`, `fase`, `sintomas`, `fecha_ultima_menstruacion`)
- Test psicológico (`respuestas`, `comentarios`, `estado_psicologico`)
- Lesión y diagnóstico clínico (`diagnostico`, `comentario_fisio_medico`, `plan_rtp`, `rtp_checklist`, `notas_clinicas`)
- Comentarios y dolor libre (`dolor_especifico`, `comentario_wellness`, `observaciones_privadas`, `notas_privadas`)

### Disponibilidad frente a lesión
- Se exporta únicamente la disponibilidad estructurada. El objeto de lesión y sus comentarios clínicos asociados quedan 100% excluidos.

### Texto libre
- Todo texto libre queda excluido por defecto de la salida staff. Solo se transmiten campos estructurados y tipados autorizados.

---

## Arquitectura aplicada

```text
Datos internos
-> constructor DTO staff concreto con allowlist (asignación propiedad por propiedad)
-> serializador aplicable a cada ruta staff inventariada
   (actualmente exportToExcel / generatePDFStaff)
-> archivo descargable
```

---

## Evidencia de no filtración

| Formato | Claves/etiquetas revisadas | Valores revisados | Resultado |
|---|---|---|---|
| **DTO Staff (Dominio)** | `dolor_especifico`, `comentario_wellness`, `ciclo_menstrual`, `diagnostico`, `nota_nueva_no_clasificada` | "Dolor punzante", "ansiedad", "Lútea", "Microtrauma" | **0 presentes (Filtrados 100%)** |
| **Excel staff** | Cabeceras y celdas | Valores de DTO staff y XLSX generado | **0 sensibles presentes** |
| **PDF Staff** | Título, nota de privacidad y filas | Contenido renderizado | **0 sensibles presentes** |

---

## Compatibilidad

- **Datos internos:** Se conservan intactos en IndexedDB y Zustand para la aplicación local.
- **Backups:** `src/utils/backup.ts` se mantiene sin modificar (exportación técnica completa fuera del alcance de T-03).
- **Importaciones / Cálculos / Alertas / UI de captura:** No modificados.

---

## Archivos modificados y creados

- **`src/domain/privacy/exportPrivacy.ts`** (NUEVO — DTOs concretos y constructores puros allowlist)
- **`src/domain/privacy/exportPrivacy.test.ts`** (NUEVO — Unit tests de dominio DTO)
- **`src/utils/export.ts`** (Soporte generico para DTOs staff)
- **`src/utils/export.test.ts`** (NUEVO — Pruebas de integración de exportación XLSX staff y de compatibilidad de utilidades)
- **`src/utils/pdf.ts`** (Generador `generatePDFStaff` basado en DTOs)
- **`src/utils/pdf.test.ts`** (NUEVO — Integration tests de PDF)
- **`src/pages/WeeklySummaryPage.tsx`** (Uso de DTOs en Excel y PDF)
- **`src/pages/FollowUpDashboardPage.tsx`** (Uso de DTOs en Excel)
- **`docs/CIERRE_T-03_PRIV_EXP.md`** (NUEVO — Documento formal de cierre T-03)

---

## Riesgos residuales

- Los backups técnicos completos siguen fuera del filtro DTO staff y sin cifrado (trabajo futuro).
- El modo de exportación IA anonimizado permanece pendiente para futuros tickets.
- No existe control de acceso persistente ni roles reales de usuario.
- Toda nueva ruta de exportación que se añada en el futuro deberá adoptar un DTO concreto antes de ser habilitada.
- No se identificaron exportaciones staff activas en CSV o JSON. Si se habilitan en el futuro, deberán construirse desde un DTO staff concreto antes de cualquier serialización.

---

## Declaración final

**T-03-PRIV-EXP: CERRADO**
