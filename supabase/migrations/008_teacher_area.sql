-- ============================================================
-- LearnQuest – Migration 008: Lehrer-Bereich
-- Neue Tabellen für Lehrer-Klassen, Aufgaben und eigene Fragen.
-- Additiv & idempotent. Ausführen in: Supabase → SQL Editor
-- ============================================================

-- ── 1. profiles: Rolle + Schule + Fächer ────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role     TEXT NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'teacher_pending', 'teacher', 'admin')),
  ADD COLUMN IF NOT EXISTS school   TEXT,
  ADD COLUMN IF NOT EXISTS subjects TEXT;

-- ── 2. classes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.classes (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id  uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT        NOT NULL,
  subject     TEXT        NOT NULL,
  grade       TEXT        NOT NULL,
  invite_code TEXT        NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(invite_code)
);

-- ── 3. class_members ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.class_members (
  class_id   uuid        REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  student_id uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at  timestamptz DEFAULT now(),
  PRIMARY KEY (class_id, student_id)
);

-- ── 4. assignments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assignments (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id     uuid        REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  teacher_id   uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title        TEXT        NOT NULL,
  topic        TEXT        NOT NULL,
  dungeon_type TEXT        NOT NULL DEFAULT 'dungeon',
  deadline     timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- ── 5. custom_questions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.custom_questions (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  class_id      uuid        REFERENCES public.classes(id) ON DELETE SET NULL,
  question      TEXT        NOT NULL,
  options       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer     NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- ── 6. RLS aktivieren ────────────────────────────────────────
ALTER TABLE public.classes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_questions ENABLE ROW LEVEL SECURITY;

-- ── 7. RLS-Policies: classes ─────────────────────────────────
DROP POLICY IF EXISTS "classes_teacher_all"      ON public.classes;
DROP POLICY IF EXISTS "classes_student_select"   ON public.classes;

-- Lehrer: voller Zugriff auf eigene Klassen
CREATE POLICY "classes_teacher_all" ON public.classes
  FOR ALL USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- Schüler: darf Klassen lesen, denen er beigetreten ist
CREATE POLICY "classes_student_select" ON public.classes
  FOR SELECT USING (
    id IN (
      SELECT class_id FROM public.class_members WHERE student_id = auth.uid()
    )
  );

-- ── 8. RLS-Policies: class_members ───────────────────────────
DROP POLICY IF EXISTS "class_members_read"  ON public.class_members;
DROP POLICY IF EXISTS "class_members_join"  ON public.class_members;
DROP POLICY IF EXISTS "class_members_leave" ON public.class_members;

-- Schüler sieht seine eigenen Einträge; Lehrer sieht Einträge seiner Klassen
CREATE POLICY "class_members_read" ON public.class_members
  FOR SELECT USING (
    student_id = auth.uid()
    OR class_id IN (
      SELECT id FROM public.classes WHERE teacher_id = auth.uid()
    )
  );

-- Schüler darf sich selbst eintragen (beitreten)
CREATE POLICY "class_members_join" ON public.class_members
  FOR INSERT WITH CHECK (student_id = auth.uid());

-- Schüler darf sich selbst austragen (verlassen)
CREATE POLICY "class_members_leave" ON public.class_members
  FOR DELETE USING (student_id = auth.uid());

-- ── 9. RLS-Policies: assignments ─────────────────────────────
DROP POLICY IF EXISTS "assignments_teacher"        ON public.assignments;
DROP POLICY IF EXISTS "assignments_student_select" ON public.assignments;

-- Lehrer: voller Zugriff
CREATE POLICY "assignments_teacher" ON public.assignments
  FOR ALL USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- Schüler: lesen wenn Mitglied der Klasse
CREATE POLICY "assignments_student_select" ON public.assignments
  FOR SELECT USING (
    class_id IN (
      SELECT class_id FROM public.class_members WHERE student_id = auth.uid()
    )
  );

-- ── 10. RLS-Policies: custom_questions ───────────────────────
DROP POLICY IF EXISTS "custom_questions_teacher" ON public.custom_questions;

CREATE POLICY "custom_questions_teacher" ON public.custom_questions
  FOR ALL USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- ── 11. Indizes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_classes_teacher    ON public.classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_members_cls  ON public.class_members(class_id);
CREATE INDEX IF NOT EXISTS idx_class_members_stu  ON public.class_members(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class  ON public.assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_tchr   ON public.assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_cq_teacher         ON public.custom_questions(teacher_id);

-- ── 12. Hilfsfunktion: Schülerliste für Lehrer ───────────────
-- SECURITY DEFINER: Lehrer kann Profil-Daten seiner Schüler lesen,
-- obwohl die profiles-RLS normalerweise nur eigene Zeilen zeigt.
CREATE OR REPLACE FUNCTION public.get_class_students(p_class_id uuid)
RETURNS TABLE (
  student_id     uuid,
  student_name   text,
  level          integer,
  streak         integer,
  last_active    text,
  total_sessions integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sicherstellen: auth.uid() ist der Lehrer dieser Klasse
  IF NOT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = p_class_id AND teacher_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'unauthorized: caller is not the teacher of class %', p_class_id;
  END IF;

  RETURN QUERY
  SELECT
    cm.student_id,
    COALESCE(p.name,  'Unbekannt')     AS student_name,
    COALESCE(ch.level, 1)              AS level,
    COALESCE(p.current_streak, 0)      AS streak,
    p.last_active_date                 AS last_active,
    COALESCE(p.total_sessions, 0)      AS total_sessions
  FROM public.class_members cm
  LEFT JOIN public.profiles   p  ON p.id       = cm.student_id
  LEFT JOIN public.characters ch ON ch.user_id = cm.student_id
  WHERE cm.class_id = p_class_id
  ORDER BY p.last_active_date DESC NULLS LAST;
END;
$$;

-- ── 13. Hilfsfunktion: Klasse per Code beitreten ────────────
CREATE OR REPLACE FUNCTION public.join_class_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id   uuid;
  v_class_name text;
BEGIN
  SELECT id, name INTO v_class_id, v_class_name
  FROM public.classes
  WHERE upper(trim(invite_code)) = upper(trim(p_code));

  IF v_class_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_not_found');
  END IF;

  INSERT INTO public.class_members (class_id, student_id)
  VALUES (v_class_id, auth.uid())
  ON CONFLICT (class_id, student_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'class_name', v_class_name, 'class_id', v_class_id);
END;
$$;
