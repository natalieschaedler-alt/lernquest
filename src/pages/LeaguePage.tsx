import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLeague, LEAGUES, getTierFromXP } from '../hooks/useLeague'

function getNextMondayReset(): string {
  const now = new Date()
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7
  const next = new Date(now)
  next.setDate(now.getDate() + daysUntilMonday)
  next.setHours(0, 0, 0, 0)
  const days = Math.ceil((next.getTime() - now.getTime()) / 86400000)
  return days === 1 ? 'morgen' : `in ${days} Tagen`
}

function getInitials(name: string | null): string {
  if (!name) return 'A'
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'A'
}

function rankBadgeColor(rank: number): string {
  if (rank === 1) return '#FFD700'
  if (rank === 2) return '#C0C0C0'
  if (rank === 3) return '#CD7F32'
  return '#2A2A3E'
}

export default function LeaguePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { leaderboard, userWeeklyXP, userRank, userTier, loading } = useLeague()

  const nextTierIndex = LEAGUES.findIndex((l) => l.tier === userTier.tier) + 1
  const nextTier = nextTierIndex < LEAGUES.length ? LEAGUES[nextTierIndex] : null
  const xpToNext = nextTier ? nextTier.minXP - userWeeklyXP : 0
  const tierSpan = nextTier ? nextTier.minXP - userTier.minXP : 1
  const tierProgress = nextTier
    ? Math.max(0, Math.min(100, ((userWeeklyXP - userTier.minXP) / tierSpan) * 100))
    : 100

  return (
    <div className="min-h-screen bg-dark text-white flex flex-col px-5 pt-safe pb-8" style={{ maxWidth: '480px', margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-center justify-between pt-6 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="bg-dark-card border border-dark-border rounded-xl px-4 py-2 text-white text-sm font-body cursor-pointer"
        >
          ← Zurück
        </button>
        <h1 className="font-display text-lg text-white">Liga</h1>
        <div style={{ width: '80px' }} />
      </div>

      <p className="text-center text-xs text-gray-400 font-body -mt-2 mb-4">
        Wöchentlicher Reset {getNextMondayReset()} (Montag 00:00)
      </p>

      {/* Dein Rang */}
      {user ? (
        <motion.div
          className="bg-dark-card rounded-2xl p-5 flex flex-col items-center"
          style={{ border: `2px solid ${userTier.color}` }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-4">
            <span className="text-6xl" style={{ filter: `drop-shadow(0 0 18px ${userTier.color})` }}>
              {userTier.emoji}
            </span>
            <div className="flex flex-col">
              <span className="font-display text-2xl" style={{ color: userTier.color }}>
                {userTier.label}
              </span>
              <span className="font-body text-sm text-gray-300">
                {userRank > 0 ? `Platz #${userRank}` : 'Unplatziert'}
              </span>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="font-body font-semibold text-white">
              {user.user_metadata?.name ?? user.email ?? 'Abenteurer'}
            </p>
            <p className="font-body text-sm text-gray-300 mt-1">
              <span className="font-bold text-white tabular-nums">{userWeeklyXP}</span> XP diese Woche
            </p>
          </div>

          {nextTier && (
            <div className="w-full mt-4">
              <div className="flex justify-between text-xs text-gray-400 font-body mb-1">
                <span>Noch {xpToNext} XP bis {nextTier.label}</span>
                <span>{nextTier.emoji}</span>
              </div>
              <div className="w-full rounded-full h-2" style={{ background: '#1A1A2E' }}>
                <motion.div
                  className="h-2 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${userTier.color}, ${nextTier.color})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${tierProgress}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                />
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          className="bg-dark-card rounded-2xl p-6 border border-dark-border flex flex-col items-center text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span className="text-5xl mb-2">🏅</span>
          <p className="font-body text-white">Melde dich an um in der Liga zu spielen!</p>
          <motion.button
            onClick={() => navigate('/auth')}
            className="mt-4 font-body font-bold text-white rounded-xl px-5 py-3 cursor-pointer border-none"
            style={{ background: 'linear-gradient(135deg, #6C3CE1, #9B5DE5)', fontSize: '15px' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Jetzt anmelden
          </motion.button>
        </motion.div>
      )}

      {/* Leaderboard */}
      <motion.div
        className="mt-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h3 className="font-display text-base text-white mb-3">Rangliste</h3>

        {loading ? (
          <p className="font-body text-sm text-gray-400 text-center py-6">Lade…</p>
        ) : leaderboard.length === 0 ? (
          <p className="font-body text-sm text-gray-400 text-center py-6">
            Noch keine Einträge diese Woche.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {leaderboard.map((entry, i) => {
              const rank = i + 1
              const tier = getTierFromXP(entry.weekly_xp)
              const isMe = user?.id === entry.id
              const badgeBg = rankBadgeColor(rank)
              const displayName = entry.name ?? 'Abenteurer'

              return (
                <div
                  key={entry.id}
                  className="bg-dark-card rounded-xl px-3 py-2.5 flex items-center gap-3"
                  style={{
                    border: isMe ? `2px solid ${userTier.color}` : '1px solid #2A2A3E',
                    fontWeight: isMe ? 700 : 400,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-display text-sm"
                    style={{
                      background: badgeBg,
                      color: rank <= 3 ? '#0D0A1A' : '#FFFFFF',
                    }}
                  >
                    {rank}
                  </div>

                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-body text-sm font-bold"
                    style={{ background: tier.color + '33', color: tier.color }}
                  >
                    {getInitials(entry.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-body text-white text-sm truncate">
                      {displayName}{isMe && ' (Du)'}
                    </p>
                    <p className="font-body text-xs text-gray-400 tabular-nums">
                      {entry.weekly_xp} XP
                    </p>
                  </div>

                  <span className="text-xl" title={tier.label}>{tier.emoji}</span>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* Dungeon-Button */}
      <motion.button
        onClick={() => navigate('/onboarding')}
        className="mt-6 w-full font-body font-bold text-white rounded-2xl py-4 cursor-pointer border-none"
        style={{ background: 'linear-gradient(135deg, #6C3CE1, #9B5DE5)', fontSize: '16px' }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        ⚔️ Dungeon spielen
      </motion.button>
    </div>
  )
}
