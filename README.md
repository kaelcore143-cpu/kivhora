# Kivhora — Aprende a leer rápido

Sitio estático, sin build, listo para subir a cualquier hosting (Netlify, Vercel,
GitHub Pages, cPanel, S3…). La autenticación y el progreso viven en Supabase.

## Archivos
- `index.html` — Landing pública optimizada para SEO (JSON-LD, OG, canonical, semántica).
- `login.html` / `registro.html` — Autenticación con Supabase Auth.
- `dashboard.html` — Ruta de 8 lecciones, XP, racha y logros.
- `exam.html` — Test de velocidad lectora de 60 s.
- `lesson.html?lesson=1..8` — Lecciones con quiz de comprensión.
- `practica.html` — Práctica de desplazamiento continuo.
- `style-2.5d.css` — Sistema de diseño (azul, estilo Duolingo, 2.5D).
- `app.js` — Estado en memoria, utilidades, navegación y autenticación (delegada).
- `lecciones.js` — Contenido de las 8 lecciones + preguntas.
- `nutria_logo.jpeg` — Logo/mascota (nutria con corona) y favicon.
- `kiv-cloud.js` — Cliente de Supabase: sesión, RPC y normalización del estado.
- `supabase-config.js` — URL y publishable key públicas del proyecto Supabase.
- `supabase/` — Migración SQL, RLS, RPCs y guía de configuración del backend.

## Backend Supabase

El esquema (`profiles`, `user_progress`, historial, RLS y RPC) está en
`supabase/migrations/`. Antes de abrir las páginas hay que aplicarlo en el proyecto
y configurar la URL y la publishable key en `supabase-config.js`; los pasos están en
`supabase/README.md`.

El servidor calcula XP, rachas, desbloqueos y el límite diario de práctica. El
navegador no puede escribir esas tablas directamente. La publishable/anon key es
pública por diseño; nunca pongas la `service_role` key en el frontend.

## Notas
- No hay usuarios ni contraseñas guardadas en el navegador. Al cargar, `app.js`
  elimina cualquier resto del prototipo antiguo (`leomas_*`).
- "Mantener mi sesión" usa `localStorage`; sin marcarlo, la sesión vive solo en la
  pestaña (`sessionStorage`) y se cierra al cerrarla.
- SEO: revisa el dominio en `canonical`, `og:url`, `sitemap.xml` y `robots.txt`.