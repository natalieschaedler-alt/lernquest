/**
 * events.ts – Zentraler typisierter Event-Bus für LearnQuest
 *
 * Entkoppelt Game-Logik von Side-Effects (Sound, Haptic, Analytics, DB-Write).
 * Alle Mini-Games emitten hier rein, alle Effekte hören zu.
 *
 * Verwendung:
 *   import { bus } from './events'
 *
 *   // Emittieren (in Mini-Games / Stores)
 *   bus.emit('answerCorrect', { questionIndex: 2, points: 50, fast: true })
 *
 *   // Lauschen (in Effekt-Hooks / Komponenten)
 *   const off = bus.on('bossDefeated', ({ worldId }) => { ... })
 *   // Cleanup: off()
 */

// ── Event-Map ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type GameEvents = {
  /** Korrekte Antwort gegeben */
  answerCorrect: {
    questionIndex: number
    points: number
    fast: boolean
    combo: number
  }
  /** Falsche Antwort gegeben */
  answerWrong: {
    questionIndex: number
    correctAnswer: string
    givenAnswer: string
  }
  /** Ein Dungeon-Raum abgeschlossen */
  roomComplete: {
    roomIndex: number
    score: number
    allCorrect: boolean
  }
  /** Boss besiegt */
  bossDefeated: {
    worldId: string
    score: number
    duration_sec: number
  }
  /** Kritischer Treffer ausgelöst */
  critHit: {
    multiplier: number
    questionIndex: number
  }
  /** Goldene Frage ausgelöst */
  goldenQuestion: {
    multiplier: number
    questionIndex: number
  }
  /** Streak erhöht */
  streakIncrease: {
    newStreak: number
    milestone: boolean
  }
  /** Session gestartet */
  sessionStart: {
    worldId: string
    worldTheme: string | null
  }
  /** Session beendet (Victory oder Game Over) */
  sessionEnd: {
    worldId: string
    score: number
    won: boolean
    duration_sec: number
  }
}

// ── Implementierung ───────────────────────────────────────────

type EventHandler<T> = (payload: T) => void

class TypedEventBus<Events extends Record<string, unknown>> {
  private readonly listeners = new Map<
    keyof Events,
    Set<EventHandler<Events[keyof Events]>>
  >()

  /**
   * Registriert einen Listener. Gibt eine Cleanup-Funktion zurück.
   */
  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    // Safe cast: the set is scoped to K
    const set = this.listeners.get(event) as Set<EventHandler<Events[K]>>
    set.add(handler)
    return () => { set.delete(handler) }
  }

  /**
   * Entfernt einen spezifischen Listener.
   */
  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    const set = this.listeners.get(event) as Set<EventHandler<Events[K]>> | undefined
    set?.delete(handler)
  }

  /**
   * Feuert ein Event an alle registrierten Listener.
   * Fehler in einzelnen Listenern werden geloggt, brechen aber keine weiteren ab.
   */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event) as Set<EventHandler<Events[K]>> | undefined
    if (!set || set.size === 0) return
    for (const handler of set) {
      try {
        handler(payload)
      } catch (err) {
        console.error(`[EventBus] Handler-Fehler für Event "${String(event)}":`, err)
      }
    }
  }

  /**
   * Entfernt alle Listener für ein Event (oder alle Events wenn kein Argument).
   */
  clear(event?: keyof Events): void {
    if (event !== undefined) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }
}

/** Globale Singleton-Instanz – einmal importieren und überall nutzen. */
export const bus = new TypedEventBus<GameEvents>()
