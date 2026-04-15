-- ============================================================
-- LearnQuest – Migration 003: Security Hardening
-- Patches SECURITY DEFINER functions to enforce caller identity.
-- Without these checks any authenticated user could call e.g.
--   rpc('increment_xp', { p_user_id: '<victim-id>', p_delta: 99999 })
-- and manipulate another user's XP / streak.
-- ============================================================

-- ── Patch 1: increment_xp ────────────────────────────────────
-- Only the user themselves (or a service-role bypass) may call this.
CREATE OR REPLACE FUNCTION public.increment_xp(p_user_id uuid, p_delta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized: caller % cannot update xp for %', auth.uid(), p_user_id;
  END IF;

  UPDATE public.characters
  SET xp = xp + p_delta
  WHERE user_id = p_user_id;
END;
$$;

-- ── Patch 2: update_streak ───────────────────────────────────
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
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized: caller % cannot update streak for %', auth.uid(), p_user_id;
  END IF;

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

-- ── Patch 3: add_weekly_xp ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_weekly_xp(p_user_id uuid, p_xp integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized: caller % cannot update weekly_xp for %', auth.uid(), p_user_id;
  END IF;

  UPDATE public.profiles SET weekly_xp = weekly_xp + p_xp WHERE id = p_user_id;
END;
$$;
