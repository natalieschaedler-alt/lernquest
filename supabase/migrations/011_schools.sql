-- ============================================================
-- LearnQuest – Migration 011: Schools
--
-- Schulen als separate Entity: Admin erstellt Schulen,
-- Lehrer werden einer Schule zugeordnet, Klassen gehören zur Schule
-- (via teacher → school). Schüler sehen über die Klasse indirekt die Schule.
-- ============================================================

-- ── 1. SCHOOLS TABLE ───────────────────────────────────────
create table if not exists public.schools (
  id         uuid         default gen_random_uuid() primary key,
  name       text         not null,
  city       text,
  country    text         default 'DE',
  created_by uuid         references auth.users(id) on delete set null,
  created_at timestamptz  default now()
);

create index if not exists schools_name_idx on public.schools (name);

alter table public.schools enable row level security;

-- Admins: full access
drop policy if exists "admin_all_schools" on public.schools;
create policy "admin_all_schools"
  on public.schools
  for all
  using ( public.is_admin(auth.uid()) )
  with check ( public.is_admin(auth.uid()) );

-- Teachers: read their own school
drop policy if exists "teacher_read_own_school" on public.schools;
create policy "teacher_read_own_school"
  on public.schools
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.school_id = schools.id
    )
  );

-- Any authenticated user: read list of schools (for signup dropdown)
drop policy if exists "authenticated_read_schools" on public.schools;
create policy "authenticated_read_schools"
  on public.schools
  for select
  to authenticated
  using ( true );


-- ── 2. ADD school_id TO profiles ───────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name='profiles' and column_name='school_id'
  ) then
    alter table public.profiles
      add column school_id uuid references public.schools(id) on delete set null;
  end if;
end
$$;

create index if not exists profiles_school_id_idx on public.profiles (school_id);


-- ── 3. STATS VIEW: enrich schools with teacher- and student-counts ──
create or replace view public.schools_with_counts as
  select
    s.id,
    s.name,
    s.city,
    s.country,
    s.created_at,
    (select count(*) from public.profiles p where p.school_id = s.id and p.role in ('teacher','teacher_pending')) as teacher_count,
    (select count(*) from public.profiles p where p.school_id = s.id and p.role = 'student')                       as student_count
  from public.schools s
  order by s.created_at desc;


-- ── 4. ADMIN-CALLABLE: list schools with stats ─────────────
create or replace function public.get_schools_with_counts()
returns table (
  id uuid,
  name text,
  city text,
  country text,
  created_at timestamptz,
  teacher_count bigint,
  student_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_current_user_admin() or
          exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher','teacher_pending')))
  then
    -- Non-admin/non-teacher: only id+name (for public dropdown fallback)
    return query
      select s.id, s.name, s.city, s.country, s.created_at, 0::bigint, 0::bigint
      from public.schools s
      order by s.name;
    return;
  end if;
  return query select * from public.schools_with_counts;
end;
$$;


-- ── 5. ADMIN-CALLABLE: assign teacher to school by email ───
create or replace function public.admin_assign_teacher_to_school(
  target_email text,
  p_school_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select id into target_id from auth.users where email = target_email limit 1;
  if target_id is null then
    raise exception 'user with email % not found', target_email;
  end if;

  update public.profiles
    set school_id = p_school_id
    where id = target_id;

  return true;
end;
$$;
