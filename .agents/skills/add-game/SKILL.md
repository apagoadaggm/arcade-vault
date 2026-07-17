---
name: add-game
description: Diseña el spec de un juego nuevo para Arcade Vault siguiendo la receta de spec 05 (motor + canvas + integración en el reproductor + catálogo + cover) y spec 06 (fila en tabla games + guardado de score real). El juego puede venir de references/started-games/ o describirse desde cero (mecánica + controles). Úsalo antes de implementar un juego nuevo.
disable-model-invocation: true
argument-hint: "<slug/descripción del juego o ruta references/started-games/NN-nombre>"
---

# /add-game — Diseñador de spec para juegos nuevos

Este skill **no escribe código**. Su trabajo es producir un archivo `specs/NN-slug.md`
completo y fiel a la receta ya probada por los juegos reales del catálogo, siguiendo el
mismo método guiado que `/spec`. El resultado se implementa después con `/spec-impl`.

## Filosofía

Arcade Vault ya resolvió, dos veces, cómo se agrega un juego real con leaderboard:
**spec 05** (`specs/05-asteroides-game.md`) definió el motor + canvas + integración en el
reproductor; **spec 06** (`specs/06-supabase-games-scores.md`) definió la persistencia en
Supabase (tabla `games` sembrada por migración + tabla `scores` genérica + guardado real
del score). Ese patrón es la receta que este skill aplica sin improvisar nombres de
archivos ni firmas — por eso se apoya en `recipe.md` (compañero de este skill, misma
carpeta) para las rutas y firmas exactas.

**Regla dura, antes de cualquier otra cosa:** este skill **siempre** empieza leyendo la
skill `/spec` completa — `.agents/skills/spec/SKILL.md` y su `.agents/skills/spec/template.md`
— y la usa como referencia de método y de estructura para el archivo de especificación que
va a producir. No se inventa una estructura propia: el spec de un juego es un spec más,
con las mismas 7 secciones del template de `/spec`, solo que precargado con el contenido
específico de juegos.

## Command flow

Sigue las cuatro fases en orden, igual que `/spec`. **No te saltes fases.** Tus respuestas
deben estar en el mismo idioma que el prompt inicial (normalmente español, en este repo).

### Fase 1 — Contexto, método y origen del juego

Antes de preguntar nada sobre el juego:

1. Lee `CLAUDE.md` y `AGENTS.md` si existen.
2. **Lee la skill `/spec` completa**: `.agents/skills/spec/SKILL.md` y
   `.agents/skills/spec/template.md`. Esa es tu referencia de método (las 4 fases, cómo
   hacer preguntas, cómo desarrollar secciones) y de estructura (las 7 secciones del
   template: Header, Scope, Data model, Implementation plan, Acceptance criteria,
   Decisions, Risks). El spec que produzcas debe respetar ese template al pie de la letra.
3. Lee `recipe.md` (en la misma carpeta que este skill) — trae las rutas y firmas exactas
   de la receta de juegos de este repo (motor, canvas, integración, catálogo, cover, DB).
4. Lista `specs/` para determinar el próximo número `NN` y lee al menos
   `specs/05-asteroides-game.md` y `specs/06-supabase-games-scores.md` como specs de
   referencia — son la aplicación concreta de la receta a un juego real.

**Determina la fuente del juego.** Hay dos caminos válidos, y debes identificar cuál
aplica antes de seguir:

- **A) Desde una referencia existente.** Si `$ARGUMENTS` nombra o apunta a una carpeta
  bajo `references/started-games/` (ej. `02-asteroids`, `03-tetris`, `04-arkanoid`), o el
  usuario menciona uno de esos juegos, localiza esa carpeta y lee su `game.js` (o
  equivalente) y su `CLAUDE.md`/`README.md` si existen. El spec describirá **portar** ese
  motor a `lib/games/<id>/engine.ts`, tal como hizo spec 05 con `02-asteroids`.
- **B) Desde cero.** Si no hay carpeta de referencia aplicable, el juego se diseña a
  partir de la descripción que da el usuario: mecánica, controles, condiciones de
  victoria/derrota, puntuación. Aquí no hay `game.js` que portar — las clases, constantes
  y lógica del motor se **diseñan de nuevo** seguiendo el mismo patrón de clase
  (`update(dt)`/`draw()`) que usan los motores existentes.

Si `$ARGUMENTS` viene vacío, pregunta directamente: "¿Este juego parte de alguna carpeta
en `references/started-games/`, o me describes la mecánica y los controles desde cero?"

### Fase 2 — Clarificar con preguntas

Igual que `/spec`: preguntas en bloques de 3 a 5, no una por una. Espera respuesta antes
de seguir con el siguiente bloque.

**Categorías específicas de un juego nuevo (además de las genéricas de `/spec` — scope,
integración, riesgos, decisiones cerradas):**

- **Identidad del juego:** `id` (slug usado en rutas y en `id === '<id>'`), `title`,
  `cat` (`ARCADE | PUZZLE | SHOOTER`), `color` (`cyan | magenta | yellow | green`),
  textos `short`/`long` para el catálogo.
- **Arte de portada:** breve descripción visual para el bloque `.cover-<id>` (paleta,
  formas, glifo central) — no hace falta CSS exacto, solo la idea a implementar.
- **Mecánica y controles:** cómo se mueve/actúa el jugador, qué teclas, condiciones de
  colisión/game over, si hay niveles, vidas, power-ups.
- **Puntuación y HUD:** esquema de puntos por evento (equivalente a `POINTS` en
  Asteroides), qué valores emite el HUD (score/vidas/nivel — mapea a
  `onScoreChange`/`onLivesChange`/`onLevelChange`).
- **Origen confirmado:** si es opción A, confirma qué archivo(s) de
  `references/started-games/NN-nombre/` se van a portar; si es opción B, confirma que no
  hay referencia y que las reglas se toman tal cual las describió el usuario.
- **Fuera de alcance:** por convención de este repo, estos puntos van siempre a "Fuera de
  alcance" salvo que el usuario diga explícitamente lo contrario — controles
  táctiles/móviles, audio, anti-cheat, RLS/seguridad en Supabase, abstracción genérica de
  "motor de juego" reutilizable. Confírmalo con el usuario, no lo asumas en silencio.

Sigue el mismo criterio de corte que `/spec`: deja de preguntar solo cuando puedas
responder sin asumir nada: qué archivos van a aparecer o cambiar, cuál es el primer y el
último paso ejecutable, y cómo se verifica que el juego quedó completo.

### Fase 3 — Desarrollar el spec sección por sección

**No generes el spec entero de una vez.** Desarrolla cada sección del template de `/spec`,
la muestras, esperas confirmación, y solo entonces sigues con la próxima. Usa `recipe.md`
para que los nombres de archivo y las firmas sean exactos, no aproximados.

Orden y contenido esperado por sección (adaptando el template genérico de `/spec` a la
receta de juegos):

1. **Header.** `# SPEC NN — Juego <Title>`. Depende de `05-asteroides-game` y
   `06-supabase-games-scores` (la receta que este spec aplica), más cualquier spec previo
   relevante. Estado inicial `Borrador`. Objetivo en una sola frase.

2. **Scope.**
   - **In:** típicamente cubre las seis capas de la receta (ver `recipe.md`): motor
     `lib/games/<id>/engine.ts`; componente `components/games/<Id>Canvas.tsx`;
     integración condicional en `app/games/[id]/play/page.tsx` (flag
     `is<Id> = id === '<id>'`, HUD, botones PAUSA/FIN/JUGAR DE NUEVO); entrada en
     `app/data/games.ts`; bloque `.cover-<id>` en `app/globals.css`; fila del juego en la
     tabla `games` de Supabase vía MCP `apply_migration`; guardado del score real con
     `insertScore('<id>', user ?? 'ANÓNIMO', finalScore)` guardado por un ref tipo
     `savedOnceRef` para evitar inserciones dobles.
   - **Fuera de alcance:** cambios a otros juegos existentes, controles táctiles/móviles,
     audio, anti-cheat/RLS (se difieren, como en spec 06), abstracción genérica de motor
     reutilizable, cualquier cambio de schema en `scores` (es genérica, no cambia por
     juego).

3. **Data model.** La entrada `Game` nueva en `app/data/games.ts`; la interfaz
   `<Id>EngineCallbacks` y la firma de la clase del motor (constructor
   `(ctx, width, height, callbacks)`, métodos `update`/`draw`/`reset`/`forceGameOver`/
   `destroy`); las props/handle del componente canvas (`paused` + callbacks / `{ reset,
forceGameOver }`); el `INSERT` SQL de la fila en `public.games`; nota explícita de que
   `public.scores` no cambia (es genérica por `game_id`, ya cubierta por
   `lib/data/scores.ts`).

4. **Implementation plan.** Pasos numerados, cada uno dejando el sistema funcional,
   típicamente: (1) motor, (2) componente canvas, (3) integración en el reproductor,
   (4) catálogo + cover, (5) migración de la fila en `games` vía MCP `apply_migration`,
   (6) guardado de score en el game over, (7) verificación end-to-end + `npm run build`.

5. **Acceptance criteria.** Checklist booleano, siguiendo el mismo nivel de detalle que
   spec 05/06 (motor y componente, reproductor, catálogo y navegación, alcance respetado).

6. **Decisions.** Qué se decidió sí/no y por qué — en particular, confirma explícitamente
   si el origen fue "desde referencia" o "desde cero", y por qué se dejó cada punto fuera
   de alcance.

7. **Risks (si aplica).** Riesgos ya conocidos de esta receta que siguen vigentes: doble
   montaje en React Strict Mode (listeners/loop duplicados si `destroy()` no limpia bien),
   doble inserción de score si `onGameOver` se dispara dos veces, estados vacíos del
   leaderboard cuando el juego nuevo aún no tiene `scores`.

**Después de cada sección:** muéstrala en markdown y pregunta si se queda así o se ajusta,
igual que `/spec`. Solo avanza cuando el usuario confirma.

### Fase 4 — Guardar el spec

1. Determina el siguiente número secuencial mirando `specs/`.
2. Genera un slug corto a partir del `id`/título del juego.
3. Confirma el nombre de archivo propuesto con el usuario antes de escribirlo.
4. Crea `specs/NN-slug.md` con todas las secciones aprobadas, estado `Borrador`.
5. Confirma al usuario: ruta del archivo creado, recordatorio de que sigue en `Borrador`
   hasta que lo revise y lo apruebe, y sugerencia de siguiente paso:
   `/spec-impl NN-slug` una vez aprobado.

## Reglas duras

- **Siempre leer primero la skill `/spec` (`SKILL.md` + `template.md`) y `recipe.md`**
  antes de escribir cualquier sección del spec — son la referencia de método y de
  estructura/firmas respectivamente.
- **Nunca escribir código durante este comando.** Solo el archivo `.md` del spec al final.
- **Nunca asumir decisiones que el usuario no confirmó** (id, controles, puntuación,
  origen referencia-vs-cero). Si falta información, pregunta.
- **Nunca generar el spec completo en una sola respuesta.** Sección por sección, con
  confirmación.
- Si el usuario quiere saltarse la Fase 2, recuérdale el costo de un spec vago y, si
  insiste, regístralo igualmente en la sección de decisiones.

## Arguments

- Si `$ARGUMENTS` nombra una carpeta de `references/started-games/` (o el nombre de un
  juego que vive ahí), trátalo como punto de partida de la fuente A (desde referencia).
- Si `$ARGUMENTS` es una descripción libre del juego (mecánica/controles) o viene vacío,
  trátalo como fuente B (desde cero) y pasa a hacer las preguntas de la Fase 2.
