import { useMemo } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useLeague, LEAGUES, getTierFromXP } from '../hooks/useLeague'
import Footer from '../components/ui/Footer'

function getNextMondayReset(t: (key: string, opts?: Record<string, unknown>) => string): string {
  const now = new Date()
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7
  const next = new Date(now)
  next.setDate(now.getDate() + daysUntilMonday)
  next.setHours(0, 0, 0, 0)
  const days = Math.ceil((next.getTime() - now.getTime()) / 86400000)
  return days === 1 ? t('league.tomorrow') : t('league.in_days', { days })
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
  const { t } = useTranslation()
  const { user } = useAuth()
  const { leaderboard, userWeeklyXP, userRank, userTier, loading } = useLeague()

  const { nextTier, xpToNext, tierProgress } = useMemo(() => {
    const nextTierIndex = LEAGUES.findIndex((l) => l.tier === userTier.tier) + 1
    const next = nextTierIndex < LEAGUES.length ? LEAGUES[nextTierIndex] : null
    const toNext = next ? next.minXP - userWeeklyXP : 0
    const span = next ? next.minXP - userTier.minXP : 1
    const progress = next
      ? Math.max(0, Math.min(100, ((userWeeklyXP - userTier.minXP) / span) * 100))
      : 100
    return { nextTier: next, xpToNext: toNext, tierProgress: progress }
  }, [userTier, userWeeklyXP])

  return (
    <main className="min-h-screen bg-dark text-white flex flex-col px-5 pt-safe pb-8" style={{ maxWidth: '480px', margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-center justify-between pt-6 pb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t('league.back')}
          className="bg-dark-card border border-dark-border rounded-xl px-4 py-3 min-h-[44px] text-white text-sm font-body cursor-pointer"
        >
          {t('league.back')}
        </button>
        <h1 className="font-display text-lg text-white">{t('league.title')}</h1>
        <div style={{ width: '80px' }} />
      </div>

      <p className="text-center text-xs text-gray-400 font-body -mt-2 mb-4">
        {t('league.weekly_reset', { when: getNextMondayReset(t) })}
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
            <span
              className="text-6xl"
              style={{ filter: `drop-shadow(0 0 18px ${userTier.color})` }}
              aria-label={userTier.label}
              role="img"
            >
              {userTier.emoji}
            </span>
            <div className="flex flex-col">
              <span className="font-display text-2xl" style={{ color: userTier.color }}>
                {userTier.label}
              </span>
              <span className="font-body text-sm text-gray-300">
                {userRank > 0 ? t('league.rank', { rank: userRank }) : t('league.unranked')}
              </span>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="font-body font-semibold text-white">
              {user.user_metadata?.name ?? user.email ?? t('profile.adventurer')}
            </p>
            <p className="font-body text-sm text-gray-300 mt-1">
              {t('league.xp_this_week', { xp: userWeeklyXP })}
            </p>
          </div>

          {nextTier && (
            <div className="w-full mt-4">
              <div className="flex justify-between text-xs text-gray-400 font-body mb-1">
                <span>{t('league.xp_to_next', { xp: xpToNext, tier: nextTier.label })}</span>
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
          <p className="font-body text-white">{t('league.sign_in_prompt')}</p>
          <motion.button
            type="button"
            onClick={() => navigate('/auth')}
            className="mt-4 font-body font-bold text-white rounded-xl px-5 py-3 cursor-pointer border-none"
            style={{ background: 'linear-gradient(135deg, #6C3CE1, #9B5DE5)', fontSize: '15px' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {t('league.sign_in_button')}
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
        <h3 className="font-display text-base text-white mb-3">{t('league.leaderboard')}</h3>

        {loading ? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label={t('league.loading')}>
            <span className="sr-only">{t('league.loading')}</span>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-dark-card rounded-xl px-3 py-2.5 flex items-center gap-3 border border-dark-border"
                style={{ opacity: 1 - i * 0.15 }}
              >
                <div className="w-8 h-8 rounded-full bg-dark-border animate-pulse" />
                <div className="w-9 h-9 rounded-full bg-dark-border animate-pulse" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="h-3 rounded-full bg-dark-border animate-pulse w-1/2" />
                  <div className="h-2.5 rounded-full bg-dark-border animate-pulse w-1/4" />
                </div>
                <div className="w-7 h-7 rounded-full bg-dark-border animate-pulse" />
              </div>
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <span className="text-4xl">🏅</span>
            <p className="font-body text-sm text-gray-400 text-center">
              {t('league.empty')}
            </p>
            <p className="font-body text-sm text-white text-center font-semibold">
              {t('league_extra.empty_cta')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {leaderboard.map((entry, i) => {
              const rank = i + 1
              const tier = getTierFromXP(entry.weekly_xp)
              const isMe = user?.id === entry.id
              const badgeBg = rankBadgeColor(rank)
              const displayName = entry.name ?? t('profile.adventurer')

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
                    className="w-8 h-8 rounded-full flex items-center justify-center font-display text-sm flex-shrink-0"
                    style={{
                      background: badgeBg,
                      color: rank <= 3 ? '#0D0A1A' : '#FFFFFF',
                    }}
                  >
                    {rank}
                  </div>

                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-body text-sm font-bold flex-shrink-0"
                    style={{ background: tier.color + '33', color: tier.color }}
                  >
                    {getInitials(entry.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-body text-white text-sm truncate">
                      {displayName}{isMe && ` ${t('league.you')}`}
                    </p>
                    <p className="font-body text-xs text-gray-400 tabular-nums">
                      {entry.weekly_xp} XP
                    </p>
                  </div>

                  <span className="text-xl flex-shrink-0" aria-label={tier.label} role="img">{tier.emoji}</span>
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
        {t('league.play_dungeon')}
      </motion.button>

      <Footer />
    </main>
  )
}
