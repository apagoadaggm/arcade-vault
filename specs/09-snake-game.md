# SPEC 09 — Juego Snake

> **Estado:** Aprobado · **Depende de:** 05-asteroides-game, 06-supabase-games-scores · **Fecha:** 2026-07-17
> **Objetivo:** Diseñar desde cero (sin código de referencia) un motor de Snake sobre grid 20×20 con frutas dibujadas desde el sprite atlas de `references/source-assets/snake-assets/`, e integrarlo al reproductor, catálogo y persistencia de Supabase siguiendo la receta de spec 05/06.

---

## Scope

**In:**

- Crear `lib/games/snake/engine.ts` — motor de Snake diseñado desde cero (no hay
  `game.js` de referencia en `references/started-games/`), agnóstico del DOM (recibe
  `ctx`, `width`, `height` y `callbacks` por parámetro). Implementa:
  - Grid discreto de 20×20 celdas sobre una resolución interna de 800×600, con celdas
    **rectangulares** de 40×30px (800/20 = 40, 600/20 = 30), consistente con la
    convención 4:3 de `.crt-screen`.
  - Movimiento por celda: la serpiente avanza una celda por tick a un intervalo fijo
    por nivel (no por frame libre); las flechas cambian la dirección pero no permiten
    reversa instantánea sobre el propio cuerpo (ej. si va a la derecha, Abajo/Arriba
    cambian dirección pero Izquierda se ignora).
  - Fruta activa: una sola fruta en pantalla a la vez, elegida al azar (distribución
    uniforme) entre las 22 frutas de `SPRITE_ATLAS.fruits` (`sprites.js`), en una celda
    libre (no ocupada por el cuerpo de la serpiente).
  - Puntuación por tier de fruta (22 frutas en `SPRITE_ATLAS.fruits`):
    - **Común (10 pts, 7 frutas):** banana, orange, grape, apple, cherry, tomato, grapes2.
    - **Poco común (20 pts, 8 frutas):** garlic, eggplant, strawberry, carrot, mushroom,
      broccoli, peanut, pepper.
    - **Rara (40 pts, 7 frutas):** watermelon, kiwi, lemon, peach, pineapple, melon,
      berries.
  - Crecimiento: comer la fruta activa suma 1 celda a la cola y dispara `onScoreChange`
    con el nuevo puntaje total.
  - Subida de nivel: cada 5 frutas comidas incrementa el nivel (`onLevelChange`) y
    acelera ligeramente el intervalo de movimiento.
  - Fin de partida (una sola vida): chocar contra el borde del área de juego, o contra
    su propio cuerpo, dispara `onGameOver(finalScore)` de inmediato — sin vidas extra.
  - Callbacks estándar de la receta: `onScoreChange`, `onLevelChange`, `onGameOver`,
    `onRestart`. (No hay `onLivesChange` — una sola vida por partida, no aplica.)
  - Métodos imperativos `reset()`, `forceGameOver()`, `destroy()` (listeners de
    `keydown` en `window`, removidos en `destroy()`), siguiendo el mismo patrón que
    `AsteroidsEngine`.
  - Presionar Espacio en estado "game over" reinicia el motor (mismo patrón que
    Asteroides).

- Copiar `references/source-assets/snake-assets/fruits.png` a `public/games/snake/fruits.png`
  para que el componente canvas pueda cargarlo con `new Image()` en tiempo de
  ejecución. Portar el contenido de `sprites.js` (los 22 recortes `{x, y, w, h}`) a una
  constante TypeScript tipada en `lib/games/snake/sprites.ts` — no se usa
  `window.SPRITE_ATLAS` global, se importa como módulo.

- Crear `components/games/SnakeCanvas.tsx` — `"use client"`, `forwardRef` con
  `{ reset, forceGameOver }`, canvas 800×600 escalado por CSS, loop
  `requestAnimationFrame` pausable vía prop `paused`, siguiendo el mismo patrón de
  refs (`canvasRef`/`engineRef`/`pausedRef`/`callbacksRef`) que `AsteroidsCanvas.tsx`.
  Carga la imagen `fruits.png` una vez al montar (esperando `onload`) y la pasa al
  motor.

- Modificar `app/games/[id]/play/page.tsx` — rama condicional `isSnake = id === 'snake'`,
  igual patrón que `isAsteroides`: HUD conectado a `onScoreChange`/`onLevelChange`,
  botones PAUSA/FIN/JUGAR DE NUEVO, guardado de score real vía `insertScore('snake',
user ?? 'ANÓNIMO', finalScore)` con `savedOnceRef`. El HUD de vidas de React se omite
  para este juego (no aplica, una sola vida).

- Añadir entrada en `app/data/games.ts`: `id: 'snake'`, `title: 'SNAKE'`,
  `cat: 'ARCADE'`, `color: 'green'`, `cover: 'cover-snake'`, con `short`/`long`
  confirmados en la sección Data model.

- Añadir `.cover-snake` en `app/globals.css`: fondo verde oscuro con patrón de
  cuadrícula sutil, cuerpo de serpiente en `var(--green)` con `text-shadow` a juego, y
  un glifo/acento de fruta central.

- Insertar la fila del juego `snake` en `public.games` vía MCP `apply_migration`
  (misma receta que spec 06/08).

**Fuera de alcance (para specs futuros):**

- Controles táctiles/móviles.
- Audio o efectos de sonido.
- RLS / políticas de seguridad en Supabase (deuda ya conocida desde spec 06).
- Anti-cheat o validación del score guardado.
- Abstracción genérica de "motor de juego" reutilizable para otros títulos.
- Wrap-around en los bordes — se descartó explícitamente a favor de game over clásico.
- Vidas múltiples — una sola vida por partida, decisión cerrada.
- Probabilidad de aparición ponderada por rareza — el spawn de fruta es uniforme entre
  las 22; solo el **puntaje** varía por tier, no la frecuencia de aparición.
- Power-ups o mecánicas adicionales (velocidad temporal, invulnerabilidad, etc.) — Snake
  clásico puro.

---

## Data model

**Entrada nueva en `app/data/games.ts`** (`GAMES: Game[]`, misma interfaz `Game` existente):

```ts
{
  id: 'snake',
  title: 'SNAKE',
  short: 'Come frutas, crece y no choques contigo mismo.',
  long: 'Guía a la serpiente por una cuadrícula de 20×20 recogiendo las frutas más '
      + 'variadas del arcade. Cada fruta suma puntos según lo rara que sea, y cada 5 '
      + 'frutas la velocidad aumenta un poco más. Un solo error contra el borde o tu '
      + 'propia cola termina la partida.',
  cat: 'ARCADE',
  cover: 'cover-snake',
  color: 'green',
}
```

**Atlas de sprites** — `lib/games/snake/sprites.ts` (portado desde
`references/source-assets/snake-assets/sprites.js`, tipado, sin `window` global):

```ts
export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FRUIT_SPRITES: Record<string, SpriteRect> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};

export const FRUIT_POINTS: Record<string, number> = {
  banana: 10,
  orange: 10,
  grape: 10,
  apple: 10,
  cherry: 10,
  tomato: 10,
  grapes2: 10,
  garlic: 20,
  eggplant: 20,
  strawberry: 20,
  carrot: 20,
  mushroom: 20,
  broccoli: 20,
  peanut: 20,
  pepper: 20,
  watermelon: 40,
  kiwi: 40,
  lemon: 40,
  peach: 40,
  pineapple: 40,
  melon: 40,
  berries: 40,
};
```

Imagen fuente: `public/games/snake/fruits.png` (copiada de
`references/source-assets/snake-assets/fruits.png`), cargada por `SnakeCanvas.tsx` con
`new Image()` y recortada con `ctx.drawImage` usando `FRUIT_SPRITES`.

**API del motor** — `lib/games/snake/engine.ts`:

```ts
export interface SnakeEngineCallbacks {
  onScoreChange?: (score: number) => void;
  onLevelChange?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
  onRestart?: () => void;
}

export class SnakeEngine {
  constructor(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    callbacks: SnakeEngineCallbacks,
    fruitImage: HTMLImageElement,
  );

  update(dt: number): void; // avance de celda por intervalo, colisiones, spawn de fruta
  draw(): void; // grid + serpiente + fruta con sprite + HUD propio
  reset(): void; // reinicia partida; dispara onRestart
  forceGameOver(): void; // fuerza fin de partida sin colisión; dispara onGameOver
  destroy(): void; // remueve listeners de keydown de window
}
```

**Props/ref del componente** — `components/games/SnakeCanvas.tsx`:

```ts
export interface SnakeCanvasProps extends SnakeEngineCallbacks {
  paused: boolean;
}
export interface SnakeCanvasHandle {
  reset: () => void;
  forceGameOver: () => void;
}
```

**Grid interno del motor:**

```ts
const GRID_COLS = 20; // columnas
const GRID_ROWS = 20; // filas
const CELL_W = 40; // 800 / 20 = 40px de ancho por celda
const CELL_H = 30; // 600 / 20 = 30px de alto por celda
```

> Celdas rectangulares (40×30, no cuadradas) para que el grid de 20×20 encaje
> exactamente en la resolución interna estándar de 800×600 (4:3) que ya usa
> `AsteroidsCanvas`, sin introducir una proporción de canvas nueva. La serpiente y la
> fruta se dibujan respetando este rectángulo por celda (el sprite de fruta se escala
> a `CELL_W × CELL_H` al hacer `drawImage`).

**Tabla `games` (Supabase):** no cambia de esquema — solo se agrega la fila de `snake`
vía `insert`, igual que spec 06/08. **Tabla `scores`:** no cambia, es genérica por
`game_id`.

---

## Implementation plan

1. **Atlas de sprites** — crear `lib/games/snake/sprites.ts` portando los 22 recortes de
   `references/source-assets/snake-assets/sprites.js` a `FRUIT_SPRITES` (tipado
   `SpriteRect`) y `FRUIT_POINTS` (mapa fruta→puntos por tier). Copiar
   `references/source-assets/snake-assets/fruits.png` a `public/games/snake/fruits.png`.
   Verificación: el archivo no tiene errores de tipos (`npx tsc --noEmit`); la imagen es
   accesible en `/games/snake/fruits.png` sirviendo la app en local.

2. **Motor del juego** — crear `lib/games/snake/engine.ts` con la clase `SnakeEngine`:
   grid 20×20 (celda 40×30), movimiento por celda a intervalo fijo por nivel, cambio de
   dirección sin reversa instantánea, spawn de fruta aleatoria (uniforme entre las 22)
   en celda libre, suma de puntos por `FRUIT_POINTS`, crecimiento de la cola, subida de
   nivel cada 5 frutas con aceleración del intervalo, fin de partida por colisión con
   borde o cuerpo propio, reinicio con Espacio en estado game over. Incluye
   `reset()`, `forceGameOver()`, `destroy()` y los callbacks `onScoreChange`,
   `onLevelChange`, `onGameOver`, `onRestart`. Verificación: `npx tsc --noEmit` sin
   errores; aún no se importa en ningún componente.

3. **Componente canvas** — crear `components/games/SnakeCanvas.tsx`, `forwardRef` que
   instancia `SnakeEngine` sobre un `<canvas>` 800×600 escalado por CSS, carga
   `fruits.png` una vez al montar, loop `requestAnimationFrame` pausable vía `paused`,
   expone `{ reset, forceGameOver }` por ref. Verificación: compila sin errores; aún no
   se usa en ninguna página.

4. **Integrar en el Reproductor** — modificar `app/games/[id]/play/page.tsx`: rama
   `isSnake = id === 'snake'` renderiza `<SnakeCanvas ref={canvasRef}>` en lugar del
   mock. Conectar `onScoreChange`/`onLevelChange` a `setScore`/`setLevel`. Botón "PAUSA"
   controla `paused`; botón "FIN" llama `canvasRef.current?.forceGameOver()`;
   `onGameOver` abre el modal; "JUGAR DE NUEVO" llama `canvasRef.current?.reset()`;
   `onRestart` cierra el modal. Verificación: navegar manualmente a
   `http://localhost:3000/games/snake/play` permite jugar con flechas, el HUD refleja
   score/nivel en tiempo real, pausar/reanudar funciona, chocar contra borde o cuerpo
   propio abre el modal de game over, y Espacio reinicia dentro del canvas.

5. **Catálogo y portada** — añadir la entrada `snake` a `app/data/games.ts` y la clase
   `.cover-snake` a `app/globals.css`. Verificación: `/games` muestra la card "SNAKE"
   con su portada y enlaza a `/games/snake`, que a su vez enlaza a `/games/snake/play`.

6. **Migración de catálogo en Supabase** — insertar la fila `snake` en `public.games`
   vía MCP `apply_migration`. Verificación: `execute_sql` (`select * from games where
id = 'snake'`) devuelve la fila con los mismos valores del catálogo estático.

7. **Guardado de score real** — en el `onGameOver` de `app/games/[id]/play/page.tsx`
   (rama `isSnake`), llamar `insertScore('snake', user ?? 'ANÓNIMO', finalScore)`
   guardado por `savedOnceRef` para evitar inserciones dobles. Verificación: jugar,
   perder, confirmar la fila nueva en `scores` con `execute_sql`; recargar el Salón de
   la Fama y ver la marca reflejada en `best`/`plays` de biblioteca y detalle.

8. **Verificación end-to-end + build** — flujo completo: Biblioteca → card "SNAKE" →
   Detalle → "JUGAR AHORA" → jugar con flechas (crecer, subir de nivel, comer frutas de
   distinto tier) → game over por choque → modal con puntuación final → "JUGAR DE
   NUEVO" reinicia → "SALIR" vuelve a Biblioteca. Confirmar `npm run build` sin errores
   de TypeScript ni de build.

---

## Acceptance criteria

**Motor y componente**

- [ ] `lib/games/snake/sprites.ts` exporta `FRUIT_SPRITES` (22 recortes) y
      `FRUIT_POINTS` (22 valores: 7 en 10, 8 en 20, 7 en 40).
- [ ] `lib/games/snake/engine.ts` exporta `SnakeEngine` con `reset()`,
      `forceGameOver()`, `destroy()` y los callbacks `onScoreChange`, `onLevelChange`,
      `onGameOver`, `onRestart`.
- [ ] `npm run build` no reporta errores de tipos en `sprites.ts`, `engine.ts` ni
      `SnakeCanvas.tsx`.
- [ ] `components/games/SnakeCanvas.tsx` expone `{ reset, forceGameOver }` vía ref y
      limpia el loop de `requestAnimationFrame` y los listeners de teclado al
      desmontarse.

**Reproductor (`/games/snake/play`)**

- [ ] Al navegar a `/games/snake/play` se renderiza el canvas del juego real (no el
      mock decorativo).
- [ ] Las flechas cambian la dirección de la serpiente; no se permite reversa
      instantánea sobre el propio cuerpo.
- [ ] La serpiente se mueve por celda a intervalo fijo, y ese intervalo se acelera
      cada 5 frutas comidas (subida de nivel).
- [ ] La fruta activa se dibuja con el sprite correspondiente de `fruits.png` (no un
      cuadrado de color), escalado a la celda 40×30.
- [ ] Comer una fruta suma los puntos correctos según su tier (10/20/40) y hace crecer
      la cola en una celda.
- [ ] Chocar contra el borde del área de juego dispara game over inmediato.
- [ ] Chocar contra el propio cuerpo dispara game over inmediato.
- [ ] El HUD de React (panel superior) refleja score y nivel en tiempo real.
- [ ] El botón "PAUSA" detiene el loop del juego y "REANUDAR" lo retoma.
- [ ] El botón "FIN" fuerza el fin de partida real vía `forceGameOver()`.
- [ ] Presionar Espacio en estado game over reinicia el motor y sincroniza el HUD de
      React, cerrando el modal si estaba abierto.
- [ ] El botón "JUGAR DE NUEVO" del modal reinicia el motor mediante `ref.reset()`.
- [ ] El botón "SALIR" navega de vuelta a `/games/snake` sin errores.

**Catálogo y navegación**

- [ ] `/games` muestra la card "SNAKE" con la portada `.cover-snake`.
- [ ] La card "SNAKE" enlaza a `/games/snake` (Detalle) y desde ahí "JUGAR AHORA"
      enlaza a `/games/snake/play`.
- [ ] Ningún otro juego existente (asteroides, tetris, arkanoid, mocks) sufrió cambios
      de comportamiento.

**Persistencia en Supabase**

- [ ] `public.games` tiene una fila con `id = 'snake'` y los valores del catálogo.
- [ ] Al terminar una partida de Snake, se inserta una fila en `scores` con
      `game_id = 'snake'`, `score` = puntuación final y `player_name` = nombre de
      `UserContext` o `'ANÓNIMO'`.
- [ ] La marca guardada aparece en el Salón de la Fama de Snake tras recargar, y
      actualiza `best`/`plays` en biblioteca y detalle.

**Alcance respetado**

- [ ] No se agregaron controles táctiles ni audio.
- [ ] No se agregó RLS ni políticas de seguridad.
- [ ] La serpiente no reaparece del lado opuesto al chocar contra un borde
      (wrap-around descartado).
- [ ] El juego maneja una sola vida por partida (no hay contador de vidas).
- [ ] `npm run build` completa sin errores de TypeScript ni de build.

---

## Decisions

- **Sí:** Snake se diseña **desde cero** (fuente B) — no hay `game.js` de referencia en
  `references/started-games/`; solo se reutiliza el arte de fruta de
  `references/source-assets/snake-assets/` (imagen + coordenadas de recorte).

- **Sí:** Grid de 20×20 celdas con celdas **rectangulares** de 40×30px, en vez de
  celdas cuadradas o un canvas interno nuevo. Mantiene la resolución estándar 800×600
  (4:3) que ya usa `AsteroidsCanvas`, sin introducir una proporción de canvas distinta
  para un solo juego.

- **Sí:** Movimiento discreto por celda a intervalo fijo (no píxeles libres por frame),
  con reversa instantánea bloqueada. Es el comportamiento estándar reconocible de
  Snake.

- **Sí:** Bordes = game over (variante clásica), en vez de wrap-around. Más simple de
  implementar y es la variante más común del género.

- **Sí:** Una sola vida por partida — no hay `onLivesChange` en los callbacks del
  motor, a diferencia de Asteroides. El HUD de React para Snake no muestra vidas.

- **Sí:** Puntuación por tier de rareza (10/20/40), pero **spawn uniforme** entre las
  22 frutas — la rareza afecta solo el valor en puntos, no la probabilidad de
  aparición. Evita una lógica de ponderación adicional sin pedido explícito.

- **Sí:** Subida de nivel cada 5 frutas comidas, acelerando el intervalo de movimiento,
  siguiendo el mismo espíritu de progresión por oleadas que usa Asteroides.

- **Sí:** Atlas de sprites portado a `lib/games/snake/sprites.ts` como módulo TS
  tipado, en vez de cargar `sprites.js` tal cual (que depende de `window.SPRITE_ATLAS`
  global, incompatible con el resto del código modular del repo).

- **Sí:** `fruits.png` se copia a `public/games/snake/fruits.png` para poder cargarse
  con `new Image()` desde el cliente; `references/source-assets/` no se sirve como
  activo estático de la app.

- **No:** Controles táctiles/móviles, audio, RLS/anti-cheat — fuera de alcance,
  consistente con el resto del catálogo (spec 05/06/08).

- **No:** Power-ups o mecánicas adicionales (velocidad temporal, muros extra, etc.) —
  Snake clásico puro, sin pedido explícito de variantes.

- **No:** Abstracción genérica de "motor de juego" reutilizable — prematuro, se
  posterga hasta que el patrón se repita lo suficiente entre motores (mismo criterio
  que spec 05).

---

## Risks

| Riesgo                                                                                                                                                                                         | Mitigación                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Doble montaje en React Strict Mode**: si `destroy()` no limpia bien el `requestAnimationFrame` y los listeners de `window`, podría arrancar dos loops o duplicar el manejo de teclas.        | `destroy()` cancela el `rAF` pendiente y remueve explícitamente los listeners antes de que el segundo montaje cree los suyos, igual que `AsteroidsEngine`.                                |
| **Doble inserción de score** si `onGameOver` se dispara más de una vez.                                                                                                                        | `savedOnceRef` en `app/games/[id]/play/page.tsx`, mismo patrón que Asteroides/Arkanoid/Tetris.                                                                                            |
| **Carga asíncrona de `fruits.png`**: si el motor intenta `drawImage` antes de que la imagen termine de cargar, la fruta no se dibuja (o lanza error en navegadores estrictos).                 | `SnakeCanvas.tsx` espera el evento `onload` de la imagen antes de instanciar `SnakeEngine` / iniciar el loop.                                                                             |
| **Distorsión visual de sprites**: las frutas del atlas no son todas cuadradas (anchos de 110–170px, alto fijo 160px); al escalar a la celda 40×30 podrían verse achatadas o desproporcionadas. | Se acepta como compromiso visual conocido — el `drawImage` escala manteniendo la celda como destino fijo; si se nota mal, ajustar en una iteración visual posterior (fuera de este spec). |
| **Sin celda libre para la fruta** si la serpiente casi llena las 400 celdas del grid (20×20).                                                                                                  | Caso extremo poco probable dado que el juego termina por colisión mucho antes; no se resuelve explícitamente en este spec (se documenta como aceptado).                                   |

---

## Lo que **no** está en este spec

- Controles táctiles/móviles.
- Audio o efectos de sonido.
- RLS, políticas de seguridad y anti-cheat.
- Abstracción genérica de "motor de juego" reutilizable.
- Wrap-around en los bordes.
- Vidas múltiples.
- Spawn de fruta ponderado por rareza.
- Power-ups o mecánicas adicionales.

Cada uno de esos, si llega, va en su propio spec.
