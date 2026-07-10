# AGENTS.md — Instrucciones persistentes

## Reglas generales
- Responde en español o inglés según el idioma en que te hablen
- Sé conciso: respuestas cortas, código limpio, sin comentarios innecesarios
- Cuando edites código, respeta las convenciones del proyecto
- No hagas commits a menos que te lo pida explícitamente
- Prefiere usar skills cuando apliquen a la tarea

## Skills disponibles localmente
- `.opencode/skills/ask-questions-if-underspecified/`
- `.opencode/skills/systematic-debugging/`
- `.opencode/skills/verification-before-completion/`
- `.opencode/skills/writing-plans/`

## Proyecto: Futsal Monitor (futsal-monitor/)

App React SPA para monitorización de preparación física en futsal femenino.

**Stack:** React 19 + Vite 8 + Tailwind 3 + Zustand 5 + Dexie (IndexedDB) + Recharts + react-router-dom 7

**Todos los comandos se ejecutan desde `futsal-monitor/`:**

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Dev server (http://localhost:5173) |
| `npm run build` | `tsc -b && vite build` (typecheck + bundle) |
| `npm run lint` | **oxlint** (Rust, NO eslint — no `.eslintrc.*`) |
| `npm run preview` | Vista previa del build |

**No hay test framework configurado.** `npm test` fallará. Si se necesitan tests, hay que instalar vitest o similar.

## Convenciones y peculiaridades

- **TypeScript 6.0** con `erasableSyntaxOnly: true` — prohibido usar enums, namespaces, parameter properties. Usar union types o `const` objects.
- **Path alias:** `@/` → `src/`. Todos los imports usan `@/componentes`, `@/types`, etc.
- **Idioma:** Todo el dominio está en español — tipos, rutas, UI, comentarios.
- **Login:** `futsal2024` (hardcoded, auth local sin seguridad real).
- **Datos 100% locales** en IndexedDB via Dexie — no hay backend ni API.
- **Entrypoint:** `src/main.tsx` → `src/App.tsx` (router + layout).
- **Tipos:** `src/types/index.ts` — dominio completo (Jugadora, Sesion, Lesion, etc.).
- **DB schema:** `src/db/database.ts` — 3 versiones Dexie, 10 tablas.
- **Store:** `src/store/store.ts` — Zustand single store.
- **Sin CI/CD** — no hay GitHub Actions.
- **Lanzadores PowerShell:** `start.ps1` (configura PATH + vite dev), `run-vite.ps1`.

## Preferencias de trabajo
- Usar TDD solo si se configura un test runner primero
- Skills locales en `.opencode/skills/` tienen prioridad sobre las de skills-lock.json
