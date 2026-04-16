/**
 * progressSync.ts – Server-Sync-Funktionen für Spielfortschritt
 *
 * Verantwortlichkeiten:
 *  - Fortschritt vom Server laden (pullServerProgress)
 *  - Fortschritt zum Server pushen (pushProgressToServer)
 *  - Offline-Queue verwalten (enqueue / flush)
 *  - Topics & Learned-Content upserten
 */
import { supabase } from './supabase'

// ── Typen ──────────────────────────────────────────────────────

export interface ServerProgress {
  xp: number
  level: number
  streak: number
  longestStreak: number
  totalSessions: number
  /** ISO-Datum-String oder null */
  lastActiveDate: string | null
  avatarColor: string | null
  learningIntention: string | null
}

// ── Offline-Queue ──────────────────────────────────────────────
// Speichert ausstehende Syncs als einzelnen "neuesten Stand" pro User.
// Wird geleert, sobald Verbindung besteht.

const PENDING_SYNC_KEY = 'learnquest-pending-sync'

interface PendingSyncEntry {
  userId: string
  xp: number
  level: number
  totalSessions: number
  timestamp: number
}

function readPendingSync(): PendingSyncEntry[] {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY)
    return raw ? (JSON.parse(raw) as PendingSyncEntry[]) : []
  } catch {
    return []
  }
}

function writePendingSync(entries: PendingSyncEntry[]): void {
  try {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(entries))
  } catch {
    // Kein Fatal-Error wenn localStorage nicht verfügbar
  }
}

/** Offline-Änderungen für einen User einreihen (überschreibt vorherigen Eintrag). */
export function enqueuePendingSync(
  userId: string,
  xp: number,
  level: number,
  totalSessions: number,
): void {
  const others = readPendingSync().filter((e) => e.userId !== userId)
  writePendingSync([...others, { userId, xp, level, totalSessions, timestamp: Date.now() }])
}

/** Prüft ob es ausstehende Offline-Syncs für einen User gibt. */
export function hasPendingSync(userId: string): boolean {
  return readPendingSync().some((e) => e.userId === userId)
}

// ── Pull ───────────────────────────────────────────────────────

/**
 * Liest den aktuellen Fortschritt eines Users vom Server.
 * Kombiniert `characters` (XP/Level) und `profiles` (Streak/Sessions).
 */
export async function pullServerProgress(userId: string): Promise<ServerProgress | null> {
  try {
    const [charRes, profileRes] = await Promise.all([
      supabase
        .from('characters')
        .select('xp, level')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select(
          'current_streak, longest_streak, last_active_date, total_sessions, avatar_color, learning_intention',
        )
        .eq('id', userId)
        .maybeSingle(),
    ])

    if (charRes.error) throw charRes.error
    if (profileRes.error) throw profileRes.error

    return {
      xp:                charRes.data?.xp              ?? 0,
      level:             charRes.data?.level            ?? 1,
      streak:            profileRes.data?.current_streak ?? 0,
      longestStreak:     profileRes.data?.longest_streak ?? 0,
      totalSessions:     profileRes.data?.total_sessions ?? 0,
      lastActiveDate:    profileRes.data?.last_active_date ?? null,
      avatarColor:       profileRes.data?.avatar_color    ?? null,
      learningIntention: profileRes.data?.learning_intention ?? null,
    }
  } catch (err) {
    console.error('pullServerProgress:', err)
    return null
  }
}

// ── Push ───────────────────────────────────────────────────────

/**
 * Pusht XP/Level/Sessions zum Server (idempotent – Server nimmt immer den höheren Wert).
 * Wirft bei Fehler, damit der Aufrufer in die Offline-Queue einreihen kann.
 */
export async function pushProgressToServer(
  userId: string,
  xp: number,
  level: number,
  totalSessions: number,
): Promise<void> {
  const { error } = await supabase.rpc('upsert_player_progress', {
    p_user_id:        userId,
    p_xp:             xp,
    p_level:          level,
    p_total_sessions: totalSessions,
  })
  if (error) throw error
}

// ── Flush ──────────────────────────────────────────────────────

/**
 * Leert die Offline-Queue für einen User.
 * Schlägt still fehl, wenn kein Netz – Queue bleibt erhalten.
 */
export async function flushPendingSync(userId: string): Promise<void> {
  const pending = readPendingSync().filter((e) => e.userId === userId)
  if (pending.length === 0) return

  // Neuesten Eintrag nehmen (mehrere fassen zusammen)
  const latest = pending.reduce((a, b) => (a.timestamp > b.timestamp ? a : b))

  try {
    await pushProgressToServer(userId, latest.xp, latest.level, latest.totalSessions)
    writePendingSync(readPendingSync().filter((e) => e.userId !== userId))
  } catch (err) {
    console.warn('flushPendingSync: Netz nicht verfügbar, Queue bleibt erhalten', err)
  }
}

// ── Topics ─────────────────────────────────────────────────────

/**
 * Legt ein Topic an oder aktualisiert mastery_percent (immer erhöhen).
 * Gibt die Topic-ID zurück oder null bei Fehler.
 */
export async function upsertTopic(
  userId: string,
  topicName: string,
  sourceType: 'pdf' | 'text' | 'ai' | 'manual',
  masteryPercent: number,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_topics')
      .upsert(
        {
          user_id:         userId,
          topic_name:      topicName,
          source_type:     sourceType,
          mastery_percent: masteryPercent,
          last_studied_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,topic_name' },
      )
      .select('id')
      .single()
    if (error) throw error
    return (data as { id: string }).id
  } catch (err) {
    console.error('upsertTopic:', err)
    return null
  }
}

// ── Learned Content (SM-2 Spaced Repetition) ───────────────────

/**
 * Zeichnet eine beantwortete Frage auf.
 * Beim ersten Mal wird ein Eintrag angelegt, danach aktualisiert.
 * Ease-Factor folgt SM-2: 1.3 (min) – 2.5 (max).
 */
export async function recordLearnedContent(
  userId: string,
  topicId: string | null,
  questionText: string,
  correctAnswer: string,
  correct: boolean,
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('learned_content')
      .select('id, times_correct, times_wrong, ease_factor')
      .eq('user_id', userId)
      .eq('question_text', questionText)
      .maybeSingle()

    const easeDelta = correct ? 0.1 : -0.2

    if (existing) {
      const newEase = Math.max(1.3, Math.min(2.5, Number(existing.ease_factor) + easeDelta))
      const intervalDays = correct ? Math.ceil(newEase) : 1
      await supabase
        .from('learned_content')
        .update({
          times_correct: correct
            ? (existing.times_correct as number) + 1
            : existing.times_correct,
          times_wrong: correct
            ? existing.times_wrong
            : (existing.times_wrong as number) + 1,
          ease_factor:   newEase,
          next_review_at: new Date(Date.now() + intervalDays * 86_400_000).toISOString(),
        })
        .eq('id', existing.id)
    } else {
      const initEase = Math.max(1.3, 2.5 + easeDelta)
      const intervalDays = correct ? 3 : 1
      await supabase.from('learned_content').insert({
        user_id:        userId,
        topic_id:       topicId,
        question_text:  questionText,
        correct_answer: correctAnswer,
        times_correct:  correct ? 1 : 0,
        times_wrong:    correct ? 0 : 1,
        ease_factor:    initEase,
        next_review_at: new Date(Date.now() + intervalDays * 86_400_000).toISOString(),
      })
    }
  } catch (err) {
    console.error('recordLearnedContent:', err)
  }
}
