-- ============================================================
-- LearnQuest – Migration 009: Infra-Tabellen & Schema-Erweiterungen
-- Additiv & idempotent. Ausführen in: Supabase → SQL Editor
-- ============================================================

-- ── 1. profiles: settings_json ───────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS settings_json JSONB NOT NULL DEFAULT '{
    "reducedMotion": false,
    "soundEnabled": true,
    "hapticEnabled": true,
    "highContrast": false
  }'::jsonb;

-- ── 2. sessions: fehlende Spalten ────────────────────────────
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS world_theme        TEXT,
  ADD COLUMN IF NOT EXISTS dungeon_number     INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS boss_defeated      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stars              SMALLINT DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
  ADD COLUMN IF NOT EXISTS duration_sec       INTEGER,
  ADD COLUMN IF NOT EXISTS questions_correct  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS questions_total    INTEGER DEFAULT 0;

-- ── 3. mistakes: fehlende Spalten ────────────────────────────
ALTER TABLE public.mistakes
  ADD COLUMN IF NOT EXISTS world_theme    TEXT,
  ADD COLUMN IF NOT EXISTS topic_id       UUID,
  ADD COLUMN IF NOT EXISTS wrong_answer   TEXT,
  ADD COLUMN IF NOT EXISTS correct_answer TEXT,
  ADD COLUMN IF NOT EXISTS game_type      TEXT DEFAULT 'mc',
  ADD COLUMN IF NOT EXISTS srs_stage      INTEGER DEFAULT 0;

-- ── 4. topics: Hierarchisches Themen-System ──────────────────
CREATE TABLE IF NOT EXISTS public.topics (
  id                        UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  title                     TEXT        NOT NULL,
  parent_id                 UUID        REFERENCES public.topics(id) ON DELETE SET NULL,
  source_page_range         TEXT,
  total_questions_generated INTEGER     NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. runes: Sammel-Loot-System ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.runes (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic_id        UUID        REFERENCES public.topics(id) ON DELETE SET NULL,
  world_id        UUID        REFERENCES public.worlds(id) ON DELETE SET NULL,
  rarity          TEXT        NOT NULL DEFAULT 'common'
    CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  fact_title      TEXT        NOT NULL,
  fact_body       TEXT        NOT NULL,
  world_theme     TEXT,
  obtained_at     TIMESTAMPTZ DEFAULT NOW(),
  evolution_level SMALLINT    NOT NULL DEFAULT 1
    CHECK (evolution_level BETWEEN 1 AND 3)
);

-- ── 6. error_log: API-Fehler-Protokoll ───────────────────────
CREATE TABLE IF NOT EXISTS public.error_log (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_response TEXT,
  error        TEXT        NOT NULL,
  prompt_hash  TEXT,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. RLS aktivieren ────────────────────────────────────────
ALTER TABLE public.topics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;

-- ── 8. RLS-Policies: topics ───────────────────────────────────
DROP POLICY IF EXISTS "topics_own" ON public.topics;
CREATE POLICY "topics_own" ON public.topics
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 9. RLS-Policies: runes ────────────────────────────────────
DROP POLICY IF EXISTS "runes_own" ON public.runes;
CREATE POLICY "runes_own" ON public.runes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 10. RLS-Policies: error_log ──────────────────────────────
-- Jeder darf einfügen (API-Route schreibt hier rein, auch ohne Service-Key)
-- Lesen ist nur über Service-Role möglich (kein SELECT-Policy = kein User-Zugriff)
DROP POLICY IF EXISTS "error_log_insert" ON public.error_log;
CREATE POLICY "error_log_insert" ON public.error_log
  FOR INSERT WITH CHECK (TRUE);

-- ── 11. Indizes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_topics_user       ON public.topics(user_id);
CREATE INDEX IF NOT EXISTS idx_topics_parent     ON public.topics(parent_id);
CREATE INDEX IF NOT EXISTS idx_runes_user        ON public.runes(user_id);
CREATE INDEX IF NOT EXISTS idx_runes_world       ON public.runes(world_id);
CREATE INDEX IF NOT EXISTS idx_error_log_hash    ON public.error_log(prompt_hash);
CREATE INDEX IF NOT EXISTS idx_error_log_created ON public.error_log(created_at DESC);
