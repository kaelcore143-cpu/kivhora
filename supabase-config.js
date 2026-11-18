/* ============================================================
   KIVHORA · Configuración pública de la capa de datos
   ------------------------------------------------------------
   MODO ACTUAL: local
   - `enabled: false` usa el almacenamiento del navegador. No
     requiere backend ni conexión; sirve para desarrollar y
     probar la app.
   - `enabled: true` usa Supabase Auth + RPC. Requiere el
     esquema aplicado (ver supabase/README.md).

   Datos del proyecto (Project Settings → API):
   - url: Project URL
   - anonKey: publishable key (o "anon public" en proyectos
     antiguos)

   La clave es pública por diseño: la protección real está en
   las políticas RLS y en las RPC. NUNCA pongas aquí la
   `service_role` key.
   ============================================================ */
window.KIV_SUPABASE = {
  enabled: false,
  url: 'https://plazqnnhrhlhypxbtlkt.supabase.co',
  anonKey: 'sb_publishable_aJU719qnsUKEcMxHTjOhJA_FZphCaFw'
};
