# SPEC 05 — Juego Asteroides (motor real)

> **Estado:** Aprobado · **Depende de:** 01-mvp-visual-screens · **Fecha:** 2026-07-16
> **Objetivo:** Adaptar el juego Asteroids de `references/started-games/02-asteroids/game.js`
> a un motor TypeScript + componente canvas que reemplaza el mock del Reproductor para el
> nuevo juego `asteroides`, integrándose con el HUD y el modal de fin de partida existentes.

---

## Scope

**In:**

- Crear `lib/games/asteroids/engine.ts` — puerto a TypeScript del motor de
  `references/started-games/02-asteroids/game.js`: clases `Bullet`, `Asteroid`, `Ship`,
  `Particle`, `PowerUp`, constantes (`RADII`, `SPEEDS`, `POINTS`, etc.), y toda la lógica de
  `update`/colisiones/spawns/HUD/overlay de "GAME OVER" **tal cual el original** (sin
  quitar nada dibujado en el canvas: HUD de score/nivel/vidas/temporizador 3x y el overlay
  "GAME OVER — ESPACIO PARA REINICIAR" se conservan). El motor no referencia el DOM
  globalmente (recibe `CanvasRenderingContext2D`, ancho/alto por parámetro). Expone una
  clase (p. ej. `AsteroidsEngine`) con:
  - `update(dt)` y `draw()`.
  - Manejo propio de listeners de teclado (`keydown`/`keyup`) atados a `window`, con
    `destroy()` para limpiarlos.
  - Callbacks de notificación hacia afuera: `onScoreChange`, `onLivesChange`,
    `onLevelChange`, `onGameOver(finalScore)`, `onRestart` — se disparan tanto cuando el
    reinicio ocurre **dentro** del canvas (Space tras game over) como cuando lo pide algo
    externo.
  - Métodos imperativos `reset()` (reinicia la partida, dispara `onRestart`) y
    `forceGameOver()` (fuerza el fin de partida sin colisión, dispara `onGameOver`) para
    que el HUD/modal de React puedan controlar el mismo motor, no un duplicado.

- Crear `components/games/AsteroidsCanvas.tsx` — `"use client"`, `forwardRef` que expone
  `{ reset, forceGameOver }` vía `useImperativeHandle`. Monta un `<canvas>` de resolución
  fija 800×600 (coincide con `aspect-ratio: 4/3` de `.crt-screen`), escalado por CSS
  (`width:100%; height:100%`). Instancia `AsteroidsEngine` en un `useEffect`, corre el loop
  vía `requestAnimationFrame` (pausable con la prop `paused`), y reenvía los callbacks del
  motor como props: `paused: boolean`, `onScoreChange`, `onLivesChange`, `onLevelChange`,
  `onGameOver`, `onRestart`. Limpia el loop y los listeners al desmontar.

- Modificar `app/games/[id]/play/page.tsx` — cuando `id === 'asteroides'`, renderiza
  `<AsteroidsCanvas>` dentro de `.crt-screen` en lugar del mock decorativo
  (`.game-arena`/enemigos CSS/`setInterval` de score falso). El HUD superior de React
  sigue mostrando jugador/puntuación/vidas/nivel (ahora alimentados por los callbacks del
  motor, en paralelo al HUD propio del canvas). El botón "PAUSA" controla la prop
  `paused`. El botón "FIN" llama a `ref.forceGameOver()`. El modal de fin de partida se
  abre vía `onGameOver`; su botón "JUGAR DE NUEVO" llama a `ref.reset()` (el mismo camino
  que presionar Space dentro del canvas) y `onRestart` cierra el modal si estaba abierto.
  Cualquier otro `id` (incluido `rocas`) conserva el mock actual sin cambios.

- Añadir la entrada del juego en `app/data/games.ts`: `id: 'asteroides'`,
  `title: 'ASTEROIDES'`, `cat: 'SHOOTER'`, `color: 'cyan'`, `cover: 'cover-asteroides'`
  (título/descripciones se redactan en la sección Data model de este spec).

- Añadir `.cover-asteroides` en `app/globals.css` — variante visual de `.cover-rocas`
  (campo de asteroides + nave), para la card de Biblioteca y la portada de Detalle.

**Fuera de alcance:**

- Cualquier cambio al juego/entrada `rocas` — sigue siendo mock, no se toca.
- Controles táctiles/móviles — el juego funciona solo con teclado (flechas + espacio).
- Impedir que Space reinicie el motor mientras el modal de React está abierto encima —
  ambos overlays son independientes por decisión explícita; se documenta como riesgo
  aceptado, no se soluciona en este spec.
- Persistencia real de puntuaciones en Supabase — se mantiene el guardado simulado
  (`setSaved(true)` sin escribir a ninguna tabla), igual que los demás juegos.
- Una interfaz/abstracción genérica de "motor de juego" reutilizable para otros títulos
  (Tetris, Arkanoid en `references/started-games/`).
- Sonido o efectos de audio — el original no los tiene.
- Leaderboard real conectado a las partidas jugadas — sigue usando `seededScores` (fake).
- Rediseño visual del HUD, del modal de fin de partida o de la pantalla de Detalle — solo
  se conectan a datos reales del juego, no se modifica su apariencia.
- Validación anti-cheat del score guardado.

---

## Data model

**Entrada nueva en `app/data/games.ts`** (`GAMES: Game[]`, misma interfaz `Game` existente):

```ts
{
  id: 'asteroides',
  title: 'ASTEROIDES',
  short: 'Sobrevive al campo de rocas y suma puntos.',
  long: 'Pilotas una nave solitaria atrapada en un campo de asteroides sin fin. Dispara '
      + 'para fragmentar rocas gigantes en pedazos cada vez más pequeños, recoge el '
      + 'power-up de disparo triple y sobrevive ronda tras ronda mientras el campo se '
      + 'vuelve más denso.',
  cat: 'SHOOTER',
  cover: 'cover-asteroides',
  color: 'cyan',
  best: 33800,
  plays: '9.7K',
}
```

> `best`/`plays` son decorativos como en el resto del catálogo (no reflejan partidas
> reales).

**API del motor** — `lib/games/asteroids/engine.ts`:

```ts
export interface AsteroidsEngineCallbacks {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
  onRestart?: () => void;
}

export class AsteroidsEngine {
  constructor(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    callbacks: AsteroidsEngineCallbacks,
  );

  update(dt: number): void; // lógica: nave, asteroides, balas, colisiones, power-ups
  draw(): void; // playfield + HUD propio + overlay "GAME OVER" (sin cambios)
  reset(): void; // equivale a initGame() original; dispara onRestart
  forceGameOver(): void; // fuerza state = 'gameover' sin colisión; dispara onGameOver
  destroy(): void; // remueve listeners de keydown/keyup de window
}
```

**Props/ref del componente** — `components/games/AsteroidsCanvas.tsx`:

```ts
export interface AsteroidsCanvasProps {
  paused: boolean;
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
  onRestart?: () => void;
}

export interface AsteroidsCanvasHandle {
  reset: () => void;
  forceGameOver: () => void;
}
```

No se introduce persistencia (localStorage/IndexedDB/DB) — todo el estado del motor vive
en memoria mientras el componente está montado, igual que el resto del catálogo mock.

---

## Implementation plan

1. **Motor del juego** — crear `lib/games/asteroids/engine.ts` portando fielmente
   `game.js` (clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`, constantes,
   `update`/colisiones/spawns/HUD/overlay "GAME OVER") a TypeScript, encapsulado en la
   clase `AsteroidsEngine` con `reset()`, `forceGameOver()`, `destroy()` y los callbacks
   `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver`/`onRestart`.
   Verificación: el archivo no tiene errores de tipos (`npx tsc --noEmit`); no se importa
   aún en ningún componente, la app sigue funcionando igual que antes.

2. **Componente canvas** — crear `components/games/AsteroidsCanvas.tsx`, `forwardRef`
   que instancia `AsteroidsEngine` sobre un `<canvas>` 800×600 escalado por CSS, con loop
   `requestAnimationFrame` pausable vía la prop `paused`, y expone
   `{ reset, forceGameOver }` por ref. Verificación: compila sin errores; aún no se usa
   en ninguna página.

3. **Integrar en el Reproductor** — modificar `app/games/[id]/play/page.tsx`: cuando
   `id === 'asteroides'`, renderizar `<AsteroidsCanvas ref={canvasRef}>` dentro de
   `.crt-screen` en lugar del mock decorativo. Conectar `onScoreChange` /
   `onLivesChange` / `onLevelChange` a `setScore` / `setLives` / `setLevel` (se agrega
   setter para `lives`, hoy fijo en 3). El botón "PAUSA" controla la prop `paused`.
   El botón "FIN" llama a `canvasRef.current?.forceGameOver()`. `onGameOver` abre el
   modal (`setOver(true)`, `setSaved(false)`). El botón "JUGAR DE NUEVO" del modal llama
   a `canvasRef.current?.reset()`. `onRestart` (disparado tanto por ese `reset()` como
   por Space dentro del canvas tras game over) cierra el modal y reestablece `name`.
   Cualquier otro `id` (incluido `rocas`) sigue usando el mock existente sin cambios.
   Verificación: navegar manualmente a `http://localhost:3000/games/asteroides/play`
   (aunque aún no exista card en Biblioteca) permite jugar con teclado; el HUD de React
   y el HUD dibujado en el canvas muestran los mismos valores; pausar/reanudar
   funciona; perder las 3 vidas abre el modal; "JUGAR DE NUEVO" reinicia todo
   correctamente, tanto desde el botón como presionando Space en el canvas.

4. **Catálogo y portada** — añadir la entrada `asteroides` a `app/data/games.ts` y la
   clase `.cover-asteroides` a `app/globals.css`. Verificación: `/games` muestra la card
   "ASTEROIDES" con su portada y enlaza a `/games/asteroides`, que a su vez enlaza a
   `/games/asteroides/play`; el juego `rocas` no cambió.

5. **Verificación end-to-end** — flujo completo: Biblioteca → card "ASTEROIDES" →
   Detalle → "JUGAR AHORA" → jugar con teclado (mover, disparar, recoger power-up 3x,
   perder vidas) → modal de fin de partida con puntuación final → "JUGAR DE NUEVO"
   reinicia y "SALIR" vuelve a Biblioteca. Confirmar que `npm run build` pasa sin
   errores de TypeScript ni de build.

---

## Acceptance criteria

**Motor y componente**

- [ ] `lib/games/asteroids/engine.ts` exporta `AsteroidsEngine` con `reset()`,
      `forceGameOver()`, `destroy()` y los callbacks `onScoreChange`, `onLivesChange`,
      `onLevelChange`, `onGameOver`, `onRestart`.
- [ ] `npm run build` no reporta errores de tipos en `engine.ts` ni en
      `AsteroidsCanvas.tsx`.
- [ ] `components/games/AsteroidsCanvas.tsx` expone `{ reset, forceGameOver }` vía ref
      y limpia el loop de `requestAnimationFrame` y los listeners de teclado al
      desmontarse.

**Reproductor (`/games/asteroides/play`)**

- [ ] Al navegar a `/games/asteroides/play` se renderiza el canvas del juego real (no
      el mock decorativo con enemigos CSS).
- [ ] Las flechas rotan/propulsan la nave y Espacio dispara, igual que el juego
      original.
- [ ] El HUD dibujado en el canvas (SCORE, NIVEL, vidas, temporizador 3x) sigue
      visible y funcional.
- [ ] El HUD de React (panel superior) refleja los mismos valores de puntuación,
      vidas y nivel que el canvas, en tiempo real.
- [ ] El botón "PAUSA" detiene el loop del juego (todo se congela) y "REANUDAR" lo
      retoma.
- [ ] El botón "FIN" fuerza el fin de partida del motor real (no solo abre el modal
      por fuera) — dispara el overlay "GAME OVER" en canvas y el modal de React a la
      vez.
- [ ] Perder las 3 vidas dispara automáticamente el overlay "GAME OVER" en canvas y
      el modal de React con la puntuación final.
- [ ] El power-up de disparo triple ("3x") aparece, se puede recoger y activa el
      disparo triple temporalmente.
- [ ] Los asteroides grandes se dividen en medianos y estos en pequeños al ser
      destruidos, sumando los puntos correspondientes (100/50/20).
- [ ] Presionar Espacio dentro del canvas en estado "GAME OVER" reinicia el motor y
      sincroniza el HUD de React, incluyendo el cierre del modal si estaba abierto.
- [ ] El botón "JUGAR DE NUEVO" del modal reinicia el motor mediante `ref.reset()` y
      el juego queda jugable desde cero.
- [ ] El botón "SALIR" navega de vuelta a `/games/asteroides` sin errores.

**Catálogo y navegación**

- [ ] `/games` muestra la card "ASTEROIDES" con la portada `.cover-asteroides`.
- [ ] La card "ASTEROIDES" enlaza a `/games/asteroides` (Detalle) y desde ahí "JUGAR
      AHORA" enlaza a `/games/asteroides/play`.
- [ ] El juego `rocas` (card, detalle, reproductor mock) no sufrió ningún cambio de
      comportamiento.

**Alcance respetado**

- [ ] No se agregaron controles táctiles ni botones en pantalla.
- [ ] No se creó ninguna tabla ni llamada a Supabase para guardar puntuaciones.
- [ ] No se removió el HUD ni el overlay "GAME OVER" dibujados en el canvas.
- [ ] `npm run build` completa sin errores de TypeScript ni de build.

---

## Decisions

- **Sí:** Juego nuevo con `id: 'asteroides'`, separado de la entrada existente `rocas`.
  `rocas` sigue siendo mock; este es un título distinto aunque temáticamente similar
  (ambos son de asteroides).

- **Sí:** Motor separado en `lib/games/asteroids/engine.ts` + componente delgado
  `AsteroidsCanvas.tsx`, en lugar de todo en un solo componente. Sigue la convención de
  separación cliente/servidor ya usada en spec 04 (`lib/supabase/client.ts` vs
  `server.ts`) y facilita el mantenimiento del motor de forma independiente de React.

- **Sí:** Conversión completa a TypeScript tipado del motor, en lugar de dejarlo en JS
  sin tipos. Consistente con el resto del proyecto, que es 100% TypeScript.

- **Sí:** Mantener el HUD dibujado en canvas (score/nivel/vidas/3x) y el overlay
  "GAME OVER" del juego original, en paralelo al HUD/modal de React — decisión
  explícita del usuario al reconsiderar la propuesta inicial de removerlo. Ambos HUDs
  se muestran a la vez y quedan sincronizados vía callbacks del motor.

- **Sí:** API imperativa (`reset()` / `forceGameOver()` vía ref) en lugar de remontar
  el componente por `key`, para que los botones "JUGAR DE NUEVO" / "FIN" de React
  controlen la misma instancia del motor que el propio juego usa internamente (Espacio
  dentro del canvas), evitando dos caminos de reinicio divergentes.

- **No:** Impedir que Espacio reinicie el juego mientras el modal de React está
  abierto encima. Se acepta como comportamiento conocido: ambos overlays son
  independientes por decisión explícita del usuario.

- **No:** Persistencia real en Supabase de la puntuación. Sigue fuera de alcance — el
  spec 04 dejó explícitamente las tablas para un spec futuro de persistencia de
  puntuaciones.

- **No:** Controles táctiles/móviles. Se difiere a un spec futuro dedicado a soporte
  táctil para todo el catálogo, no solo Asteroides.

- **No:** Interfaz genérica reutilizable de "motor de juego" para otros títulos
  (Tetris, Arkanoid en `references/started-games/`). Prematuro con un solo juego real
  implementado; se diseña cuando llegue el siguiente.

- **No:** Cambiar el diseño visual del HUD, del modal de fin de partida o de la
  pantalla de Detalle. Solo se conectan a datos reales del juego, no se rediseña la UI.

---

## Identified risks

- **Doble montaje en modo desarrollo (React Strict Mode).** Next.js en desarrollo monta
  y desmonta los efectos dos veces para detectar fugas. Si `useEffect` no limpia bien el
  `requestAnimationFrame` y los listeners de `window` (`destroy()`), podría arrancar dos
  loops o duplicar el disparo por cada pulsación de tecla. Mitigación: `destroy()` debe
  cancelar el `rAF` pendiente y remover explícitamente los listeners antes de que el
  segundo montaje cree los suyos.

- **Espacio reinicia el juego con el modal de React abierto encima.** Ya aceptado como
  comportamiento conocido (ver Decisions), pero vale la pena registrarlo como riesgo: un
  jugador podría "perder" visualmente el modal de fin de partida al presionar Espacio
  por reflejo, ya que el listener de teclado sigue activo en `window` aunque el modal
  esté visualmente encima.

- **Legibilidad del HUD en pantallas pequeñas.** El HUD dibujado en canvas usa tamaños
  de fuente fijos en píxeles sobre una resolución interna de 800×600; al escalar por
  CSS para caber en viewports angostos, el texto puede volverse difícil de leer. No se
  soluciona en este spec (controles táctiles/responsive de juego quedan fuera de
  alcance), pero se documenta para un spec futuro de adaptación móvil.
