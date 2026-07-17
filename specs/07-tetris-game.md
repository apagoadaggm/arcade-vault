# SPEC 07 — Juego Tetris (motor real)

> **Estado:** Aprobado · **Depende de:** 05-asteroides-game, 06-supabase-games-scores · **Fecha:** 2026-07-17
> **Objetivo:** Portar el Tetris de `references/started-games/03-tetris/game.js` a un motor TypeScript + componente canvas que se integra como juego nuevo `tetris` en el Reproductor, el catálogo y el leaderboard real de Supabase.

---

## Scope

**In:**

- Crear `lib/games/tetris/engine.ts` — puerto a TypeScript de
  `references/started-games/03-tetris/game.js`: modelo de tablero (`board`, matriz
  10×20), las 8 piezas (7 tetrominós estándar + la pieza "tuerca" extra), rotación con
  wall kicks (`rotateCW` + `tryRotate` con desplazamientos ±1/±2), colisión (`collide`),
  soft drop / hard drop, limpieza de líneas (`clearLines`), sistema de niveles/velocidad
  (`dropInterval`), pieza fantasma (`ghostY`) y vista previa de la siguiente pieza — todo
  dibujado **dentro de un único `<canvas>`** de resolución interna 800×600 (igual que
  Asteroides): el tablero centrado/escalado y un panel lateral con SCORE/LINES/LEVEL +
  preview de la siguiente pieza, dibujados por el propio motor. Expone una clase
  `TetrisEngine` con:
  - `update(dt)` y `draw()`.
  - Listeners de teclado propios (`keydown`) atados a `window`, con `destroy()` para
    limpiarlos. Controles idénticos al original: ←/→ mover, ↑ o X rotar, ↓ soft drop
    (+1 pt/fila), Espacio hard drop (+2 pt/celda). **Sin** tecla de pausa propia (`P` se
    elimina del puerto) — la pausa es responsabilidad exclusiva de la prop `paused` del
    componente canvas, igual que Asteroides.
  - Callbacks de notificación: `onScoreChange`, `onLevelChange`, `onLivesChange`,
    `onGameOver(finalScore)`, `onRestart`. `onLivesChange` se dispara **una sola vez**
    con el valor fijo `1` (al iniciar/reiniciar) — Tetris no tiene vidas: perder es game
    over directo, así que el HUD compartido de "Vidas" muestra un solo corazón fijo sin
    necesidad de tocar el HUD compartido de `page.tsx`.
  - Métodos imperativos `reset()` (reinicia la partida, dispara `onRestart`) y
    `forceGameOver()` (fuerza el fin de partida sin colisión real, dispara `onGameOver`).
  - Puntuación y velocidad idénticas al original: `LINE_SCORES = [0,100,300,500,800]` ×
    nivel; nivel = `floor(líneas/10)+1`; `dropInterval = max(100, 1000-(nivel-1)×90)` ms.

- Crear `components/games/TetrisCanvas.tsx` — `"use client"`, `forwardRef` que expone
  `{ reset, forceGameOver }` vía `useImperativeHandle`. Monta un `<canvas>` de resolución
  fija 800×600, escalado por CSS (`width:100%; height:100%`). Instancia `TetrisEngine` en
  un `useEffect`, corre el loop vía `requestAnimationFrame` (pausable con la prop
  `paused`), y reenvía los callbacks del motor como props. Mismo patrón de refs
  (`canvasRef`, `engineRef`, `pausedRef`, `callbacksRef`) que `AsteroidsCanvas.tsx`.

- Modificar `app/games/[id]/play/page.tsx` — cuando `id === 'tetris'`, renderiza
  `<TetrisCanvas>` dentro de `.crt-screen` en lugar del mock decorativo. El HUD superior
  de React sigue mostrando jugador/puntuación/vidas (fijo en 1)/nivel, alimentados por los
  callbacks del motor. Botón "PAUSA" controla la prop `paused`. Botón "FIN" llama a
  `canvasRef.current?.forceGameOver()`. Modal de fin de partida vía `onGameOver`; "JUGAR
  DE NUEVO" llama a `canvasRef.current?.reset()`. Guardado real de score:
  `insertScore('tetris', user ?? 'ANÓNIMO', finalScore)` guardado por un `savedOnceRef`
  propio para este juego (para no interferir con el de Asteroides), igual patrón que la
  receta. Cualquier otro `id` (incluidos `asteroides`, `caida`, `rocas`, etc.) no cambia.

- Añadir la entrada `tetris` en `app/data/games.ts`: `id: 'tetris'`, `title: 'TETRIS'`,
  `cat: 'PUZZLE'`, `color: 'yellow'`, `cover: 'cover-tetris'` (textos en Data model).

- Añadir `.cover-tetris` en `app/globals.css` — patrón de 3 capas (gradiente base amarillo
  - `::after` con bloques rectangulares apilados tipo tetrominó + `::before` con un glifo
    central en `var(--yellow)`), distinta de `.cover-tetro` (la del mock `caida`).

- Migración: `insert` de la fila `tetris` en `public.games` vía MCP `apply_migration`
  (mismo proyecto que specs 04/06).

**Fuera de alcance:**

- Cualquier cambio a la entrada mock `caida` (sigue siendo mock, id/title/cat/color/cover
  intactos) — `tetris` es una entrada nueva y separada, mismo patrón que `rocas` →
  `asteroides`.
- Controles táctiles/móviles.
- Audio o efectos de sonido (el original no los tiene).
- El toggle de tema claro/oscuro del original (`localStorage: 'tetris-theme'`) — no aplica
  al theming de Arcade Vault, se descarta al portar.
- Un segundo `<canvas>` para la vista previa de la siguiente pieza — se dibuja dentro del
  mismo canvas del motor.
- RLS, políticas de seguridad o anti-cheat en Supabase (deuda ya conocida, diferida desde
  spec 06).
- Una interfaz/abstracción genérica de "motor de juego" reutilizable para futuros títulos.
- Rediseño visual del HUD compartido, del modal de fin de partida o de la pantalla de
  Detalle.

---

## Data model

**Entrada nueva en `app/data/games.ts`** (`GAMES: Game[]`, misma interfaz `Game` ya
vigente desde spec 06, sin `best`/`plays`):

```ts
{
  id: 'tetris',
  title: 'TETRIS',
  short: 'Encaja las piezas antes de que la torre te sepulte.',
  long: 'Piezas geométricas caen sin descanso desde la oscuridad. Rota, desliza y '
      + 'encaja cada tetrominó para completar líneas antes de que el tablero se '
      + 'desborde. Cada 10 líneas el ritmo se acelera sin piedad.',
  cat: 'PUZZLE',
  cover: 'cover-tetris',
  color: 'yellow',
}
```

**Modelo interno del motor** — `lib/games/tetris/engine.ts` (puerto directo de las
constantes/estructuras de `game.js`):

```ts
const COLS = 10;
const ROWS = 20;

// 0 = vacío; índices 1–8 son las 8 piezas (7 tetrominós + "tuerca")
type Board = number[][]; // ROWS x COLS

interface Piece {
  type: number; // 1–8
  shape: number[][];
  x: number;
  y: number;
}

const LINE_SCORES = [0, 100, 300, 500, 800];
```

**API del motor**:

```ts
export interface TetrisEngineCallbacks {
  onScoreChange?: (score: number) => void;
  onLevelChange?: (level: number) => void;
  onLivesChange?: (lives: number) => void; // se emite una sola vez con valor 1
  onGameOver?: (finalScore: number) => void;
  onRestart?: () => void;
}

export class TetrisEngine {
  constructor(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    callbacks: TetrisEngineCallbacks,
  );

  update(dt: number): void; // dt en segundos, cap por el llamador (~0.05s)
  draw(): void; // tablero centrado + panel lateral (score/lines/level/next) + ghost piece
  reset(): void; // equivale a init() original; dispara onRestart y onLivesChange(1)
  forceGameOver(): void; // fuerza game over sin colisión real; dispara onGameOver
  destroy(): void; // remueve el listener de keydown de window
}
```

**Props/ref del componente** — `components/games/TetrisCanvas.tsx`:

```ts
export interface TetrisCanvasProps extends TetrisEngineCallbacks {
  paused: boolean;
}
export interface TetrisCanvasHandle {
  reset: () => void;
  forceGameOver: () => void;
}
```

**Migración `games`** (vía MCP `apply_migration`, sin cambios de esquema — solo un
`insert` nuevo sobre la tabla ya creada en spec 06):

```sql
insert into public.games (id, title, short, long, cat, color, cover)
values (
  'tetris',
  'TETRIS',
  'Encaja las piezas antes de que la torre te sepulte.',
  'Piezas geométricas caen sin descanso desde la oscuridad. Rota, desliza y encaja cada tetrominó para completar líneas antes de que el tablero se desborde. Cada 10 líneas el ritmo se acelera sin piedad.',
  'PUZZLE',
  'yellow',
  'cover-tetris'
);
```

`public.scores` **no cambia** — es genérica por `game_id` desde spec 06; `tetris` la usa
tal cual vía `lib/data/scores.ts` (`getScores`, `getPlayerBest`, `insertScore`).

---

## Implementation plan

1. **Motor del juego** — crear `lib/games/tetris/engine.ts` portando fielmente
   `game.js`: modelo de tablero (`board`, 10×20), las 8 piezas, `rotateCW`/`tryRotate`
   (wall kicks ±1/±2), `collide`, `clearLines`, `ghostY`, soft/hard drop, sistema de
   niveles/velocidad. Encapsulado en la clase `TetrisEngine` con `reset()`,
   `forceGameOver()`, `destroy()` y los callbacks `onScoreChange`, `onLevelChange`,
   `onLivesChange` (emitido una vez con `1`), `onGameOver`, `onRestart`. Todo el dibujo
   (tablero centrado + panel lateral SCORE/LINES/LEVEL + preview de la siguiente pieza +
   ghost piece) ocurre dentro de un único canvas 800×600, sin tecla de pausa propia.
   Verificación: `npx tsc --noEmit` sin errores; el archivo no se importa aún en ningún
   componente, la app sigue funcionando igual que antes.

2. **Componente canvas** — crear `components/games/TetrisCanvas.tsx`, `forwardRef` que
   instancia `TetrisEngine` sobre un `<canvas>` 800×600 escalado por CSS, con loop
   `requestAnimationFrame` pausable vía la prop `paused`, y expone
   `{ reset, forceGameOver }` por ref. Verificación: compila sin errores; aún no se usa
   en ninguna página.

3. **Integrar en el Reproductor** — modificar `app/games/[id]/play/page.tsx`: cuando
   `id === 'tetris'`, renderizar `<TetrisCanvas ref={canvasRef}>` dentro de
   `.crt-screen` en lugar del mock decorativo. Conectar `onScoreChange` /
   `onLevelChange` / `onLivesChange` a `setScore` / `setLevel` / `setLives` (este último
   fija "Vidas" en 1 corazón, sin más lógica). Botón "PAUSA" controla `paused`. Botón
   "FIN" llama a `canvasRef.current?.forceGameOver()`. `onGameOver` abre el modal;
   "JUGAR DE NUEVO" llama a `canvasRef.current?.reset()`. `onRestart` cierra el modal y
   restablece `name`. Cualquier otro `id` (incluidos `asteroides`, `caida`, `rocas`)
   sigue su rama actual sin cambios. Verificación: navegar a
   `http://localhost:3000/games/tetris/play` permite jugar con teclado (mover, rotar,
   soft/hard drop); el HUD de React refleja puntuación/nivel/vidas(1) en tiempo real;
   pausar/reanudar funciona; que la pieza no quepa al aparecer abre el modal de fin de
   partida.

4. **Catálogo y portada** — añadir la entrada `tetris` a `app/data/games.ts` y la clase
   `.cover-tetris` a `app/globals.css` (patrón de 3 capas, distinta de `.cover-tetro`).
   Verificación: `/games` muestra la card "TETRIS" con su portada y enlaza a
   `/games/tetris`, que a su vez enlaza a `/games/tetris/play`; `caida` no cambió.

5. **Migración de catálogo** — vía MCP `apply_migration`, insertar la fila `tetris` en
   `public.games` (sin cambios de esquema). Verificación: `list_tables`/`execute_sql`
   confirman la nueva fila; `/games` la lista al leer de Supabase.

6. **Guardado de score real** — en el `onGameOver` de la rama `tetris` en
   `app/games/[id]/play/page.tsx`, llamar
   `insertScore('tetris', user ?? 'ANÓNIMO', finalScore)`, reutilizando el mismo patrón
   de `savedOnceRef` ya usado por Asteroides para evitar inserciones dobles (React
   Strict Mode / doble disparo de `onGameOver`). Verificación: jugar Tetris, perder, y
   confirmar la fila con `execute_sql`; el Salón de la Fama de `tetris` la muestra tras
   recargar.

7. **Verificación end-to-end + build** — flujo completo: Biblioteca → card "TETRIS" →
   Detalle → "JUGAR AHORA" → jugar con teclado (mover, rotar, soft/hard drop, limpiar
   líneas, subir de nivel) → game over al no caber una pieza nueva → modal con
   puntuación final → "JUGAR DE NUEVO" reinicia y "SALIR" vuelve a Biblioteca. Confirmar
   que la marca aparece en el Salón de la Fama con "TU MEJOR MARCA". Confirmar
   `npm run build` sin errores de TypeScript ni de build.

---

## Acceptance criteria

**Motor y componente**

- [ ] `lib/games/tetris/engine.ts` exporta `TetrisEngine` con `reset()`,
      `forceGameOver()`, `destroy()` y los callbacks `onScoreChange`, `onLevelChange`,
      `onLivesChange`, `onGameOver`, `onRestart`.
- [ ] `npm run build` no reporta errores de tipos en `engine.ts` ni en
      `TetrisCanvas.tsx`.
- [ ] `components/games/TetrisCanvas.tsx` expone `{ reset, forceGameOver }` vía ref y
      limpia el loop de `requestAnimationFrame` y el listener de teclado al
      desmontarse.

**Reproductor (`/games/tetris/play`)**

- [ ] Al navegar a `/games/tetris/play` se renderiza el canvas del juego real (no el
      mock decorativo).
- [ ] ←/→ mueven la pieza, ↑ o X la rotan (con wall kicks), ↓ hace soft drop y Espacio
      hace hard drop, igual que el original.
- [ ] El panel dibujado en canvas muestra SCORE/LINES/LEVEL y la vista previa de la
      siguiente pieza; la pieza fantasma (ghost) se ve semitransparente en su posición
      de aterrizaje.
- [ ] El HUD de React (panel superior) refleja la misma puntuación y nivel que el
      canvas en tiempo real, y muestra "Vidas" fijo en 1 corazón durante toda la
      partida.
- [ ] El botón "PAUSA" detiene el loop del juego (todo se congela) y "REANUDAR" lo
      retoma; no existe ninguna tecla de pausa propia del motor.
- [ ] El botón "FIN" fuerza el fin de partida real (`forceGameOver`), abriendo el modal
      de React con la puntuación final.
- [ ] Que una pieza nueva no quepa al aparecer dispara automáticamente el modal de
      React con la puntuación final (game over).
- [ ] Completar una línea la elimina del tablero, suma los puntos de `LINE_SCORES`
      multiplicados por el nivel, y las líneas de arriba caen una posición.
- [ ] El nivel sube cada 10 líneas acumuladas y la velocidad de caída aumenta en
      consecuencia.
- [ ] Las 8 piezas (7 tetrominós + "tuerca") aparecen aleatoriamente durante el juego.
- [ ] El botón "JUGAR DE NUEVO" del modal reinicia el motor mediante `ref.reset()` y el
      juego queda jugable desde cero.
- [ ] El botón "SALIR" navega de vuelta a `/games/tetris` sin errores.

**Persistencia**

- [ ] Al terminar una partida (game over), se inserta una fila en `scores` con
      `game_id='tetris'`, `score` = puntuación final y `player_name` = nombre de
      `UserContext` o `'ANÓNIMO'` si no hay nombre.
- [ ] La marca guardada aparece en el Salón de la Fama de `tetris` tras recargar, y
      actualiza `best`/`plays` en biblioteca y detalle.
- [ ] No se inserta más de una fila por partida (React Strict Mode / doble disparo de
      `onGameOver`).

**Catálogo y navegación**

- [ ] `/games` muestra la card "TETRIS" con la portada `.cover-tetris`.
- [ ] La card "TETRIS" enlaza a `/games/tetris` (Detalle) y desde ahí "JUGAR AHORA"
      enlaza a `/games/tetris/play`.
- [ ] La entrada `caida` (card, detalle, reproductor mock) no sufrió ningún cambio de
      comportamiento.

**Alcance respetado**

- [ ] No se agregaron controles táctiles ni botones en pantalla.
- [ ] No se agregó ningún toggle de tema claro/oscuro propio del juego.
- [ ] No se removió ni se modificó ningún otro juego existente (`asteroides`, `rocas`,
      `caida`, etc.).
- [ ] `npm run build` completa sin errores de TypeScript ni de build.

---

## Decisions

- **Sí:** Juego nuevo con `id: 'tetris'`, separado de la entrada mock existente
  `caida`. Sigue el mismo patrón que `rocas` → `asteroides`: `caida` sigue siendo mock
  intacto; este es un motor real independiente.

- **Sí:** `color: 'yellow'` para diferenciarlo visualmente de `caida` (`magenta`),
  aunque ambos colores ya se repiten en otros juegos del catálogo — no había un color
  100% libre entre los 4 disponibles.

- **Sí:** Motor separado en `lib/games/tetris/engine.ts` + componente delgado
  `TetrisCanvas.tsx`, siguiendo exactamente la misma separación que
  `lib/games/asteroids/engine.ts` / `AsteroidsCanvas.tsx` de spec 05.

- **Sí:** Todo el dibujo (tablero + panel lateral de score/lines/level + preview de la
  siguiente pieza + ghost piece) ocurre dentro de un único `<canvas>` de 800×600, en
  vez de los dos `<canvas>` del original (`board` + `next-canvas`). Mantiene el patrón
  de "un solo canvas por componente" que sigue Asteroides y evita tocar el layout de
  `.crt-screen`.

- **Sí:** Se elimina la tecla `P` de pausa interna del motor portado. La pausa queda
  100% controlada por la prop `paused` del componente canvas (igual que Asteroides),
  evitando dos mecanismos de pausa divergentes.

- **Sí:** Se conservan las 8 piezas del original (7 tetrominós estándar + la pieza
  "tuerca" extra), fiel al puerto del `game.js` de referencia.

- **Sí:** `onLivesChange` se emite una sola vez con el valor fijo `1` — Tetris no tiene
  vidas reales (perder es game over directo), pero esto evita tocar el HUD compartido
  de `page.tsx` (el campo "Vidas" simplemente muestra un corazón fijo).

- **Sí:** Persistencia real en Supabase desde el primer spec de este juego (a
  diferencia de Asteroides, que separó motor de persistencia en specs 05/06 porque la
  tabla `scores` aún no existía). Aquí la tabla ya existe desde spec 06, así que este
  spec cubre motor + integración + persistencia de una vez.

- **No:** Se descarta el toggle de tema claro/oscuro del original
  (`localStorage: 'tetris-theme'`) — no aplica al sistema de theming de Arcade Vault.

- **No:** Controles táctiles/móviles. Se difiere a un spec futuro dedicado a soporte
  táctil para todo el catálogo.

- **No:** RLS, políticas de seguridad ni anti-cheat en Supabase. Deuda ya conocida y
  diferida desde spec 06; no se resuelve en el spec de un juego individual.

- **No:** Abstracción genérica reutilizable de "motor de juego". Prematuro con solo dos
  motores reales (Asteroides y Tetris); se diseña si llega un tercero.

- **No:** Cambiar el diseño visual del HUD compartido, del modal de fin de partida o de
  la pantalla de Detalle. Solo se conecta el juego a datos reales, no se rediseña la UI.

---

## Risks

| Riesgo                                                                                                                                                                                                    | Mitigación                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Doble montaje en React Strict Mode**: si `destroy()` no limpia bien el `requestAnimationFrame` y el listener de `keydown`, podrían arrancar dos loops o duplicar el movimiento por cada pulsación.      | `destroy()` cancela el `rAF` pendiente y remueve explícitamente el listener antes de que el segundo montaje cree el suyo, igual que Asteroides.                               |
| **Doble inserción de score**: `onGameOver` podría dispararse dos veces (Strict Mode / doble colisión de spawn) y guardar la partida repetida.                                                             | Reutilizar el patrón `savedOnceRef` ya probado en Asteroides: se guarda solo una vez por partida hasta el próximo `reset()`/`onRestart`.                                      |
| **Tablero angosto (10×20) dentro de un canvas 800×600**: al centrar el tablero y dejar espacio para el panel lateral, los bloques podrían verse pequeños o el layout desbalanceado en pantallas angostas. | No se soluciona en este spec (responsive/táctil queda fuera de alcance); se documenta para un spec futuro de adaptación móvil, igual que el riesgo equivalente de Asteroides. |
| **`ANÓNIMO` colapsa marcas de invitados distintos** en una sola etiqueta del leaderboard de `tetris`.                                                                                                     | Riesgo ya aceptado desde spec 06 para todo el catálogo; se resuelve cuando llegue el spec de autenticación real.                                                              |

---

## Lo que **no** está en este spec

- Cualquier cambio a la entrada mock `caida`.
- Controles táctiles/móviles.
- Audio o efectos de sonido.
- El toggle de tema claro/oscuro del original.
- Un segundo `<canvas>` para la vista previa de la siguiente pieza.
- RLS, políticas de seguridad o anti-cheat en Supabase.
- Una abstracción genérica de "motor de juego" reutilizable.
- Rediseño visual del HUD compartido, del modal de fin de partida o de la pantalla de
  Detalle.

Cada uno de esos, si llega, va en su propio spec.
