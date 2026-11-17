# Kivhora — Aprende a leer rápido

Sitio estático, sin dependencias de JavaScript, listo para subir a cualquier hosting
(Netlify, Vercel, GitHub Pages, cPanel, S3…).

## Archivos
- `index.html` — Landing pública optimizada para SEO (JSON-LD, OG, canonical, semántica).
- `login.html` / `registro.html` — Autenticación local.
- `dashboard.html` — Ruta de 9 lecciones, XP, racha, ranking y logros.
- `exam.html` — Test de velocidad lectora de 60 s.
- `lesson.html?lesson=1..9` — Lecciones con quiz de comprensión.
- `style-2.5d.css` — Sistema de diseño (azul, estilo Duolingo, 2.5D).
- `app.js` — Auth, progreso, XP, rachas, niveles, toasts.
- `lecciones.js` — Contenido de las 9 lecciones + preguntas.
- `assets/nutria_logo.jpeg` — Logo/mascota (nutria con corona) y favicon.

## Cuenta de demostración
- Email: `demo@kivhora.com`
- Contraseña: `kivhora123`

## Notas
- Los datos se guardan en `localStorage` (`leomas_users`, `leomas_session`,
  `leomas_progress`, `leomas_profiles`). Para producción real se recomienda sustituir
  `app.js` por una API con sesiones seguras y contraseñas con bcrypt/argon2.
- El hash de contraseñas es demostrativo (no criptográfico).
- SEO: revisa el dominio en `canonical`, `og:url`, `sitemap.xml` y `robots.txt`.