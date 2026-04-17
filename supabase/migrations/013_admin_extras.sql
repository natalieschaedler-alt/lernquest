-- ============================================================
-- LearnQuest – Migration 013: Admin extras
--   * audit_log: jede admin-Aktion protokollieren
--   * app_settings: Key-Value-Store für globale Konfig
--   * get_admin_overview_series: time-series (users/sessions last 30d)
--   * get_top_worlds: meist-gespielte Welten
--   * get_school_detail: alle Lehrer + Klassen + Schüler einer Schule
-- ============================================================

-- ── 1. AUDIT LOG ─────────────────────────────────────────────
create table if not exists public.audit_log (
  id         bigserial primary key,
  admin_id   uuid       references auth.users(id) on delete set null,
  admin_email text,
  action     text       not null,        -- e.g. 'approve_teacher', 'set_role', 'delete_school'
  target     text,                       -- email/id of target
  details    jsonb      default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_admin_idx   on public.audit_log (admin_id);

alter table public.audit_log enable row level security;

drop policy if exists "admin_read_audit" on public.audit_log;
create policy "admin_read_audit"
  on public.audit_log for select
  using ( public.is_admin(auth.uid()) );

drop policy if exists "admin_insert_audit" on public.audit_log;
create policy "admin_insert_audit"
  on public.audit_log for insert
  with check ( public.is_admin(auth.uid()) );

-- Convenience: log an audit entry (callable by admins)
create or replace function public.log_admin_action(p_action text, p_target text, p_details jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_current_user_admin() then return; end if;
  insert into public.audit_log (admin_id, admin_email, action, target, details)
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    p_action, p_target, coalesce(p_details, '{}'::jsonb)
  );
end; $$;
grant execute on function public.log_admin_action(text, text, jsonb) to authenticated;


-- ── 2. APP SETTINGS (key-value) ────────────────────────────
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb      not null,
  updated_at timestamptz default now(),
  updated_by uuid       references auth.users(id) on delete set null
);

alter table public.app_settings enable row level security;

drop policy if exists "admin_all_settings" on public.app_settings;
create policy "admin_all_settings"
  on public.app_settings for all
  using ( public.is_admin(auth.uid()) )
  with check ( public.is_admin(auth.uid()) );

-- Readable for everyone (so client can fetch defaults)
drop policy if exists "public_read_settings" on public.app_settings;
create policy "public_read_settings"
  on public.app_settings for select
  using ( true );

-- Seed defaults (idempotent)
insert into public.app_settings (key, value) values
  ('daily_goal_default',     '1'::jsonb),
  ('maintenance_mode',        'false'::jsonb),
  ('content_filter_strict',   'true'::jsonb),
  ('rate_limit_auth_per_hour','10'::jsonb),
  ('rate_limit_guest_per_hour','3'::jsonb)
on conflict (key) do nothing;


-- ── 3. TIME-SERIES (last 30 days) ──────────────────────────
create or replace function public.get_admin_overview_series()
returns table (day date, new_users bigint, new_sessions bigint, new_worlds bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
  with days as (
    select generate_series(
      (now() - interval '29 days')::date,
      now()::date,
      interval '1 day'
    )::date as day
  )
  select
    d.day,
    (select count(*) from auth.users u where u.created_at::date = d.day)                 as new_users,
    (select count(*) from public.sessions s where s.completed_at::date = d.day)           as new_sessions,
    (select count(*) from public.worlds w where w.created_at::date = d.day)               as new_worlds
  from days d
  order by d.day;
end; $$;
grant execute on function public.get_admin_overview_series() to authenticated;


-- ── 4. TOP WORLDS ──────────────────────────────────────────
create or replace function public.get_top_worlds(p_limit int default 10)
returns table (world_id uuid, title text, sessions bigint, unique_users bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
  select
    w.id,
    w.title,
    count(s.id) as sessions,
    count(distinct s.user_id) as unique_users
  from public.worlds w
  left join public.sessions s on s.world_id = w.id
  group by w.id, w.title
  order by sessions desc
  limit p_limit;
end; $$;
grant execute on function public.get_top_worlds(int) to authenticated;


-- ── 5. SCHOOL DETAIL (all teachers + classes) ──────────────
create or replace function public.get_school_detail(p_school_id uuid)
returns table (
  kind text,
  id uuid,
  name text,
  sub_info text,
  count_info bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  -- Teachers
  return query
  select
    'teacher'::text      as kind,
    p.id,
    coalesce(p.name, 'Ohne Namen') as name,
    p.role::text         as sub_info,
    (select count(*) from public.classes c where c.teacher_id = p.id)::bigint as count_info
  from public.profiles p
  where p.school_id = p_school_id and p.role in ('teacher','teacher_pending');

  -- Classes (via teachers of this school)
  return query
  select
    'class'::text        as kind,
    c.id,
    c.name,
    (c.subject || ' · ' || c.grade)::text as sub_info,
    (select count(*) from public.class_members cm where cm.class_id = c.id)::bigint as count_info
  from public.classes c
  where c.teacher_id in (
    select id from public.profiles where school_id = p_school_id and role = 'teacher'
  );
end; $$;
grant execute on function public.get_school_detail(uuid) to authenticated;


-- ── 6. USER DETAIL (stats for one user) ────────────────────
create or replace function public.get_user_detail(p_user_id uuid)
returns table (
  email text,
  role text,
  name text,
  school_name text,
  total_sessions bigint,
  total_worlds_created bigint,
  current_streak int,
  longest_streak int,
  level int,
  xp int,
  created_at timestamptz,
  last_active timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
  select
    u.email::text,
    p.role::text,
    p.name::text,
    (select s.name from public.schools s where s.id = p.school_id)::text as school_name,
    (select count(*) from public.sessions where user_id = p_user_id)::bigint,
    (select count(*) from public.worlds  where user_id = p_user_id)::bigint,
    coalesce(p.current_streak, 0),
    coalesce(p.longest_streak, 0),
    coalesce(c.level, 1),
    coalesce(c.xp, 0),
    u.created_at,
    p.last_active_date::timestamptz
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.characters c on c.user_id = u.id
  where u.id = p_user_id;
end; $$;
grant execute on function public.get_user_detail(uuid) to authenticated;
