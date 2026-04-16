import { supabase } from './supabase'
import { useGameStore } from '../stores/gameStore'
import type { World, GameSession, Character, Profile, Mistake } from '../types'
import { sm2Calculate, qualityFromResult } from './sm2'
import type { EaseStrength } from './sm2'
export type { EaseStrength }

// --- Worlds ---

export async function getUserWorlds(userId: string): Promise<Array<Pick<World, 'id' | 'title' | 'created_at' | 'questions'>>> {
  try {
    const { data, error } = await supabase
      .from('worlds')
      .select('id, title, created_at, questions')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Array<Pick<World, 'id' | 'title' | 'created_at' | 'questions'>>
  } catch (err) {
    console.error('getUserWorlds:', err)
    return []
  }
}

export async function deleteWorld(worldId: string): Promise<void> {
  const { error } = await supabase
    .from('worlds')
    .delete()
    .eq('id', worldId)
  if (error) throw error
}

export async function getWorldByHash(hash: string): Promise<World | null> {
  try {
    const { data, error } = await supabase
      .from('worlds')
      .select('*')
      .eq('content_hash', hash)
      .maybeSingle()
    if (error) throw error
    return data as World | null
  } catch (err) {
    console.error('getWorldByHash:', err)
    return null
  }
}

export async function saveWorld(
  world: Omit<World, 'id' | 'created_at'>
): Promise<World> {
  const { data, error } = await supabase
    .from('worlds')
    .insert(world)
    .select()
    .single()
  if (error) throw error
  return data as World
}

// --- Sessions ---

export async function saveSession(
  session: Omit<GameSession, 'id'>
): Promise<GameSession> {
  const { data, error } = await supabase
    .from('sessions')
    .insert(session)
    .select()
    .single()
  if (error) throw error
  return data as GameSession
}

// --- Mistakes (Spaced Repetition) ---

export async function saveMistake(
  userId: string,
  worldId: string,
  questionIndex: number
): Promise<void> {
  try {
    const { error } = await supabase.from('mistakes').insert({
      user_id: userId,
      world_id: worldId,
      question_index: questionIndex,
    })
    if (error) throw error
  } catch (err) {
    console.error('saveMistake:', err)
  }
}

export async function getMistakesForReview(userId: string): Promise<Mistake[]> {
  try {
    const { data, error } = await supabase
      .from('mistakes')
      .select('*')
      .eq('user_id', userId)
      .lte('next_review_at', new Date().toISOString())
    if (error) throw error
    return (data ?? []) as Mistake[]
  } catch (err) {
    console.error('getMistakesForReview:', err)
    return []
  }
}

/** Mark a mistake as reviewed, scheduling the next review using spaced repetition intervals */
export async function markMistakeReviewed(mistakeId: string, correct: boolean): Promise<void> {
  try {
    // Simple SM-2 inspired intervals: 1d → 3d → 7d → 14d → 30d
    const INTERVALS_DAYS = [1, 3, 7, 14, 30]
    const { data: mistake } = await supabase
      .from('mistakes')
      .select('review_count')
      .eq('id', mistakeId)
      .maybeSingle()
    if (!mistake) return
    const nextCount = correct ? (mistake.review_count ?? 0) + 1 : 0
    const intervalDays = INTERVALS_DAYS[Math.min(nextCount, INTERVALS_DAYS.length - 1)]
    const nextReview = new Date(Date.now() + intervalDays * 86400000).toISOString()
    await supabase
      .from('mistakes')
      .update({ review_count: nextCount, next_review_at: nextReview })
      .eq('id', mistakeId)
  } catch (err) {
    console.error('markMistakeReviewed:', err)
  }
}

// --- Characters ---

export async function getCharacter(userId: string): Promise<Character | null> {
  try {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data as Character | null
  } catch (err) {
    console.error('getCharacter:', err)
    return null
  }
}

export async function saveCharacter(
  char: Omit<Character, 'id'>
): Promise<Character> {
  const { data, error } = await supabase
    .from('characters')
    .insert(char)
    .select()
    .single()
  if (error) throw error
  return data as Character
}

export async function updateXP(userId: string, xpDelta: number): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_xp', {
      p_user_id: userId,
      p_delta: xpDelta,
    })
    if (error) throw error
  } catch (err) {
    console.error('updateXP:', err)
  }
}

// --- Profiles ---

export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw error
    return data as Profile | null
  } catch (err) {
    console.error('getProfile:', err)
    return null
  }
}

export async function updateProfile(
  userId: string,
  data: Partial<Omit<Profile, 'id' | 'created_at'>>
): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', userId)
    if (error) throw error
  } catch (err) {
    console.error('updateProfile:', err)
  }
}

// --- Profile Sync & Leaderboard ---

export async function syncProfileToStore(userId: string): Promise<void> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('current_streak, total_sessions, selected_world_id')
      .eq('id', userId)
      .maybeSingle()
    if (!data) return
    const store = useGameStore.getState()
    if (data.current_streak > store.streak)
      useGameStore.setState({ streak: data.current_streak })
    if (data.total_sessions > store.totalSessions)
      useGameStore.setState({ totalSessions: data.total_sessions })
    if (data.selected_world_id)
      useGameStore.setState({ selectedWorldId: data.selected_world_id })
  } catch (err) {
    console.warn('syncProfileToStore:', err)
  }
}

export async function getWeeklyLeaderboard(limit = 50): Promise<Array<{
  id: string; name: string | null; weekly_xp: number; selected_world_id: string | null
}>> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, weekly_xp, selected_world_id')
      .order('weekly_xp', { ascending: false })
      .limit(limit)
    return (data ?? []) as Array<{ id: string; name: string | null; weekly_xp: number; selected_world_id: string | null }>
  } catch (err) {
    console.error('getWeeklyLeaderboard:', err)
    return []
  }
}

// --- Spaced Repetition (SM-2) ---

export interface SRAnswerResult {
  questionIndex: number
  correct: boolean
  fast: boolean
}

/**
 * Returns the count of questions due for review today for a given user.
 */
export async function getDueSRCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('spaced_repetition')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('next_review_at', new Date().toISOString())
    if (error) throw error
    return count ?? 0
  } catch (err) {
    console.error('getDueSRCount:', err)
    return 0
  }
}

/**
 * Returns up to `limit` due SR records (oldest first) as { worldId, questionIndex }.
 */
export async function getDueSRRecords(
  userId: string,
  limit = 15,
): Promise<Array<{ worldId: string; questionIndex: number }>> {
  try {
    const { data, error } = await supabase
      .from('spaced_repetition')
      .select('world_id, question_index')
      .eq('user_id', userId)
      .lte('next_review_at', new Date().toISOString())
      .order('next_review_at', { ascending: true })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map((r) => ({ worldId: r.world_id as string, questionIndex: r.question_index as number }))
  } catch (err) {
    console.error('getDueSRRecords:', err)
    return []
  }
}

/**
 * Returns average ease_factor and count of reviewed questions per world_id.
 * Used by the dashboard to compute topic card strength indicators.
 */
export async function getWorldSRSummary(
  userId: string,
): Promise<Record<string, { avgEaseFactor: number; count: number }>> {
  try {
    const { data, error } = await supabase
      .from('spaced_repetition')
      .select('world_id, ease_factor')
      .eq('user_id', userId)
    if (error) throw error

    const byWorld: Record<string, { sum: number; count: number }> = {}
    for (const row of data ?? []) {
      const wid = row.world_id as string
      if (!byWorld[wid]) byWorld[wid] = { sum: 0, count: 0 }
      byWorld[wid].sum   += row.ease_factor as number
      byWorld[wid].count += 1
    }

    return Object.fromEntries(
      Object.entries(byWorld).map(([wid, { sum, count }]) => [
        wid,
        { avgEaseFactor: sum / count, count },
      ]),
    )
  } catch (err) {
    console.error('getWorldSRSummary:', err)
    return {}
  }
}

/**
 * Applies SM-2 to the answered questions and upserts the results into Supabase.
 * Fetches existing SR records first so the algorithm can continue from where it left off.
 */
export async function updateSRAfterSession(
  userId: string,
  worldId: string,
  results: SRAnswerResult[],
): Promise<void> {
  if (results.length === 0) return
  try {
    // Fetch existing SR state for these questions
    const { data: existing } = await supabase
      .from('spaced_repetition')
      .select('question_index, ease_factor, interval, repetitions')
      .eq('user_id', userId)
      .eq('world_id', worldId)
      .in('question_index', results.map((r) => r.questionIndex))

    const existingMap: Record<number, { ease_factor: number; interval: number; repetitions: number }> = {}
    for (const row of existing ?? []) {
      existingMap[row.question_index as number] = {
        ease_factor:  row.ease_factor  as number,
        interval:     row.interval     as number,
        repetitions:  row.repetitions  as number,
      }
    }

    const now = new Date().toISOString()
    const rows = results.map((r) => {
      const cur = existingMap[r.questionIndex] ?? { ease_factor: 2.5, interval: 1, repetitions: 0 }
      const quality  = qualityFromResult(r.correct, r.fast)
      const sm2      = sm2Calculate({ quality, easeFactor: cur.ease_factor, interval: cur.interval, repetitions: cur.repetitions })
      return {
        user_id:          userId,
        world_id:         worldId,
        question_index:   r.questionIndex,
        ease_factor:      sm2.easeFactor,
        interval:         sm2.interval,
        repetitions:      sm2.repetitions,
        next_review_at:   sm2.nextReviewAt,
        last_reviewed_at: now,
      }
    })

    const { error } = await supabase
      .from('spaced_repetition')
      .upsert(rows, { onConflict: 'user_id,world_id,question_index' })
    if (error) throw error
  } catch (err) {
    console.error('updateSRAfterSession:', err)
  }
}

// --- Connection Test ---

export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
    if (error) {
      console.error('testConnection fehlgeschlagen:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('testConnection:', err)
    return false
  }
}
