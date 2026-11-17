# Kivhora — Aprende a leer rápido

Sitio estático, sin dependencias de JavaScript, listo para subir a cualquier hosting
(Netlify, Vercel, GitHub Pages, cPanel, S3…).

## Archivos
- `index.html` — Landing pública optimizada para SEO (JSON-LD, OG, canonical, semántica).
- `login.html` / `registro.html` — Autenticación local.
- `dashboard.html` — Ruta de 8 lecciones, XP, racha y logros.
- `exam.html` — Test de velocidad lectora de 60 s.
- `lesson.html?lesson=1..8` — Lecciones con quiz de comprensión.
- `practica.html` — Práctica de desplazamiento continuo.
- `style-2.5d.css` — Sistema de diseño (azul, estilo Duolingo, 2.5D).
- `app.js` — Auth y progreso locales del prototipo; toasts, niveles y utilidades.
- `lecciones.js` — Contenido de las 8 lecciones + preguntas.
- `nutria_logo.jpeg` — Logo/mascota (nutria con corona) y favicon.
- `kiv-cloud.js` — Cliente de Supabase para la futura autenticación y progreso remoto.
- `supabase-config.js` — URL y anon key públicas del proyecto Supabase.
- `supabase/` — Migración SQL, RLS, RPCs y guía de configuración del backend.

## Backend Supabase

La carpeta `supabase/` contiene el esquema inicial, las políticas RLS y las RPC que
calcularán XP, rachas y desbloqueos en el servidor. El frontend **todavía no está
conectado**: las páginas siguen usando `localStorage` hasta configurar el proyecto y
completar la integración. Instrucciones en `supabase/README.md`.

Configura `supabase-config.js` con la URL y la anon key del proyecto. La anon key es
pública por diseño; nunca pongas la `service_role` key en el frontend.

## Cuenta de demostración
- Email: `demo@kivhora.com`
- Contraseña: `kivhora123`

## Notas
- El prototipo guarda todo en `localStorage` (`leomas_users`, `leomas_session`,
  `leomas_progress`, `leomas_profiles`). El backend Supabase ya está diseñado y
  esperando la integración del frontend.
- El hash de contraseñas local es demostrativo (no criptográfico); no se usará cuando
  el frontend pase a Supabase Auth.
- SEO: revisa el dominio en `canonical`, `og:url`, `sitemap.xml` y `robots.txt`.