# Futsal Monitor - Staff Tool

Aplicación web de monitorización de preparación física para equipos de fútbol sala de alto nivel.

## Uso

- **Acceso**: Contraseña por defecto: `futsal2024`
- **Datos de demostración**: Ve a Importar > Cargar datos de demostración para populate la app con datos de ejemplo
- **Importar datos**: Sube CSV o Excel exportado desde Google Sheets con respuestas del formulario diario de wellness

## Módulos

1. **Dashboard** - KPIs generales del equipo, wellness medio, carga semanal, alertas
2. **Jugadoras** - Gestión completa de ficha de jugadoras
3. **Wellness** - Registro y visualización diaria de wellness (sueño, fatiga, dolor, estrés, ánimo)
4. **Sesiones** - Gestión de sesiones de entrenamiento
5. **Partidos** - Registro de partidos y RPE por jugadora
6. **Lesiones** - Control de lesiones y proceso de readaptación (RTP)
7. **Tests** - Resultados de tests físicos con gráficos comparativos
8. **Resumen Semanal** - Cálculo automático de carga, ACWR y estado por jugadora
9. **Alertas** - Sistema automático de alertas (wellness bajo, carga alta, lesiones, datos faltantes)
10. **Importar/Exportar** - Importación desde formularios y exportación a Excel/JSON

## Arquitectura

- **Frontend**: React 19 + TypeScript + Vite
- **UI**: Tailwind CSS
- **Estado**: Zustand
- **Base de datos**: Dexie (IndexedDB) - almacenamiento local del navegador
- **Gráficos**: Recharts
- **Exportación**: xlsx + file-saver

## Funcionalidades clave

- **ACWR** (Acute:Chronic Workload Ratio) calculado automáticamente
- **Score Wellness** calculado como media de 5 variables (sueño, fatiga, dolor, estrés, ánimo)
- **Carga interna** = RPE × duración (UA - Unidades Arbitrarias)
- **Normalización automática** de datos de formularios (reconoce múltiples nombres de columna)
- **Detección de duplicados** e IDs inconsistentes
- **Alertas automáticas** cuando wellness < 5, ACWR > 1.5, lesiones activas, o datos faltantes

## Despliegue

```bash
npm install
npm run dev    # Desarrollo
npm run build  # Producción
npm run preview # Vista previa del build
```

## Conexión con formularios

1. Crea un Google Form con campos: ID Jugadora, Fecha, Calidad de sueño, Fatiga, Dolor muscular, Estrés, Estado de ánimo, Dolor específico
2. Exporta las respuestas a Google Sheets
3. Descarga como CSV o Excel
4. Importa en la app desde la sección "Importar"

El sistema normaliza automáticamente los nombres de columna y valida los IDs de jugadora.
