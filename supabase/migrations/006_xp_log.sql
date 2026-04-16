-- ============================================================
-- LearnQuest – Migration 006: XP-Log
-- Protokolliert alle XP-Ereignisse pro User.
-- Additiv & idempotent. Ausführen in: Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.xp_log (
  id         uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid         REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  xp_amount  integer      NOT NULL,
  -- Quelle: question | dungeon | boss | streak | mystery_box | bonus
  source     text         NOT NULL,
  -- Zusatzinfos als JSON, z.B. { isGolden: true, isCrit: true, fast: true, stars: 3 }
  details    jsonb        DEFAULT '{}'::jsonb,
  created_at timestamptz  DEFAULT now()
);

ALTER TABLE public.xp_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xp_log_own" ON public.xp_log;
CREATE POLICY "xp_log_own" ON public.xp_log
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK  (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_xp_log_user   ON public.xp_log(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_log_date   ON public.xp_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_log_source ON public.xp_log(user_id, source);
