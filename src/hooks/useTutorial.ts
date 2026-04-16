/**
 * useTutorial – manages the first-dungeon tutorial flow.
 *
 * Steps (in order):
 *   dungeon_q1   → first question, points at answer buttons
 *   dungeon_xp   → after first correct answer, explains XP
 *   dungeon_room2 → on room 2, explains game variety
 *   boss_fight   → entering boss page
 *   victory_loot → after victory, explains loot rarity
 *
 * Rules:
 * - Each step shows once per hook instance (seenInSession Set)
 * - globallyDone (firstDungeonDone) stops ALL tips permanently
 * - After victory_loot closes, firstDungeonDone is set automatically
 * - Auto-close fires after AUTO_CLOSE_MS
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from '../stores/gameStore'

export type TutorialStepId =
  | 'dungeon_q1'
  | 'dungeon_xp'
  | 'dungeon_room2'
  | 'boss_fight'
  | 'victory_loot'

export const TUTORIAL_AUTO_CLOSE_MS = 5000

/** The final step — completing it marks the tutorial as done. */
const FINAL_STEP: TutorialStepId = 'victory_loot'

export function useTutorial() {
  const firstDungeonDone     = useGameStore((s) => s.firstDungeonDone)
  const markFirstDungeonDone = useGameStore((s) => s.markFirstDungeonDone)

  const [activeTip, setActiveTip] = useState<TutorialStepId | null>(null)
  const seenInSession = useRef<Set<TutorialStepId>>(new Set())
  const lastShownRef  = useRef<TutorialStepId | null>(null)
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When FINAL_STEP closes → mark tutorial complete globally
  useEffect(() => {
    if (!firstDungeonDone && activeTip === null && lastShownRef.current === FINAL_STEP) {
      markFirstDungeonDone()
    }
  }, [activeTip, firstDungeonDone, markFirstDungeonDone])

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const dismissTip = useCallback(() => {
    setActiveTip(null)
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const showTip = useCallback((id: TutorialStepId) => {
    if (firstDungeonDone) return
    if (seenInSession.current.has(id)) return
    seenInSession.current.add(id)
    lastShownRef.current = id
    setActiveTip(id)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setActiveTip(null), TUTORIAL_AUTO_CLOSE_MS)
  }, [firstDungeonDone])

  /** Immediately marks the tutorial complete (call from VictoryPage after showing loot tip). */
  const completeTutorial = useCallback(() => {
    dismissTip()
    markFirstDungeonDone()
  }, [dismissTip, markFirstDungeonDone])

  return {
    isDone: firstDungeonDone,
    activeTip,
    autoCloseMs: TUTORIAL_AUTO_CLOSE_MS,
    showTip,
    dismissTip,
    completeTutorial,
  }
}
