import { useState, useEffect } from 'react'
import { getWeeklyLeaderboard } from '../lib/database'
import { useAuth } from './useAuth'

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export interface LeagueInfo {
  tier:  LeagueTier
  label: string
  color: string
  emoji: string
  minXP: number
  maxXP: number
}

export const LEAGUES: LeagueInfo[] = [
  { tier: 'bronze',   label: 'Bronze',  color: '#CD7F32', emoji: '🥉', minXP: 0,    maxXP: 99    },
  { tier: 'silver',   label: 'Silber',  color: '#C0C0C0', emoji: '🥈', minXP: 100,  maxXP: 299   },
  { tier: 'gold',     label: 'Gold',    color: '#FFD700', emoji: '🥇', minXP: 300,  maxXP: 599   },
  { tier: 'platinum', label: 'Platin',  color: '#A78BFA', emoji: '💎', minXP: 600,  maxXP: 999   },
  { tier: 'diamond',  label: 'Diamant', color: '#06B6D4', emoji: '🔷', minXP: 1000, maxXP: 99999 },
]

export function getTierFromXP(weeklyXP: number): LeagueInfo {
  return [...LEAGUES].reverse().find(l => weeklyXP >= l.minXP) ?? LEAGUES[0]
}

export function useLeague() {
  const { user } = useAuth()
  const [leaderboard, setLeaderboard] = useState<Array<{
    id: string; name: string | null; weekly_xp: number; selected_world_id: string | null
  }>>([])
  const [userWeeklyXP, setUserWeeklyXP] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { void load() }, [user])

  const load = async () => {
    setLoading(true)
    const data = await getWeeklyLeaderboard(50)
    setLeaderboard(data)
    if (user) {
      const me = data.find(d => d.id === user.id)
      setUserWeeklyXP(me?.weekly_xp ?? 0)
    }
    setLoading(false)
  }

  const userRank = user ? leaderboard.findIndex(d => d.id === user.id) + 1 : 0
  const userTier = getTierFromXP(userWeeklyXP)

  return { leaderboard, userWeeklyXP, userRank, userTier, loading, reload: load }
}
