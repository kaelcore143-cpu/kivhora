# AGENTS.md

## What this is

Static, no-build, Spanish-language reading-speed app ("Kivhora"). Vanilla ES5-style
JavaScript, global `KIV` namespace, no `package.json`, dependencies, tests, CI, or git.
Everything runs directly in the browser.

## Run

- No install/build step. Serve the folder over HTTP (`npx serve .` or
  `python -m http.server`) and open `index.html`; `file://` can break `localStorage`
  in some browsers.
- Editing HTML/CSS/JS only needs a page reload; there is no watcher or codegen.

## Wiring

- Each page is standalone HTML with an inline `<script>` IIFE at the bottom.
- Script order matters: `app.js` (core `KIV`), then `lecciones.js` (`KIV_LESSONS`),
  then the inline page script. Keep these globals unless every page is migrated.
- `app.js`: auth, progress, XP, streaks, levels, toasts, header chrome.
  `lecciones.js`: all 8 lesson definitions.
- Pages: `index` (public landing/SEO), `login`, `registro`, `dashboard` (lesson map),
  `exam`, `lesson.html?lesson=1..8`, `practica`.
- CSS: `style-2.5d.css` holds design tokens/components; `iconos-individuales.css` holds
  icons. Page-specific CSS is usually inline in that page's `<head>`.

## Domain rules

- `localStorage` keys keep the legacy `leomas_*` prefix: `leomas_users`,
  `leomas_session`, `leomas_progress`, `leomas_profiles`. Don't rename without migrating.
- Session is stored in `localStorage` when "remember me" is checked, otherwise in
  `sessionStorage`.
- Passwords use a demo djb2-style hash, not real security. This is a prototype; don't
  present it as production auth.
- Progression is strict: the exam needs ≥100 PPM **and** ≥8/10 to set `examDone`;
  lesson 1 needs `examDone`; lesson n>1 needs lesson n-1 done (`KIV.isLessonUnlocked`).
  The dashboard does not visually lock node 8, but `lesson.html` still rejects it.
- There are 8 lessons, not 9: `KIV.overall` divides by 9 because it counts the exam
  plus the 8 lessons.
- `app.js` seeds the demo user `demo@kivhora.com` / `kivhora123` with preset progress on
  `DOMContentLoaded`.
- Use `KIV.esc` for dynamic content; several spots interpolate strings into `innerHTML`.

## Content and SEO

- All UI copy is Spanish (UTF-8); preserve accents/emoji when editing.
- The domain is hardcoded as `https://kivhora.com` in `index.html` (canonical, OG,
  JSON-LD), `sitemap.xml`, and `robots.txt`. Update them together if the domain changes.
- The logo/mascot is `nutria_logo.jpeg` at the repo root. The README's `assets/...`
  path is stale.

## Manual verification

There are no automated tests. Serve the site and walk: register/login → pass the exam
(≥100 PPM, 8/10) → dashboard unlocks lesson 1 → complete lesson chain → practice saves XP
→ edit profile/logout. Reset state via DevTools → Application → Local Storage
(`leomas_*` keys).
