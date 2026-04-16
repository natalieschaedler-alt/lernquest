/**
 * sfx.ts – Web-Audio-Synthesizer für LearnQuest
 *
 * Alle Sounds werden zur Laufzeit synthetisiert (kein <audio>-Tag, kein externes Asset).
 * → Null Latenz, kein Hosting, konsistenter Sound auf allen Plattformen.
 *
 * Verwendung:
 *   import { sfx } from './sfx'
 *   sfx.play('correct_soft')
 *   sfx.setEnabled(false)
 */

// ── Typen ─────────────────────────────────────────────────────

export type SfxId =
  | 'correct_soft'
  | 'correct_crisp'
  | 'wrong_thud'
  | 'crit_sharp'
  | 'golden_chime'
  | 'streak_fire'
  | 'boss_roar'
  | 'chain_break'
  | 'rune_glow'
  | 'lava_bubble'
  | 'ice_crack'
  | 'bridge_land'

type SynthFn = (ctx: AudioContext, vol: number, pitch: number) => void

// ── Synth-Funktionen ──────────────────────────────────────────

/** Sanfter, zweistufiger Aufwärts-Chirp – für Standard-Richtig */
function synthCorrectSoft(ctx: AudioContext, vol: number, pitch = 1): void {
  const now = ctx.currentTime
  for (let i = 0; i < 2; i++) {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    const t  = now + i * 0.075
    const f0 = (660 + i * 220) * pitch
    osc.frequency.setValueAtTime(f0, t)
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + 0.11)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(vol * 0.12, t + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    osc.start(t)
    osc.stop(t + 0.2)
  }
}

/** Knackiger, hellerer Chirp – für Schnell-Antwort-Bonus */
function synthCorrectCrisp(ctx: AudioContext, vol: number, pitch = 1): void {
  const now  = ctx.currentTime
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(1320 * pitch, now)
  osc.frequency.exponentialRampToValueAtTime(2640 * pitch, now + 0.07)
  gain.gain.setValueAtTime(vol * 0.18, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10)
  osc.start(now)
  osc.stop(now + 0.12)
}

/** Tiefer Aufprall – für falsche Antwort */
function synthWrongThud(ctx: AudioContext, vol: number, pitch = 1): void {
  const now  = ctx.currentTime
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(140 * pitch, now)
  osc.frequency.exponentialRampToValueAtTime(35 * pitch, now + 0.22)
  gain.gain.setValueAtTime(vol * 0.28, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
  osc.start(now)
  osc.stop(now + 0.3)
}

/** Doppel-Blip mit hoher Energie – Kritischer Treffer */
function synthCritSharp(ctx: AudioContext, vol: number, pitch = 1): void {
  const now = ctx.currentTime
  for (let i = 0; i < 2; i++) {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'square'
    const t = now + i * 0.055
    osc.frequency.setValueAtTime((880 + i * 440) * pitch, t)
    gain.gain.setValueAtTime(vol * 0.14, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
    osc.start(t)
    osc.stop(t + 0.08)
  }
}

/** Majestätisches C-E-G-Arpeggio – Goldene Frage */
function synthGoldenChime(ctx: AudioContext, vol: number, pitch = 1): void {
  const notes = [523.25, 659.25, 783.99, 1046.5] // C5-E5-G5-C6
  notes.forEach((freq, i) => {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    const t = ctx.currentTime + i * 0.11
    osc.frequency.value = freq * pitch
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(vol * 0.13, t + 0.02)
    gain.gain.setValueAtTime(vol * 0.13, t + 0.12)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
    osc.start(t)
    osc.stop(t + 0.5)
  })
}

/** Schnell aufsteigende Tonkaskade – Streak-Erhöhung */
function synthStreakFire(ctx: AudioContext, vol: number, pitch = 1): void {
  const now = ctx.currentTime
  for (let i = 0; i < 5; i++) {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    const t = now + i * 0.04
    osc.frequency.setValueAtTime(440 * Math.pow(1.333, i) * pitch, t)
    gain.gain.setValueAtTime(vol * 0.09, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
    osc.start(t)
    osc.stop(t + 0.08)
  }
}

/** Tiefes, verzerrtes Grollen – Boss */
function synthBossRoar(ctx: AudioContext, vol: number, pitch = 1): void {
  const now  = ctx.currentTime
  const osc  = ctx.createOscillator()
  const dist = ctx.createWaveShaper()
  const gain = ctx.createGain()

  const curve = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1
    curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x))
  }
  dist.curve = curve

  osc.connect(dist)
  dist.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(90 * pitch, now)
  osc.frequency.exponentialRampToValueAtTime(38 * pitch, now + 0.65)
  gain.gain.setValueAtTime(vol * 0.22, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75)
  osc.start(now)
  osc.stop(now + 0.8)
}

/** Scharfer Rausch-Knall – Kettenbruch, Failure */
function synthChainBreak(ctx: AudioContext, vol: number, pitch = 1): void {
  const now     = ctx.currentTime
  const samples = Math.ceil(ctx.sampleRate * 0.09)
  const buf     = ctx.createBuffer(1, samples, ctx.sampleRate)
  const data    = buf.getChannelData(0)
  for (let i = 0; i < samples; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples, 1.5)
  }
  const src    = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain   = ctx.createGain()
  src.buffer   = buf
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  filter.type            = 'bandpass'
  filter.frequency.value = 2800 * pitch
  filter.Q.value         = 0.4
  gain.gain.setValueAtTime(vol * 0.45, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13)
  src.start(now)
}

/** Weicher, mystischer Dreiklang – Runen */
function synthRuneGlow(ctx: AudioContext, vol: number, pitch = 1): void {
  const notes = [396, 528, 660]
  notes.forEach((freq, i) => {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    const t = ctx.currentTime + i * 0.09
    osc.frequency.value = freq * pitch
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(vol * 0.07, t + 0.06)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
    osc.start(t)
    osc.stop(t + 0.6)
  })
}

/** Perkussiver Lava-Blaupunkt */
function synthLavaBubble(ctx: AudioContext, vol: number, pitch = 1): void {
  const now  = ctx.currentTime
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(220 * pitch, now)
  osc.frequency.exponentialRampToValueAtTime(55 * pitch, now + 0.18)
  gain.gain.setValueAtTime(vol * 0.22, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
  osc.start(now)
  osc.stop(now + 0.24)
}

/** Hochfrequentes Zischen – Eis */
function synthIceCrack(ctx: AudioContext, vol: number, pitch = 1): void {
  const now     = ctx.currentTime
  const samples = Math.ceil(ctx.sampleRate * 0.06)
  const buf     = ctx.createBuffer(1, samples, ctx.sampleRate)
  const data    = buf.getChannelData(0)
  for (let i = 0; i < samples; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / samples)
  }
  const src    = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain   = ctx.createGain()
  src.buffer   = buf
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  filter.type            = 'highpass'
  filter.frequency.value = 5500 * pitch
  gain.gain.setValueAtTime(vol * 0.35, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
  src.start(now)
}

/** Solider Aufprall – Brücke/Plattform */
function synthBridgeLand(ctx: AudioContext, vol: number, pitch = 1): void {
  const now  = ctx.currentTime
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(110 * pitch, now)
  osc.frequency.exponentialRampToValueAtTime(45 * pitch, now + 0.17)
  gain.gain.setValueAtTime(vol * 0.38, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
  osc.start(now)
  osc.stop(now + 0.24)
}

// ── Synth-Map ─────────────────────────────────────────────────

const SYNTH_MAP: Record<SfxId, SynthFn> = {
  correct_soft:  synthCorrectSoft,
  correct_crisp: synthCorrectCrisp,
  wrong_thud:    synthWrongThud,
  crit_sharp:    synthCritSharp,
  golden_chime:  synthGoldenChime,
  streak_fire:   synthStreakFire,
  boss_roar:     synthBossRoar,
  chain_break:   synthChainBreak,
  rune_glow:     synthRuneGlow,
  lava_bubble:   synthLavaBubble,
  ice_crack:     synthIceCrack,
  bridge_land:   synthBridgeLand,
}

// ── SfxController ─────────────────────────────────────────────

class SfxController {
  private ctx: AudioContext | null = null
  private enabled = true
  private masterVol = 0.7
  private pitch = 1

  setEnabled(v: boolean): void  { this.enabled = v }
  setVolume(v: number): void    { this.masterVol = Math.max(0, Math.min(1, v)) }
  setPitch(v: number): void     { this.pitch = Math.max(0.1, Math.min(4, v)) }
  resetPitch(): void            { this.pitch = 1 }

  private getCtx(): AudioContext | null {
    if (!this.enabled) return null
    try {
      if (!this.ctx) this.ctx = new AudioContext()
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    } catch {
      return null
    }
  }

  play(id: SfxId, volume = 1): void {
    const ctx = this.getCtx()
    if (!ctx) return
    try {
      SYNTH_MAP[id]?.(ctx, volume * this.masterVol, this.pitch)
    } catch (e) {
      console.warn('[sfx] play error:', id, e)
    }
  }

  /** Play a raw tone at `freq` Hz for `duration` seconds. Useful for sequenced melodies. */
  tone(freq: number, duration = 0.12, volume = 1): void {
    const ctx = this.getCtx()
    if (!ctx) return
    try {
      const now  = ctx.currentTime
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq * this.pitch
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(volume * this.masterVol * 0.18, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
      osc.start(now)
      osc.stop(now + duration + 0.01)
    } catch (e) {
      console.warn('[sfx] tone error:', e)
    }
  }
}

/** Globale Singleton-Instanz. */
export const sfx = new SfxController()
