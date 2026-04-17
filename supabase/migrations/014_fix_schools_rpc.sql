-- ============================================================
-- LearnQuest – Migration 014: Fix get_schools_with_counts
--
-- Fehler in 011: Return-Column-Namen (id, name, city, ...) kollidieren
-- mit den Spaltennamen von `schools` → PG 42702 "could refer to either
-- a PL/pgSQL variable or a table column".
-- Fix: Tabellen-Spalten explizit qualifizieren ODER View direkt zurückgeben.
-- Einfachste Lösung: Return-Column-Namen umbenennen (out_id, out_name, …).
-- ============================================================

-- Drop first weil change of return-type nicht mit CREATE OR REPLACE geht
drop function if exists public.get_schools_with_counts();

create or replace function public.get_schools_with_counts()
returns table (
  out_id            uuid,
  out_name          text,
  out_city          text,
  out_country       text,
  out_created_at    timestamptz,
  out_teacher_count bigint,
  out_student_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_current_user_admin() or
          exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher','teacher_pending')))
  then
    return query
      select
        s.id::uuid,
        s.name::text,
        s.city::text,
        s.country::text,
        s.created_at::timestamptz,
        0::bigint,
        0::bigint
      from public.schools s
      order by s.name;
    return;
  end if;

  return query
    select
      s.id::uuid,
      s.name::text,
      s.city::text,
      s.country::text,
      s.created_at::timestamptz,
      (select count(*) from public.profiles p
         where p.school_id = s.id and p.role in ('teacher','teacher_pending'))::bigint,
      (select count(*) from public.profiles p
         where p.school_id = s.id and p.role = 'student')::bigint
    from public.schools s
    order by s.created_at desc;
end;
$$;

grant execute on function public.get_schools_with_counts() to authenticated;


-- Same fix for get_school_detail (returns generic kind/id/name/sub_info/count_info)
-- → that one has NO column name conflict, so leave it unchanged.

-- Same for get_admin_overview_series → uses (day, new_users, ...) which don't
-- conflict with any real table column → unchanged.

-- Same for get_top_worlds → uses (world_id, title, ...). World_id doesn't
-- conflict. Title DOES conflict with worlds.title. Let me check…
-- Actually looking at the SQL: "select w.id, w.title, count(s.id) ..." — the
-- returned column "title" DOES match "w.title". Let me rename to be safe.

drop function if exists public.get_top_worlds(int);

create or replace function public.get_top_worlds(p_limit int default 10)
returns table (
  out_world_id     uuid,
  out_title        text,
  out_sessions     bigint,
  out_unique_users bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
  select
    w.id::uuid                  as out_world_id,
    w.title::text               as out_title,
    count(s.id)::bigint         as out_sessions,
    count(distinct s.user_id)::bigint as out_unique_users
  from public.worlds w
  left join public.sessions s on s.world_id = w.id
  group by w.id, w.title
  order by out_sessions desc
  limit p_limit;
end;
$$;

grant execute on function public.get_top_worlds(int) to authenticated;
