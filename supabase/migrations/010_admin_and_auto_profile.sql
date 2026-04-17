-- ============================================================
-- LearnQuest – Migration 010: Admin role + auto-profile on signup
--
-- Adds:
--   1. Trigger: auto-create profiles row + characters row on auth.users insert
--   2. is_admin() helper function + RLS policies for admin read-all
--   3. Seed-helper: promote_to_admin(email) callable function
-- ============================================================

-- ── 1. AUTO-CREATE PROFILE + CHARACTER ON SIGNUP ────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    now()
  )
  on conflict (id) do nothing;

  insert into public.characters (user_id, level, xp)
  values (new.id, 1, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Trigger on Supabase auth schema (requires superuser; works via migrations).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── 2. ADMIN ROLE + HELPER FUNCTION ─────────────────────────
-- Ensure 'role' column exists on profiles (already created in 008 or earlier)
-- Add admin to the allowed values via check-constraint soft-relaxation.

do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='role') then
    alter table public.profiles add column role text default 'student';
  end if;
end
$$;

-- is_admin(uid) – used by RLS + frontend
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'admin'
  );
$$;

-- Shorthand: is current auth user admin?
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(auth.uid());
$$;


-- ── 3. RLS: ADMINS CAN READ/UPDATE ALL PROFILES ─────────────
-- Additive policies – existing user-scoped policies remain intact.

drop policy if exists "admin_read_all_profiles" on public.profiles;
create policy "admin_read_all_profiles"
  on public.profiles
  for select
  using ( public.is_admin(auth.uid()) );

drop policy if exists "admin_update_all_profiles" on public.profiles;
create policy "admin_update_all_profiles"
  on public.profiles
  for update
  using ( public.is_admin(auth.uid()) );

-- Allow admins to see all characters (for admin dashboard stats)
drop policy if exists "admin_read_all_characters" on public.characters;
create policy "admin_read_all_characters"
  on public.characters
  for select
  using ( public.is_admin(auth.uid()) );

-- Allow admins to see all sessions (for analytics)
drop policy if exists "admin_read_all_sessions" on public.sessions;
create policy "admin_read_all_sessions"
  on public.sessions
  for select
  using ( public.is_admin(auth.uid()) );


-- ── 4. ADMIN-CALLABLE: PROMOTE USER TO TEACHER / ADMIN ──────
-- Only callable by existing admin. Promotes a user by email.

create or replace function public.admin_set_role(target_email text, new_role text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  -- Gate: only admins may call
  if not public.is_current_user_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  if new_role not in ('student', 'teacher_pending', 'teacher', 'admin') then
    raise exception 'invalid role: %', new_role;
  end if;

  select id into target_id from auth.users where email = target_email limit 1;
  if target_id is null then
    raise exception 'user with email % not found', target_email;
  end if;

  update public.profiles set role = new_role where id = target_id;

  return true;
end;
$$;


-- ── 5. ADMIN-READABLE STATS VIEW ────────────────────────────
-- Aggregated numbers for the admin dashboard.

create or replace view public.admin_stats as
  select
    (select count(*) from auth.users)                                                    as total_users,
    (select count(*) from public.profiles where role = 'teacher')                        as active_teachers,
    (select count(*) from public.profiles where role = 'teacher_pending')                as pending_teachers,
    (select count(*) from public.profiles where role = 'student')                        as students,
    (select count(*) from public.worlds)                                                 as total_worlds,
    (select count(*) from public.worlds where created_at > now() - interval '24 hours')  as worlds_last_24h,
    (select count(*) from public.sessions where completed_at > now() - interval '7 days') as sessions_last_7d;

-- Lock it behind is_admin via a security-definer wrapper
create or replace function public.get_admin_stats()
returns table (
  total_users bigint,
  active_teachers bigint,
  pending_teachers bigint,
  students bigint,
  total_worlds bigint,
  worlds_last_24h bigint,
  sessions_last_7d bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  return query select * from public.admin_stats;
end;
$$;


-- ── 6. BACKFILL: CREATE MISSING PROFILES FOR EXISTING USERS ─
-- Safe on re-run (on conflict do nothing).

insert into public.profiles (id, name, role, created_at)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  'student',
  now()
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

insert into public.characters (user_id, level, xp)
select u.id, 1, 0
from auth.users u
where not exists (select 1 from public.characters c where c.user_id = u.id)
on conflict (user_id) do nothing;


-- ============================================================
-- SEED: make yourself admin.  Run ONCE manually with your email:
--
--   update public.profiles
--     set role = 'admin'
--     where id = (select id from auth.users where email = 'mathias.schaedler00@gmail.com');
-- ============================================================
