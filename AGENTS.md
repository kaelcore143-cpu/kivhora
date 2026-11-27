# AGENTS.md

## What this is

Static, no-build, Spanish-language reading-speed app ("Kivhora"). Vanilla ES5-style JavaScript, global `KIV` namespace, no `package.json`, dependencies, tests, or CI. Each page runs directly in the browser — serve it over HTTP, do not open via `file://`.

## Run

- `npx serve .` or `python -m http.server`, then open `index.html`. `file://` can break `localStorage` in some browsers.
- Edit HTML/CSS/JS and reload; there is no watcher or codegen.

## Wiring (load order matters)

On app pages, scripts load in this exact order:

1. `@supabase/supabase-js@2` from CDN
2. `supabase-config.js` (Supabase URL + publishable/anon key)
3. `kiv-cloud.js` (`KIVCloud`: auth + RPC)
4. `app.js` (core `KIV`: in-memory state copy, helpers, chrome)
5. `lecciones.js` (`KIV_LESSONS`)
6. the page's inline `<script>` IIFE

- `app.js` does not own auth or progress; it calls `KIVCloud` and keeps an in-memory copy. Protected pages start with `KIV.ready(function (user, progress) { ... })`, which redirects to `login.html` when there is no session.
- Writes go through `KIV.completeLesson`, `KIV.completeExam`, `KIV.savePractice`, `KIV.updateProfile`. They return promises `{ok, xpGained, error}`; the server is the only place that grants XP.
- Pages: `index` (public landing/SEO), `test` (public speed test, no account), `login`, `registro`, `dashboard` (lesson map, protected), `exam` (protected), `lesson.html?lesson=1..8` (protected), `practica` (protected), `404`, `privacidad`, `terminos`.
- `examen-datos.js` holds the three reading passages + questions shared by `exam.html` and `test.html` — edit once, both pages change.
- CSS: `style-2.5d.css` = design tokens/components; `iconos-individuales.css` = icons. Page-specific CSS is usually inline in that page's `<head>`.
- `nutria_logo.jpeg` at the repo root is the logo/mascot and favicon; keep all page references pointing there.

## Domain rules

- Auth is Supabase Auth (email/password). No local password hash, no demo user seeded in the browser.
- Session storage: `window.KIV_AUTH_STORAGE` (defined in `app.js`) = `localStorage` when "mantener sesión" is checked, `sessionStorage` otherwise. Do not write prototype data to `leomas_*` keys; `app.js` deletes leftovers on boot.
- Progression is strict and server-enforced: exam passes at ≥100 PPM **and** ≥8/10; lesson 1 needs `examDone`; lesson n>1 needs lesson n-1 done. Dashboard and `lesson.html` use the same rules for rendering only.
- 8 lessons, not 9: `KIV.overall` divides by 9 (counts the exam plus the 8 lessons).
- Lesson XP is awarded only on first completion; replays update history but grant no repeat XP. Lesson 8's milestone saves automatically on first render.
- Lessons 4, 6, and 7 require a correct quiz before the server accepts completion.
- Gamificación (modo local, puntos 1-5 del plan interno):
  - **Corazones (`hearts`)**: perfil empieza con 5 (`max_hearts: 5`). Fallar un quiz o examen resta 1 corazón. A 0, `lesson.html` bloquea `finishLesson` y `kiv-cloud.js` devuelve error `hearts_depleted`. Completar una práctica restaura 1 corazón (si está por debajo del máximo).
  - **Coronas (`crowns`)**: `lessonsDone` es ahora un array de objetos `{lesson: n, crowns: 1..3, last_completed: fecha}`. Datos viejos (array de números) se migran automáticamente al leer. Repetir una lección bien sube corona (tope 3) sin dar XP extra. `isLessonUnlocked` requiere `crowns >= 1` de la lección anterior. `KIV.overall` divide por 25 (1 examen + 3×8 coronas).
  - **Streak freeze (`streak_freezes`)**: si hay un día de descanso y `streak_freezes > 0`, se gasta uno y se conserva la racha en lugar de resetearla a 1.
  - **Gemas (`gems`)**: moneda blanda. `completeLesson` otorga gems si la lección se completa perfecta (`quizOk` y sin errores). `completeExam` otorga gems si aprueba.
  - **Repaso espaciado**: cada objeto de lección guarda `last_completed`. En `dashboard.html`, si pasaron más de 7 días, el nodo muestra la clase `.needs-practice` y etiqueta "⚠ repaso".
- Use `KIV.esc` for dynamic content; several spots interpolate strings into `innerHTML` (XSS).
- The dashboard inline script aborts silently if `#dailyXP`, `#dailyPct`, `#dailyRing`, or `#badges` is missing — keep those in the markup before changing its stats, lock, badges, or profile logic.

## Data layer (cloud or local)

- `kiv-cloud.js` exposes `KIVCloud` with two backends, same API:
  - **local** (default): browser storage, no backend. Rules reimplemented client-side; stored under `kiv_local_db` + `kiv_local_session`. Not security — anyone with DevTools can edit it. Dev/demo only.
  - **cloud**: Supabase Auth + RPC. Enable with `enabled: true` in `supabase-config.js`.
- Switch modes only through `enabled`; pages and `app.js` do not change. Local and cloud accounts are independent — no data migration.
- If `enabled: true` but the CDN or schema is unavailable, protected pages fail; there is no silent fallback to local. Flip `enabled` deliberately.
- Local rules mirror SQL: exam pass ≥100 PPM and ≥8/10; lesson 1 needs the exam; lesson n needs n-1; lessons 4/6/7 need the quiz; lesson XP on first completion; exam XP on first pass; practice XP capped at 2 rewarded sessions/day.
- Streaks and daily reset use `America/Bogota`.
- Both modes return `{ok, state}` where `state` is camelCase (`profile`, `progress`, `lessonsDone`, `history`).

## Backend Supabase (ready, off by default)

- `supabase/migrations/20261117000000_kivhora_initial.sql` defines profiles, progress, lesson/exam/practice history, RLS, triggers, and server-side RPCs.
- `supabase-config.js` holds the public URL and publishable key. Never put a `service_role` key there.
- `enabled: false` = local mode. The schema is applied in the project but the app stays local until you flip it.
- Server-side rules: exam pass ≥100 PPM and ≥8/10; lesson XP first-completion only; exam XP only on first pass; practice XP capped at 2 rewarded sessions/day; streaks/daily reset `America/Bogota`.
- Keep business logic in the SQL RPCs, not the client (users cannot grant themselves XP). The client only reads tables allowed by RLS.
- Setup, RPC contracts, pending checks: `supabase/README.md`.

## Content and SEO

- All UI copy is Spanish (UTF-8); preserve accents/emoji when editing.
- The domain `https://kivhora.com` is hardcoded in `index.html` (canonical, OG, JSON-LD), `sitemap.xml`, and `robots.txt`. Update them together if the domain changes.

## Manual verification

There are no automated tests. Serve the site and walk: register/login → pass exam (≥100 PPM, 8/10) → dashboard unlocks lesson 1 → complete the lesson chain → practice (XP twice/day) → edit profile/logout.

- Local reset: delete `kiv_local_db` and `kiv_local_session` in DevTools → Application → Storage, then reload.
- Supabase reset: SQL Editor `delete from auth.users;` (cascades); use a second account to confirm RLS isolation.
