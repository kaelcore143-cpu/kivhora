# AGENTS.md

## What this is

Static, no-build, Spanish-language reading-speed app ("Kivhora"). Vanilla ES5-style
JavaScript, global `KIV` namespace, no `package.json`, dependencies, tests, or CI.
The repository is under git; each page runs directly in the browser.

## Run

- No install/build step. Serve the folder over HTTP (`npx serve .` or
  `python -m http.server`) and open `index.html`; `file://` can break `localStorage`
  in some browsers.
- Editing HTML/CSS/JS only needs a page reload; there is no watcher or codegen.

## Wiring

- Each page is standalone HTML with an inline `<script>` IIFE at the bottom.
- Script order matters on app pages:
  1. Supabase JS from CDN (`@supabase/supabase-js@2`)
  2. `supabase-config.js` (public URL + publishable/anon key)
  3. `kiv-cloud.js` (`KIVCloud` wrapper: auth + RPC calls)
  4. `app.js` (core `KIV`: cached state, helpers, chrome)
  5. `lecciones.js` (`KIV_LESSONS`)
  6. the inline page script
- `app.js` no longer owns auth or progress. It calls `KIVCloud` and keeps an
  in-memory copy of the server state. Protected pages start with
  `KIV.ready(function (user, progress) { ... })`, which redirects to `login.html`
  when there is no session.
- Writes go through `KIV.completeLesson`, `KIV.completeExam`, `KIV.savePractice`
  and `KIV.updateProfile`. They return promises (`{ok, xpGained, error}`); the
  server is the only place that grants XP.
- Pages: `index` (public landing/SEO), `test` (public speed test, no account),
  `login`, `registro`, `dashboard` (lesson map), `exam`, `lesson.html?lesson=1..8`,
  `practica`, `404`, `privacidad`, `terminos`.
- `examen-datos.js` holds the three reading passages + questions used by both
  `exam.html` and `test.html`. Edit it once, both pages change.
- CSS: `style-2.5d.css` holds design tokens/components; `iconos-individuales.css` holds
  icons. Page-specific CSS is usually inline in that page's `<head>`.

## Domain rules

- Auth is Supabase Auth (email/password). There is no local password hash and no
  demo user seeded in the browser anymore.
- Supabase stores its token via the adapter in `app.js` (`window.KIV_AUTH_STORAGE`):
  `localStorage` when "mantener sesión" is checked, `sessionStorage` otherwise.
  Do not write prototype data to `leomas_*` keys; `app.js` deletes any leftovers.
- Progression is strict and enforced server-side: the exam needs ≥100 PPM **and** ≥8/10;
  lesson 1 needs `examDone`; lesson n>1 needs lesson n-1 done. The dashboard and
  `lesson.html` use the same rules for rendering only.
- There are 8 lessons, not 9: `KIV.overall` divides by 9 because it counts the exam
  plus the 8 lessons.
- Lesson XP is awarded only on first completion; replays update history but do not
  grant XP again. Lesson 8's milestone still saves automatically on first render.
- Lessons 4, 6 and 7 require a correct quiz before the server accepts completion.
- The dashboard inline script aborts silently if any expected element is missing.
  Keep `#dailyXP`, `#dailyPct`, `#dailyRing`, and `#badges` in the markup before
  changing its stats, lock, badges, or profile logic.
- Use `KIV.esc` for dynamic content; several spots interpolate strings into `innerHTML`.

## Data layer (cloud or local)

- `kiv-cloud.js` exposes one API (`KIVCloud`) with two backends:
  - **local** (default): browser storage. No backend needed. Rules are reimplemented in
    the client and stored under `kiv_local_db` + `kiv_local_session`. Not security:
    anyone with DevTools can edit it. Use it to develop/demo, not to sell as real auth.
  - **cloud**: Supabase Auth + RPC. Enable with `enabled: true` in
    `supabase-config.js`.
- Switch modes only through `enabled`; pages and `app.js` do not change.
- Local rules mirror the SQL: exam pass ≥100 PPM and ≥8/10; lesson 1 requires the exam;
  lesson n requires n-1; lessons 4/6/7 require the quiz; lesson XP on first completion;
  exam XP on first pass; practice XP capped at 2/day.
- Both modes return `{ok, state}` where `state` is already camelCase
  (`profile`, `progress`, `lessonsDone`, `history`).
- If `enabled` is true but the CDN or the schema is unavailable, protected pages fail;
  there is no silent fallback to local. Flip `enabled` deliberately.

## Backend Supabase (ready, off by default)

- `supabase/migrations/20261117000000_kivhora_initial.sql` defines profiles, progress,
  lesson/exam/practice history, RLS, triggers and server-side RPCs.
- `kiv-cloud.js` is the browser client wrapper; `supabase-config.js` holds the public
  project URL and publishable key. Never put a `service_role` key there.
- The schema is applied in the project, but `enabled: false` keeps the app in local
  mode for now.
- Server-side rules: exam pass is ≥100 PPM and ≥8/10; lesson XP is first-completion
  only; exam XP only on first pass; practice XP is capped at 2 rewarded sessions/day;
  streaks/daily reset use `America/Bogota`.
- Keep business logic in the SQL RPCs, not in the client, so users cannot grant
  themselves XP. The client only reads tables allowed by RLS.
- Setup, RPC contracts and pending checks: `supabase/README.md`.

## Content and SEO

- All UI copy is Spanish (UTF-8); preserve accents/emoji when editing.
- The domain is hardcoded as `https://kivhora.com` in `index.html` (canonical, OG,
  JSON-LD), `sitemap.xml`, and `robots.txt`. Update them together if the domain changes.
- The logo/mascot is `nutria_logo.jpeg` at the repo root; keep all page references
  pointing there.

## Manual verification

There are no automated tests in the repo. Serve the site and walk: register/login →
pass the exam (≥100 PPM, 8/10) → dashboard unlocks lesson 1 → complete the lesson chain
→ practice saves XP twice/day → edit profile/logout. In local mode, reset by deleting
`kiv_local_db` and `kiv_local_session` from DevTools → Application → Storage. With
Supabase on, use a second account to confirm RLS isolation and reset via the SQL Editor
(`delete from auth.users;` cascades).
