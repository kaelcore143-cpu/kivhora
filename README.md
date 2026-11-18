# Kivhora — Aprende a leer rápido

Sitio estático, sin build, listo para subir a cualquier hosting (Netlify, Vercel,
GitHub Pages, cPanel, S3…). Funciona sin backend (modo local) y puede conectarse a
Supabase con un interruptor.

## Archivos
- `index.html` — Landing pública optimizada para SEO (JSON-LD, OG, canonical, semántica).
- `login.html` / `registro.html` — Autenticación (local o Supabase).
- `dashboard.html` — Ruta de 8 lecciones, XP, racha y logros.
- `exam.html` — Test de velocidad lectora de 60 s (usuarios con cuenta).
- `test.html` — Test público sin registro; enlaza al curso con una cuenta.
- `examen-datos.js` — Lecturas y preguntas compartidas por `exam.html` y `test.html`.
- `lesson.html?lesson=1..8` — Lecciones con quiz de comprensión.
- `practica.html` — Práctica de desplazamiento continuo.
- `privacidad.html` / `terminos.html` — Páginas legales enlazadas desde el footer y el registro.
- `404.html` — Página de error para el hosting.
- `style-2.5d.css` — Sistema de diseño (azul, estilo Duolingo, 2.5D).
- `app.js` — Estado en memoria, utilidades, navegación y autenticación (delegada).
- `lecciones.js` — Contenido de las 8 lecciones + preguntas.
- `nutria_logo.jpeg` — Logo/mascota (nutria con corona) y favicon.
- `iconos/` — Iconos 2.5D de estadísticas y logros; `iconos/opt/` tiene las copias
  optimizadas (128 px) que usa el dashboard.
- `fondos/` — Fondo del panel (`fondo-1.jpg` es la copia comprimida que se usa).
- `kiv-cloud.js` — Capa de datos: modo local y cliente Supabase (Auth + RPC).
- `supabase-config.js` — Interruptor `enabled` + URL y publishable key de Supabase.
- `supabase/` — Migración SQL, RLS, RPCs y guía de configuración del backend.

## Modos de datos

**Local (por defecto, `enabled: false`)**
- No requiere backend ni configuración. Todo se guarda en el navegador
  (`kiv_local_db` y `kiv_local_session`).
- Aplica las mismas reglas de XP, bloqueos y tope de práctica que el servidor.
- Es un modo de desarrollo/demo: cualquiera con DevTools puede editar esos datos.
  No lo presentes como autenticación real.

**Supabase (`enabled: true`)**
- Auth con correo/contraseña y progreso calculado en el servidor.
- Requiere aplicar `supabase/migrations/` y configurar URL + publishable key.
  Pasos en `supabase/README.md`.
- La clave pública puede ir en el frontend; nunca pongas la `service_role`.

## Notas
- "Mantener mi sesión" usa `localStorage`; sin marcarlo, la sesión vive solo en la
  pestaña (`sessionStorage`) y se cierra al cerrarla.
- Las cuentas locales y las de Supabase son independientes: al cambiar de modo no se
  migran datos.
- SEO: revisa el dominio en `canonical`, `og:url`, `sitemap.xml` y `robots.txt`.
- Publicación paso a paso: `DEPLOY.md` (qué subir, hosting, caché, checklist).