-- ============================================================
-- LearnQuest – Initiales Datenbankschema
-- Ausführen in: Supabase → SQL Editor → "Run"
-- ============================================================

-- ── Worlds (Lernwelten mit KI-generierten Fragen) ──────────
create table if not exists public.worlds (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references auth.users(id) on delete set null,
  title         text        not null,
  content_hash  text        not null unique,
  questions     jsonb       not null,
  created_at    timestamptz default now()
);

-- ── Sessions (einzelne Spielsitzungen) ─────────────────────
create table if not exists public.sessions (
  id           uuid        default gen_random_uuid() primary key,
  user_id      uuid        references auth.users(id) on delete cascade,
  world_id     uuid        references public.worlds(id) on delete cascade,
  score        integer     not null default 0,
  duration     integer,
  completed_at timestamptz default now()
);

-- ── Characters (ein Charakter pro User) ────────────────────
create table if not exists public.characters (
  id            uuid    default gen_random_uuid() primary key,
  user_id       uuid    references auth.users(id) on delete cascade unique,
  type          text    not null default 'wizard',
  level         integer not null default 1,
  xp            integer not null default 0,
  customization jsonb   default '{}'::jsonb
);

-- ── Profiles (Name, Alter etc.) ────────────────────────────
create table if not exists public.profiles (
  id         uuid        references auth.users(id) on delete cascade primary key,
  name       text,
  age        integer,
  created_at timestamptz default now()
);

-- ── Mistakes (Spaced Repetition – falsche Antworten) ───────
create table if not exists public.mistakes (
  id             uuid        default gen_random_uuid() primary key,
  user_id        uuid        references auth.users(id) on delete cascade,
  world_id       uuid        references public.worlds(id) on delete cascade,
  question_index integer     not null,
  next_review_at timestamptz default now(),
  review_count   integer     default 0
);

-- ============================================================
-- Row Level Security (RLS) – jeder sieht nur seine Daten
-- ============================================================

alter table public.worlds     enable row level security;
alter table public.sessions   enable row level security;
alter table public.characters enable row level security;
alter table public.profiles   enable row level security;
alter table public.mistakes   enable row level security;

-- Policies: erst löschen falls vorhanden (idempotent)
drop policy if exists "worlds_select"    on public.worlds;
drop policy if exists "worlds_insert"    on public.worlds;
drop policy if exists "sessions_all"     on public.sessions;
drop policy if exists "characters_all"   on public.characters;
drop policy if exists "profiles_all"     on public.profiles;
drop policy if exists "mistakes_all"     on public.mistakes;

-- Worlds: öffentlich lesbar (Cache-Lookup), jeder darf einfügen
create policy "worlds_select" on public.worlds
  for select using (true);

create policy "worlds_insert" on public.worlds
  for insert with check (true);

-- Sessions: nur eigene
create policy "sessions_all" on public.sessions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Characters: nur eigene
create policy "characters_all" on public.characters
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Profiles: nur eigenes
create policy "profiles_all" on public.profiles
  for all using (auth.uid() = id)
  with check (auth.uid() = id);

-- Mistakes: nur eigene
create policy "mistakes_all" on public.mistakes
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Hilfsfunktionen
-- ============================================================

-- XP erhöhen (wird von database.ts → updateXP aufgerufen)
create or replace function public.increment_xp(p_user_id uuid, p_delta integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.characters
  set xp = xp + p_delta
  where user_id = p_user_id;
end;
$$;

-- Profil automatisch anlegen wenn neuer User sich registriert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger: bei jedem neuen Auth-User → Profil anlegen
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Indizes für Performance
-- ============================================================

create index if not exists idx_worlds_content_hash  on public.worlds(content_hash);
create index if not exists idx_worlds_user_id        on public.worlds(user_id);
create index if not exists idx_sessions_user_id      on public.sessions(user_id);
create index if not exists idx_mistakes_user_review  on public.mistakes(user_id, next_review_at);
