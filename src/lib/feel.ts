/**
 * feel.ts – Typen, Context und useFeel-Hook für die Feel-Engine
 *
 * Dieser Datei ist absichtlich React-State-frei. Sie definiert nur die
 * öffentliche API, die FeelProvider.tsx implementiert.
 */
import { createContext, useContext } from 'react'

// ── Typen ─────────────────────────────────────────────────────

export type ShakeIntensity = 'soft' | 'medium' | 'hard' | 'boss'

export type ParticleType = 'sparkle' | 'crash' | 'smoke' | 'golden' | 'ice' | 'lava'

export type HapticPattern = 'tick' | 'thud' | 'success' | 'fail'

export interface Origin { x: number; y: number }

// ── Interne Datenstrukturen (für FeelProvider) ────────────────

export interface ParticleState {
  id:       number
  key:      number    // erhöht bei Recycling → React remountet das Element
  active:   boolean
  type:     ParticleType
  x:        number    // screen-px
  y:        number
  dx:       number    // CSS-var --lq-pdx: horizontaler Drift in px
  dy:       number    // CSS-var --lq-pdy: vertikaler Drift in px (signed)
  size:     number    // px
  color:    string
  duration: number    // ms
  rotation: number    // deg (Startwert, CSS-var --lq-rot)
}

export interface FloatTextState {
  id:     number
  key:    number
  active: boolean
  text:   string
  x:      number
  y:      number
  color:  string
  size:   number     // rem
}

export interface FlashState {
  key:      number
  active:   boolean
  color:    string
  duration: number
}

export interface ChromaticState {
  key:       number
  active:    boolean
  intensity: number  // 0–1, mapped to CSS variable
  duration:  number
}

// ── Helpers ───────────────────────────────────────────────────

export function emptyParticlePool(size = 50): ParticleState[] {
  return Array.from({ length: size }, (_, i) => ({
    id: i, key: 0, active: false,
    type: 'sparkle', x: 0, y: 0, dx: 0, dy: 0,
    size: 0, color: '', duration: 0, rotation: 0,
  }))
}

export function emptyFloatPool(size = 15): FloatTextState[] {
  return Array.from({ length: size }, (_, i) => ({
    id: i, key: 0, active: false, text: '', x: 0, y: 0, color: '', size: 1.1,
  }))
}

// ── Context + Hook ────────────────────────────────────────────

export interface FeelContextValue {
  /** Schüttelt den Screen für eine kurze Animation */
  shake(intensity: ShakeIntensity): void
  /** Blendet einen farbigen Vollbild-Blitz ein */
  flash(color: string, duration: number): void
  /** Pausiert alle CSS-Animationen im App-Content für `duration` ms */
  freeze(duration: number): void
  /** Pseudo-Kamera-Zoom auf ein Element (Rect in Screen-Koordinaten) */
  zoom(target: DOMRect, duration: number): void
  /** Verlangsamt alle Web Animations auf `factor` für `duration` ms */
  slowmo(factor: number, duration: number): void
  /** Spawnt Partikel an einer Screen-Position */
  particles(origin: Origin, type: ParticleType, count: number): void
  /** Lässt einen Text ("+10 XP", "CRIT!") hochsteigen und ausfaden */
  floatText(text: string, origin: Origin, color: string, size?: number): void
  /** Vibration (falls navigator.vibrate unterstützt) */
  haptic(pattern: HapticPattern): void
  /** RGB-Split-Effekt über CSS filter */
  chromatic(intensity: number, duration: number): void
}

export const FeelContext = createContext<FeelContextValue | null>(null)

/** Gibt alle Feel-Methoden zurück. Muss innerhalb von FeelProvider verwendet werden. */
export function useFeel(): FeelContextValue {
  const ctx = useContext(FeelContext)
  if (!ctx) throw new Error('useFeel() must be called inside <FeelProvider>')
  return ctx
}
