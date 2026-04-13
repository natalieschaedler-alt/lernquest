import md5 from 'md5'
import { supabase } from '../lib/supabase'
import { checkContent } from './contentFilter'
import type { Question } from '../types'

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

  // 5. JSON parsen
  const data = await response.json() as { questions: Question[] }
  let questions: Question[]
  try {
    questions = data.questions
    if (!Array.isArray(questions) || questions.length === 0) throw new Error('Leeres Array')
  } catch {
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
