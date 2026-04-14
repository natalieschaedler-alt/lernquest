import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../stores/gameStore'
import { useLeague } from '../hooks/useLeague'
import { getWorldById } from '../data/worlds'
import { soundManager } from '../utils/soundManager'

const XP_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2000, 2700, 3500, 4500, 6000]

function getLevelProgress(xp: number, level: number): { current: number; needed: number; percent: number } {
  const currentLevelXP = XP_THRESHOLDS[Math.min(level - 1, XP_THRESHOLDS.length - 1)] ?? 0
  const nextLevelXP = XP_THRESHOLDS[Math.min(level, XP_THRESHOLDS.length - 1)] ?? 6000
  const current = xp - currentLevelXP
  const needed = nextLevelXP - currentLevelXP
  const percent = needed > 0 ? Math.min(100, Math.round((current / needed) * 100)) : 100
  return { current, needed, percent }
}

const ACHIEVEMENTS = [
  { id: 'first_win', icon: '⚔️', label: 'Erster Sieg', desc: 'Ersten Boss besiegt', unlocked: (level: number) => level >= 1 },
  { id: 'level5', icon: '⭐', label: 'Aufsteiger', desc: 'Level 5 erreicht', unlocked: (level: number) => level >= 5 },
  { id: 'level10', icon: '👑', label: 'Legende', desc: 'Level 10 erreicht', unlocked: (level: number) => level >= 10 },
  { id: 'streak3', icon: '🔥', label: '3-Tage-Streak', desc: '3 Tage am Stück gelernt', unlocked: (_: number, streak: number) => streak >= 3 },
  { id: 'streak7', icon: '💫', label: 'Wochenkämpfer', desc: '7 Tage am Stück gelernt', unlocked: (_: number, streak: number) => streak >= 7 },
  { id: 'streak30', icon: '🌟', label: 'Monatsmeister', desc: '30 Tage am Stück gelernt', unlocked: (_: number, streak: number) => streak >= 30 },
]

export default function ProfilePage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const playerName = useGameStore((s) => s.playerName)
  const selectedWorldId = useGameStore((s) => s.selectedWorldId)
  const level = useGameStore((s) => s.level)
  const xp = useGameStore((s) => s.xp)
  const streak = useGameStore((s) => s.streak)

  const { userTier, userWeeklyXP } = useLeague()

  const worldTheme = getWorldById(selectedWorldId)
  const { current, needed, percent } = getLevelProgress(xp, level)

  return (
    <div className="min-h-screen bg-dark text-white flex flex-col px-5 pt-safe pb-8" style={{ maxWidth: '480px', margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-center justify-between pt-6 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="bg-dark-card border border-dark-border rounded-xl px-4 py-2 text-white text-sm font-body cursor-pointer"
        >
          ← {t('profile.back')}
        </button>
        <h1 className="font-display text-lg text-white">{t('profile.title')}</h1>
        <div style={{ width: '80px' }} />
      </div>

      {/* Character Card */}
      <motion.div
        className="bg-dark-card rounded-2xl p-6 border border-dark-border flex flex-col items-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          className="text-7xl mb-3"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ filter: `drop-shadow(0 0 20px ${worldTheme.primaryColor})` }}
        >
          {worldTheme.emoji}
        </motion.div>

        <h2 className="font-display text-2xl text-white">
          {playerName || t('profile.adventurer')}
        </h2>

        <div className="flex items-center gap-2 mt-1">
          <span
            className="font-body text-xs px-3 py-1 rounded-full font-semibold"
            style={{ background: worldTheme.primaryColor + '30', color: worldTheme.primaryColor }}
          >
            {worldTheme.name}
          </span>
          <span className="font-body text-xs text-gray-400">
            {t('profile.level', { level })}
          </span>
        </div>

        {/* XP Bar */}
        <div className="w-full mt-5">
          <div className="flex justify-between text-xs text-gray-400 font-body mb-1">
            <span>{xp} XP</span>
            <span>{level < 10 ? `${t('profile.next_level')}: ${current}/${needed} XP` : t('profile.max_level')}</span>
          </div>
          <div className="w-full rounded-full h-3" style={{ background: '#1A1A2E' }}>
            <motion.div
              className="h-3 rounded-full"
              style={{ background: `linear-gradient(90deg, ${worldTheme.primaryColor}, ${worldTheme.primaryColor}cc)` }}
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
            />
          </div>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        className="grid grid-cols-3 gap-3 mt-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {[
          { icon: '🏆', label: t('profile.level_label'), value: String(level) },
          { icon: '⚡', label: 'XP', value: String(xp) },
          { icon: '🔥', label: t('profile.streak_label'), value: `${streak}d` },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-dark-card rounded-2xl p-4 border border-dark-border flex flex-col items-center"
          >
            <span className="text-2xl">{stat.icon}</span>
            <span className="font-display text-xl text-white mt-1">{stat.value}</span>
            <span className="font-body text-xs text-gray-400 mt-0.5">{stat.label}</span>
          </div>
        ))}
      </motion.div>

      {/* Achievements */}
      <motion.div
        className="mt-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h3 className="font-display text-base text-white mb-3">{t('profile.achievements')}</h3>
        <div className="flex flex-col gap-2">
          {ACHIEVEMENTS.map((ach) => {
            const isUnlocked = ach.unlocked(level, streak)
            return (
              <div
                key={ach.id}
                className="bg-dark-card rounded-xl px-4 py-3 border border-dark-border flex items-center gap-3"
                style={{ opacity: isUnlocked ? 1 : 0.4 }}
              >
                <span className="text-2xl">{ach.icon}</span>
                <div className="flex-1">
                  <p className="font-body font-semibold text-white text-sm">{ach.label}</p>
                  <p className="font-body text-xs text-gray-400">{ach.desc}</p>
                </div>
                {isUnlocked && (
                  <span className="text-xs font-body px-2 py-0.5 rounded-full" style={{ background: '#00C89620', color: '#00C896' }}>
                    ✓
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Sound Toggle */}
      <motion.div
        className="mt-5 bg-dark-card rounded-2xl border border-dark-border px-5 py-4 flex items-center justify-between"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div>
          <p className="font-body font-semibold text-white text-sm">{t('profile.sound')}</p>
          <p className="font-body text-xs text-gray-400 mt-0.5">{t('profile.sound_desc')}</p>
        </div>
        <SoundToggleSwitch />
      </motion.div>

      {/* Liga Card */}
      <motion.div
        className="mt-5 bg-dark-card rounded-2xl p-4 flex items-center gap-3"
        style={{ border: `2px solid ${userTier.color}` }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
      >
        <span className="text-4xl" style={{ filter: `drop-shadow(0 0 12px ${userTier.color})` }}>
          {userTier.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg" style={{ color: userTier.color }}>
            {userTier.label}
          </p>
          <p className="font-body text-xs text-gray-400">
            <span className="font-bold text-white tabular-nums">{userWeeklyXP}</span> XP diese Woche
          </p>
        </div>
        <motion.button
          onClick={() => navigate('/league')}
          className="font-body font-semibold text-white rounded-xl px-4 py-2 cursor-pointer border-none text-sm"
          style={{ background: userTier.color + '33', color: userTier.color }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Zur Liga →
        </motion.button>
      </motion.div>

      {/* New Adventure Button */}
      <motion.button
        onClick={() => navigate('/onboarding')}
        className="mt-5 w-full font-body font-bold text-white rounded-2xl py-4 cursor-pointer border-none"
        style={{ background: 'linear-gradient(135deg, #6C3CE1, #9B5DE5)', fontSize: '16px' }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        ✨ {t('profile.new_adventure')}
      </motion.button>
    </div>
  )
}

function SoundToggleSwitch() {
  const [isEnabled, setIsEnabled] = React.useState(soundManager.isEnabled())

  const toggle = () => {
    const newState = soundManager.toggle()
    setIsEnabled(newState)
  }

  return (
    <button
      onClick={toggle}
      className="relative cursor-pointer border-none bg-transparent p-0"
      aria-label="Toggle sound"
    >
      <div
        className="w-12 h-6 rounded-full transition-all duration-300"
        style={{ background: isEnabled ? '#00C896' : '#1A1A2E' }}
      >
        <motion.div
          className="w-5 h-5 rounded-full bg-white absolute top-0.5"
          animate={{ left: isEnabled ? '26px' : '2px' }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        />
      </div>
    </button>
  )
}

// Import React for the SoundToggleSwitch component
import React from 'react'
