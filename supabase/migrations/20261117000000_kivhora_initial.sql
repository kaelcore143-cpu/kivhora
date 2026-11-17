-- ============================================================
-- Kivhora · Esquema inicial de Supabase
-- Ejecutar en Supabase Studio → SQL Editor, o con `supabase db push`.
--
-- Principios:
-- - El cliente solo puede leer sus propios datos.
-- - El XP, las rachas y los desbloqueos se calculan en el servidor.
-- - Las inserciones de progreso se hacen exclusivamente por RPC.
-- - La anon key es pública; la seguridad real vive en RLS.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tablas
-- ------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Lector',
  profile_type text not null default 'adolescente'
    check (profile_type in ('niño', 'adolescente', 'universitario', 'profesor')),
  avatar text not null default '🦦',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  streak integer not null default 0 check (streak >= 0),
  last_ppm integer not null default 0 check (last_ppm >= 0),
  best_ppm integer not null default 0 check (best_ppm >= 0),
  minutes integer not null default 0 check (minutes >= 0),
  exam_done boolean not null default false,
  last_active date,
  daily_date date not null default current_date,
  daily_xp integer not null default 0 check (daily_xp >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_number smallint not null check (lesson_number between 1 and 8),
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_number)
);

create table if not exists public.exam_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ppm integer not null check (ppm > 0),
  score smallint not null check (score between 0 and 10),
  passed boolean not null default false,
  seconds integer not null default 0 check (seconds >= 0),
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.practice_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ppm integer not null check (ppm > 0),
  multiplier numeric(3, 1) not null check (multiplier in (1.0, 1.5, 2.0, 3.0)),
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  created_at timestamptz not null default now()
);

create index if not exists lesson_completions_user_idx
  on public.lesson_completions (user_id);

create index if not exists exam_attempts_user_created_idx
  on public.exam_attempts (user_id, created_at desc);

create index if not exists practice_attempts_user_created_idx
  on public.practice_attempts (user_id, created_at desc);

-- ------------------------------------------------------------
-- 2. Utilidades de fecha y triggers
-- ------------------------------------------------------------

-- Zona horaria del producto. Cambiar aquí si Kivhora deja de operar en Colombia.
create or replace function public.kiv_today()
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select (now() at time zone 'America/Bogota')::date;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists user_progress_set_updated_at on public.user_progress;
create trigger user_progress_set_updated_at
  before update on public.user_progress
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3. Creación automática de perfil y progreso al registrarse
-- ------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_type text := coalesce(nullif(new.raw_user_meta_data->>'profile_type', ''), 'adolescente');
begin
  if v_profile_type not in ('niño', 'adolescente', 'universitario', 'profesor') then
    v_profile_type := 'adolescente';
  end if;

  insert into public.profiles (id, name, profile_type)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), 'Lector'),
    v_profile_type
  )
  on conflict (id) do nothing;

  insert into public.user_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill por si ya existen usuarios creados antes de este esquema.
insert into public.profiles (id, name, profile_type)
select
  id,
  coalesce(nullif(trim(raw_user_meta_data->>'name'), ''), 'Lector'),
  case
    when raw_user_meta_data->>'profile_type' in ('niño', 'adolescente', 'universitario', 'profesor')
      then raw_user_meta_data->>'profile_type'
    else 'adolescente'
  end
from auth.users
on conflict (id) do nothing;

insert into public.user_progress (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ------------------------------------------------------------
-- 4. Funciones internas de progreso
-- ------------------------------------------------------------

create or replace function public.ensure_progress(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_progress (user_id)
  values (p_user)
  on conflict (user_id) do nothing;
end;
$$;

-- Aplica una actividad al progreso: XP, racha, meta diaria, PPM y minutos.
-- Nunca debe exponerse directamente al cliente.
create or replace function public.apply_activity(
  p_user uuid,
  p_xp integer,
  p_ppm integer,
  p_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := public.kiv_today();
  v_xp integer := greatest(coalesce(p_xp, 0), 0);
  v_ppm integer := coalesce(p_ppm, 0);
  v_seconds integer := greatest(coalesce(p_seconds, 0), 0);
begin
  perform public.ensure_progress(p_user);

  update public.user_progress
  set
    xp = xp + v_xp,
    daily_xp = case
      when daily_date = v_today then daily_xp + v_xp
      else v_xp
    end,
    daily_date = v_today,
    streak = case
      when last_active is null then 1
      when last_active = v_today then streak
      when last_active = v_today - 1 then streak + 1
      else 1
    end,
    last_active = v_today,
    last_ppm = case when v_ppm > 0 then v_ppm else last_ppm end,
    best_ppm = greatest(best_ppm, v_ppm),
    minutes = minutes + (round(v_seconds / 60.0))::integer
  where user_id = p_user;
end;
$$;

-- ------------------------------------------------------------
-- 5. Lectura del estado del usuario
-- ------------------------------------------------------------

create or replace function public.get_my_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select jsonb_build_object(
    'profile', coalesce((
      select jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'profile_type', p.profile_type,
        'avatar', p.avatar
      )
      from public.profiles p
      where p.id = v_user
    ), '{}'::jsonb),
    'progress', coalesce((
      select jsonb_build_object(
        'xp', up.xp,
        'streak', up.streak,
        'last_ppm', up.last_ppm,
        'best_ppm', up.best_ppm,
        'minutes', up.minutes,
        'exam_done', up.exam_done,
        'last_active', up.last_active,
        'daily_date', up.daily_date,
        'daily_xp', up.daily_xp
      )
      from public.user_progress up
      where up.user_id = v_user
    ), '{}'::jsonb),
    'lessons', coalesce((
      select jsonb_agg(lesson_number order by lesson_number)
      from public.lesson_completions
      where user_id = v_user
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(entry order by created_at desc)
      from (
        select
          jsonb_build_object(
            'type', 'exam',
            'ppm', ppm,
            'score', score,
            'passed', passed,
            'created_at', created_at
          ) as entry,
          created_at
        from public.exam_attempts
        where user_id = v_user

        union all

        select
          jsonb_build_object(
            'type', 'lesson',
            'lesson', lesson_number,
            'xp', xp_awarded,
            'created_at', completed_at
          ) as entry,
          completed_at as created_at
        from public.lesson_completions
        where user_id = v_user

        union all

        select
          jsonb_build_object(
            'type', 'practice',
            'ppm', ppm,
            'multiplier', multiplier,
            'xp', xp_awarded,
            'created_at', created_at
          ) as entry,
          created_at
        from public.practice_attempts
        where user_id = v_user

        order by created_at desc
        limit 50
      ) h
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

-- ------------------------------------------------------------
-- 6. RPCs de negocio
-- ------------------------------------------------------------

create or replace function public.complete_lesson(
  p_lesson integer,
  p_ppm integer,
  p_quiz_ok boolean,
  p_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_xp integer;
  v_rows integer := 0;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if p_lesson is null or p_lesson < 1 or p_lesson > 8 then
    raise exception 'invalid_lesson';
  end if;
  if p_ppm is null or p_ppm < 0 then
    raise exception 'invalid_ppm';
  end if;
  if p_seconds is null or p_seconds < 0 then
    raise exception 'invalid_seconds';
  end if;

  perform public.ensure_progress(v_user);

  if p_lesson = 1 then
    if not exists (
      select 1 from public.user_progress
      where user_id = v_user and exam_done = true
    ) then
      raise exception 'lesson_locked';
    end if;
  else
    if not exists (
      select 1 from public.lesson_completions
      where user_id = v_user and lesson_number = p_lesson - 1
    ) then
      raise exception 'lesson_locked';
    end if;
  end if;

  if p_lesson in (4, 6, 7) and not coalesce(p_quiz_ok, false) then
    raise exception 'quiz_required';
  end if;

  v_xp := case
    when p_lesson = 1 then 10
    when p_lesson = 2 then case when coalesce(p_quiz_ok, false) then 20 else 10 end
    when p_lesson = 3 then 20
    when p_lesson in (4, 6, 7) then 30
    when p_lesson = 5 then 50
    when p_lesson = 8 then 20
  end;

  insert into public.lesson_completions (user_id, lesson_number, xp_awarded)
  values (v_user, p_lesson, v_xp)
  on conflict (user_id, lesson_number) do nothing;

  get diagnostics v_rows = row_count;

  -- El XP solo se otorga la primera vez que se completa la lección.
  if v_rows > 0 then
    perform public.apply_activity(v_user, v_xp, p_ppm, p_seconds);
  end if;

  return public.get_my_state();
end;
$$;

create or replace function public.complete_exam(
  p_ppm integer,
  p_score integer,
  p_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_was_done boolean := false;
  v_passed boolean;
  v_xp integer := 0;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if p_ppm is null or p_ppm <= 0 then
    raise exception 'invalid_ppm';
  end if;
  if p_score is null or p_score < 0 or p_score > 10 then
    raise exception 'invalid_score';
  end if;
  if p_seconds is null or p_seconds < 0 then
    raise exception 'invalid_seconds';
  end if;

  perform public.ensure_progress(v_user);

  select exam_done into v_was_done
  from public.user_progress
  where user_id = v_user
  for update;

  v_passed := p_ppm >= 100 and p_score >= 8;

  -- El examen solo otorga XP la primera vez que se aprueba.
  if v_passed and not coalesce(v_was_done, false) then
    v_xp := 60
      + case
          when p_ppm >= 300 then 40
          when p_ppm >= 200 then 25
          else 10
        end
      + (p_score * 5);

    update public.user_progress
    set exam_done = true
    where user_id = v_user;
  end if;

  insert into public.exam_attempts (user_id, ppm, score, passed, seconds, xp_awarded)
  values (v_user, p_ppm, p_score, v_passed, p_seconds, v_xp);

  perform public.apply_activity(v_user, v_xp, p_ppm, p_seconds);

  return public.get_my_state();
end;
$$;

create or replace function public.save_practice(
  p_ppm integer,
  p_multiplier numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_exam_done boolean := false;
  v_xp integer := 0;
  v_rewarded_today integer := 0;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if p_ppm is null or p_ppm <= 0 then
    raise exception 'invalid_ppm';
  end if;
  if p_multiplier not in (1.0, 1.5, 2.0, 3.0) then
    raise exception 'invalid_multiplier';
  end if;

  perform public.ensure_progress(v_user);

  select exam_done into v_exam_done
  from public.user_progress
  where user_id = v_user;

  if not coalesce(v_exam_done, false) then
    raise exception 'exam_required';
  end if;

  -- Máximo 2 prácticas con XP por día para evitar farming ilimitado.
  select count(*) into v_rewarded_today
  from public.practice_attempts
  where user_id = v_user
    and xp_awarded > 0
    and (created_at at time zone 'America/Bogota')::date = public.kiv_today();

  if v_rewarded_today < 2 then
    v_xp := 30
      + case when p_multiplier > 1 then 10 else 0 end
      + case when p_multiplier > 2 then 20 else 0 end;
  end if;

  insert into public.practice_attempts (user_id, ppm, multiplier, xp_awarded)
  values (v_user, p_ppm, p_multiplier, v_xp);

  perform public.apply_activity(v_user, v_xp, 0, 0);

  return public.get_my_state();
end;
$$;

create or replace function public.update_profile(
  p_name text,
  p_avatar text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_avatar text := coalesce(p_avatar, '🦦');
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'invalid_name';
  end if;
  if char_length(v_avatar) < 1 or char_length(v_avatar) > 16 then
    raise exception 'invalid_avatar';
  end if;

  insert into public.profiles (id, name, avatar)
  values (v_user, v_name, v_avatar)
  on conflict (id) do update
  set name = excluded.name,
      avatar = excluded.avatar;

  return public.get_my_state();
end;
$$;

-- ------------------------------------------------------------
-- 7. Row Level Security
-- ------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_progress enable row level security;
alter table public.lesson_completions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.practice_attempts enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists user_progress_select_own on public.user_progress;
create policy user_progress_select_own
  on public.user_progress for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists lesson_completions_select_own on public.lesson_completions;
create policy lesson_completions_select_own
  on public.lesson_completions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists exam_attempts_select_own on public.exam_attempts;
create policy exam_attempts_select_own
  on public.exam_attempts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists practice_attempts_select_own on public.practice_attempts;
create policy practice_attempts_select_own
  on public.practice_attempts for select
  to authenticated
  using (auth.uid() = user_id);

-- El cliente solo lee. Las escrituras pasan por RPCs security definer.
revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;

revoke all on public.user_progress from anon;
revoke all on public.user_progress from authenticated;
grant select on public.user_progress to authenticated;

revoke all on public.lesson_completions from anon;
revoke all on public.lesson_completions from authenticated;
grant select on public.lesson_completions to authenticated;

revoke all on public.exam_attempts from anon;
revoke all on public.exam_attempts from authenticated;
grant select on public.exam_attempts to authenticated;

revoke all on public.practice_attempts from anon;
revoke all on public.practice_attempts from authenticated;
grant select on public.practice_attempts to authenticated;

-- ------------------------------------------------------------
-- 8. Permisos de funciones
-- ------------------------------------------------------------

revoke all on function public.kiv_today() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.ensure_progress(uuid) from public, anon, authenticated;
revoke all on function public.apply_activity(uuid, integer, integer, integer) from public, anon, authenticated;

revoke all on function public.get_my_state() from public, anon;
grant execute on function public.get_my_state() to authenticated;

revoke all on function public.complete_lesson(integer, integer, boolean, integer) from public, anon;
grant execute on function public.complete_lesson(integer, integer, boolean, integer) to authenticated;

revoke all on function public.complete_exam(integer, integer, integer) from public, anon;
grant execute on function public.complete_exam(integer, integer, integer) to authenticated;

revoke all on function public.save_practice(integer, numeric) from public, anon;
grant execute on function public.save_practice(integer, numeric) to authenticated;

revoke all on function public.update_profile(text, text) from public, anon;
grant execute on function public.update_profile(text, text) to authenticated;

-- ------------------------------------------------------------
-- 9. Notas operativas
-- ------------------------------------------------------------
-- - En Authentication → Providers → Email, habilita email/password.
-- - Si activas "Confirm email", el registro no devuelve sesión hasta confirmar.
-- - Configura Site URL y Redirect URLs con el dominio real y localhost para desarrollo.
-- - La anon key puede estar en el frontend. Nunca pongas la service_role key.
-- - El límite de 2 prácticas con XP/día está en save_practice; ajústalo si cambia el producto.
