-- ============================================================
-- LearnQuest – Migration 012: Student usernames
--
-- Schüler loggen sich mit Username+Passwort ein (KEINE Email nötig).
-- Technisch wird intern ein Fake-Email `{username}@students.learnquest.local`
-- angelegt, damit Supabase Auth (das Email zwingend verlangt) funktioniert.
--
-- Lehrer erstellen Schüler-Accounts via /api/create-student
-- (Vercel-Funktion, die mit Service-Role-Key auth.users.insert macht).
-- ============================================================

-- ── 1. ADD username column to profiles ─────────────────────
alter table public.profiles add column if not exists username text;

-- Only lowercase-alphanum-with-hyphens, 3-20 chars. Null allowed für bestehende User.
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (
    username is null
    or (username ~ '^[a-z0-9_-]{3,20}$')
  );

-- Unique (excluding nulls so existing users without username don't break)
create unique index if not exists profiles_username_unique
  on public.profiles (username)
  where username is not null;


-- ── 2. LOOKUP: username → email (public, anon-callable) ────
-- Client ruft das beim Login auf: user tippt Username, Frontend holt
-- das zugehörige Email, dann signInWithPassword.
create or replace function public.lookup_student_email(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = lower(p_username)
    and p.role = 'student'
  limit 1;
$$;

-- Grant execute on anon role so login page can call it before auth
grant execute on function public.lookup_student_email(text) to anon, authenticated;


-- ── 3. TEACHER-CALLABLE: list students in a class WITH username ──
-- (Used by BulkInviteModal + teacher student list)
create or replace function public.get_class_students_v2(p_class_id uuid)
returns table (
  student_id uuid,
  student_name text,
  username text,
  level integer,
  streak integer,
  last_active timestamptz,
  total_sessions integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Caller must be the teacher of this class (or admin)
  if not exists (
    select 1 from public.classes c
    where c.id = p_class_id
      and (c.teacher_id = auth.uid() or public.is_admin(auth.uid()))
  ) then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
  select
    p.id as student_id,
    coalesce(p.name, p.username, 'Schüler') as student_name,
    p.username,
    coalesce(c2.level, 1) as level,
    coalesce(p.current_streak, 0) as streak,
    p.last_active_date as last_active,
    coalesce(p.total_sessions, 0) as total_sessions
  from public.class_members cm
  join public.profiles p on p.id = cm.student_id
  left join public.characters c2 on c2.user_id = p.id
  where cm.class_id = p_class_id
  order by coalesce(p.last_active_date, '1970-01-01'::timestamptz) desc;
end;
$$;

grant execute on function public.get_class_students_v2(uuid) to authenticated;


-- ── 4. HELPER: auto-join class when student profile is created with a class_code ──
-- When create-student API sets `user_metadata->>'pending_class_code'`, the trigger
-- reads it + joins the matching class automatically.
create or replace function public.handle_student_pending_class()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_code text;
  matched_class_id uuid;
begin
  pending_code := new.raw_user_meta_data->>'pending_class_code';
  if pending_code is null or pending_code = '' then
    return new;
  end if;

  select id into matched_class_id from public.classes where invite_code = pending_code limit 1;
  if matched_class_id is null then
    return new;
  end if;

  insert into public.class_members (class_id, student_id)
  values (matched_class_id, new.id)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_join_class on auth.users;
create trigger on_auth_user_join_class
  after insert on auth.users
  for each row execute function public.handle_student_pending_class();
