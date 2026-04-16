-- ============================================================
-- LearnQuest – Migration 004: Progress Sync
-- Neue Tabellen für serverseitige Fortschrittsspeicherung.
-- Additiv & idempotent. Ausführen in: Supabase → SQL Editor
-- ============================================================

-- ── profiles erweitern (Avatar-Farbe + Lernabsicht) ──────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_color       TEXT DEFAULT '#6C3CE1',
  ADD COLUMN IF NOT EXISTS learning_intention TEXT;

-- ── user_topics (Lernthemen pro User) ────────────────────────
-- Jeder Dungeon-Lauf erzeugt (oder aktualisiert) ein Topic.
-- mastery_percent steigt mit jeder richtigen Antwort.
CREATE TABLE IF NOT EXISTS public.user_topics (
  id              uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid         REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic_name      TEXT         NOT NULL,
  source_type     TEXT         NOT NULL DEFAULT 'text',  -- 'pdf' | 'text' | 'ai' | 'manual'
  mastery_percent INTEGER      NOT NULL DEFAULT 0 CHECK (mastery_percent BETWEEN 0 AND 100),
  last_studied_at TIMESTAMPTZ  DEFAULT now(),
  created_at      TIMESTAMPTZ  DEFAULT now(),
  -- Pro User darf ein Topic-Name nur einmal vorkommen
  UNIQUE (user_id, topic_name)
);

-- ── learned_content (Spaced-Repetition pro Frage) ────────────
-- Ersetzt/ergänzt die 'mistakes'-Tabelle mit vollständigen SR-Daten.
CREATE TABLE IF NOT EXISTS public.learned_content (
  id             uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid         REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic_id       uuid         REFERENCES public.user_topics(id) ON DELETE CASCADE,
  question_text  TEXT         NOT NULL,
  correct_answer TEXT         NOT NULL,
  times_correct  INTEGER      NOT NULL DEFAULT 0,
  times_wrong    INTEGER      NOT NULL DEFAULT 0,
  next_review_at TIMESTAMPTZ  DEFAULT now(),
  ease_factor    NUMERIC(4,2) NOT NULL DEFAULT 2.5  -- SM-2 ease factor (1.3 – 2.5)
);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.user_topics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learned_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_topics_own"     ON public.user_topics;
DROP POLICY IF EXISTS "learned_content_own" ON public.learned_content;

-- User kann nur eigene Daten lesen/schreiben
CREATE POLICY "user_topics_own" ON public.user_topics
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK  (auth.uid() = user_id);

CREATE POLICY "learned_content_own" ON public.learned_content
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK  (auth.uid() = user_id);

-- ── Indizes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_topics_user    ON public.user_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_topics_mastery ON public.user_topics(user_id, mastery_percent DESC);
CREATE INDEX IF NOT EXISTS idx_learned_user        ON public.learned_content(user_id);
CREATE INDEX IF NOT EXISTS idx_learned_review      ON public.learned_content(user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_learned_topic       ON public.learned_content(topic_id);

-- ── upsert_player_progress ────────────────────────────────────
-- Idempotenter Server-Sync: schreibt XP/Level/Sessions nur dann,
-- wenn der neue Wert GRÖSSER als der gespeicherte ist (Supabase gewinnt).
-- Auth-gesichert: Caller muss identisch mit p_user_id sein.
CREATE OR REPLACE FUNCTION public.upsert_player_progress(
  p_user_id        uuid,
  p_xp             integer,
  p_level          integer,
  p_total_sessions integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized: caller % cannot update progress for %',
      auth.uid(), p_user_id;
  END IF;

  -- Charakter anlegen oder XP/Level aktualisieren (nimmt immer den höheren Wert)
  INSERT INTO public.characters (user_id, type, level, xp)
  VALUES (p_user_id, 'wizard', p_level, p_xp)
  ON CONFLICT (user_id) DO UPDATE SET
    xp    = GREATEST(characters.xp,    EXCLUDED.xp),
    level = GREATEST(characters.level, EXCLUDED.level);

  -- Gesamtsessions im Profil aktualisieren (nur erhöhen)
  UPDATE public.profiles
  SET total_sessions = GREATEST(COALESCE(total_sessions, 0), p_total_sessions)
  WHERE id = p_user_id;
END;
$$;
