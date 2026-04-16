/**
 * FeelProvider – Unsichtbare Feel-Engine-Schicht
 *
 * Rendert:
 *  • einen "shake-root"-Wrapper um {children} (Web Animations API)
 *  • ein festes Overlay (z-index 9995) für Flash, Chromatic-Effekt,
 *    Partikel-Pool (max 50) und FloatText-Pool (max 15)
 *
 * Liest reducedMotion:
 *  • Prop `reducedMotion` (von settings_json.reducedMotion)
 *  • Oder CSS-Medienabfrage prefers-reduced-motion
 *  → Bei reducedMotion werden alle visuellen Effekte auf no-op gesetzt.
 *
 * EventBus-Wiring:
 *  Hört auf bus-Events aus /lib/events.ts und übersetzt sie via
 *  juiceConfig.ts in konkrete Feel-Aufrufe – Mini-Games müssen nur
 *  `bus.emit('answerCorrect', {...})` aufrufen.
 */
import {
  useRef, useState, useCallback, useEffect, useMemo,
  type CSSProperties,
} from 'react'
import {
  FeelContext,
  emptyParticlePool,
  emptyFloatPool,
  type FeelContextValue,
  type ShakeIntensity,
  type ParticleType,
  type HapticPattern,
  type ParticleState,
  type FloatTextState,
  type FlashState,
  type ChromaticState,
  type Origin,
} from '../lib/feel'
import { sfx } from '../lib/sfx'
import { JUICE } from '../lib/juiceConfig'
import { bus } from '../lib/events'

// ── CSS (in JS injiziert, kein separates Stylesheet nötig) ───

const FEEL_CSS = `
.lq-shake-root { isolation: isolate; }

/* ── Partikel ── */
.lq-particle {
  position: fixed;
  pointer-events: none;
  will-change: transform, opacity;
  z-index: 9996;
  transform-origin: center center;
}
@keyframes lq-sparkle {
  0%   { transform: translate(0,0) scale(1) rotate(0deg); opacity: 1; }
  100% { transform: translate(var(--lq-pdx,0px), -68px) scale(0) rotate(180deg); opacity: 0; }
}
.lq-p-sparkle { border-radius: 50%; animation: lq-sparkle var(--lq-dur,.65s) ease-out forwards; }

@keyframes lq-crash {
  0%   { transform: translate(0,0) scale(1); opacity: 1; }
  55%  { opacity: .9; }
  100% { transform: translate(var(--lq-pdx,20px), var(--lq-pdy,50px)) scale(.15); opacity: 0; }
}
.lq-p-crash {
  clip-path: polygon(50% 0%,100% 50%,50% 100%,0% 50%);
  animation: lq-crash var(--lq-dur,.5s) cubic-bezier(.25,.46,.45,.94) forwards;
}

@keyframes lq-smoke {
  0%   { transform: translate(var(--lq-pdx,0px),0) scale(.5); opacity: .55; filter: blur(3px); }
  100% { transform: translate(var(--lq-pdx,8px),-52px) scale(2.2); opacity: 0; filter: blur(10px); }
}
.lq-p-smoke { border-radius: 50%; animation: lq-smoke var(--lq-dur,.85s) ease-out forwards; }

@keyframes lq-golden {
  0%   { transform: translate(0,0) scale(0) rotate(0deg); opacity: 0; }
  18%  { transform: translate(var(--lq-pdx,0px),-20px) scale(1.2) rotate(25deg); opacity: 1; }
  100% { transform: translate(var(--lq-pdx,0px),-85px) scale(.25) rotate(200deg); opacity: 0; }
}
.lq-p-golden {
  clip-path: polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);
  animation: lq-golden var(--lq-dur,1.3s) ease-in-out forwards;
}

@keyframes lq-ice {
  0%   { transform: translate(0,0) rotate(var(--lq-rot,0deg)); opacity: 1; }
  100% { transform: translate(var(--lq-pdx,0px),78px) rotate(calc(var(--lq-rot,0deg) + 200deg)); opacity: 0; }
}
.lq-p-ice {
  clip-path: polygon(50% 0%,0% 100%,100% 100%);
  animation: lq-ice var(--lq-dur,.7s) cubic-bezier(.55,.085,.68,.53) forwards;
}

@keyframes lq-lava {
  0%   { transform: translate(0,0) scale(1); opacity: 1; }
  45%  { transform: translate(var(--lq-pdx,10px),calc(var(--lq-pdy,-35px) * .5)) scale(.85); }
  100% { transform: translate(var(--lq-pdx,10px),var(--lq-pdy,35px)) scale(.2); opacity: 0; }
}
.lq-p-lava {
  border-radius: 50% 50% 50% 0;
  animation: lq-lava var(--lq-dur,.55s) cubic-bezier(.55,.085,.68,.53) forwards;
}

/* ── Float-Text ── */
@keyframes lq-floattext {
  0%   { transform: translate(-50%,0) scale(1); opacity: 1; }
  18%  { transform: translate(-50%,-14px) scale(1.12); opacity: 1; }
  100% { transform: translate(-50%,-62px) scale(.8); opacity: 0; }
}
.lq-floattext {
  position: fixed;
  pointer-events: none;
  z-index: 9998;
  font-weight: 800;
  text-shadow: 0 2px 10px rgba(0,0,0,.6);
  white-space: nowrap;
  animation: lq-floattext .85s ease-out forwards;
  font-family: var(--font-display,'system-ui',sans-serif);
}

/* ── Flash ── */
@keyframes lq-flash-in {
  0%   { opacity: 0; }
  15%  { opacity: 1; }
  100% { opacity: 0; }
}
.lq-flash {
  position: fixed; inset: 0;
  pointer-events: none;
  z-index: 9997;
  animation: lq-flash-in var(--lq-flash-dur,.4s) ease-out forwards;
}

/* ── Chromatic (CSS filter hue-rotate-based) ── */
@keyframes lq-chromatic-anim {
  0%   { filter: none; }
  20%  { filter: hue-rotate(var(--lq-chroma-rot,20deg)) saturate(200%) contrast(125%); }
  45%  { filter: hue-rotate(calc(var(--lq-chroma-rot,20deg) * -1)) saturate(160%) contrast(115%); }
  70%  { filter: hue-rotate(calc(var(--lq-chroma-rot,20deg) * .5)) saturate(180%) contrast(120%); }
  100% { filter: none; }
}
.lq-chromatic-active {
  animation: lq-chromatic-anim var(--lq-chroma-dur,.3s) ease-out forwards;
}

/* ── Freeze ── */
.lq-content-frozen * {
  animation-play-state: paused !important;
  transition: none !important;
}
`

// ── Shake-Konfigurationen ─────────────────────────────────────

const SHAKE_CFG: Record<ShakeIntensity, { amp: number; count: number; dur: number }> = {
  soft:   { amp: 3,  count: 6,  dur: 240 },
  medium: { amp: 6,  count: 8,  dur: 320 },
  hard:   { amp: 12, count: 10, dur: 420 },
  boss:   { amp: 18, count: 14, dur: 550 },
}

// ── Haptic-Muster ─────────────────────────────────────────────

const HAPTIC_PATTERNS: Record<HapticPattern, number[]> = {
  tick:    [12],
  thud:    [30, 10, 30],
  success: [15, 10, 25, 10, 40],
  fail:    [50, 20, 50],
}

// ── Partikel-Farben & Größen pro Typ ─────────────────────────

interface ParticleTheme { colors: string[]; minSize: number; maxSize: number; duration: number }

const PARTICLE_THEME: Record<ParticleType, ParticleTheme> = {
  sparkle: { colors: ['#FFD700','#FFEC5C','#FFF4A3','#F59E0B'], minSize: 5,  maxSize: 11, duration: 650 },
  crash:   { colors: ['#F1F5F9','#CBD5E1','#94A3B8','#E2E8F0'], minSize: 4,  maxSize: 10, duration: 500 },
  smoke:   { colors: ['#6B7280','#9CA3AF','#D1D5DB'],           minSize: 10, maxSize: 22, duration: 850 },
  golden:  { colors: ['#FFD700','#FFF176','#FFCA28'],           minSize: 12, maxSize: 22, duration: 1300 },
  ice:     { colors: ['#BAE6FD','#7DD3FC','#E0F2FE','#BFDBFE'], minSize: 5,  maxSize: 10, duration: 700 },
  lava:    { colors: ['#FF6B35','#FF9500','#FF5F1F','#F97316'], minSize: 6,  maxSize: 13, duration: 550 },
}

// ── Hilfsfunktionen ───────────────────────────────────────────

function rnd(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function pickColor(theme: ParticleTheme): string {
  return theme.colors[Math.floor(Math.random() * theme.colors.length)]
}

// ── Haupt-Komponente ──────────────────────────────────────────

interface FeelProviderProps {
  children: React.ReactNode
  /** Setzt alle Effekte auf no-op (aus settings_json.reducedMotion) */
  reducedMotion?: boolean
}

export function FeelProvider({ children, reducedMotion = false }: FeelProviderProps) {
  // CSS prefers-reduced-motion als zusätzliche Quelle
  const systemReduced =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  const isReduced = reducedMotion || systemReduced

  // ── Refs ──
  const shakeRef    = useRef<HTMLDivElement>(null)
  const overlayRef  = useRef<HTMLDivElement>(null)
  const frozenTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── State ──
  const [pPool, setPPool] = useState<ParticleState[]>(emptyParticlePool)
  const [ftPool, setFtPool] = useState<FloatTextState[]>(emptyFloatPool)
  const [flashSt, setFlashSt] = useState<FlashState>({ key: 0, active: false, color: '', duration: 300 })
  const [chromSt, setChromSt] = useState<ChromaticState>({ key: 0, active: false, intensity: 0, duration: 300 })

  // ── CSS einmalig injizieren ───────────────────────────────
  useEffect(() => {
    const id  = 'lq-feel-css'
    if (document.getElementById(id)) return
    const tag = document.createElement('style')
    tag.id    = id
    tag.textContent = FEEL_CSS
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, [])

  // ── Feel-Methoden ─────────────────────────────────────────

  const shake = useCallback((intensity: ShakeIntensity) => {
    if (isReduced || !shakeRef.current) return
    const { amp, count, dur } = SHAKE_CFG[intensity]
    const frames: Keyframe[] = []
    for (let i = 0; i <= count; i++) {
      const decay = 1 - i / count
      const x = (i % 2 === 0 ? 1 : -1) * amp * decay
      const y = (i % 3 === 0 ? 0.4 : -0.4) * amp * decay
      frames.push({ transform: `translate(${x}px,${y}px)`, offset: i / count })
    }
    frames.push({ transform: 'translate(0,0)', offset: 1 })
    shakeRef.current.animate(frames, { duration: dur, easing: 'ease-out', fill: 'none' })
  }, [isReduced])

  const flash = useCallback((color: string, duration: number) => {
    if (isReduced) return
    setFlashSt(s => ({ key: s.key + 1, active: true, color, duration }))
  }, [isReduced])

  const freeze = useCallback((duration: number) => {
    if (isReduced || !shakeRef.current) return
    shakeRef.current.classList.add('lq-content-frozen')
    if (frozenTimer.current) clearTimeout(frozenTimer.current)
    frozenTimer.current = setTimeout(() => {
      shakeRef.current?.classList.remove('lq-content-frozen')
    }, duration)
  }, [isReduced])

  const zoom = useCallback((target: DOMRect, duration: number) => {
    if (isReduced || !shakeRef.current) return
    const root   = shakeRef.current.getBoundingClientRect()
    const ox     = ((target.x + target.width  / 2 - root.x) / root.width)  * 100
    const oy     = ((target.y + target.height / 2 - root.y) / root.height) * 100
    shakeRef.current.animate(
      [
        { transform: 'scale(1)',    transformOrigin: `${ox}% ${oy}%` },
        { transform: 'scale(1.07)', transformOrigin: `${ox}% ${oy}%`, offset: 0.35 },
        { transform: 'scale(1)',    transformOrigin: `${ox}% ${oy}%` },
      ],
      { duration, easing: 'ease-in-out', fill: 'none' },
    )
  }, [isReduced])

  const slowmo = useCallback((factor: number, duration: number) => {
    if (isReduced || !shakeRef.current) return
    const els = Array.from(shakeRef.current.querySelectorAll<Element>('*'))
    const anims = els.flatMap(el => el.getAnimations())
    anims.forEach(a => { a.playbackRate = factor })
    setTimeout(() => { anims.forEach(a => { a.playbackRate = 1 }) }, duration)
  }, [isReduced])

  const spawnParticles = useCallback((origin: Origin, type: ParticleType, count: number) => {
    if (isReduced) return
    const theme = PARTICLE_THEME[type]
    setPPool(prev => {
      const next    = [...prev]
      let spawned   = 0
      for (let i = 0; i < next.length && spawned < count; i++) {
        if (next[i].active) continue
        const p   = next[i]
        const dx  = rnd(-55, 55)
        const dy  = type === 'ice' ? rnd(50, 90) : type === 'lava' ? rnd(-45, 10) : rnd(-20, 20)
        next[i] = {
          ...p,
          key:      p.key + 1,
          active:   true,
          type,
          x:        origin.x + rnd(-8, 8),
          y:        origin.y + rnd(-8, 8),
          dx,
          dy,
          size:     rnd(theme.minSize, theme.maxSize),
          color:    pickColor(theme),
          duration: theme.duration + rnd(-80, 80),
          rotation: rnd(0, 360),
        }
        spawned++
      }
      return next
    })
  }, [isReduced])

  const recycle = useCallback((id: number) => {
    setPPool(prev => prev.map(p => p.id === id ? { ...p, active: false } : p))
  }, [])

  const spawnFloatText = useCallback((text: string, origin: Origin, color: string, size = 1.1) => {
    if (isReduced) return
    setFtPool(prev => {
      const next  = [...prev]
      const slot  = next.findIndex(ft => !ft.active)
      if (slot === -1) return prev
      const ft    = next[slot]
      next[slot]  = { ...ft, key: ft.key + 1, active: true, text, x: origin.x, y: origin.y, color, size }
      return next
    })
  }, [isReduced])

  const recycleFt = useCallback((id: number) => {
    setFtPool(prev => prev.map(ft => ft.id === id ? { ...ft, active: false } : ft))
  }, [])

  const haptic = useCallback((pattern: HapticPattern) => {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(HAPTIC_PATTERNS[pattern]) } catch { /* ignore */ }
    }
  }, [])

  const chromatic = useCallback((intensity: number, duration: number) => {
    if (isReduced) return
    setChromSt(s => ({ key: s.key + 1, active: true, intensity, duration }))
  }, [isReduced])

  // ── Screenkoordinaten-Fallback ───────────────────────────
  function defaultOrigin(): Origin {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }

  // ── Juice-Dispatcher ──────────────────────────────────────
  const triggerJuice = useCallback((
    eventKey: string,
    origin: Origin = defaultOrigin(),
    zoomTarget?: DOMRect,
  ) => {
    const spec = JUICE[eventKey]
    if (!spec) return

    if (spec.sfx)       sfx.play(spec.sfx)
    if (spec.haptic)    haptic(spec.haptic)
    if (spec.shake)     shake(spec.shake)
    if (spec.freeze)    freeze(spec.freeze)
    if (spec.flash)     flash(spec.flash.color, spec.flash.duration)
    if (spec.chromatic) chromatic(spec.chromatic.intensity, spec.chromatic.duration)
    if (spec.slowmo)    slowmo(spec.slowmo.factor, spec.slowmo.duration)
    if (spec.zoom && zoomTarget) zoom(zoomTarget, 320)
    if (spec.particles) {
      spec.particles.forEach(ps => spawnParticles(origin, ps.type, ps.count))
    }
    if (spec.floatText) {
      spawnFloatText(spec.floatText.text, origin, spec.floatText.color, spec.floatText.size)
    }
  }, [shake, flash, freeze, zoom, slowmo, spawnParticles, spawnFloatText, haptic, chromatic])

  // ── EventBus-Wiring ───────────────────────────────────────
  useEffect(() => {
    const offs = [
      bus.on('answerCorrect', ({ points, fast, ...rest }) => {
        const origin = (rest as { origin?: Origin }).origin ?? defaultOrigin()
        triggerJuice(fast ? 'correctFast' : 'correctAnswer', origin)
        // Floattext dynamisch mit tatsächlichen Punkten
        const txt = `+${points} XP`
        if (!fast) spawnFloatText(txt, origin, '#F59E0B', 1.05)
      }),
      bus.on('answerWrong', (rest) => {
        const origin = (rest as { origin?: Origin }).origin ?? defaultOrigin()
        triggerJuice('wrongAnswer', origin)
      }),
      bus.on('critHit', (e) => {
        const origin = (e as { origin?: Origin }).origin ?? defaultOrigin()
        triggerJuice('critHit', origin)
      }),
      bus.on('goldenQuestion', (e) => {
        const origin = (e as { origin?: Origin }).origin ?? defaultOrigin()
        triggerJuice('goldenQuestion', origin)
      }),
      bus.on('bossDefeated', (e) => {
        triggerJuice('bossDefeat', defaultOrigin())
        void e
      }),
      bus.on('roomComplete', (e) => {
        triggerJuice('roomComplete', defaultOrigin())
        void e
      }),
      bus.on('streakIncrease', (e) => {
        const origin = defaultOrigin()
        triggerJuice('streakIncrease', origin)
        void e
      }),
    ]
    return () => offs.forEach(f => f())
  }, [triggerJuice, spawnFloatText])

  // ── Context-Value ─────────────────────────────────────────
  const value: FeelContextValue = useMemo(() => ({
    shake,
    flash,
    freeze,
    zoom,
    slowmo,
    particles: spawnParticles,
    floatText: spawnFloatText,
    haptic,
    chromatic,
  }), [shake, flash, freeze, zoom, slowmo, spawnParticles, spawnFloatText, haptic, chromatic])

  // ── Render ────────────────────────────────────────────────
  return (
    <FeelContext.Provider value={value}>
      {/* App-Content – wird geschüttelt / gefroren */}
      <div ref={shakeRef} className="lq-shake-root">
        {children}
      </div>

      {/* Effekt-Overlay – festes Layer über dem Content */}
      <div
        ref={overlayRef}
        style={{
          position:      'fixed',
          inset:         0,
          pointerEvents: 'none',
          zIndex:        9995,
          overflow:      'hidden',
        }}
      >
        {/* Chromatic-Effekt-Overlay (sehr leicht) */}
        {chromSt.active && (
          <div
            key={`chrom-${chromSt.key}`}
            className="lq-chromatic-active"
            style={{
              position:   'absolute',
              inset:      0,
              background: 'transparent',
              '--lq-chroma-rot': `${Math.round(chromSt.intensity * 30)}deg`,
              '--lq-chroma-dur': `${chromSt.duration}ms`,
            } as CSSProperties}
            onAnimationEnd={() => setChromSt(s => ({ ...s, active: false }))}
          />
        )}

        {/* Flash */}
        {flashSt.active && (
          <div
            key={`flash-${flashSt.key}`}
            className="lq-flash"
            style={{
              background:       flashSt.color,
              '--lq-flash-dur': `${flashSt.duration}ms`,
            } as CSSProperties}
            onAnimationEnd={() => setFlashSt(s => ({ ...s, active: false }))}
          />
        )}

        {/* Partikel-Pool */}
        {pPool.map(p =>
          p.active ? (
            <div
              key={`p-${p.id}-${p.key}`}
              className={`lq-particle lq-p-${p.type}`}
              style={{
                left:           p.x,
                top:            p.y,
                width:          p.size,
                height:         p.size,
                background:     p.color,
                boxShadow:      p.type === 'golden'  ? `0 0 ${p.size * 1.5}px ${p.color}` :
                                p.type === 'sparkle' ? `0 0 ${p.size}px ${p.color}88` : undefined,
                '--lq-pdx':     `${p.dx}px`,
                '--lq-pdy':     `${p.dy}px`,
                '--lq-dur':     `${p.duration}ms`,
                '--lq-rot':     `${p.rotation}deg`,
              } as CSSProperties}
              onAnimationEnd={() => recycle(p.id)}
            />
          ) : null,
        )}

        {/* Float-Text-Pool */}
        {ftPool.map(ft =>
          ft.active ? (
            <div
              key={`ft-${ft.id}-${ft.key}`}
              className="lq-floattext"
              style={{
                left:     ft.x,
                top:      ft.y,
                color:    ft.color,
                fontSize: `${ft.size}rem`,
              }}
              onAnimationEnd={() => recycleFt(ft.id)}
            >
              {ft.text}
            </div>
          ) : null,
        )}
      </div>
    </FeelContext.Provider>
  )
}
