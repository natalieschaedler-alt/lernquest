import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const MODEL = 'claude-haiku-4-5-20251001'
const LONG_TEXT_THRESHOLD = 6000
const MIN_WORD_COUNT = 20
const MAX_BODY_BYTES = 200_000 // 200 KB – rejects oversized payloads before parsing

// ── Rate limiters (optional – only if Upstash env vars are set) ──
// Both instances are created once at module load, not per-request.
let authRatelimit: Ratelimit | null = null
let guestRatelimit: Ratelimit | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  authRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    analytics: false,
  })
  guestRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    analytics: false,
  })
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

async function callClaude(apiKey: string, system: string, userMessage: string, maxTokens: number): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!response.ok) {
    const errBody = await response.text()
    console.error('[generate] Claude non-OK:', response.status, errBody.slice(0, 300))
    throw new Error('Claude API Fehler: ' + response.status)
  }
  const data = await response.json() as { content?: Array<{ text?: string }> }
  const text = data.content?.[0]?.text?.trim()
  if (!text) throw new Error('Leere KI-Antwort')
  return text
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    res.end()
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed', data: null })
    return
  }

  // ── Auth check ──
  const authHeader = req.headers['authorization']
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  let userId: string | null = null
  if (token) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { data } = await supabase.auth.getUser(token)
        userId = data?.user?.id ?? null
      } catch (e) {
        console.warn('[generate] auth validation failed:', e)
      }
    }
  }

  // ── Rate limiting ──
  // Authenticated users get 10 req/h; guests get 3 req/h.
  if (authRatelimit && guestRatelimit) {
    const identifier = userId
      ?? (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
      ?? 'anonymous'

    const limiter = userId ? authRatelimit : guestRatelimit
    const { success, remaining } = await limiter.limit(identifier)
    if (!success) {
      res.setHeader('X-RateLimit-Remaining', remaining)
      sendJson(res, 429, { error: 'Rate limit überschritten. Bitte in einer Stunde erneut versuchen.', data: null })
      return
    }
  }

  // ── Body parsing ──
  let body: string
  try {
    body = await new Promise<string>((resolve, reject) => {
      let data = ''
      let byteCount = 0
      req.on('data', (chunk: Buffer) => {
        byteCount += chunk.length
        if (byteCount > MAX_BODY_BYTES) {
          reject(new Error('PAYLOAD_TOO_LARGE'))
          req.destroy()
          return
        }
        data += chunk.toString()
      })
      req.on('end', () => resolve(data))
      req.on('error', reject)
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'PAYLOAD_TOO_LARGE') {
      sendJson(res, 413, { error: 'Payload zu groß (max. 200 KB)', data: null })
      return
    }
    console.error('[generate] body read failed:', err)
    sendJson(res, 400, { error: 'Body konnte nicht gelesen werden', data: null })
    return
  }

  let parsed: { text?: string }
  try {
    parsed = JSON.parse(body) as { text?: string }
  } catch {
    sendJson(res, 400, { error: 'Ungültiges JSON', data: null })
    return
  }

  const { text } = parsed
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    sendJson(res, 400, { error: 'text ist erforderlich (min. 10 Zeichen)', data: null })
    return
  }

  const wordCount = text.trim().split(/\s+/).length
  if (wordCount < MIN_WORD_COUNT) {
    sendJson(res, 400, {
      error: `Text zu kurz – mindestens ${MIN_WORD_COUNT} Wörter benötigt, damit sinnvolle Lernfragen entstehen können.`,
      data: null,
    })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[generate] ANTHROPIC_API_KEY missing')
    sendJson(res, 500, { error: 'API Key nicht konfiguriert', data: null })
    return
  }

  try {
    let workingText = text

    // Summarize very long texts first
    if (text.length > LONG_TEXT_THRESHOLD) {
      console.log('[generate] long text, summarizing. len:', text.length)
      workingText = await callClaude(
        apiKey,
        'Du extrahierst Lerninhalte aus Texten. Antworte NUR mit der strukturierten Zusammenfassung, kein anderer Text.',
        `Erstelle eine strukturierte Lernzusammenfassung dieses Textes (max. 3000 Zeichen). Behalte: alle Definitionen, Fachbegriffe, Zahlen/Daten, Ursache-Wirkungs-Zusammenhänge und zentrale Konzepte. Verwerfe: Einleitungen, Wiederholungen, Fülltext.\n\n${text}`,
        1800
      )
    }

    const generatePrompt = `Analysiere diesen Lerntext und antworte NUR mit diesem JSON-Objekt – kein anderer Text, keine Markdown-Backticks, kein Kommentar:
{
  "summary": "Kernaussage in 2 prägnanten Sätzen",
  "key_concepts": ["Begriff1","Begriff2","Begriff3","Begriff4","Begriff5"],
  "difficulty_overall": 2,
  "multiple_choice": [
    {
      "question": "Frage, die echtes Verständnis prüft?",
      "correct": "Korrekte Antwort (max. 8 Wörter)",
      "wrong": ["Falschantwort A","Falschantwort B","Falschantwort C"],
      "difficulty": 1,
      "explanation": "Warum ist diese Antwort richtig? (1 Satz)"
    }
  ],
  "true_false": [
    { "statement": "Klare Aussage aus dem Text (max. 15 Wörter)", "is_true": true, "explanation": "Begründung (1 Satz)" }
  ],
  "memory_pairs": [
    { "term": "Fachbegriff (1–3 Wörter)", "definition": "Präzise Definition (3–8 Wörter)" }
  ],
  "fill_blanks": [
    { "sentence": "Vollständiger Satz mit ___ als einzige Lücke.", "answer": "gesuchtes Wort", "hint": "Kategorie oder Anfangsbuchstabe" }
  ]
}

PFLICHTREGELN – jede Verletzung macht das Ergebnis unbrauchbar:
1. Exakt: 8 multiple_choice (3× difficulty:1, 3× difficulty:2, 2× difficulty:3), 4 true_false, 4 memory_pairs, 4 fill_blanks
2. Sprache der Fragen = Sprache des Textes (Deutsch wenn Text Deutsch ist, Englisch wenn Englisch usw.)
3. Nur Fakten AUS dem Text – keine Allgemeinwissen-Fragen
4. fill_blanks: Jeder "sentence"-Wert MUSS exakt einmal den Token ___ enthalten
5. fill_blanks: "answer" ist das einzelne Wort/die Phrase die ___ ersetzt; der Satz muss ohne ___ grammatikalisch korrekt sein
6. multiple_choice "wrong"-Antworten: gleiche syntaktische Form wie "correct", plausibel aber eindeutig falsch
7. difficulty:1 = Direkte Fakten (Was? Wann? Wer?), difficulty:2 = Zusammenhänge (Warum? Wie?), difficulty:3 = Transfer/Analyse (Was würde passieren wenn...? Welcher Schluss folgt?)
8. true_false-Statements: eindeutig wahr ODER eindeutig falsch – keine Graubereiche
9. memory_pairs: Term und Definition müssen ein echtes Lernpaar bilden (Fachbegriff ↔ Bedeutung)
10. "explanation" bei multiple_choice und true_false: erklär warum die Antwort stimmt, damit Lernende etwas mitnehmen

TEXT:\n\n${workingText}`

    const systemPrompt = 'Du bist ein erfahrener Pädagoge und Didaktiker. Deine Aufgabe: Erstelle präzise, lehrreiche Lernfragen die echtes Verständnis statt bloßes Auswendiglernen fördern. Falschantworten müssen so formuliert sein dass nur wer den Stoff wirklich verstanden hat die richtige Antwort erkennt. Antworte AUSSCHLIESSLICH als valides JSON-Objekt ohne jeglichen anderen Text.'

    // Helper: extract and validate JSON from a raw Claude response
    function extractAndValidate(raw: string): unknown {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Kein JSON-Objekt in KI-Antwort gefunden')
      const data = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      const valid =
        Array.isArray(data?.multiple_choice) && (data.multiple_choice as unknown[]).length >= 8 &&
        Array.isArray(data?.true_false)       && (data.true_false as unknown[]).length >= 4 &&
        Array.isArray(data?.memory_pairs)     && (data.memory_pairs as unknown[]).length >= 4 &&
        Array.isArray(data?.fill_blanks)      && (data.fill_blanks as unknown[]).length >= 4
      if (!valid) throw new Error('KI-Schema unvollständig')
      return data
    }

    let parsedData: unknown
    let rawText: string

    try {
      rawText = await callClaude(apiKey, systemPrompt, generatePrompt, 5000)
      parsedData = extractAndValidate(rawText)
    } catch (firstErr) {
      // One retry – model occasionally produces incomplete or garbled output
      console.warn('[generate] first attempt failed, retrying:', firstErr instanceof Error ? firstErr.message : firstErr)
      try {
        rawText = await callClaude(apiKey, systemPrompt, generatePrompt, 5000)
        parsedData = extractAndValidate(rawText)
      } catch (retryErr) {
        const msg = retryErr instanceof Error ? retryErr.message : 'KI-Schema ungültig'
        console.error('[generate] retry also failed:', msg)
        sendJson(res, 500, { error: msg, data: null })
        return
      }
    }

    sendJson(res, 200, { error: null, data: parsedData })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Interner Fehler'
    console.error('[generate] handler error:', msg)
    sendJson(res, 500, { error: msg, data: null })
  }
}
