/**
 * useProgress – Einheitlicher Fortschritts-Hook
 *
 * Gast-User:      Liest/schreibt nur über den Zustand-Store (LocalStorage).
 * Eingeloggte User: Zustand-Store ist der reaktive Cache, Supabase die
 *                   dauerhafte Quelle. Ablauf:
 *
 *   1. Login       → Server-Fortschritt laden, mit lokalem mergen
 *                    (Server gewinnt bei Konflikten).
 *   2. Spielaktion → Store sofort aktualisieren (optimistic update),
 *                    dann asynchron zu Supabase senden.
 *   3. Offline     → Änderungen in LocalStorage puffern
 *                    (learnquest-pending-sync), beim nächsten
 *                    Online-Event flushen.
 *
 * Alle Komponenten können diesen Hook statt `useGameStore` verwenden –
 * die API ist ein Superset der relevanten Store-Felder.
 */
import { useEffect, useCallback, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import {
  pullServerProgress,
  pushProgressToServer,
  enqueuePendingSync,
  flushPendingSync,
  hasPendingSync,
} from '../lib/progressSync'

// ── Hook ──────────────────────────────────────────────────────

export function useProgress() {
  const { user } = useAuth()
  // Verhindert doppelten Login-Merge innerhalb derselben Session
  const mergedRef = useRef<string | null>(null)

  // ── Reaktiver State aus Zustand (immer aktuell) ───────────
  const xp                  = useGameStore((s) => s.xp)
  const level               = useGameStore((s) => s.level)
  const streak              = useGameStore((s) => s.streak)
  const totalSessions       = useGameStore((s) => s.totalSessions)
  const playerName          = useGameStore((s) => s.playerName)
  const selectedWorldId     = useGameStore((s) => s.selectedWorldId)
  const lastPlayedDate      = useGameStore((s) => s.lastPlayedDate)
  const unlockedAchievements = useGameStore((s) => s.unlockedAchievements)
  const dailyChallenge      = useGameStore((s) => s.dailyChallenge)

  // Store-Aktionen (werden unten gewrappt)
  const _addXP                  = useGameStore((s) => s.addXP)
  const _updateStreak           = useGameStore((s) => s.updateStreak)
  const _incrementSessions      = useGameStore((s) => s.incrementSessions)
  const _setPlayerName          = useGameStore((s) => s.setPlayerName)
  const _setSelectedWorldId     = useGameStore((s) => s.setSelectedWorldId)
  const _checkNewAchievements   = useGameStore((s) => s.checkNewAchievements)
  const _initDailyChallenge     = useGameStore((s) => s.initDailyChallenge)
  const _completeDailyChallenge = useGameStore((s) => s.completeDailyChallenge)

  // ── Login-Sync: Server → Local (einmalig pro User-Session) ───
  useEffect(() => {
    if (!user) {
      mergedRef.current = null
      return
    }
    // Schon für diesen User gemacht?
    if (mergedRef.current === user.id) return
    mergedRef.current = user.id

    void (async () => {
      const server = await pullServerProgress(user.id)
      if (!server) return

      const local = useGameStore.getState()
      const patch: Record<string, unknown> = {}

      // Server gewinnt bei allen numerischen Feldern
      if (server.xp > local.xp)                                  patch.xp = server.xp
      if (server.level > local.level)                             patch.level = server.level
      if (server.streak > local.streak)                           patch.streak = server.streak
      if (server.totalSessions > local.totalSessions)             patch.totalSessions = server.totalSessions
      // Datum übernehmen, falls lokal noch keines gesetzt
      if (server.lastActiveDate && !local.lastPlayedDate)         patch.lastPlayedDate = server.lastActiveDate

      if (Object.keys(patch).length > 0) {
        useGameStore.setState(patch)
      }

      // Lokalen Fortschritt (der evtl. als Gast angesammelt wurde) zum Server pushen
      const merged = useGameStore.getState()
      if (
        merged.xp > server.xp ||
        merged.level > server.level ||
        merged.totalSessions > server.totalSessions
      ) {
        await pushProgressToServer(user.id, merged.xp, merged.level, merged.totalSessions).catch(
          () => enqueuePendingSync(user.id, merged.xp, merged.level, merged.totalSessions),
        )
      }

      // Ausstehende Offline-Syncs flushen
      await flushPendingSync(user.id)
    })()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reconnect-Handler: Offline-Queue flushen ──────────────
  useEffect(() => {
    if (!user) return
    const uid = user.id

    const handleOnline = () => {
      if (hasPendingSync(uid)) void flushPendingSync(uid)
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hilfsfunktion: nach einer Aktion den aktuellen State pushen ──
  const syncToServer = useCallback(() => {
    if (!user) return
    const { xp: curXp, level: curLevel, totalSessions: curTs } = useGameStore.getState()
    void pushProgressToServer(user.id, curXp, curLevel, curTs).catch(
      () => enqueuePendingSync(user.id, curXp, curLevel, curTs),
    )
  }, [user])

  // ── Gewrappte Aktionen ────────────────────────────────────

  /**
   * XP hinzufügen.
   * Lokal sofort, dann Server + Weekly-XP asynchron.
   */
  const addXP = useCallback(
    (amount: number) => {
      const result = _addXP(amount) // optimistic update

      if (user) {
        syncToServer()
        void supabase.rpc('add_weekly_xp', { p_user_id: user.id, p_xp: amount })
      }

      return result
    },
    [user, _addXP, syncToServer],
  )

  /**
   * Streak aktualisieren.
   * Lokal sofort, dann Server-RPC (Server-Side idempotent).
   */
  const updateStreak = useCallback(() => {
    _updateStreak() // optimistic

    if (user) {
      void supabase
        .rpc('update_streak', { p_user_id: user.id })
        .then((res) => {
          if (!res.data) return
          const serverStreak = (res.data as { streak: number }).streak
          const localStreak = useGameStore.getState().streak
          if (serverStreak > localStreak) {
            useGameStore.setState({ streak: serverStreak })
          }
        })
    }
  }, [user, _updateStreak])

  /**
   * Session-Zähler erhöhen.
   * Server-seitig übernimmt `update_streak` RPC die total_sessions,
   * daher kein separater Push nötig.
   */
  const incrementSessions = useCallback(() => {
    _incrementSessions()
  }, [_incrementSessions])

  /**
   * Spielernamen setzen und in profiles synchronisieren.
   */
  const setPlayerName = useCallback(
    (name: string) => {
      _setPlayerName(name)
      if (user) {
        void supabase.from('profiles').update({ name }).eq('id', user.id)
      }
    },
    [user, _setPlayerName],
  )

  /**
   * Gewählte Welt setzen und in profiles synchronisieren.
   */
  const setSelectedWorldId = useCallback(
    (id: string) => {
      _setSelectedWorldId(id)
      if (user) {
        void supabase.from('profiles').update({ selected_world_id: id }).eq('id', user.id)
      }
    },
    [user, _setSelectedWorldId],
  )

  // ── Rückgabe ──────────────────────────────────────────────

  return {
    // State
    xp,
    level,
    streak,
    totalSessions,
    playerName,
    selectedWorldId,
    lastPlayedDate,
    unlockedAchievements,
    dailyChallenge,
    /** true wenn ein User eingeloggt ist (nützlich für UI-Anzeigen) */
    isAuthenticated: !!user,

    // Aktionen mit Server-Sync
    addXP,
    updateStreak,
    incrementSessions,
    setPlayerName,
    setSelectedWorldId,

    // Reine Store-Aktionen (kein Server-Sync nötig)
    checkNewAchievements:   _checkNewAchievements,
    initDailyChallenge:     _initDailyChallenge,
    completeDailyChallenge: _completeDailyChallenge,
  }
}
