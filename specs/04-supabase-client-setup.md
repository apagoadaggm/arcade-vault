# SPEC 04 — Setup del cliente de Supabase

> **Estado:** Aprobado · **Depende de:** Ninguno · **Fecha:** 2026-07-16
> **Objetivo:** Configurar el cliente de Supabase (@supabase/ssr + @supabase/supabase-js)
> en la app Next.js, con instancias separadas para navegador y servidor, dejando la
> base lista para que specs futuros implementen autenticación real y persistencia de datos.

---

## Scope

**In:**

- Instalar `@supabase/ssr` y `@supabase/supabase-js`.
- Crear `lib/supabase/client.ts` — cliente de Supabase para uso en Client Components
  (`createBrowserClient`).
- Crear `lib/supabase/server.ts` — cliente de Supabase para uso en Server Components /
  Route Handlers (`createServerClient`), leyendo y escribiendo cookies vía `next/headers`.
- Añadir `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` a `.env.local` como
  placeholders vacíos, con comentario en `.env.template` indicando de dónde obtenerlos
  (Supabase Dashboard → Project Settings → API).
- Verificar la conexión con una llamada simple (`supabase.auth.getSession()`) una vez
  que el usuario complete las variables de entorno.

**Fuera de alcance:**

- `middleware.ts` para refrescar sesión — se agrega en el spec de autenticación.
- Cualquier lógica de login/signup/OAuth — reemplazar `UserContext.tsx` y `app/auth/page.tsx`
  queda para un spec futuro.
- Cualquier tabla, esquema o migración en la base de datos (ej. puntuaciones, perfiles) —
  el proyecto Supabase remoto (`ugkzgpixmjiymranyklc`) sigue sin tablas al terminar este spec.
- Row Level Security (RLS) — no aplica todavía porque no hay tablas.
- Tipos generados de la base de datos (`generate_typescript_types`) — no hay esquema aún
  que generar.

---

## Data model

No se introduce ningún modelo de datos nuevo — este spec no crea tablas ni estructuras
persistentes, solo configura los clientes de conexión.

---

## Implementation plan

1. **Instalar dependencias** — `npm install @supabase/ssr @supabase/supabase-js`.
   Verificación: ambos paquetes aparecen en `package.json` dependencies.

2. **Añadir variables de entorno** — agregar a `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_ANON_KEY=` (vacías). Agregar a
   `.env.template` las mismas claves con un comentario indicando que se obtienen en
   Supabase Dashboard → Project Settings → API del proyecto `ugkzgpixmjiymranyklc`.
   Verificación: ambos archivos contienen las claves.

3. **Crear `lib/supabase/client.ts`** — exporta una función `createClient()` que usa
   `createBrowserClient` de `@supabase/ssr` con las variables de entorno públicas.
   Verificación: el archivo compila sin errores de TypeScript.

4. **Crear `lib/supabase/server.ts`** — exporta una función `createClient()` (async)
   que usa `createServerClient` de `@supabase/ssr`, integrando `cookies()` de
   `next/headers` para leer/escribir la sesión en Server Components y Route Handlers.
   Verificación: el archivo compila sin errores de TypeScript.

5. **Verificación end-to-end** — el usuario completa `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local` con los valores reales del proyecto.
   Se confirma que `npm run build` pasa sin errores y que una llamada de prueba a
   `supabase.auth.getSession()` desde el cliente de navegador no lanza error de red
   (devuelve `{ data: { session: null }, error: null }`, ya que no hay auth implementado).

---

## Acceptance criteria

**Dependencias y configuración**

- [ ] `@supabase/ssr` y `@supabase/supabase-js` aparecen en `package.json` dependencies.
- [ ] `.env.local` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] `.env.template` documenta ambas variables con un comentario sobre dónde obtenerlas.

**Clientes de Supabase**

- [ ] `lib/supabase/client.ts` exporta un `createClient()` funcional para Client Components.
- [ ] `lib/supabase/server.ts` exporta un `createClient()` funcional para Server Components
      / Route Handlers, integrado con `next/headers`.
- [ ] `npm run build` completa sin errores de TypeScript ni de build.

**Conexión real**

- [ ] Con las variables de entorno reales completadas por el usuario, una llamada a
      `supabase.auth.getSession()` desde el cliente de navegador devuelve
      `{ data: { session: null }, error: null }` sin error de red ni de configuración.

**Alcance respetado**

- [ ] No existe ningún `middleware.ts` de Supabase en la raíz del proyecto.
- [ ] No se creó ninguna tabla, migración ni política RLS en el proyecto Supabase remoto.
- [ ] `app/auth/page.tsx` y `UserContext.tsx` no fueron modificados.

---

## Decisions

- **Sí:** `@supabase/ssr` + `@supabase/supabase-js` en lugar de solo `@supabase/supabase-js`.
  Es el paquete oficial recomendado por Supabase para Next.js App Router — maneja cookies
  de sesión en Server Components/Route Handlers y evita una migración posterior cuando se
  implemente el spec de autenticación.

- **Sí:** Clientes separados en `lib/supabase/client.ts` (navegador) y `lib/supabase/server.ts`
  (servidor). Es la convención oficial de Supabase/Next.js: cada entorno de ejecución
  (browser vs. RSC/Route Handler) necesita una forma distinta de manejar la sesión y las
  cookies.

- **Sí:** Variables de entorno como placeholder vacío (`NEXT_PUBLIC_SUPABASE_URL=`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=`) en lugar de completarlas automáticamente vía MCP.
  Mismo patrón que `RESEND_API_KEY` en el spec 03: el repo no incluye secrets, el usuario
  las completa manualmente.

- **No:** Incluir `middleware.ts` para refresco de sesión en este spec. Sin login real
  todavía no hay sesiones que refrescar; se agrega junto con el spec de autenticación
  para no tocar el flujo de todas las requests sin necesidad.

- **No:** Crear tablas, migraciones o políticas RLS en este spec. El proyecto Supabase
  remoto (`ugkzgpixmjiymranyklc`) está vacío intencionalmente — el modelo de datos se
  define en el spec de puntuaciones/persistencia cuando exista una estructura concreta
  que soportar.

- **No:** Tocar `app/auth/page.tsx` o `UserContext.tsx` en este spec. Siguen siendo
  visuales/localStorage hasta que se implemente el spec de autenticación real.
