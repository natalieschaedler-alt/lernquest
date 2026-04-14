import { useEffect } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

export function useStreak() {
  const { user } = useAuth()
  const { streak, updateStreak } = useGameStore()

  useEffect(() => {
    updateStreak()
    if (user) void syncWithSupabase()
  }, [user])

  const syncWithSupabase = async () => {
    const result = await supabase.rpc('update_streak', { p_user_id: user!.id })
    if (result.data) {
      const serverStreak = (result.data as { streak: number }).streak
      const localStreak = useGameStore.getState().streak
      if (serverStreak > localStreak) {
        useGameStore.setState({ streak: serverStreak })
      }
    }
  }

  return { streak }
}
