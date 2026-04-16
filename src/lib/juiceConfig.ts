/**
 * juiceConfig.ts – Zentrale Juice-Defaults pro Game-Event
 *
 * Jeder Eintrag beschreibt, welche Feel-Effekte + Sounds bei einem bestimmten
 * Spielereignis ausgelöst werden. FeelProvider liest diese Tabelle und ruft
 * die entsprechenden Methoden auf.
 *
 * Kein React, kein State – reine Konfigurationsdatei.
 */
import type { ShakeIntensity, ParticleType, HapticPattern } from './feel'
import type { SfxId } from './sfx'

// ── Typen ─────────────────────────────────────────────────────

export interface ParticleSpec {
  type:  ParticleType
  count: number
}

export interface FlashSpec {
  color:    string
  duration: number   // ms
}

export interface FloatTextSpec {
  text:  string
  color: string
  size?: number      // rem, default 1.1
}

export interface ChromaticSpec {
  intensity: number  // 0–1
  duration:  number  // ms
}

export interface SlowmoSpec {
  factor:   number   // e.g. 0.3
  duration: number   // ms
}

export interface JuiceSpec {
  sfx?:        SfxId
  haptic?:     HapticPattern
  shake?:      ShakeIntensity
  flash?:      FlashSpec
  freeze?:     number          // ms
  particles?:  ParticleSpec[]
  floatText?:  FloatTextSpec
  chromatic?:  ChromaticSpec
  slowmo?:     SlowmoSpec
  /** true = zoom auf das target-DOMRect das mit dem Event mitgeliefert wird */
  zoom?:       boolean
}

// ── Juice-Definitionen ────────────────────────────────────────

export const JUICE: Record<string, JuiceSpec> = {

  /** Korrekte Antwort – Standard */
  correctAnswer: {
    haptic:    'tick',
    sfx:       'correct_soft',
    particles: [{ type: 'sparkle', count: 8 }],
    floatText: { text: '+10 XP', color: '#F59E0B', size: 1.05 },
  },

  /** Korrekte Antwort unter Zeitlimit (Fast-Bonus) */
  correctFast: {
    haptic:    'tick',
    sfx:       'correct_crisp',
    particles: [{ type: 'sparkle', count: 14 }],
    floatText: { text: '⚡ +15 XP', color: '#00C896', size: 1.1 },
  },

  /** Falsche Antwort */
  wrongAnswer: {
    haptic:    'fail',
    sfx:       'wrong_thud',
    shake:     'soft',
    particles: [{ type: 'smoke', count: 5 }],
  },

  /** Kritischer Treffer (15 % Chance) */
  critHit: {
    haptic:    'success',
    sfx:       'crit_sharp',
    shake:     'medium',
    particles: [{ type: 'sparkle', count: 20 }],
    floatText: { text: 'CRIT! ×2', color: '#FF9500', size: 1.3 },
    chromatic: { intensity: 0.35, duration: 200 },
  },

  /** Goldene Frage (5 % Chance, ×5 XP) */
  goldenQuestion: {
    freeze:    700,
    flash:     { color: 'rgba(255, 215, 0, 0.55)', duration: 450 },
    sfx:       'golden_chime',
    particles: [{ type: 'golden', count: 30 }],
    floatText: { text: '✨ GOLDEN! ×5', color: '#FFD700', size: 1.5 },
  },

  /** Boss trifft (falsche Boss-Antwort) */
  bossHit: {
    sfx:       'boss_roar',
    shake:     'hard',
    zoom:      true,
    particles: [{ type: 'crash', count: 12 }],
    chromatic: { intensity: 0.4, duration: 250 },
  },

  /** Boss besiegt */
  bossDefeat: {
    sfx:       'boss_roar',
    haptic:    'success',
    slowmo:    { factor: 0.25, duration: 1800 },
    flash:     { color: 'rgba(255, 255, 255, 0.75)', duration: 500 },
    particles: [{ type: 'crash', count: 40 }, { type: 'golden', count: 20 }],
    floatText: { text: '🏆 SIEG!', color: '#FFD700', size: 1.8 },
  },

  /** Streak erhöht */
  streakIncrease: {
    haptic:    'success',
    sfx:       'streak_fire',
    particles: [{ type: 'sparkle', count: 12 }],
    floatText: { text: '🔥 STREAK!', color: '#FF6B35', size: 1.2 },
  },

  /** Lava-Welt: korrekte Antwort */
  lavaCorrect: {
    sfx:       'lava_bubble',
    particles: [{ type: 'lava', count: 8 }],
    floatText: { text: '+10 XP', color: '#FF6B35', size: 1.05 },
  },

  /** Eis-Welt: korrekte Antwort */
  iceCorrect: {
    sfx:       'ice_crack',
    particles: [{ type: 'ice', count: 8 }],
    floatText: { text: '+10 XP', color: '#93C5FD', size: 1.05 },
  },

  /** Rune erhalten */
  runeObtained: {
    sfx:       'rune_glow',
    haptic:    'success',
    particles: [{ type: 'golden', count: 10 }],
    floatText: { text: '💎 Rune!', color: '#A78BFA', size: 1.2 },
  },

  /** Raum abgeschlossen */
  roomComplete: {
    sfx:       'bridge_land',
    particles: [{ type: 'sparkle', count: 6 }],
  },

  /** Kombo ×3+ */
  comboFire: {
    haptic:    'tick',
    sfx:       'streak_fire',
    shake:     'soft',
    particles: [{ type: 'sparkle', count: 16 }],
    floatText: { text: '🔥 KOMBO!', color: '#FF9500', size: 1.2 },
  },
}

/** Typ-sichere Hilfsfunktion für Mini-Games: gibt den Spec oder leeres Objekt zurück */
export function getJuice(event: string): JuiceSpec {
  return JUICE[event] ?? {}
}
