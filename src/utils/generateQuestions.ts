import md5 from 'md5'
import { supabase } from '../lib/supabase'
import { checkContent } from './contentFilter'
import type { Question, GeneratedQuestionsResponse } from '../types'

function convertToQuestions(data: GeneratedQuestionsResponse): Question[] {
  const questions: Question[] = []

  // Multiple Choice
  for (const mc of data.multiple_choice) {
    const answers = [mc.correct, ...mc.wrong]
    for (let i = answers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[answers[i], answers[j]] = [answers[j], answers[i]]
    }
    questions.push({
      question:      mc.question,
      answers,
      correctIndex:  answers.indexOf(mc.correct),
      difficulty:    mc.difficulty as 1 | 2 | 3,
      question_type: 'mc',
      explanation:   mc.explanation,
      variants:      mc.variants,
    })
  }

  // True/False
  for (const tf of data.true_false) {
    questions.push({
      question:      tf.statement,
      answers:       ['Wahr', 'Falsch'],
      correctIndex:  tf.is_true ? 0 : 1,
      difficulty:    2,
      question_type: 'tf',
      explanation:   tf.explanation,
    })
  }

  // Memory Pairs
  for (const mp of data.memory_pairs) {
    questions.push({
      question:          mp.term,
      answers:           [mp.definition, '', '', ''],
      correctIndex:      0,
      difficulty:        2,
      question_type:     'memory',
      memory_term:       mp.term,
      memory_definition: mp.definition,
    })
  }

  // Fill Blanks
  for (const fb of data.fill_blanks) {
    questions.push({
      question:         fb.sentence,
      answers:          [fb.answer, '', '', ''],
      correctIndex:     0,
      difficulty:       2,
      question_type:    'fillblank',
      fillblank_answer: fb.answer,
      fillblank_hint:   fb.hint,
    })
  }

  return questions
}

export async function generateQuestions(text: string): Promise<{ questions: Question[], worldId: string, fromCache: boolean }> {
  // 1. Content prüfen
  const check = checkContent(text)
  if (!check.safe) throw new Error(check.reason)

  // 2. Hash berechnen
  const hash = md5(text.trim().toLowerCase())

  // 3. Cache prüfen
  const { data: cached } = await supabase
    .from('worlds')
    .select('id, questions')
    .eq('content_hash', hash)
    .single()

  if (cached) {
    return { questions: cached.questions as Question[], worldId: cached.id as string, fromCache: true }
  }

  // 4. API aufrufen – über den sicheren Backend-Proxy (api/generate.ts)
  // Der Anthropic-Key liegt damit NUR auf dem Server, nie im Browser!
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    const error = await response.json() as { error?: string }
    throw new Error(`API Fehler: ${error.error ?? 'Unbekannter Fehler'}`)
  }

  // 5. JSON parsen – neues Schema: { data: GeneratedQuestionsResponse }
  const responseData = (await response.json() as { data: GeneratedQuestionsResponse }).data
  const questions = convertToQuestions(responseData)
  if (questions.length === 0) {
    throw new Error('Fehler beim Verarbeiten der KI-Antwort. Bitte versuche es nochmal.')
  }

  // 6. In Supabase speichern (optional – schlägt für Gäste still fehl)
  const title = text.split(' ').slice(0, 5).join(' ') + '...'
  const { data: currentUser } = await supabase.auth.getUser()
  const userId = currentUser?.user?.id ?? null

  const { data: saved, error: saveError } = await supabase
    .from('worlds')
    .insert({ title, content_hash: hash, questions, user_id: userId })
    .select('id')
    .single()

  // Für Gäste (kein user_id) wird der Speicherversuch übersprungen –
  // wir generieren eine lokale ID damit der Spielfluss weitergeht.
  if (saveError || !saved) {
    const localWorldId = `local-${hash.slice(0, 8)}`
    return { questions, worldId: localWorldId, fromCache: false }
  }

  return { questions, worldId: (saved as { id: string }).id, fromCache: false }
}
