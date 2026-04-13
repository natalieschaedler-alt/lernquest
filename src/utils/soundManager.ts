class SoundManager {
  private audioContext: AudioContext | null = null
  private enabled: boolean = true

  constructor() {
    const saved = localStorage.getItem('learnquest-sound')
    if (saved !== null) {
      this.enabled = saved === 'true'
    }
  }

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    return this.audioContext
  }

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
      // Ignore audio errors (e.g. autoplay policy)
    }
  }

  playCorrect() {
    this.playTone(880, 0.1)
    setTimeout(() => this.playTone(1100, 0.15), 100)
  }

  playWrong() {
    this.playTone(440, 0.1, 'sawtooth', 0.2)
    setTimeout(() => this.playTone(330, 0.2, 'sawtooth', 0.2), 100)
  }

  playLevelUp() {
    ;[523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.playTone(f, 0.2), i * 100),
    )
  }

  playVictory() {
    ;[523, 659, 784, 1047, 1319].forEach((f, i) =>
      setTimeout(() => this.playTone(f, 0.3), i * 150),
    )
  }

  toggle(): boolean {
    this.enabled = !this.enabled
    localStorage.setItem('learnquest-sound', String(this.enabled))
    return this.enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }
}

export const soundManager = new SoundManager()
