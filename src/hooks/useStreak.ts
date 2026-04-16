/**
 * useStreak – vollständiges Streak-System für LearnQuest.
 *
 * Liefert:
 *   streak, longestStreak, freezeCount, activityDays,
 *   pendingMilestone, streakLostPending, previousStreak,
 *   freezeJustUsed, isDangerHour, isTodayActive
 *
 * Für eingeloggte User wird der Streak nach jeder Aktivität mit
 * Supabase synchronisiert (upsert_streak + upsert_activity_day).
 */
import { useCallback, useEffect } from 'react'
import { useGameStore, toLocalISODate, type DayActivity, type StreakMilestone } from '../stores/gameStore'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

// ── Milestone XP rewards ──────────────────────────────────────────────────────
export const MILESTONE_XP: Record<StreakMilestone, number> = {
  7:    200,
  14:   500,
  30:  1000,
  50:  1500,
  100: 3000,
  365: 10000,
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStreak() {
  const { user } = useAuth()

  const streak               = useGameStore((s) => s.streak)
  const longestStreak        = useGameStore((s) => s.longestStreak)
  const freezeCount          = useGameStore((s) => s.freezeCount)
  const activityDays         = useGameStore((s) => s.activityDays)
  const pendingMilestone     = useGameStore((s) => s.pendingMilestone)
  const streakLostPending    = useGameStore((s) => s.streakLostPending)
  const previousStreak       = useGameStore((s) => s.previousStreak)
  const freezeJustUsed       = useGameStore((s) => s.freezeJustUsed)
  const recordActivity       = useGameStore((s) => s.recordActivity)
  const clearPendingMilestone  = useGameStore((s) => s.clearPendingMilestone)
  const clearStreakLostPending = useGameStore((s) => s.clearStreakLostPending)
  const clearFreezeJustUsed   = useGameStore((s) => s.clearFreezeJustUsed)
  const addXP                = useGameStore((s) => s.addXP)

  const todayStr    = toLocalISODate()
  const todayData   = activityDays[todayStr] ?? { d: 0, q: 0 }
  const isTodayActive = todayData.d >= 1 || todayData.q >= 5
  const isDangerHour  = new Date().getHours() >= 18 && !isTodayActive

  // ── Supabase sync after activity ─────────────────────────────────────────
  const syncToSupabase = useCallback(async (
    delta: { type: 'dungeon' | 'question' }
  ) => {
    if (!user) return
    const state = useGameStore.getState()
    const today = toLocalISODate()

    // Sync streak row
    await supabase.rpc('upsert_streak', {
      p_user_id:        user.id,
      p_current_streak: state.streak,
      p_longest_streak: state.longestStreak,
      p_last_active:    today,
      p_freeze_count:   state.freezeCount,
    })

    // Sync activity day
    await supabase.rpc('upsert_activity_day', {
      p_user_id:         user.id,
      p_date:            today,
      p_dungeons_delta:  delta.type === 'dungeon'  ? 1 : 0,
      p_questions_delta: delta.type === 'question' ? 1 : 0,
    })
  }, [user])

  // ── Load initial Supabase data on login ───────────────────────────────────
  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data } = await supabase
        .from('streaks')
        .select('current_streak, longest_streak, freeze_count')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data) {
        const store = useGameStore.getState()
        // Take the higher value (client-wins for streak, server-wins for longest)
        useGameStore.setState({
          streak:        Math.max(store.streak, data.current_streak ?? 0),
          longestStreak: Math.max(store.longestStreak, data.longest_streak ?? 0),
          freezeCount:   data.freeze_count ?? store.freezeCount,
        })
      }
    })()
  }, [user])

  // ── Wrapped recordActivity (includes Supabase sync + milestone XP) ────────
  const trackActivity = useCallback(async (type: 'dungeon' | 'question') => {
    const result = recordActivity(type)

    // Award milestone XP
    if (result.milestoneReached) {
      const xpBonus = MILESTONE_XP[result.milestoneReached]
      if (xpBonus) addXP(xpBonus)
    }

    if (user) await syncToSupabase({ type })

    return result
  }, [recordActivity, addXP, user, syncToSupabase])

  return {
    streak,
    longestStreak,
    freezeCount,
    activityDays,
    isTodayActive,
    isDangerHour,
    pendingMilestone,
    streakLostPending,
    previousStreak,
    freezeJustUsed,
    // Actions
    trackActivity,
    clearPendingMilestone,
    clearStreakLostPending,
    clearFreezeJustUsed,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the last N days as ISO date strings, newest last. */
export function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    return toLocalISODate(new Date(Date.now() - (n - 1 - i) * 86400000))
  })
}

/** Activity level 0-3 for a given day (used for heatmap color intensity). */
export function activityLevel(day: DayActivity | undefined): 0 | 1 | 2 | 3 {
  if (!day) return 0
  if (day.d >= 1) return 3          // dungeon = highest
  if (day.q >= 5) return 2          // 5+ questions = active
  if (day.q >= 1) return 1          // some questions
  return 0
}
