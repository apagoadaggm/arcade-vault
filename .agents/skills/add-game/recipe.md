# Receta de un juego nuevo en Arcade Vault

Este archivo es la referencia que consulta el skill `/add-game` (misma carpeta) para no
improvisar nombres de archivo ni firmas al redactar el spec de un juego nuevo. Documenta
**cómo se ve, en código, un juego ya integrado** — el caso de referencia es `asteroides`
(spec 05 + spec 06), el único juego con motor real y persistencia real hoy en el repo.

No es texto para copiar literal en el spec — es la forma que el spec debe respetar.

---

## Las seis capas de un juego nuevo

1. **Motor** — `lib/games/<id>/engine.ts`
2. **Componente canvas** — `components/games/<Id>Canvas.tsx`
3. **Integración en el reproductor** — `app/games/[id]/play/page.tsx`
4. **Catálogo** — `app/data/games.ts`
5. **Arte de portada** — `app/globals.css`
6. **Persistencia en Supabase** — fila en `games` (migración) + `scores` (ya genérica, sin cambios)

---

## 1. Motor — `lib/games/<id>/engine.ts`

Agnóstico del DOM: recibe `ctx`, `width`, `height` y `callbacks` por parámetro; nunca lee
`document`/`window.innerWidth` directamente para su tamaño. Referencia real:
`lib/games/asteroids/engine.ts`.

```ts
export interface <Id>EngineCallbacks {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
  onRestart?: () => void;
}

export class <Id>Engine {
  constructor(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    callbacks: <Id>EngineCallbacks,
  );

  update(dt: number): void; // dt ya viene capado por el llamador (típicamente a 0.05s)
  draw(): void;             // playfield + HUD propio del canvas
  reset(): void;            // reinicia la partida; dispara onRestart
  forceGameOver(): void;    // fuerza fin de partida sin colisión; dispara onGameOver
  destroy(): void;          // remueve listeners de keydown/keyup de window
}
```

Convenciones internas a preservar:

- Entidades del juego (balas, enemigos, partículas, power-ups) como clases con
  `update(dt, ...)` y `draw(ctx)`, y un flag `dead` para filtrarlas tras cada frame.
- Constantes indexadas por tamaño/tipo (equivalente a `RADII`/`SPEEDS`/`POINTS` en
  Asteroides) declaradas a nivel de módulo.
- Listeners de teclado como arrow-function **class properties** (para que la referencia
  sea estable y removible), añadidos con `window.addEventListener` en el constructor y
  removidos explícitamente en `destroy()`.
- Toda mutación de `score`/`lives`/`level`/estado de partida pasa por setters internos que
  disparan el callback correspondiente (`setScore` → `onScoreChange`, etc.) — así React
  nunca necesita duplicar el estado del motor.
- `reset()` y `forceGameOver()` son la única vía de reinicio/fin, tanto si lo pide el
  propio motor (ej. Space tras game over) como si lo pide React vía ref — un solo camino,
  no dos implementaciones divergentes.

---

## 2. Componente canvas — `components/games/<Id>Canvas.tsx`

`"use client"`. Resolución interna fija (Asteroides usa 800×600, 4:3), escalada por CSS
(`width:100%; height:100%`) para caber en `.crt-screen`. Referencia real:
`components/games/AsteroidsCanvas.tsx`.

```ts
export interface <Id>CanvasProps extends <Id>EngineCallbacks {
  paused: boolean;
}
export interface <Id>CanvasHandle {
  reset: () => void;
  forceGameOver: () => void;
}
export const <Id>Canvas = forwardRef<<Id>CanvasHandle, <Id>CanvasProps>(...)
```

Patrones a preservar:

- Refs: `canvasRef` (el `<canvas>`), `engineRef` (instancia del motor), `pausedRef` y
  `callbacksRef` — ambos actualizados en cada render (`pausedRef.current = paused`, etc.)
  para que el efecto de montaje pueda quedar con dependencias `[]` sin quedar con
  callbacks obsoletos.
- El motor se instancia una sola vez, con callbacks "wrapper" que leen
  `callbacksRef.current.on*?.(...)` — evita reconstruir el motor en cada render.
- `useImperativeHandle(ref, () => ({ reset, forceGameOver }), [])` delega al motor.
- El loop `requestAnimationFrame` vive dentro de ese único `useEffect([])`: si
  `pausedRef.current` es true, no llama `update`/`draw` (pero sigue pidiendo el próximo
  frame) y resetea el `lastTime` a `null` para no saltar el `dt` al reanudar; si no está
  pausado, calcula `dt = Math.min((ts - lastTime) / 1000, 0.05)` y llama
  `engine.update(dt); engine.draw();`.
- Cleanup del efecto: `cancelAnimationFrame`, `engine.destroy()`, limpiar `engineRef`.

---

## 3. Integración en el reproductor — `app/games/[id]/play/page.tsx`

Página compartida por todos los juegos. Los juegos sin motor real siguen usando el mock
existente (`.game-arena`, `setInterval` de score falso) — **no tocar esa rama**. Solo se
añade una rama condicional nueva para el `id` del juego nuevo.

Patrón (`isAsteroides` es el ejemplo real ya en el código):

```tsx
const is<Id> = id === "<id>";
```

```tsx
{is<Id> ? (
  <<Id>Canvas
    ref={canvasRef}
    paused={paused}
    onScoreChange={setScore}
    onLivesChange={setLives}
    onLevelChange={setLevel}
    onGameOver={(finalScore) => {
      setOver(true); setSaved(false); setSaveError(false);
      if (savedOnceRef.current) return;
      savedOnceRef.current = true;
      insertScore("<id>", user ?? "ANÓNIMO", finalScore)
        .then(() => setSaved(true))
        .catch(() => { savedOnceRef.current = false; setSaveError(true); });
    }}
    onRestart={() => {
      setOver(false); setSaved(false); setSaveError(false);
      setName(user ?? "INVITADO"); savedOnceRef.current = false;
    }}
  />
) : (
  <div className="game-arena">{/* mock existente, sin cambios */}</div>
)}
```

Botones:

- **PAUSA/REANUDAR** → `setPaused(p => !p)`; controla la prop `paused` del canvas.
- **FIN** → si `is<Id>`: `setPaused(false); canvasRef.current?.forceGameOver()` (pasa por
  el motor, no abre el modal "por fuera").
- **JUGAR DE NUEVO** (en el modal de fin de partida) → `canvasRef.current?.reset()`.
- **SALIR** → `<Link href={`/games/${id}`}>`.

El guardado de score usa `insertScore` de `lib/data/scores.ts`, guardado por
`savedOnceRef` para no insertar dos veces la misma partida (React Strict Mode / doble
disparo de `onGameOver`). El nombre del jugador viene de `useUser()`
(`app/context/UserContext.tsx`); si no hay nombre, se usa `'ANÓNIMO'`.

---

## 4. Catálogo — `app/data/games.ts`

```ts
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER";
  cover: string; // clase CSS, ej. "cover-<id>"
  color: "cyan" | "magenta" | "yellow" | "green";
}
```

`Game` **no** tiene `best`/`plays` — son derivados (`MAX(score)`/`COUNT`) por
`lib/data/games.ts` (`GameWithStats`), nunca columnas manuales. Se añade una entrada al
array `GAMES` con el `id` del juego nuevo; ese mismo array es fallback si Supabase falla
y fuente del seed de la migración.

---

## 5. Arte de portada — `app/globals.css`

Bloque `.cover-<id>` con el mismo patrón de tres capas que `.cover-asteroides` /
`.cover-rocas`: gradiente base en el elemento, `::after` con `radial-gradient`s para el
detalle (rocas/estrellas/bloques/lo que corresponda al tema), `::before` opcional con un
glifo central (ej. `▲` para una nave) coloreado con la variable del `color` del juego
(`var(--cyan)`, etc.) y `text-shadow` a juego.

---

## 6. Persistencia en Supabase

**Tabla `games`** (`public.games`, PK `id text` = slug) — se inserta una fila nueva vía
MCP `apply_migration` al proyecto remoto (mismo proyecto que spec 04/06):

```sql
insert into public.games (id, title, short, long, cat, color, cover)
values ('<id>', '<TITLE>', '<short>', '<long>', '<CAT>', '<color>', 'cover-<id>');
```

**Tabla `scores`** (`public.scores`) — **no requiere ningún cambio de schema por juego**;
es genérica por `game_id`. El juego nuevo la usa tal cual a través de las funciones ya
existentes en `lib/data/scores.ts`:

```ts
getScores(gameId, limit = 12): Promise<Score[]>
getPlayerBest(gameId, name): Promise<number | null>
insertScore(gameId, name, score): Promise<void>
```

No hay RLS en ninguna de las dos tablas (deuda de seguridad conocida, diferida desde spec 06) — no se resuelve en el spec de un juego individual.

---

## Checklist rápido para el spec (Implementation plan típico)

1. Motor — `lib/games/<id>/engine.ts` (port de una referencia, o diseño desde cero).
2. Componente canvas — `components/games/<Id>Canvas.tsx`.
3. Integración condicional en `app/games/[id]/play/page.tsx`.
4. Entrada en `app/data/games.ts` + bloque `.cover-<id>` en `app/globals.css`.
5. Migración: `insert` de la fila del juego en `public.games` vía MCP `apply_migration`.
6. Guardado de score real en `onGameOver` vía `insertScore`, guardado por `savedOnceRef`.
7. Verificación end-to-end (Biblioteca → Detalle → jugar → game over → Salón de la Fama) +
   `npm run build` sin errores.
