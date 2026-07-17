# SPEC 08 — Juego Arkanoid (motor real)

> **Estado:** Implementado · **Depende de:** 05-asteroides-game, 06-supabase-games-scores · **Fecha:** 2026-07-17
> **Objetivo:** Portar el Arkanoid de `references/started-games/04-arkanoid/` (lógica, niveles y spritesheet) a un motor TypeScript + componente canvas con progresión infinita de niveles, integrado como juego nuevo `arkanoid` en el Reproductor, el catálogo y el leaderboard real de Supabase.

---

## Scope

**In:**

- Crear `lib/games/arkanoid/engine.ts` — puerto a TypeScript de
  `references/started-games/04-arkanoid/game.js` + `levels.js`: paleta (`paddle`),
  pelota (`ball`) con rebotes AABB contra paredes/paleta/bloques, los 5 patrones de
  bloques originales (`LEVELS`), animaciones de explosión al destruir un bloque
  (4 frames), sistema de vidas (inicia en 3) y puntuación. **Progresión infinita**: al
  limpiar el nivel 5, el nivel 6 reutiliza el patrón de bloques del nivel 1 (ciclo de
  los 5 patrones se repite indefinidamente — patrón del nivel N = patrón
  `((N-1) mod 5) + 1`), con velocidad de la pelota `speed(N) = 1.10^(N-1)` y puntos por
  bloque `points(N) = round(10 × 1.10^(N-1))`, ambos calculados por nivel sin límite
  superior — el juego termina únicamente al perder las 3 vidas, nunca por "victoria".
  Controles **solo teclado** (←/→ mueven la paleta), igual que Asteroides/Tetris — se
  descarta el control por mouse del original. **Sin tecla de pausa propia** (se elimina
  `P`/`Escape` y el selector de nivel del overlay de pausa original) — la pausa es
  responsabilidad exclusiva de la prop `paused` del componente canvas, igual que
  Asteroides y Tetris. Renderizado con el **spritesheet real** portado del original
  (`assets/spritesheet-breakout.png` → `public/games/arkanoid/spritesheet-breakout.png`),
  cargado de forma asíncrona por el motor (mientras carga, `draw()` no dibuja sprites
  hasta que la imagen esté lista). Expone una clase `ArkanoidEngine` con:
  - `update(dt)` y `draw()`.
  - Listeners de teclado propios (`keydown`/`keyup`) atados a `window`, con `destroy()`
    para limpiarlos.
  - Callbacks `onScoreChange`, `onLevelChange`, `onLivesChange`, `onGameOver(finalScore)`,
    `onRestart`.
  - Métodos imperativos `reset()` (reinicia la partida en nivel 1, dispara `onRestart`) y
    `forceGameOver()` (fuerza el fin de partida sin perder las vidas por colisión real,
    dispara `onGameOver`).

- Crear `components/games/ArkanoidCanvas.tsx` — `"use client"`, `forwardRef` que expone
  `{ reset, forceGameOver }` vía `useImperativeHandle`. Mismo patrón exacto que
  `AsteroidsCanvas.tsx`/`TetrisCanvas.tsx`: canvas 800×600 escalado por CSS, loop propio
  vía `requestAnimationFrame` pausable con la prop `paused`.

- Modificar `app/games/[id]/play/page.tsx` — cuando `id === 'arkanoid'`, renderiza
  `<ArkanoidCanvas>` dentro de `.crt-screen` en lugar del mock decorativo. HUD superior
  de React (jugador/puntuación/vidas/nivel) alimentado por los callbacks del motor.
  Botón "PAUSA" controla `paused`. Botón "FIN" llama a `forceGameOver()`. Modal de fin de
  partida vía `onGameOver`; "JUGAR DE NUEVO" llama a `reset()`. Guardado real de score:
  `insertScore('arkanoid', user ?? 'ANÓNIMO', finalScore)` guardado por un
  `savedOnceRef` propio para este juego, mismo patrón que Asteroides/Tetris. Cualquier
  otro `id` (incluidos `bloque-buster`, `asteroides`, `tetris`, etc.) no cambia.

- Añadir la entrada `arkanoid` en `app/data/games.ts`: `id: 'arkanoid'`,
  `title: 'ARKANOID'`, `cat: 'ARCADE'`, `color: 'magenta'`, `cover: 'cover-arkanoid'`
  (textos `short`/`long` redactados en Data model).

- Añadir `.cover-arkanoid` en `app/globals.css` — patrón de 3 capas (gradiente base +
  `::after` con detalle visual + `::before` con glifo central), distinta de
  `.cover-bricks` (la del mock `bloque-buster`).

- Migración: `insert` de la fila `arkanoid` en `public.games` vía MCP `apply_migration`
  (mismo proyecto que specs 04/06/07).

**Fuera de alcance:**

- Cualquier cambio a la entrada mock `bloque-buster` (sigue siendo mock, id/title/cat/
  color/cover intactos) — `arkanoid` es una entrada nueva y separada, mismo patrón que
  `rocas` → `asteroides` y `caida` → `tetris`.
- Control de la paleta por mouse — solo teclado, consistente con el resto del catálogo.
- Tecla de pausa propia del motor y el selector de nivel del overlay de pausa original.
- Estado de "victoria"/pantalla de fin de juego por completar niveles — reemplazado por
  progresión infinita; el único fin de partida es perder las 3 vidas.
- Audio o efectos de sonido (`ball-bounce.mp3`, `break-sound.mp3` del original).
- Controles táctiles/móviles.
- RLS, políticas de seguridad o anti-cheat en Supabase (deuda ya conocida, diferida desde
  spec 06).
- Una interfaz/abstracción genérica de "motor de juego" reutilizable para futuros
  títulos.
- Rediseño visual del HUD compartido, del modal de fin de partida o de la pantalla de
  Detalle.

---

## Data model

**Entrada nueva en `app/data/games.ts`** (`GAMES: Game[]`, misma interfaz `Game` ya
vigente desde spec 06, sin `best`/`plays`):

```ts
{
  id: 'arkanoid',
  title: 'ARKANOID',
  short: 'Rebota la pelota y no dejes que ningún bloque sobreviva.',
  long: 'Controla una paleta de neón y desvía una pelota implacable contra murallas de '
      + 'bloques cromáticos. Cada impacto suma puntos; cada nivel superado acelera la '
      + 'pelota y reordena el patrón. Los cinco patrones se repiten en un ciclo infinito '
      + 'cada vez más veloz — resiste todo lo que puedas antes de perder tus tres vidas.',
  cat: 'ARCADE',
  cover: 'cover-arkanoid',
  color: 'magenta',
}
```

**Modelo interno del motor** — `lib/games/arkanoid/engine.ts` (puerto directo de
`game.js` + `levels.js` + `assets/spritesheet.js`):

```ts
interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Ball {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}
interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor; // 'gray' | 'red' | 'yellow' | 'cyan' | 'magenta' | 'hotpink' | 'green'
  alive: boolean;
}
interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number; // ms transcurridos, filtrada cuando elapsed >= EXPLOSION_DURATION
}

// Puerto literal de levels.js: 5 patrones de bloques (col, row, color), sin velocidad
// embebida — la velocidad y el puntaje del nivel se calculan por fórmula (ver abajo).
const BLOCK_PATTERNS: { col: number; row: number; color: BlockColor }[][] = [
  /* l1..l5 */
];

// Progresión infinita (nivel 6+ reutiliza los patrones en ciclo):
const patternForLevel = (level: number) => BLOCK_PATTERNS[(level - 1) % 5];
const speedForLevel = (level: number) => Math.pow(1.1, level - 1);
const pointsPerBlockForLevel = (level: number) =>
  Math.round(10 * Math.pow(1.1, level - 1));

// Atlas de sprites, puerto literal de assets/spritesheet.js (coordenadas sx/sy/sw/sh):
const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
};
const EXPLOSION_FRAMES: Record<
  BlockColor,
  { sx: number; sy: number; sw: number; sh: number }[]
> = {/* ... */};
const EXPLOSION_DURATION = 150; // ms, igual al original
```

**Asset portado:** `references/started-games/04-arkanoid/assets/spritesheet-breakout.png`
se copia a `public/games/arkanoid/spritesheet-breakout.png`. El motor carga la imagen de
forma asíncrona (`new Image(); img.src = '/games/arkanoid/spritesheet-breakout.png'`) y
mantiene un flag `spriteReady`; `draw()` no dibuja paleta/pelota/bloques/explosiones
hasta que la imagen termine de cargar (solo el playfield vacío + HUD).

**API del motor**:

```ts
export interface ArkanoidEngineCallbacks {
  onScoreChange?: (score: number) => void;
  onLevelChange?: (level: number) => void;
  onLivesChange?: (lives: number) => void;
  onGameOver?: (finalScore: number) => void;
  onRestart?: () => void;
}

export class ArkanoidEngine {
  constructor(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    callbacks: ArkanoidEngineCallbacks,
  );

  update(dt: number): void; // paleta, pelota, colisiones, explosiones, progresión de nivel
  draw(): void; // playfield con sprites + HUD (SCORE/NIVEL/vidas), igual al original
  reset(): void; // reinicia en nivel 1, 3 vidas, score 0; dispara onRestart
  forceGameOver(): void; // fuerza fin de partida sin colisión real; dispara onGameOver
  destroy(): void; // remueve listeners de keydown/keyup de window
}
```

**Props/ref del componente** — `components/games/ArkanoidCanvas.tsx`:

```ts
export interface ArkanoidCanvasProps extends ArkanoidEngineCallbacks {
  paused: boolean;
}
export interface ArkanoidCanvasHandle {
  reset: () => void;
  forceGameOver: () => void;
}
```

**Migración `games`** (vía MCP `apply_migration`, sin cambios de esquema — solo un
`insert` nuevo sobre la tabla ya creada en spec 06):

```sql
insert into public.games (id, title, short, long, cat, color, cover)
values (
  'arkanoid',
  'ARKANOID',
  'Rebota la pelota y no dejes que ningún bloque sobreviva.',
  'Controla una paleta de neón y desvía una pelota implacable contra murallas de bloques cromáticos. Cada impacto suma puntos; cada nivel superado acelera la pelota y reordena el patrón. Los cinco patrones se repiten en un ciclo infinito cada vez más veloz — resiste todo lo que puedas antes de perder tus tres vidas.',
  'ARCADE',
  'magenta',
  'cover-arkanoid'
);
```

`public.scores` **no cambia** — es genérica por `game_id` desde spec 06; `arkanoid` la
usa tal cual vía `lib/data/scores.ts` (`getScores`, `getPlayerBest`, `insertScore`).

---

## Implementation plan

1. **Motor del juego + asset** — crear `lib/games/arkanoid/engine.ts` portando
   fielmente `game.js` + `levels.js` + `assets/spritesheet.js`: paleta, pelota,
   colisiones AABB, explosiones, los 5 patrones de bloques, progresión infinita de
   nivel (patrón cíclico, `speedForLevel`, `pointsPerBlockForLevel`), atlas de sprites y
   carga asíncrona de la imagen. Copiar
   `references/started-games/04-arkanoid/assets/spritesheet-breakout.png` a
   `public/games/arkanoid/spritesheet-breakout.png`. Encapsulado en la clase
   `ArkanoidEngine` con `reset()`, `forceGameOver()`, `destroy()` y los callbacks
   `onScoreChange`, `onLevelChange`, `onLivesChange`, `onGameOver`, `onRestart`.
   Verificación: `npx tsc --noEmit` sin errores; el archivo no se importa aún en ningún
   componente, la app sigue funcionando igual que antes.

2. **Componente canvas** — crear `components/games/ArkanoidCanvas.tsx`, `forwardRef`
   que instancia `ArkanoidEngine` sobre un `<canvas>` 800×600 escalado por CSS, con loop
   `requestAnimationFrame` pausable vía la prop `paused`, y expone
   `{ reset, forceGameOver }` por ref. Verificación: compila sin errores; aún no se usa
   en ninguna página.

3. **Integrar en el Reproductor** — modificar `app/games/[id]/play/page.tsx`: cuando
   `id === 'arkanoid'`, renderizar `<ArkanoidCanvas ref={canvasRef}>` dentro de
   `.crt-screen` en lugar del mock decorativo. Conectar `onScoreChange` /
   `onLevelChange` / `onLivesChange` a `setScore` / `setLevel` / `setLives`. Botón
   "PAUSA" controla `paused`. Botón "FIN" llama a `canvasRef.current?.forceGameOver()`.
   `onGameOver` abre el modal; "JUGAR DE NUEVO" llama a `canvasRef.current?.reset()`.
   Cualquier otro `id` (incluidos `bloque-buster`, `asteroides`, `tetris`) sigue su rama
   actual sin cambios. Verificación: navegar a `http://localhost:3000/games/arkanoid/play`
   permite jugar con teclado (mover paleta, rebotar pelota); tras cargar el spritesheet
   se ven los sprites reales; el HUD de React refleja puntuación/nivel/vidas en tiempo
   real; pausar/reanudar funciona; limpiar el nivel 5 continúa en nivel 6 con el patrón
   del nivel 1, más rápido y con más puntos por bloque; perder las 3 vidas abre el modal
   de fin de partida.

4. **Catálogo y portada** — añadir la entrada `arkanoid` a `app/data/games.ts` y la
   clase `.cover-arkanoid` a `app/globals.css` (patrón de 3 capas, distinta de
   `.cover-bricks`). Verificación: `/games` muestra la card "ARKANOID" con su portada y
   enlaza a `/games/arkanoid`, que a su vez enlaza a `/games/arkanoid/play`;
   `bloque-buster` no cambió.

5. **Migración de catálogo** — vía MCP `apply_migration`, insertar la fila `arkanoid` en
   `public.games` (sin cambios de esquema). Verificación: `list_tables`/`execute_sql`
   confirman la nueva fila; `/games` la lista al leer de Supabase.

6. **Guardado de score real** — en el `onGameOver` de la rama `arkanoid` en
   `app/games/[id]/play/page.tsx`, llamar
   `insertScore('arkanoid', user ?? 'ANÓNIMO', finalScore)`, guardado por un
   `savedOnceRef` propio para este juego (para no interferir con Asteroides/Tetris),
   igual patrón que ambos. Verificación: jugar Arkanoid, perder las 3 vidas, y confirmar
   la fila con `execute_sql`; el Salón de la Fama de `arkanoid` la muestra tras recargar.

7. **Verificación end-to-end + build** — flujo completo: Biblioteca → card "ARKANOID" →
   Detalle → "JUGAR AHORA" → jugar con teclado (mover paleta, rebotar pelota, romper
   bloques, ver la explosión) → limpiar al menos el nivel 1 y confirmar que el nivel 2
   carga con su patrón y velocidad correctos → perder las 3 vidas → modal con
   puntuación final → "JUGAR DE NUEVO" reinicia y "SALIR" vuelve a Biblioteca. Confirmar
   que la marca aparece en el Salón de la Fama con "TU MEJOR MARCA". Confirmar
   `npm run build` sin errores de TypeScript ni de build.

---

## Acceptance criteria

**Motor y componente**

- [ ] `lib/games/arkanoid/engine.ts` exporta `ArkanoidEngine` con `reset()`,
      `forceGameOver()`, `destroy()` y los callbacks `onScoreChange`, `onLevelChange`,
      `onLivesChange`, `onGameOver`, `onRestart`.
- [ ] `npm run build` no reporta errores de tipos en `engine.ts` ni en
      `ArkanoidCanvas.tsx`.
- [ ] `components/games/ArkanoidCanvas.tsx` expone `{ reset, forceGameOver }` vía ref y
      limpia el loop de `requestAnimationFrame` y los listeners de teclado al
      desmontarse.
- [ ] `public/games/arkanoid/spritesheet-breakout.png` existe y el motor lo carga de
      forma asíncrona (el playfield no dibuja sprites hasta que la imagen termina de
      cargar).

**Reproductor (`/games/arkanoid/play`)**

- [ ] Al navegar a `/games/arkanoid/play` se renderiza el canvas del juego real (no el
      mock decorativo).
- [ ] Solo ←/→ mueven la paleta (sin control por mouse); la pelota rebota contra
      paredes, paleta y bloques con física AABB idéntica al original.
- [ ] Los sprites del spritesheet original se ven correctamente (paleta, pelota,
      bloques por color) una vez cargada la imagen.
- [ ] Romper un bloque lo elimina del tablero, dispara la animación de explosión (4
      frames) y suma `pointsPerBlockForLevel(nivel actual)` puntos.
- [ ] El HUD de React (panel superior) refleja la misma puntuación, vidas y nivel que
      el canvas en tiempo real.
- [ ] El botón "PAUSA" detiene el loop del juego (todo se congela) y "REANUDAR" lo
      retoma; no existe ninguna tecla de pausa propia ni selector de nivel del motor.
- [ ] El botón "FIN" fuerza el fin de partida real (`forceGameOver`), abriendo el modal
      de React con la puntuación final.
- [ ] Perder la pelota con 0 vidas restantes dispara automáticamente el modal de React
      con la puntuación final (game over); con vidas restantes, la pelota se reposiciona
      y el juego continúa.
- [ ] Limpiar todos los bloques de un nivel avanza al siguiente con el patrón, la
      velocidad (`speedForLevel`) y el puntaje por bloque (`pointsPerBlockForLevel`)
      correctos.
- [ ] Al limpiar el nivel 5, el nivel 6 reutiliza el patrón de bloques del nivel 1 con
      velocidad y puntaje por bloque mayores (progresión infinita, sin pantalla de
      "victoria").
- [ ] El botón "JUGAR DE NUEVO" del modal reinicia el motor mediante `ref.reset()`
      (nivel 1, 3 vidas, score 0) y el juego queda jugable desde cero.
- [ ] El botón "SALIR" navega de vuelta a `/games/arkanoid` sin errores.

**Persistencia**

- [ ] Al terminar una partida (game over), se inserta una fila en `scores` con
      `game_id='arkanoid'`, `score` = puntuación final y `player_name` = nombre de
      `UserContext` o `'ANÓNIMO'` si no hay nombre.
- [ ] La marca guardada aparece en el Salón de la Fama de `arkanoid` tras recargar, y
      actualiza `best`/`plays` en biblioteca y detalle.
- [ ] No se inserta más de una fila por partida (React Strict Mode / doble disparo de
      `onGameOver`).

**Catálogo y navegación**

- [ ] `/games` muestra la card "ARKANOID" con la portada `.cover-arkanoid`.
- [ ] La card "ARKANOID" enlaza a `/games/arkanoid` (Detalle) y desde ahí "JUGAR AHORA"
      enlaza a `/games/arkanoid/play`.
- [ ] La entrada `bloque-buster` (card, detalle, reproductor mock) no sufrió ningún
      cambio de comportamiento.

**Alcance respetado**

- [ ] No se agregó control por mouse ni controles táctiles.
- [ ] No se agregó ninguna tecla de pausa propia ni selector de nivel en el overlay de
      pausa.
- [ ] No existe ninguna pantalla de "victoria" — el único fin de partida es perder las
      3 vidas.
- [ ] No se agregó audio ni efectos de sonido.
- [ ] No se removió ni se modificó ningún otro juego existente (`asteroides`, `tetris`,
      `bloque-buster`, etc.).
- [ ] `npm run build` completa sin errores de TypeScript ni de build.

---

## Decisions

- **Sí:** Juego nuevo con `id: 'arkanoid'`, separado de la entrada mock existente
  `bloque-buster`. Sigue el mismo patrón que `rocas` → `asteroides` y `caida` →
  `tetris`: `bloque-buster` sigue siendo mock intacto; este es un motor real
  independiente.

- **Sí:** `color: 'magenta'` — es el color menos repetido en el catálogo actual (solo
  `caida` lo usa), aunque no hay ningún color 100% libre entre los 4 disponibles.

- **Sí:** Motor separado en `lib/games/arkanoid/engine.ts` + componente delgado
  `ArkanoidCanvas.tsx`, siguiendo exactamente la misma separación que
  `lib/games/asteroids/engine.ts`/`AsteroidsCanvas.tsx` y
  `lib/games/tetris/engine.ts`/`TetrisCanvas.tsx`.

- **Sí:** Controles **solo teclado** (←/→), descartando el control por mouse del
  original. Consistente con Asteroides y Tetris, que tampoco mezclan mouse y teclado.

- **Sí:** Se elimina la tecla de pausa propia (`P`/`Escape`) y el selector de nivel del
  overlay de pausa del original. La pausa queda 100% controlada por la prop `paused`
  del componente canvas, igual que Asteroides y Tetris — evita dos mecanismos de pausa
  divergentes y un selector de nivel que no encaja con el flujo del Reproductor.

- **Sí:** Se porta el **spritesheet real** (`assets/spritesheet-breakout.png`) en vez de
  rediseñar con figuras vectoriales, a diferencia de Asteroides/Tetris. Decisión
  explícita del usuario — mantiene la identidad visual original del juego.

- **Sí:** Progresión de nivel **infinita**: al limpiar el nivel 5, el nivel 6 reutiliza
  el patrón de bloques del nivel 1 (ciclo de los 5 patrones), con velocidad
  `speedForLevel(n) = 1.10^(n-1)` y puntos por bloque
  `pointsPerBlockForLevel(n) = round(10 × 1.10^(n-1))` — ambas fórmulas extienden sin
  límite la progresión ×1.10/nivel que ya traía el original para 5 niveles. Reemplaza
  la pantalla de "victoria" del original: el único fin de partida es perder las 3 vidas.

- **Sí:** Se conservan las animaciones de explosión (4 frames por color) del original —
  no se consideran "audio", son parte del feedback visual del juego.

- **No:** Audio o efectos de sonido (`ball-bounce.mp3`, `break-sound.mp3`). No aplica al
  resto del catálogo (ningún otro juego real tiene audio).

- **No:** Controles táctiles/móviles. Se difiere a un spec futuro dedicado a soporte
  táctil para todo el catálogo.

- **No:** RLS, políticas de seguridad ni anti-cheat en Supabase. Deuda ya conocida y
  diferida desde spec 06.

- **No:** Abstracción genérica reutilizable de "motor de juego". Prematuro con solo tres
  motores reales (Asteroides, Tetris, Arkanoid); se diseña si llega un cuarto.

- **No:** Cambiar el diseño visual del HUD compartido, del modal de fin de partida o de
  la pantalla de Detalle. Solo se conecta el juego a datos reales, no se rediseña la UI.

---

## Risks

| Riesgo                                                                                                                                                                                                                                                          | Mitigación                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Doble montaje en React Strict Mode**: si `destroy()` no limpia bien el `requestAnimationFrame` y los listeners de `keydown`/`keyup`, podrían arrancar dos loops o duplicar el movimiento de la paleta.                                                        | `destroy()` cancela el `rAF` pendiente y remueve explícitamente los listeners antes de que el segundo montaje cree los suyos, igual que Asteroides y Tetris.                         |
| **Doble inserción de score**: `onGameOver` podría dispararse dos veces (Strict Mode / doble colisión) y guardar la partida repetida.                                                                                                                            | Reutilizar el patrón `savedOnceRef` ya probado en Asteroides/Tetris: se guarda solo una vez por partida hasta el próximo `reset()`/`onRestart`.                                      |
| **Velocidad sin límite en progresión infinita**: `speedForLevel(n) = 1.10^(n-1)` crece sin tope; a partir de cierto nivel la pelota podría moverse tan rápido que "atraviese" la paleta o los bloques entre frames (tunneling), especialmente con `dt` grandes. | No se soluciona en este spec (el cap de velocidad no fue solicitado); se documenta como límite conocido de la progresión infinita para un spec futuro si se vuelve un problema real. |
| **Carga asíncrona del spritesheet**: si la imagen tarda en cargar o falla, el jugador vería el playfield vacío sin feedback.                                                                                                                                    | El motor no dibuja sprites hasta `spriteReady`; se acepta el estado vacío transitorio (la carga es prácticamente instantánea al ser un asset local de `public/`).                    |
| **`ANÓNIMO` colapsa marcas de invitados distintos** en una sola etiqueta del leaderboard de `arkanoid`.                                                                                                                                                         | Riesgo ya aceptado desde spec 06 para todo el catálogo; se resuelve cuando llegue el spec de autenticación real.                                                                     |

---

## Lo que **no** está en este spec

- Cualquier cambio a la entrada mock `bloque-buster`.
- Control de la paleta por mouse.
- Controles táctiles/móviles.
- Tecla de pausa propia del motor y selector de nivel en el overlay de pausa.
- Pantalla de "victoria" — la progresión es infinita.
- Audio o efectos de sonido.
- RLS, políticas de seguridad o anti-cheat en Supabase.
- Una abstracción genérica de "motor de juego" reutilizable.
- Rediseño visual del HUD compartido, del modal de fin de partida o de la pantalla de
  Detalle.

Cada uno de esos, si llega, va en su propio spec.
