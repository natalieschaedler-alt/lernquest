import type { WorldTheme } from '../types'

export const WORLDS: WorldTheme[] = [
  {
    id: 'fire', name: 'Feuer-Vulkan', emoji: '🔥',
    unlockedAtSessions: 0,
    bgFrom: '#1a0500', bgTo: '#2d0a00',
    primaryColor: '#FF6B35', secondaryColor: '#F97316',
    particleEmoji: '🔥',
    bossName: 'Lava-Drache Ignar', bossEmoji: '🐉',
    specialAttacks: [],
    unlockMessage: 'Deine erste Welt!',
    loot: {
      common:    'Kohlestein (+50 XP)',
      rare:      'Feuer-Kristall (+150 XP)',
      epic:      'Vulkan-Kern (+300 XP)',
      legendary: 'Boss-Fang des Drachen (+500 XP)',
    },
  },
  {
    id: 'water', name: 'Tiefsee-Abyss', emoji: '🌊',
    unlockedAtSessions: 5,
    bgFrom: '#000d1a', bgTo: '#001a2d',
    primaryColor: '#06B6D4', secondaryColor: '#0891B2',
    particleEmoji: '💧',
    bossName: 'Tiefsee-Kraken Azul', bossEmoji: '🐙',
    specialAttacks: ['fog'],
    unlockMessage: '5 Sessions gespielt!',
    loot: {
      common:    'Muschel (+50 XP)',
      rare:      'Tiefsee-Perle (+150 XP)',
      epic:      'Kraken-Tinte (+300 XP)',
      legendary: 'Auge des Kraken (+500 XP)',
    },
  },
  {
    id: 'cyber', name: 'Cyber-Matrix', emoji: '⚡',
    unlockedAtSessions: 15,
    bgFrom: '#001a00', bgTo: '#002d00',
    primaryColor: '#10B981', secondaryColor: '#059669',
    particleEmoji: '⚡',
    bossName: 'Virus-Daemon X-0', bossEmoji: '🤖',
    specialAttacks: ['time'],
    unlockMessage: '15 Sessions gespielt!',
    loot: {
      common:    'Datenshard (+50 XP)',
      rare:      'Neon-Chip (+150 XP)',
      epic:      'Virus-Core (+300 XP)',
      legendary: 'Daemon-Kern (+500 XP)',
    },
  },
  {
    id: 'forest', name: 'Zauberwald', emoji: '🌿',
    unlockedAtSessions: 30,
    bgFrom: '#001a08', bgTo: '#002d10',
    primaryColor: '#A78BFA', secondaryColor: '#7C3AED',
    particleEmoji: '✨',
    bossName: 'Baum-Wächter Sylvus', bossEmoji: '🌳',
    specialAttacks: ['shuffle'],
    unlockMessage: '30 Sessions gespielt!',
    loot: {
      common:    'Verzaubertes Blatt (+50 XP)',
      rare:      'Waldgeist-Essenz (+150 XP)',
      epic:      'Moos-Kristall (+300 XP)',
      legendary: 'Herz des Waldes (+500 XP)',
    },
  },
  {
    id: 'cosmos', name: 'Kosmos-Dimension', emoji: '🌌',
    unlockedAtSessions: 100,
    bgFrom: '#05001a', bgTo: '#0d002d',
    primaryColor: '#F59E0B', secondaryColor: '#D97706',
    particleEmoji: '⭐',
    bossName: 'Kosmos-Titan Aether', bossEmoji: '🌠',
    specialAttacks: ['fog', 'time', 'shuffle'],
    unlockMessage: '100 Sessions! Endgame erreicht!',
    loot: {
      common:    'Sternensplitter (+50 XP)',
      rare:      'Galaxie-Staub (+150 XP)',
      epic:      'Kosmos-Kristall (+300 XP)',
      legendary: 'Herz des Kosmos (+1000 XP)',
    },
  },
]

export function getWorldById(id: string | null): WorldTheme {
  return WORLDS.find(w => w.id === id) ?? WORLDS[0]
}

export function getAvailableWorlds(totalSessions: number): WorldTheme[] {
  return WORLDS.filter(w => w.unlockedAtSessions <= totalSessions)
}

export function getLockedWorlds(totalSessions: number): WorldTheme[] {
  return WORLDS.filter(w => w.unlockedAtSessions > totalSessions)
}
