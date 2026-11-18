# Publicar Kivhora

Sitio estático: no hay build, ni `npm install`, ni variables de entorno. Se sube la
carpeta tal cual y funciona. Hoy arranca en **modo local** (`enabled: false` en
`supabase-config.js`), así que no necesita backend para probarse.

## 1. Qué subir

Archivos públicos (obligatorios):

```
index.html          login.html        registro.html
dashboard.html      exam.html         lesson.html
practica.html       test.html         404.html
privacidad.html     terminos.html
style-2.5d.css      iconos-individuales.css
app.js              lecciones.js      examen-datos.js
kiv-cloud.js        supabase-config.js
nutria_logo.jpeg
iconos/             fondos/
robots.txt          sitemap.xml
```

No hace falta publicar `supabase/` (migraciones SQL y documentación del backend),
`README.md`, `AGENTS.md`, `DEPLOY.md` ni `.gitignore`. Si publicas la carpeta completa
tampoco se rompe nada, pero es información interna innecesaria para el visitante.

## 2. Antes de publicar

- [ ] Decide el dominio. Está fijado como `https://kivhora.com` en `index.html`
      (canonical, `og:url`, JSON-LD), `sitemap.xml`, `robots.txt`, `login.html` y
      `registro.html`. Si cambia, actualízalos todos juntos.
- [ ] Revisa el correo de contacto de `privacidad.html` y `terminos.html`
      (`soporte@kivhora.com`) y crea ese buzón.
- [ ] Revisa la razón social/ciudad en esas mismas páginas (hay un comentario HTML al
      inicio del documento).
- [ ] Confirma el interruptor de datos: `enabled: false` (local) o `true` (Supabase).
- [ ] Prueba registro → examen → lección 1 en el dominio final, no solo en local.

## 3. Opciones de hosting

### Netlify (la más simple)

1. Entra a <https://app.netlify.com/drop> y arrastra la carpeta del proyecto.
2. Netlify publica y te da una URL `*.netlify.app`.
3. En **Domain settings** añade tu dominio y sigue las instrucciones de DNS.
4. Netlify detecta `404.html` automáticamente y activa HTTPS.

### Vercel

1. `vercel` desde la carpeta, o importa el repositorio en el panel.
2. Framework preset: **Other**. Build command: vacío. Output directory: `.`
3. Añade el dominio en **Settings → Domains**.

### GitHub Pages

1. Sube el repositorio a GitHub.
2. **Settings → Pages → Deploy from a branch** → `main` → `/ (root)`.
3. Si usas dominio propio, crea un archivo `CNAME` con `kivhora.com` y configura el DNS.
4. `404.html` se usa automáticamente como página de error.

### cPanel / hosting compartido

1. Comprime el contenido (no la carpeta) y súbelo al `public_html`.
2. Verifica que `.html`, `.css`, `.js`, `.png` y `.jpg` se sirvan como archivos
   estáticos y que el sitio tenga certificado SSL activo.

## 4. Después de publicar

- [ ] Abre `https://tudominio/` y confirma que la landing carga sin errores.
- [ ] Crea una cuenta, aprueba el examen y completa una lección.
- [ ] Recarga la página: el progreso debe seguir ahí (modo local) o venir del servidor
      (modo nube).
- [ ] Abre una URL inexistente y confirma que aparece `404.html`.
- [ ] Comprueba `https://tudominio/robots.txt` y `https://tudominio/sitemap.xml`.
- [ ] Envía el sitemap en Google Search Console.
- [ ] Prueba en un celular real: la ruta de lecciones se desliza en horizontal.

## 5. Caché (opcional, recomendado)

Los archivos cambian poco, pero conviene que el HTML no quede atrapado en caché. Si tu
hosting permite cabeceras, estos valores funcionan bien:

```
/*.html          Cache-Control: public, max-age=0, must-revalidate
/*.css           Cache-Control: public, max-age=604800
/*.js            Cache-Control: public, max-age=604800
/iconos/*        Cache-Control: public, max-age=2592000
/fondos/*        Cache-Control: public, max-age=2592000
```

En Netlify va en un archivo `_headers` en la raíz; en Cloudflare Pages, en `_headers`
también; en Vercel, en `vercel.json`.

## 6. Pasar a Supabase más adelante

1. Aplica `supabase/migrations/20261117000000_kivhora_initial.sql` en tu proyecto.
2. Pon la URL y la publishable key en `supabase-config.js`.
3. Cambia `enabled: false` por `enabled: true`.
4. Vuelve a desplegar.

Los datos del modo local no se migran: son cuentas distintas. Los detalles del esquema,
las RPC y las comprobaciones pendientes están en `supabase/README.md`.

## 7. Borrar datos en modo local

Cada navegador guarda su propio progreso. Para reiniciar una demo:

1. DevTools → **Application → Storage**.
2. Elimina `kiv_local_db` y `kiv_local_session`.
3. Recarga.

Las cuentas del modo local no existen en ningún servidor; no hay forma de recuperarlas
desde otro dispositivo.
