-- ============================================================
-- LearnQuest – Migration 002: Streaks, Weltauswahl, Liga
-- Additiv & idempotent. Ausführen in: Supabase → SQL Editor
-- ============================================================

-- ── Teil 1: profiles erweitern ────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_streak    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_date  TEXT,
  ADD COLUMN IF NOT EXISTS streak_freezes    INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_sessions    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selected_world_id TEXT DEFAULT 'fire',
  ADD COLUMN IF NOT EXISTS weekly_xp         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_reset_at   TIMESTAMPTZ DEFAULT now();

-- ── Teil 2: sessions erweitern ────────────────────────────────
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS world_theme       TEXT,
  ADD COLUMN IF NOT EXISTS boss_defeated     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS questions_correct INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS questions_total   INTEGER DEFAULT 0;

-- ── Teil 3: league_groups ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.league_groups (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start timestamptz NOT NULL,
  week_end   timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ── Teil 4: league_members ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.league_members (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id  uuid REFERENCES public.league_groups(id) ON DELETE CASCADE,
  weekly_xp INTEGER DEFAULT 0,
  UNIQUE(user_id, group_id)
);

-- ── Teil 5: RLS für neue Tabellen ─────────────────────────────
ALTER TABLE public.league_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "league_groups_select"  ON public.league_groups;
DROP POLICY IF EXISTS "league_members_select" ON public.league_members;
DROP POLICY IF EXISTS "league_members_own"    ON public.league_members;

CREATE POLICY "league_groups_select"  ON public.league_groups  FOR SELECT USING (true);
CREATE POLICY "league_members_select" ON public.league_members FOR SELECT USING (true);
CREATE POLICY "league_members_own"    ON public.league_members
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Teil 6: update_streak ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_streak(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today         TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_yesterday     TEXT := to_char((now() AT TIME ZONE 'UTC') - interval '1 day', 'YYYY-MM-DD');
  v_profile       RECORD;
  v_new_streak    INTEGER;
  v_freeze_used   BOOLEAN := false;
  v_streak_broken BOOLEAN := false;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('streak', 0);
  END IF;

  IF v_profile.last_active_date = v_today THEN
    RETURN jsonb_build_object('streak', v_profile.current_streak, 'freeze_used', false, 'broken', false);
  END IF;

  IF v_profile.last_active_date = v_yesterday THEN
    v_new_streak := v_profile.current_streak + 1;
  ELSIF v_profile.streak_freezes > 0 AND v_profile.last_active_date IS NOT NULL THEN
    v_new_streak := v_profile.current_streak;
    v_freeze_used := true;
  ELSE
    v_new_streak := 1;
    v_streak_broken := (v_profile.current_streak > 0);
  END IF;

  UPDATE public.profiles SET
    current_streak   = v_new_streak,
    longest_streak   = GREATEST(longest_streak, v_new_streak),
    last_active_date = v_today,
    total_sessions   = total_sessions + 1,
    streak_freezes   = CASE WHEN v_freeze_used THEN streak_freezes - 1 ELSE streak_freezes END
  WHERE id = p_user_id;

  RETURN jsonb_build_object('streak', v_new_streak, 'freeze_used', v_freeze_used, 'broken', v_streak_broken);
END;
$$;

-- ── Teil 7: add_weekly_xp ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_weekly_xp(p_user_id uuid, p_xp integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET weekly_xp = weekly_xp + p_xp WHERE id = p_user_id;
END;
$$;

-- ── Teil 8: Indizes ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_weekly_xp ON public.profiles(weekly_xp DESC);
CREATE INDEX IF NOT EXISTS idx_league_members_xp  ON public.league_members(weekly_xp DESC);
