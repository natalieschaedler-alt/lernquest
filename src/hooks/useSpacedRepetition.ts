/**
 * useSpacedRepetition
 *
 * Provides reactive SR data for the dashboard:
 *  - dueCount:        how many questions are due for review today
 *  - worldSRSummary:  average ease_factor per world_id
 *  - startReviewSession: launches a dungeon with today's due questions
 */
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { getDueSRCount, getDueSRRecords, getWorldSRSummary } from '../lib/database'
import { easeToStrength } from '../lib/sm2'
import type { EaseStrength } from '../lib/sm2'
import type { Question } from '../types'

export type { EaseStrength }

export interface WorldSREntry {
  avgEaseFactor: number
  count: number
  strength: EaseStrength
}

export function useSpacedRepetition() {
  const { user } = useAuth()

  const [dueCount, setDueCount]             = useState(0)
  const [worldSRSummary, setWorldSRSummary] = useState<Record<string, WorldSREntry>>({})
  const [loading, setLoading]               = useState(false)

  const loadSRData = useCallback(async () => {
    if (!user) {
      setDueCount(0)
      setWorldSRSummary({})
      return
    }
    setLoading(true)
    try {
      const [count, rawSummary] = await Promise.all([
        getDueSRCount(user.id),
        getWorldSRSummary(user.id),
      ])
      setDueCount(count)
      const enriched: Record<string, WorldSREntry> = {}
      for (const [wid, { avgEaseFactor, count: cnt }] of Object.entries(rawSummary)) {
        enriched[wid] = { avgEaseFactor, count: cnt, strength: easeToStrength(avgEaseFactor) }
      }
      setWorldSRSummary(enriched)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void loadSRData()
  }, [loadSRData])

  /**
   * Builds a review-quest dungeon from today's due questions and navigates to /dungeon.
   * @param navigate   react-router navigate function
   * @param setQuestions  store action to load questions
   */
  const startReviewSession = useCallback(
    async (
      navigate: (path: string) => void,
      setQuestions: (questions: Question[], worldId: string) => void,
    ) => {
      if (!user) return
      const dueRecords = await getDueSRRecords(user.id, 15)
      if (dueRecords.length === 0) return

      // Fetch the relevant worlds (unique IDs only)
      const worldIds = [...new Set(dueRecords.map((r) => r.worldId))]
      const { data: worlds } = await supabase
        .from('worlds')
        .select('id, questions')
        .in('id', worldIds)

      if (!worlds) return

      const worldMap: Record<string, Question[]> = {}
      for (const w of worlds) {
        worldMap[w.id as string] = w.questions as Question[]
      }

      // Pick the specific questions that are due
      const reviewQuestions: Question[] = []
      for (const rec of dueRecords) {
        const qs = worldMap[rec.worldId]
        if (qs?.[rec.questionIndex]) {
          reviewQuestions.push(qs[rec.questionIndex])
        }
      }

      if (reviewQuestions.length === 0) return

      setQuestions(reviewQuestions, 'review-quest')
      navigate('/dungeon')
    },
    [user],
  )

  return {
    dueCount,
    worldSRSummary,
    srLoading: loading,
    startReviewSession,
    reloadSR: loadSRData,
  }
}
