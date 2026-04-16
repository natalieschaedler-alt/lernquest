-- ============================================================
-- LearnQuest – Migration 007: Spaced Repetition (SM-2)
-- Speichert pro User+Frage den SM-2-Status für intelligente
-- Wiederholungsplanung.
-- Additiv & idempotent. Ausführen in: Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.spaced_repetition (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  world_id         uuid        REFERENCES public.worlds(id) ON DELETE CASCADE NOT NULL,
  question_index   integer     NOT NULL,
  -- SM-2 Felder
  ease_factor      float       NOT NULL DEFAULT 2.5,
  interval         integer     NOT NULL DEFAULT 1,   -- Tage bis nächste Wiederholung
  repetitions      integer     NOT NULL DEFAULT 0,   -- Anzahl erfolgreicher Wiederholungen
  -- Zeitstempel
  next_review_at   timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz,
  -- Unique-Constraint: eine Zeile pro Frage pro User
  UNIQUE(user_id, world_id, question_index)
);

ALTER TABLE public.spaced_repetition ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_own" ON public.spaced_repetition;
CREATE POLICY "sr_own" ON public.spaced_repetition
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK  (auth.uid() = user_id);

-- Performance-Indizes
CREATE INDEX IF NOT EXISTS idx_sr_user_due   ON public.spaced_repetition(user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_sr_user_world ON public.spaced_repetition(user_id, world_id);
