# Juegos implementados en Arcade Vault

Estado al 2026-07-20. Fuente de verdad del catálogo: `app/data/games.ts`.

## Juegos con motor real (4)

Estos juegos tienen motor propio (`lib/games/<id>/engine.ts`), canvas dedicado
(`components/games/<Game>Canvas.tsx`) y persistencia de puntajes en Supabase.

| ID (catálogo) | Título     | Categoría | Spec                                                    | Engine                                       | Canvas                                 |
| ------------- | ---------- | --------- | ------------------------------------------------------- | -------------------------------------------- | -------------------------------------- |
| `asteroides`  | ASTEROIDES | SHOOTER   | [05-asteroides-game.md](../specs/05-asteroides-game.md) | `lib/games/asteroids/engine.ts`              | `components/games/AsteroidsCanvas.tsx` |
| `tetris`      | TETRIS     | PUZZLE    | [07-tetris-game.md](../specs/07-tetris-game.md)         | `lib/games/tetris/engine.ts`                 | `components/games/TetrisCanvas.tsx`    |
| `arkanoid`    | ARKANOID   | ARCADE    | [08-arkanoid-game.md](../specs/08-arkanoid-game.md)     | `lib/games/arkanoid/engine.ts`               | `components/games/ArkanoidCanvas.tsx`  |
| `snake`       | SNAKE      | ARCADE    | [09-snake-game.md](../specs/09-snake-game.md)           | `lib/games/snake/engine.ts` (+ `sprites.ts`) | `components/games/SnakeCanvas.tsx`     |

Todos los specs anteriores están marcados `Estado: Implementado`.

## Entradas de catálogo sin motor real (placeholders)

Existen en `GAMES` (`app/data/games.ts`) y son jugables solo con el `.game-arena`
mock en `app/games/[id]/play/page.tsx` — no tienen engine ni persistencia real.

| ID (catálogo)   | Título        | Categoría |
| --------------- | ------------- | --------- |
| `bloque-buster` | BLOQUE BUSTER | ARCADE    |
| `caida`         | CAÍDA         | PUZZLE    |
| `serpentina`    | SERPENTINA    | ARCADE    |
| `gloton`        | GLOTÓN        | ARCADE    |
| `invasores`     | INVASORES     | SHOOTER   |
| `rocas`         | ROCAS         | SHOOTER   |

## Notas

- La receta para añadir un juego real (catálogo → engine → canvas → wiring en
  player → cover art → seed en Supabase) está documentada en `CLAUDE.md` bajo
  "Games — adding a new game".
- Deuda conocida (spec 06): las tablas `games` y `scores` en Supabase aún no
  tienen RLS.
