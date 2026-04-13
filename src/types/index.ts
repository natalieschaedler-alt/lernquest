export interface Question {
  question: string
  answers: string[]
  correctIndex: number
  difficulty: 1 | 2 | 3
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
  type: 'wizard' | 'explorer' | 'robot'
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
