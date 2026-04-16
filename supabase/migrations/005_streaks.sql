-- ============================================================
-- LearnQuest – Migration 005: Streak System
-- Tabellen für serverseitiges Streak-Tracking + Aktivitäts-Log.
-- Additiv & idempotent. Ausführen in: Supabase → SQL Editor
-- ============================================================

-- ── streaks (ein Eintrag pro User) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.streaks (
  user_id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak     integer     NOT NULL DEFAULT 0,
  longest_streak     integer     NOT NULL DEFAULT 0,
  last_active_date   date,                             -- Datum des letzten aktiven Tags
  freeze_count       integer     NOT NULL DEFAULT 1 CHECK (freeze_count >= 0),
  last_freeze_refill date,                             -- Montag der letzten wöchentlichen Auffüllung
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- ── activity_log (ein Eintrag pro User+Tag) ──────────────────
-- Wird für die 30-Tage-Heatmap genutzt.
CREATE TABLE IF NOT EXISTS public.activity_log (
  id              uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_date   date    NOT NULL,
  dungeons_count  integer NOT NULL DEFAULT 0,
  questions_count integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, activity_date)
);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.streaks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "streaks_own"      ON public.streaks;
DROP POLICY IF EXISTS "activity_log_own" ON public.activity_log;

CREATE POLICY "streaks_own" ON public.streaks
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK  (auth.uid() = user_id);

CREATE POLICY "activity_log_own" ON public.activity_log
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK  (auth.uid() = user_id);

-- ── Indizes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_date ON public.activity_log(user_id, activity_date DESC);

-- ── upsert_streak ─────────────────────────────────────────────
-- Idempotenter Server-Sync: schreibt Streak nur wenn der Wert
-- neuer/größer ist. Erlaubt Client-Side-first Architektur.
CREATE OR REPLACE FUNCTION public.upsert_streak(
  p_user_id        uuid,
  p_current_streak integer,
  p_longest_streak integer,
  p_last_active    date,
  p_freeze_count   integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.streaks (
    user_id, current_streak, longest_streak, last_active_date, freeze_count, updated_at
  )
  VALUES (
    p_user_id, p_current_streak, p_longest_streak, p_last_active, p_freeze_count, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak  = EXCLUDED.current_streak,
    longest_streak  = GREATEST(streaks.longest_streak, EXCLUDED.longest_streak),
    last_active_date = CASE
      WHEN EXCLUDED.last_active_date IS NULL THEN streaks.last_active_date
      WHEN streaks.last_active_date IS NULL  THEN EXCLUDED.last_active_date
      ELSE GREATEST(streaks.last_active_date, EXCLUDED.last_active_date)
    END,
    freeze_count    = EXCLUDED.freeze_count,
    updated_at      = now();
END;
$$;

-- ── upsert_activity_day ───────────────────────────────────────
-- Addiert Dungeon/Fragen-Counts für einen Tag.
CREATE OR REPLACE FUNCTION public.upsert_activity_day(
  p_user_id         uuid,
  p_date            date,
  p_dungeons_delta  integer DEFAULT 0,
  p_questions_delta integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.activity_log (user_id, activity_date, dungeons_count, questions_count)
  VALUES (p_user_id, p_date, p_dungeons_delta, p_questions_delta)
  ON CONFLICT (user_id, activity_date) DO UPDATE SET
    dungeons_count  = activity_log.dungeons_count  + EXCLUDED.dungeons_count,
    questions_count = activity_log.questions_count + EXCLUDED.questions_count;
END;
$$;
