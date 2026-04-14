export interface Question {
  question: string
  answers: string[]
  correctIndex: number
  difficulty: 1 | 2 | 3
  question_type?: 'mc' | 'tf' | 'memory' | 'fillblank'
  explanation?: string
  variants?: string[]
  source?: string
  memory_term?: string
  memory_definition?: string
  fillblank_answer?: string
  fillblank_hint?: string
}

export interface World {
  id: string
  user_id: string
  title: string
  content_hash: string
  questions: Question[]
  created_at: string
}

export interface Character {
  id: string
  user_id: string
  type: string
  level: number
  xp: number
  customization: Record<string, string>
}

export interface GameSession {
  id: string
  user_id: string
  world_id: string
  score: number
  duration: number
  completed_at: string
}

export interface Profile {
  id: string
  name: string
  age?: number
  created_at: string
}

export interface Mistake {
  id: string
  user_id: string
  world_id: string
  question_index: number
  next_review_at: string
  review_count: number
}

export type WorldId = 'fire' | 'water' | 'cyber' | 'forest' | 'cosmos'

export interface WorldLoot {
  common: string
  rare: string
  epic: string
  legendary: string
}

export interface WorldTheme {
  id: WorldId
  name: string
  emoji: string
  unlockedAtSessions: number
  bgFrom: string
  bgTo: string
  primaryColor: string
  secondaryColor: string
  particleEmoji: string
  bossName: string
  bossEmoji: string
  specialAttacks: Array<'time' | 'fog' | 'shuffle'>
  unlockMessage: string
  loot: WorldLoot
}

export type RewardTier = 'legendary' | 'epic' | 'rare' | 'common'

export interface RewardResult {
  tier: RewardTier
  itemName: string
  color: string
  xpBonus: number
}

export interface GeneratedQuestionsResponse {
  summary: string
  key_concepts: string[]
  difficulty_overall: 1 | 2 | 3
  multiple_choice: Array<{
    question: string
    correct: string
    wrong: [string, string, string]
    difficulty: 1 | 2 | 3
    explanation: string
    variants: string[]
  }>
  true_false: Array<{
    statement: string
    is_true: boolean
    explanation: string
  }>
  memory_pairs: Array<{ term: string; definition: string }>
  fill_blanks: Array<{ sentence: string; answer: string; hint: string }>
}
