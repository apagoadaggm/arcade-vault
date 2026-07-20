# CLAUDE.md

Este archivo da contexto a Claude Code (claude.ai/code) para trabajar en este repositorio.

@AGENTS.md

## Proyecto

Arcade Vault — una plataforma de juegos online donde los usuarios juegan y compiten por puntos. Usa **Spec Driven Design** vía los skills `/spec` y `/spec-impl` de `npx skills@latest add Klerith/fernando-skills`, más el skill local `/add-game`.

Hay **4 juegos jugables** (Asteroids, Tetris, Arkanoid, Snake) con motores reales y leaderboards en Supabase, junto a entradas de catálogo tipo placeholder.

## Stack

- **Next.js 16.2.6** con App Router (directorio `app/`) — lee `node_modules/next/dist/docs/` antes de escribir código Next.js; las APIs difieren de lo que conoces por entrenamiento
- **React 19.2.4**
- **Tailwind CSS v4** (plugin PostCSS vía `@tailwindcss/postcss`; sin `tailwind.config.*` — se configura vía CSS en `app/globals.css`)
- **TypeScript ^5** (`strict`, alias de path `@/*` → `./*`)
- **Supabase** — `@supabase/ssr ^0.12.3` + `@supabase/supabase-js ^2.110.7` (leaderboards + persistencia de puntuaciones)
- **Resend** `^6.12.3` — emails del formulario de contacto
- **ESLint 9** (config plana: `eslint-config-next` + `eslint-config-prettier`) y **Prettier** (`prettier-plugin-tailwindcss`)

Aún no hay test runner configurado.

## Scripts

- `npm run dev` — servidor de desarrollo (puerto 3000)
- `npm run build` — build de producción
- `npm run start` — sirve el build
- `npm run lint` — ESLint

## Skills & Spec Driven Design

Usa siempre /frontend-design para diseñar la interfaz de usuario.

Las fuentes de los skills viven en `.agents/skills/`; `.claude/skills/` son **symlinks** a ellas.

- **`/spec`** y **`/spec-impl`** — de `Klerith/fernando-skills` (fijados en `skills-lock.json`). `/spec` diseña un spec; `/spec-impl` implementa uno ya aprobado.
- **`/add-game`** — skill local del repo (`.agents/skills/add-game/`). Diseña el `specs/NN-slug.md` de un juego nuevo siguiendo la receta probada del spec 05 (motor + canvas + integración en el jugador) y el spec 06 (persistencia en Supabase). No escribe código; se implementa después con `/spec-impl`.

**Flujo de feature/juego:** `/spec` o `/add-game` → `specs/NN-slug.md` (`Borrador`) → una persona lo pasa a `Aprobado` → `/spec-impl NN-slug` crea la rama `spec-NN-slug` e implementa paso a paso → verificar + `npm run build` → el commit final marca el spec como `Implementado` → PR a `main`.

Los specs viven en `specs/` como `NN-slug.md` (specs 01–09), redactados en español, con un encabezado en blockquote al inicio: `Estado:` (`Borrador`/`En revisión`/`Aprobado`/`Implementado`/`Obsoleto`), `Depende de:`, `Objetivo:`. La plantilla de 7 secciones está en `.agents/skills/spec/template.md`.

## Agentes

- **`game-planner`** (`.claude/agents/game-planner.md`, modelo `opus`) — subagente que piensa y decide qué juego nuevo encaja con Arcade Vault. Solo planifica: no escribe specs ni código. Mantiene su memoria en `references/game-suggestions-todo.md` (lee las sugerencias previas antes de proponer nuevas, para no repetir ideas, y añade cada sugerencia aceptada o descartada sin borrar el historial). Cuando una idea se acepta, el siguiente paso sigue siendo ejecutar `/add-game` manualmente.

## Automatización

- `.claude/settings.json` registra un hook `PostToolUse` (`Write|Edit|MultiEdit`) que ejecuta `.claude/hooks/format-and-lint.sh` — Prettier + ESLint `--fix`. No hace falta formatear a mano los archivos editados.
- `.mcp.json` define el servidor MCP `supabase` (`project_ref=ugkzgpixmjiymranyklc`). Los cambios de esquema en Supabase (p. ej. sembrar una fila en `games`) se aplican vía la tool MCP `apply_migration` — no hay archivos `.sql` de migración en el repo.

## Entorno

Copia `.env.template` (versionado) a `.env.local` y completa:

- `RESEND_API_KEY` — usado por `app/api/contact/route.ts`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

El esquema de Supabase vive solo en el proyecto remoto (`ugkzgpixmjiymranyklc`), no en el repo.

## Arquitectura

Usa exclusivamente el **App Router** de Next.js — sin directorio `pages/`. Los Server Components son el default; marca los client components con `"use client"` solo cuando haga falta.

```
app/
  layout.tsx, page.tsx (home "/"), globals.css
  about/  auth/  hall-of-fame/         # rutas
  games/  games/[id]/  games/[id]/play/
  context/UserContext.tsx              # useUser() — contexto de auth del cliente
  data/                                # catálogo ESTÁTICO: Game, GAMES[], CATS + scores semilla
  api/contact/route.ts                 # POST → Resend
components/
  Nav.tsx
  games/{Asteroids,Tetris,Arkanoid,Snake}Canvas.tsx   # renderers, exponen *CanvasHandle
lib/
  supabase/{client,server}.ts          # createBrowserClient / createServerClient
  data/{games,scores}.ts               # capa Supabase: getGames/getGame/getScores/insertScore
  games/{asteroids,arkanoid,tetris,snake}/engine.ts   # motores agnósticos del DOM
    snake/sprites.ts                    # atlas de sprites
public/games/{arkanoid,snake}/         # spritesheets
specs/                                 # documentos de spec-driven-design (01–09)
references/                            # started-games (fuentes JS portadas a lib/games),
                                       #   source-assets, plantillas de páginas
```

**Dos capas de datos (el detalle importante):**

- `app/data/*` — el catálogo **estático** autoritativo (interfaz `Game`, arreglo `GAMES`, `CATS`) más los scores semilla/fallback. El player y el catálogo importan `GAMES` desde `@/app/data`.
- `lib/data/*` — la capa respaldada por **Supabase**. `getGames()`/`getGame()` leen las tablas `games` y `scores`, derivan `best`/`plays` (`GameWithStats`), y caen de vuelta al `GAMES` estático si Supabase no está disponible. Las páginas (`home`, `hall-of-fame`, detalle de juego) leen de aquí.

## Juegos — cómo añadir uno nuevo

Un juego toca seis capas (receta probada por Asteroids, Tetris, Arkanoid, Snake):

1. **Catálogo** — añade una entrada a `GAMES` en `app/data/games.ts` (`id, title, short, long, cat: ARCADE|PUZZLE|SHOOTER, cover, color`). Esta es la fuente de verdad de qué juegos existen.
2. **Motor** — `lib/games/<id>/engine.ts`, agnóstico del DOM: recibe `ctx/width/height/callbacks`, expone `update(dt)`/`draw()`/`reset()`/`forceGameOver()`. Pórtalo desde `references/started-games/` (Asteroids/Tetris/Arkanoid) o diséñalo desde cero (Snake).
3. **Canvas** — `components/games/<Game>Canvas.tsx` (`"use client"`, `forwardRef` que expone un `<Game>CanvasHandle`), controla el loop de render con RAF.
4. **Jugador** — conéctalo en `app/games/[id]/play/page.tsx` vía un flag `is<Game> = id === "<id>"`; al terminar la partida llama a `insertScore` una sola vez (protegido con `savedOnceRef`). Los juegos sin motor real mantienen la rama mock de `.game-arena`.
5. **Cover art** — un bloque gradiente `.cover-<id>` en `app/globals.css`.
6. **Persistencia** — siembra una fila en la tabla `games` vía MCP `apply_migration`; la tabla genérica `scores` (`id, game_id, player_name, score, created_at`) no necesita cambio de esquema y se accede vía `lib/data/scores.ts`. (Deuda conocida del spec 06: las tablas todavía no tienen RLS.)
