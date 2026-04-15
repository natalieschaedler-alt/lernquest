import md5 from 'md5'
import { supabase } from '../lib/supabase'
import { checkContent } from './contentFilter'
import type { Question } from '../types'

interface MCItem { question: string; correct: string; wrong: [string,string,string]; difficulty: number; explanation: string; variants: string[] }
interface TFItem { statement: string; is_true: boolean; explanation: string }
interface MemoryItem { term: string; definition: string }
interface FillItem { sentence: string; answer: string; hint: string }
interface GeneratedData {
  summary: string
  key_concepts: string[]
  difficulty_overall: number
  multiple_choice: MCItem[]
  true_false: TFItem[]
  memory_pairs: MemoryItem[]
  fill_blanks: FillItem[]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function convertToQuestions(data: GeneratedData): Question[] {
  const questions: Question[] = []

  for (const mc of (data.multiple_choice ?? [])) {
    const answers = shuffle([mc.correct, ...mc.wrong])
    questions.push({
      question: mc.question,
      answers,
      correctIndex: answers.indexOf(mc.correct),
      difficulty: (mc.difficulty as 1|2|3) ?? 2,
      question_type: 'mc',
      explanation: mc.explanation,
      variants: mc.variants ?? [],
    })
  }

  for (const tf of (data.true_false ?? [])) {
    questions.push({
      question: tf.statement,
      answers: ['Wahr', 'Falsch'],
      correctIndex: tf.is_true ? 0 : 1,
      difficulty: 2,
      question_type: 'tf',
      explanation: tf.explanation,
    })
  }

  for (const mp of (data.memory_pairs ?? [])) {
    questions.push({
      question: mp.term,
      answers: [mp.definition, '', '', ''],
      correctIndex: 0,
      difficulty: 1,
      question_type: 'memory',
      memory_term: mp.term,
      memory_definition: mp.definition,
    })
  }

  for (const fb of (data.fill_blanks ?? [])) {
    questions.push({
      question: fb.sentence,
      answers: [fb.answer, '', '', ''],
      correctIndex: 0,
      difficulty: 2,
      question_type: 'fillblank',
      fillblank_answer: fb.answer,
      fillblank_hint: fb.hint,
    })
  }

  return questions
}

export async function generateQuestions(text: string): Promise<{ questions: Question[], worldId: string, fromCache: boolean }> {
  const check = checkContent(text)
  if (!check.safe) throw new Error(check.reason)

  const hash = md5(text.trim().toLowerCase())

  const { data: cached } = await supabase
    .from('worlds')
    .select('id, questions')
    .eq('content_hash', hash)
    .single()

  if (cached) {
    return { questions: cached.questions as Question[], worldId: cached.id as string, fromCache: true }
  }

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    const error = await response.json() as { error?: string }
    throw new Error(`API Fehler: ${error.error ?? 'Unbekannter Fehler'}`)
  }

  const responseBody = await response.json() as { error: string | null, data: GeneratedData | null }

  if (responseBody.error || !responseBody.data) {
    throw new Error(responseBody.error ?? 'Leere KI-Antwort')
  }

  if (!responseBody.data.multiple_choice || responseBody.data.multiple_choice.length === 0) {
    throw new Error('KI hat keine Fragen generiert')
  }

  const questions = convertToQuestions(responseBody.data)
  if (questions.length === 0) {
    throw new Error('Fehler beim Verarbeiten der KI-Antwort')
  }

  const title = text.split(' ').slice(0, 5).join(' ') + '...'
  const { data: currentUser } = await supabase.auth.getUser()
  const userId = currentUser?.user?.id ?? null

  const { data: saved, error: saveError } = await supabase
    .from('worlds')
    .insert({ title, content_hash: hash, questions, user_id: userId })
    .select('id')
    .single()

  if (saveError || !saved) {
    return { questions, worldId: `local-${hash.slice(0, 8)}`, fromCache: false }
  }

  return { questions, worldId: (saved as { id: string }).id, fromCache: false }
}
