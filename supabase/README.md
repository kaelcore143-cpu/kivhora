# Backend Supabase de Kivhora

Kivhora funciona sin backend en **modo local**. Supabase está conectado y con el
esquema aplicado, pero **desactivado** con `enabled: false` en `../supabase-config.js`.

Para activarlo:

1. Cambia `enabled: false` a `enabled: true` en `../supabase-config.js`.
2. Verifica la URL y la publishable/anon key del proyecto.
3. Recarga la página y prueba registro/login.

Importante: los datos del modo local y los de Supabase son independientes. Al activar
Supabase, las cuentas creadas en el navegador no existen allí.

## 1. Crear el proyecto

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Copia de **Project Settings → API**:
   - `Project URL`
   - publishable key (o `anon public` en proyectos antiguos)
3. Pega ambos valores en `../supabase-config.js`.

No uses la `service_role` key en el navegador.

## 2. Crear el esquema

Opción recomendada sin CLI:

1. Abre **SQL Editor** en Supabase Studio.
2. Copia y ejecuta el contenido de
   `migrations/20261117000000_kivhora_initial.sql`.
3. Verifica en **Table Editor** que existan:
   - `profiles`
   - `user_progress`
   - `lesson_completions`
   - `exam_attempts`
   - `practice_attempts`

Si tienes Supabase CLI instalado y Docker disponible:

```bash
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

## 3. Configurar autenticación

En **Authentication → Providers → Email**:

- Habilita email/password.
- Para pruebas puedes desactivar “Confirm email”.
- Para producción se recomienda activarlo; el registro mostrará un mensaje de
  confirmación y no iniciará sesión hasta que el usuario confirme.
- En **Authentication → URL Configuration** configura:
  - Site URL: el dominio real de Kivhora.
  - Redirect URLs: el dominio real y `http://localhost:PUERTO` para desarrollo.

## 4. Crear la cuenta demo (opcional)

En **Authentication → Users → Add user**:

- Email: `demo@kivhora.com`
- Password: elige una propia y no la publiques
- User Metadata:

```json
{
  "name": "Demo Kivhora",
  "profile_type": "adolescente"
}
```

El trigger `handle_new_user` crea automáticamente el perfil y la fila de progreso.
El progreso inicial de la demo no se replica; se puede dejar en cero o cargar desde el
SQL Editor si se necesita una presentación con datos.

## 5. Modelo de datos

### `profiles`

Perfil público del usuario. Se crea con el trigger de `auth.users`.

- `id` → `auth.users.id`
- `name`
- `profile_type`: `niño`, `adolescente`, `universitario`, `profesor`
- `avatar`

### `user_progress`

Una fila por usuario. Es la fuente de verdad de XP, racha, PPM, minutos y meta diaria.
El cliente solo puede leerla; las escrituras pasan por RPC.

### `lesson_completions`

Una fila por usuario y lección (`primary key (user_id, lesson_number)`). La clave
primaria hace que el XP de una lección sea idempotente: repetirla no vuelve a sumar.

### `exam_attempts`

Historial de intentos del examen. Guarda PPM, aciertos, aprobado, segundos y XP.

### `practice_attempts`

Historial de práctica de desplazamiento continuo. Guarda PPM, multiplicador y XP.

## 6. RPCs disponibles

Todas validan `auth.uid()` y calculan el progreso en el servidor.

| RPC | Parámetros | Uso |
|---|---|---|
| `get_my_state` | — | Devuelve perfil, progreso, lecciones e historial |
| `complete_lesson` | `p_lesson`, `p_ppm`, `p_quiz_ok`, `p_seconds` | Completa una lección y aplica XP/bloqueos |
| `complete_exam` | `p_ppm`, `p_score`, `p_seconds` | Registra el examen y aprueba si corresponde |
| `save_practice` | `p_ppm`, `p_multiplier` | Registra práctica y aplica XP con límite diario |
| `update_profile` | `p_name`, `p_avatar` | Actualiza nombre y avatar |

### Reglas implementadas

- Examen aprobado: `ppm >= 100` y `score >= 8`.
- Lección 1 requiere examen aprobado.
- Lección `n` requiere la `n-1` completada.
- Lecciones 4, 6 y 7 requieren quiz correcto.
- XP de lección solo la primera vez.
- XP del examen solo la primera aprobación; los reintentos actualizan récord e historial.
- Práctica: máximo 2 sesiones con XP por día.
- Racha y meta diaria se calculan en servidor con zona horaria `America/Bogota`.
- El cliente no puede insertar ni actualizar tablas directamente.

## 7. Seguridad

- RLS activo en las cinco tablas.
- Cada usuario solo puede leer sus propias filas.
- `anon` no tiene acceso a tablas.
- Las escrituras se hacen por funciones `security definer` que verifican `auth.uid()`.
- Las funciones internas (`apply_activity`, `ensure_progress`, etc.) no son ejecutables
  por `anon` ni por `authenticated`.
- La anon key puede ir en el frontend; la service_role nunca.

Prueba rápida de RLS:

1. Sin sesión, intenta `GET /rest/v1/profiles?select=*` con la anon key: debe fallar o
   devolver vacío.
2. Con sesión, solo deben aparecer las filas del usuario autenticado.

## 8. Estado de la integración

Implementado en el frontend:

1. Supabase JS + `supabase-config.js` + `kiv-cloud.js` se cargan en todas las páginas
   de la app.
2. `login.html` / `registro.html` usan `KIVCloud.signIn` / `signUp`; registro maneja
   confirmación de correo.
3. Las páginas protegidas esperan `KIV.ready(user, progress)`.
4. Las escrituras usan `complete_lesson`, `complete_exam`, `save_practice` y
   `update_profile`.
5. El examen registra también los intentos reprobados (sin XP).
6. "Mantener sesión" usa `localStorage`; sin marcarlo, `sessionStorage`.
7. `kiv-cloud.js` incluye un modo local con las mismas reglas para trabajar sin
   backend; se activa/desactiva con `enabled` en `supabase-config.js`.

Pendiente de verificar con Supabase activo y un usuario confirmado:

- Registro + login + logout, con y sin confirmación de correo.
- Examen aprobado y reprobado, incluido el reintento sin XP duplicado.
- Cadena de 8 lecciones y bloqueos.
- Límite de 2 prácticas con XP al día.
- Edición de perfil y avatar.
- RLS con una segunda cuenta.

## 9. Comprobaciones mínimas antes de producción

- Registro con email confirmation activado y desactivado.
- Login incorrecto, logout y sesión expirada.
- Examen aprobado y reprobado.
- Repetir lección no duplica XP.
- Repetir examen no duplica XP.
- Límite de práctica diaria.
- RLS: un usuario no puede leer datos de otro.
- Borrado de usuario en Auth elimina perfil y progreso en cascada.
