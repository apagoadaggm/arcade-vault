# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — an online gaming platform where users play games and compete for points. Uses **Spec Driven Design** via the `/spec` and `/spec-impl` skills from `npx skills@latest add Klerith/fernando-skills`, plus a repo-local `/add-game` skill.

There are **4 playable games** (Asteroids, Tetris, Arkanoid, Snake) with real engines and Supabase leaderboards, alongside placeholder catalog entries.

## Stack

- **Next.js 16.2.6** with App Router (`app/` directory) — read `node_modules/next/dist/docs/` before writing Next.js code; APIs differ from training data
- **React 19.2.4**
- **Tailwind CSS v4** (PostCSS plugin via `@tailwindcss/postcss`; no `tailwind.config.*` — configured via CSS in `app/globals.css`)
- **TypeScript ^5** (`strict`, path alias `@/*` → `./*`)
- **Supabase** — `@supabase/ssr ^0.12.3` + `@supabase/supabase-js ^2.110.7` (leaderboards + score persistence)
- **Resend** `^6.12.3` — contact form emails
- **ESLint 9** (flat config: `eslint-config-next` + `eslint-config-prettier`) and **Prettier** (`prettier-plugin-tailwindcss`)

No test runner is configured yet.

## Scripts

- `npm run dev` — dev server (port 3000)
- `npm run build` — production build
- `npm run start` — serve the build
- `npm run lint` — ESLint

## Skills & Spec Driven Design

Usa siempre /frontend-design para diseñar la interfaz de usuario.

Skill sources live in `.agents/skills/`; `.claude/skills/` are **symlinks** to them.

- **`/spec`** and **`/spec-impl`** — from `Klerith/fernando-skills` (pinned in `skills-lock.json`). `/spec` designs a spec; `/spec-impl` implements an approved one.
- **`/add-game`** — repo-local skill (`.agents/skills/add-game/`). Designs a new game's `specs/NN-slug.md` following the proven recipe of spec 05 (engine + canvas + player integration) and spec 06 (Supabase persistence). Writes no code; implement afterward with `/spec-impl`.

**Feature/game workflow:** `/spec` or `/add-game` → `specs/NN-slug.md` (`Borrador`) → human sets it to `Aprobado` → `/spec-impl NN-slug` creates branch `spec-NN-slug` and implements step-by-step → verify + `npm run build` → final commit marks the spec `Implementado` → PR to `main`.

Specs live in `specs/` as `NN-slug.md` (specs 01–09), authored in Spanish, opening with a blockquote header: `Estado:` (`Borrador`/`En revisión`/`Aprobado`/`Implementado`/`Obsoleto`), `Depende de:`, `Objetivo:`. The 7-section template is in `.agents/skills/spec/template.md`.

## Automation

- `.claude/settings.json` registers a `PostToolUse` hook (`Write|Edit|MultiEdit`) that runs `.claude/hooks/format-and-lint.sh` — Prettier + ESLint `--fix`. You do not need to format edited files by hand.
- `.mcp.json` defines the `supabase` MCP server (`project_ref=ugkzgpixmjiymranyklc`). Supabase schema changes (e.g. seeding a row in `games`) are applied via the MCP `apply_migration` tool — there are no `.sql` migration files in the repo.

## Environment

Copy `.env.template` (committed) to `.env.local` and fill in:

- `RESEND_API_KEY` — consumed by `app/api/contact/route.ts`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The Supabase schema lives only on the remote project (`ugkzgpixmjiymranyklc`), not in the repo.

## Architecture

Uses Next.js **App Router** exclusively — no `pages/` directory. Server Components are the default; mark client components with `"use client"` only when needed.

```
app/
  layout.tsx, page.tsx (home "/"), globals.css
  about/  auth/  hall-of-fame/         # routes
  games/  games/[id]/  games/[id]/play/
  context/UserContext.tsx              # useUser() — client auth context
  data/                                # STATIC catalog: Game, GAMES[], CATS + seed scores
  api/contact/route.ts                 # POST → Resend
components/
  Nav.tsx
  games/{Asteroids,Tetris,Arkanoid,Snake}Canvas.tsx   # renderers, expose *CanvasHandle
lib/
  supabase/{client,server}.ts          # createBrowserClient / createServerClient
  data/{games,scores}.ts               # Supabase layer: getGames/getGame/getScores/insertScore
  games/{asteroids,arkanoid,tetris,snake}/engine.ts   # DOM-agnostic engines
    snake/sprites.ts                    # sprite atlas
public/games/{arkanoid,snake}/         # spritesheets
specs/                                 # spec-driven-design docs (01–09)
references/                            # started-games (JS sources ported into lib/games),
                                       #   source-assets, page templates
```

**Two data layers (key gotcha):**

- `app/data/*` — the authoritative **static** catalog (`Game` interface, `GAMES` array, `CATS`) plus seed/fallback scores. The player and catalog import `GAMES` from `@/app/data`.
- `lib/data/*` — the **Supabase-backed** layer. `getGames()`/`getGame()` read the `games` and `scores` tables, derive `best`/`plays` (`GameWithStats`), and fall back to the static `GAMES` if Supabase is unavailable. Pages (`home`, `hall-of-fame`, game detail) read from here.

## Games — adding a new game

A game touches six layers (recipe proven by Asteroids, Tetris, Arkanoid, Snake):

1. **Catalog** — add an entry to `GAMES` in `app/data/games.ts` (`id, title, short, long, cat: ARCADE|PUZZLE|SHOOTER, cover, color`). This is the source of truth for which games exist.
2. **Engine** — `lib/games/<id>/engine.ts`, DOM-agnostic: receives `ctx/width/height/callbacks`, exposes `update(dt)`/`draw()`/`reset()`/`forceGameOver()`. Port from `references/started-games/` (Asteroids/Tetris/Arkanoid) or design from scratch (Snake).
3. **Canvas** — `components/games/<Game>Canvas.tsx` (`"use client"`, `forwardRef` exposing a `<Game>CanvasHandle`), owns the RAF render loop.
4. **Player** — wire into `app/games/[id]/play/page.tsx` via an `is<Game> = id === "<id>"` flag; on game over it calls `insertScore` once (guarded by `savedOnceRef`). Games without a real engine keep the mock `.game-arena` branch.
5. **Cover art** — a `.cover-<id>` gradient block in `app/globals.css`.
6. **Persistence** — seed one row in the `games` table via MCP `apply_migration`; the generic `scores` table (`id, game_id, player_name, score, created_at`) needs no schema change and is accessed through `lib/data/scores.ts`. (Known debt from spec 06: tables have no RLS yet.)
