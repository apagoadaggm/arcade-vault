# SPEC 06 — Persistencia de catálogo y leaderboard en Supabase

> **Estado:** Aprobado
> **Depende de:** 04-supabase-client-setup, 05-asteroides-game
> **Fecha:** 2026-07-16
> **Objetivo:** Reemplazar el catálogo estático y el leaderboard falso por datos reales de Supabase (tablas `games` y `scores`), guardando la puntuación al terminar una partida de Asteroides.

---

## Scope

**In:**

- **Tabla `games` en Supabase** (vía MCP `apply_migration` al proyecto `ugkzgpixmjiymranyklc`): PK `id` de tipo `text` = slug actual (`'asteroides'`, `'bloque-buster'`, etc.), más `title`, `short`, `long`, `cat`, `cover`, `color`. **Sin** columnas `best`/`plays` (se derivan de `scores`). Se siembra por migración con el contenido actual de `app/data/games.ts`.
- **Tabla `scores` en Supabase** (vía migración): `id uuid` (PK, default), `game_id text` (FK → `games.id`), `player_name text`, `score int`, `created_at timestamptz` (default `now()`). **Arranca vacía.**
- **Capa de acceso a datos** en `lib/data/` (cliente de navegador): funciones para leer juegos, leer scores por juego, leer la mejor marca de un jugador e insertar un score.
- **Migrar los 5 Client Components** (`app/page.tsx`, `app/games/page.tsx`, `app/games/[id]/page.tsx`, `app/games/[id]/play/page.tsx`, `app/hall-of-fame/page.tsx`) a leer de Supabase vía `useEffect` + estado de carga, con **fallback al array estático** de `app/data/games.ts` si la consulta falla.
- **`best` y `plays` derivados** de `scores`: `best` = MAX(`score`) del juego, `plays` = COUNT de filas del juego. Se muestran en cards de biblioteca y detalle (con `0`/`—` cuando no hay scores).
- **Estados vacíos** en el Salón de la Fama: cuando un juego tiene menos de 3 scores, el podio y la tabla degradan a un mensaje de "sin registros" en vez de romper (`rows[0]` hoy asume que existe).
- **Guardar puntuación real al terminar Asteroides**: al dispararse el game over en `app/games/[id]/play/page.tsx` (id `asteroides`), insertar una fila en `scores` con `player_name` = nombre de `UserContext` o `'ANÓNIMO'` si no hay nombre. Reemplaza el `setSaved(true)` simulado.
- **"TU MEJOR MARCA"** en el Salón de la Fama: consultar la mejor puntuación real del jugador para el juego seleccionado, en vez del cálculo falso actual.

**Fuera de alcance (para specs futuros):**

- **RLS y políticas de seguridad.** Las tablas se crean **sin RLS**; quedan abiertas vía anon key. Se difiere a un spec dedicado de seguridad/auth.
- **Anti-cheat / validación del score** insertado (consecuencia de no tener RLS ni auth).
- **Autenticación real.** Se sigue usando el nombre de `UserContext` (localStorage); reemplazar auth es otro spec.
- **Guardar scores de los juegos mock** (todos menos Asteroides). Solo Asteroides escribe; el resto no inserta nada.
- **Tipos generados de Supabase** (`generate_typescript_types`). Se usan interfaces TypeScript manuales, consistentes con las actuales.
- **Panel de administración** para editar el catálogo `games` desde la UI. La tabla se siembra por migración.
- **Paginación / filtros avanzados** del leaderboard. Se muestra top-N por juego, como hoy.
- **Refactor de los 5 consumidores a Server Components.** Se mantienen client.

---

## Data model

**Migración 1 — tabla `games`** (se siembra con las filas actuales de `app/data/games.ts`):

```sql
create table public.games (
  id    text primary key,          -- slug: 'asteroides', 'bloque-buster', ...
  title text not null,
  short text not null,
  long  text not null,
  cat   text not null,             -- 'ARCADE' | 'PUZZLE' | 'SHOOTER'
  color text not null,             -- 'cyan' | 'magenta' | 'yellow' | 'green'
  cover text not null              -- clase CSS de portada, ej. 'cover-asteroides'
);
-- seguido de INSERTs con el catálogo actual (sin best/plays)
```

**Migración 2 — tabla `scores`** (arranca vacía):

```sql
create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games(id),
  player_name text not null,
  score       integer not null,
  created_at  timestamptz not null default now()
);
create index scores_game_id_score_idx on public.scores (game_id, score desc);
```

**Tipos TypeScript** (`lib/data/`), manuales, alineados con las tablas. Opción B: `Game` es contenido puro; las estadísticas viven en `GameWithStats`.

```ts
// app/data/games.ts — Game pierde best/plays; queda como contenido puro (fallback + seed)
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER";
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
}

// lib/data/games.ts — contenido + estadísticas reales derivadas de scores
export interface GameWithStats extends Game {
  best: number; // MAX(score) del juego, 0 si no hay
  plays: number; // COUNT de scores del juego, 0 si no hay
}

// lib/data/scores.ts
export interface Score {
  id: string;
  game_id: string;
  player_name: string;
  score: number;
  created_at: string;
}
```

**Funciones de acceso** (`lib/data/`, cliente de navegador vía `lib/supabase/client.ts`):

```ts
getGames(): Promise<GameWithStats[]>              // juegos + best/plays derivados; fallback al array estático
getGame(id): Promise<GameWithStats | null>
getScores(gameId, limit = 12): Promise<Score[]>   // top-N por score desc
getPlayerBest(gameId, name): Promise<number | null>
insertScore(gameId, name, score): Promise<void>
```

**Notas de convención:**

- La interfaz `Game` de `app/data/games.ts` deja de tener `best`/`plays`; el array estático se conserva **solo como fallback** y como fuente del seed de la migración.
- `plays` pasa de `string` decorativo (`"12.4K"`) a `number` real (un COUNT). La UI formatea el entero.
- `seededScores` de `app/data/scores.ts` deja de usarse (el leaderboard lee `scores` real). La interfaz `ScoreEntry` se retira o se reemplaza por `Score`.

---

## Implementation plan

1. **Migración `games` (MCP `apply_migration`)** — crear `public.games` (esquema de la sección Data model) e insertar el catálogo actual de `app/data/games.ts` como seed (sin `best`/`plays`). Verificación: `list_tables` muestra `games`; un `execute_sql` `select` devuelve todas las filas del catálogo.

2. **Migración `scores` (MCP `apply_migration`)** — crear `public.scores` con la FK a `games.id` y el índice `(game_id, score desc)`. Verificación: `list_tables` muestra `scores` vacía; el índice existe.

3. **Capa de datos de juegos** — convertir `app/data/games.ts` a `Game[]` **sin** `best`/`plays` (queda como fallback + contenido). Crear `lib/data/games.ts` con `GameWithStats`, `getGames()` y `getGame(id)` (fetch vía cliente de navegador + derivación de `best`/`plays` desde `scores`, con fallback al array estático → `best:0, plays:0`). Verificación: `npm run build` sin errores; ningún componente lo usa aún.

4. **Capa de datos de scores** — crear `lib/data/scores.ts` con `Score`, `getScores(gameId, limit)`, `getPlayerBest(gameId, name)` e `insertScore(gameId, name, score)`. Verificación: build sin errores; aún sin consumidores.

5. **Biblioteca (`app/games/page.tsx`)** — reemplazar `import { GAMES }` por `getGames()` en `useEffect`, con estado de carga y fallback. Verificación: `/games` lista los juegos desde DB; las cards muestran `best`/`plays` reales (0 al inicio).

6. **Home (`app/page.tsx`)** — el preview de juegos (`GAMES.slice(0,6)`) pasa a `getGames()` con loading + fallback. Verificación: la home muestra el preview desde DB.

7. **Detalle (`app/games/[id]/page.tsx`)** — `getGame(id)` para el juego y `getScores(id, 10)` para el mini-leaderboard (reemplaza `seededScores`), con estado vacío cuando no hay scores. Verificación: `/games/asteroides` muestra datos reales; sin scores, el bloque de ranking degrada a "sin registros".

8. **Salón de la Fama (`app/hall-of-fame/page.tsx`)** — `getScores(tab, 12)` + `getPlayerBest(tab, user)`; agregar **estados vacíos** para el podio (hoy asume `rows[0..2]`) y la tabla. Verificación: con `scores` vacía, la página muestra "sin registros" sin romper; al haber datos, se puebla el podio/tabla y "TU MEJOR MARCA".

9. **Guardar score en Asteroides (`app/games/[id]/play/page.tsx`)** — en el `onGameOver` del motor (solo `id === 'asteroides'`), llamar `insertScore('asteroides', user ?? 'ANÓNIMO', finalScore)` reemplazando el `setSaved(true)` simulado (se marca `saved` tras el insert exitoso). Verificación: jugar Asteroides, perder, y confirmar la fila con `execute_sql`; recargar el Salón de la Fama y ver la marca.

10. **Verificación end-to-end + build** — flujo completo: jugar Asteroides → game over → score guardado → aparece en biblioteca (`best`/`plays`), en detalle y en el Salón de la Fama con "TU MEJOR MARCA". Confirmar `npm run build` sin errores de TypeScript ni de build.

---

## Acceptance criteria

**Base de datos**

- [ ] Existe la tabla `public.games` con las columnas `id, title, short, long, cat, color, cover` y sin `best`/`plays`.
- [ ] `public.games` está sembrada con **todas** las filas del catálogo actual de `app/data/games.ts` (mismos `id` slug).
- [ ] Existe la tabla `public.scores` con `id, game_id, player_name, score, created_at`, la FK `game_id → games.id` y el índice `(game_id, score desc)`.
- [ ] `public.scores` arranca vacía (0 filas tras las migraciones).

**Capa de datos**

- [ ] `lib/data/games.ts` exporta `getGames()` y `getGame(id)` que devuelven `GameWithStats` con `best` = MAX(`score`) y `plays` = COUNT de `scores` del juego (0 cuando no hay).
- [ ] Si la consulta a Supabase falla, `getGames()`/`getGame()` devuelven el contenido del array estático con `best:0, plays:0` (fallback), sin lanzar excepción.
- [ ] `lib/data/scores.ts` exporta `getScores(gameId, limit)` (ordenado por `score` desc), `getPlayerBest(gameId, name)` e `insertScore(gameId, name, score)`.

**UI conectada a datos reales**

- [ ] `/games` (biblioteca) lista los juegos leídos de Supabase y muestra `best`/`plays` derivados.
- [ ] La home (`app/page.tsx`) muestra su preview de juegos desde Supabase.
- [ ] `/games/[id]` (detalle) muestra el juego desde Supabase y su leaderboard desde `scores` (ya no usa `seededScores`).
- [ ] El Salón de la Fama lee `scores` reales por juego y muestra "TU MEJOR MARCA" con `getPlayerBest`.
- [ ] Con un juego sin scores, el Salón de la Fama y el detalle muestran un estado "sin registros" y **no** lanzan error por acceder a `rows[0]`.
- [ ] Ningún componente importa ya `seededScores` para renderizar el leaderboard.

**Guardado de puntuación**

- [ ] Al terminar una partida de Asteroides (game over), se inserta una fila en `scores` con `game_id='asteroides'`, `score` = puntuación final y `player_name` = nombre de `UserContext` o `'ANÓNIMO'` si no hay nombre.
- [ ] La marca guardada aparece en el Salón de la Fama de Asteroides tras recargar, y actualiza `best`/`plays` en biblioteca y detalle.
- [ ] Los demás juegos (mock) **no** insertan ninguna fila en `scores` al jugarse.

**Alcance respetado**

- [ ] No se crearon políticas RLS ni se habilitó RLS en `games`/`scores` (diferido a otro spec).
- [ ] No se modificó `UserContext` ni se agregó autenticación real.
- [ ] `npm run build` completa sin errores de TypeScript ni de build.

---

## Decisions

- **Sí:** `id` de `games` como `text` = slug actual (`'asteroides'`, etc.). Ya se usa en rutas (`/games/[id]`) y en lógica (`id === 'asteroides'`); un uuid obligaría a mapear slug↔id en todos lados.

- **Sí:** `best`/`plays` **derivados** de `scores` (MAX y COUNT), no columnas en `games`. Un leaderboard real exige que la "mejor marca" salga de las partidas, no de un valor manual desincronizado.

- **Sí:** Opción B de tipos — `Game` = contenido puro, `GameWithStats extends Game` con `best`/`plays`. Evita campos opcionales ambiguos; `plays` pasa de `string` decorativo a `number` real.

- **Sí:** Conservar `app/data/games.ts` como **fallback + seed** (respuesta del usuario), en vez de borrarlo. La app sigue mostrando el catálogo aunque Supabase falle, y la migración se siembra desde la misma fuente.

- **Sí:** Fetch **client-side** con el cliente de navegador y `useEffect`, manteniendo los 5 componentes como Client Components. Refactorizarlos a Server Components era un cambio mucho mayor (mover hooks a subcomponentes) sin beneficio en este spec.

- **Sí:** `scores` arranca **vacía** (respuesta del usuario), con estados vacíos en la UI. Se prefiere un leaderboard honesto que se llena jugando, antes que sembrar datos falsos en la DB.

- **Sí:** Solo **Asteroides** inserta scores. Es el único juego con motor real; los mocks generan score falso por `setInterval` y ensuciarían la tabla.

- **Sí:** `player_name = 'ANÓNIMO'` cuando no hay nombre en `UserContext` (respuesta del usuario), en vez de bloquear el guardado. Mantiene el leaderboard poblado sin exigir login (que no existe aún).

- **Sí:** Migraciones vía **MCP `apply_migration`** al proyecto remoto `ugkzgpixmjiymranyklc`, consistente con el flujo remoto del spec 04.

- **No:** RLS y políticas de seguridad en este spec (respuesta del usuario). Las tablas quedan abiertas vía anon key; se difiere a un spec dedicado. Documentado como riesgo.

- **No:** Autenticación real. Se sigue con el nombre de `UserContext` (localStorage); reemplazar auth es otro spec.

- **No:** Tipos generados de Supabase (`generate_typescript_types`). Se usan interfaces manuales, consistentes con las actuales; se evita un archivo generado como dependencia.

- **No:** Sembrar `scores` con datos falsos. Descartado a favor de arrancar vacío.

---

## Risks

| Riesgo                                                                                                                                          | Mitigación                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Tablas sin RLS**: cualquiera con la anon key puede leer/insertar/borrar `scores` y leer `games`.                                              | Aceptado explícitamente; RLS y anti-cheat se difieren a un spec dedicado. Se documenta como deuda de seguridad conocida. |
| **Doble inserción de score en React Strict Mode / doble game over**: el `onGameOver` podría dispararse dos veces y guardar la partida repetida. | Guardar solo una vez por partida: marcar `saved` tras el insert y no reinsertar hasta un nuevo `reset()`/`onRestart`.    |
| **Salón de la Fama y detalle asumen `rows[0..2]`**: con `scores` vacía (estado inicial), el podio rompería.                                     | Estados vacíos obligatorios (paso 7 y 8): si hay menos de 3 filas, mostrar "sin registros" en vez de indexar el array.   |
| **`plays` cambia de `string` ("12.4K") a `number`**: el JSX que lo formatea podría romper o verse raro (0, 1, 2…).                              | Ajustar el formateo en biblioteca/detalle para enteros reales; sin miles hasta que haya volumen de partidas.             |
| **Latencia/fallo de red en fetch client-side**: la UI podría parpadear vacía antes de cargar.                                                   | Estado de carga explícito en cada componente + fallback al array estático en `getGames`/`getGame`.                       |
| **`ANÓNIMO` colapsa marcas de invitados distintos** en una sola etiqueta en el leaderboard.                                                     | Aceptado: sin auth real no hay forma de distinguirlos; se resuelve cuando llegue el spec de autenticación.               |

---

## Lo que **no** está en este spec

- RLS, políticas de seguridad y anti-cheat.
- Autenticación real (reemplazo de `UserContext`).
- Guardado de scores en los juegos mock (todos menos Asteroides).
- Tipos generados de Supabase.
- Panel de administración del catálogo.
- Refactor de los consumidores a Server Components.

Cada uno de esos, si llega, va en su propio spec.
