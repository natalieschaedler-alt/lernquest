import { supabase } from './supabase'
import { useGameStore } from '../stores/gameStore'
import type { World, GameSession, Character, Profile, Mistake } from '../types'

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
