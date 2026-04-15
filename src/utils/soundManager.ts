/**
 * Web Audio API–based sound manager for LearnQuest.
 *
 * All sounds are synthesised on the fly — no audio files are required.
 * A single AudioContext is created lazily on first use to comply with
 * browser autoplay policies (context must be created inside a user gesture).
 *
 * Usage:
 *   import { soundManager } from './soundManager'
 *   soundManager.playCorrect()
 */
class SoundManager {
  private audioContext: AudioContext | null = null
  private enabled: boolean = true

  constructor() {
    const saved = localStorage.getItem('learnquest-sound')
    if (saved !== null) {
      this.enabled = saved === 'true'
    }
  }

  /** Returns (and lazily creates) the shared AudioContext. */
  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    return this.audioContext
  }

  /**
   * Plays a single synthesised tone.
   * @param freq      Frequency in Hz
   * @param duration  Duration in seconds
   * @param type      Oscillator waveform type
   * @param volume    Peak gain (0–1)
   */
  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
    if (!this.enabled) return
    try {
      const ctx = this.getContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(volume, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {
      // Ignore audio errors (e.g. autoplay policy, missing API on older browsers)
    }
  }

  /**
   * Plays a short ascending two-note ding for a correct answer.
   * Used in Wortwirbel, OrakelKristall, and LueckentextSpiel.
   */
  playCorrect() {
    this.playTone(880, 0.1)
    setTimeout(() => this.playTone(1100, 0.15), 100)
  }

  /**
   * Plays a descending sawtooth buzz for a wrong answer.
   * Used in all game components.
   */
  playWrong() {
    this.playTone(440, 0.1, 'sawtooth', 0.2)
    setTimeout(() => this.playTone(330, 0.2, 'sawtooth', 0.2), 100)
  }

  /**
   * Plays a four-note ascending scale to celebrate levelling up.
   * Triggered on VictoryPage when the player gains a new level.
   */
  playLevelUp() {
    ;[523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.playTone(f, 0.2), i * 100),
    )
  }

  /**
   * Plays a five-note victory fanfare at the end of a successful session.
   * Triggered on VictoryPage mount.
   */
  playVictory() {
    ;[523, 659, 784, 1047, 1319].forEach((f, i) =>
      setTimeout(() => this.playTone(f, 0.3), i * 150),
    )
  }

  /**
   * Plays a tense two-beat accent when a boss battle begins.
   * Uses a triangle wave for a dramatic, slightly ominous tone.
   */
  playBossBattle() {
    this.playTone(220, 0.3, 'triangle', 0.4)
    setTimeout(() => this.playTone(196, 0.5, 'triangle', 0.35), 350)
    setTimeout(() => this.playTone(185, 0.8, 'sawtooth', 0.2), 750)
  }

  /**
   * Plays a bright four-note fanfare for unlocking an achievement.
   * Uses a mix of sine and triangle waves for a "reward" feel.
   */
  playAchievement() {
    ;[659, 784, 1047, 1319].forEach((f, i) =>
      setTimeout(() => this.playTone(f, 0.25, 'triangle', 0.35), i * 120),
    )
  }

  /**
   * Plays a triple ascending ping to celebrate a login-streak milestone.
   * Slightly slower than playCorrect for emphasis.
   */
  playStreak() {
    ;[523, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.playTone(f, 0.2, 'sine', 0.3), i * 160),
    )
  }

  /**
   * Plays a quick energetic blip for reaching a high combo.
   * Faster and higher-pitched than playCorrect.
   */
  playCombo() {
    ;[880, 1100, 1320].forEach((f, i) =>
      setTimeout(() => this.playTone(f, 0.08, 'square', 0.15), i * 60),
    )
  }

  /**
   * Toggles sound on/off, persists the preference to localStorage.
   * @returns The new enabled state.
   */
  toggle(): boolean {
    this.enabled = !this.enabled
    localStorage.setItem('learnquest-sound', String(this.enabled))
    return this.enabled
  }

  /** Returns whether sound is currently enabled. */
  isEnabled(): boolean {
    return this.enabled
  }
}

export const soundManager = new SoundManager()
