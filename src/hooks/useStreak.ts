import { useEffect, useCallback } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

export function useStreak() {
  const { user } = useAuth()
  const { streak, updateStreak } = useGameStore()

  // Declare syncWithSupabase before the effect that calls it
  const syncWithSupabase = useCallback(async () => {
    if (!user) return
    const result = await supabase.rpc('update_streak', { p_user_id: user.id })
    if (result.data) {
      const serverStreak = (result.data as { streak: number }).streak
      const localStreak = useGameStore.getState().streak
      if (serverStreak > localStreak) {
        useGameStore.setState({ streak: serverStreak })
      }
    }
  }, [user])

  useEffect(() => {
    updateStreak()
    if (user) void syncWithSupabase()
  }, [user, updateStreak, syncWithSupabase])

  return { streak }
}
