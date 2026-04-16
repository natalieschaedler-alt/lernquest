import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { getFallbackWorld } from '../src/lib/fallbackQuestions'

const MODEL = 'claude-haiku-4-5-20251001'
const LONG_TEXT_THRESHOLD = 6000
const MIN_WORD_COUNT = 20
const MAX_BODY_BYTES = 200_000     // 200 KB
const MAX_RETRIES = 2              // 1 initial + 2 retries = 3 total attempts
const CACHE_TTL_SEC = 3600         // 1 hour

// ── MD5 helper (Node crypto) ──────────────────────────────────
function md5(s: string): string {
  return createHash('md5').update(s).digest('hex')
}

// ── Rate limiters (optional) ──────────────────────────────────
let authRatelimit: Ratelimit | null = null
let guestRatelimit: Ratelimit | null = null
let cacheRedis: Redis | null = null

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  authRatelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 h'), analytics: false })
  guestRatelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h'), analytics: false })
  cacheRedis = redis
}

// ── In-memory cache fallback (Map mit TTL) ────────────────────
interface MemCacheEntry { data: unknown; expires: number }
const memCache = new Map<string, MemCacheEntry>()

// Hit-Rate-Tracking (pro Deployment-Instanz)
let cacheHits = 0
let cacheMisses = 0

async function cacheGet(key: string): Promise<unknown | null> {
  // 1. Versuche Redis
  if (cacheRedis) {
    try {
      const val = await cacheRedis.get<string>(`gen:${key}`)
      if (val !== null) {
        cacheHits++
        logHitRate()
        return JSON.parse(val) as unknown
      }
    } catch {
      /* Redis-Fehler → falle auf In-Memory zurück */
    }
  }
  // 2. In-Memory
  const entry = memCache.get(key)
  if (entry && entry.expires > Date.now()) {
    cacheHits++
    logHitRate()
    return entry.data
  }
  if (entry) memCache.delete(key)
  cacheMisses++
  return null
}

async function cacheSet(key: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data)
  // 1. Redis (mit Ablaufzeit)
  if (cacheRedis) {
    try {
      await cacheRedis.set(`gen:${key}`, json, { ex: CACHE_TTL_SEC })
    } catch {
      /* Redis-Fehler → schreibe nur in-memory */
    }
  }
  // 2. In-Memory (immer)
  memCache.set(key, { data, expires: Date.now() + CACHE_TTL_SEC * 1000 })

  // Alte Einträge bereinigen (max. 500 Einträge)
  if (memCache.size > 500) {
    const now = Date.now()
    for (const [k, v] of memCache) {
      if (v.expires <= now) memCache.delete(k)
      if (memCache.size <= 400) break
    }
  }
}

function logHitRate(): void {
  const total = cacheHits + cacheMisses
  if (total > 0 && total % 50 === 0) {
    const rate = ((cacheHits / total) * 100).toFixed(1)
    console.info(`[generate/cache] Hit-Rate: ${rate}% (${cacheHits}/${total})`)
  }
}

// ── Supabase-Client für Error-Logging ────────────────────────
function getAdminClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function logError(opts: {
  rawResponse: string
  error: string
  promptHash: string
  userId: string | null
}): Promise<void> {
  try {
    const sb = getAdminClient()
    if (!sb) return
    await sb.from('error_log').insert({
      raw_response: opts.rawResponse.slice(0, 20_000),
      error:        opts.error.slice(0, 2_000),
      prompt_hash:  opts.promptHash,
      user_id:      opts.userId,
    })
  } catch (e) {
    console.error('[generate] error_log write failed:', e)
  }
}

// ── HTTP helpers ──────────────────────────────────────────────
function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

// ── Claude-Aufruf ─────────────────────────────────────────────
async function callClaude(
  apiKey: string,
  system: string,
  userMessage: string,
  maxTokens: number,
): Promise<string> {
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

// ── Parser-Pipeline ───────────────────────────────────────────
// Stufe 1: Markdown-Fences entfernen
// Stufe 2: Ersten '{' bis letzten '}' extrahieren
// Stufe 3: JSON.parse
// Stufe 4: Schema-Validation (Zod-equivalent, kein zusätzliches Paket)

interface MCQ  { question: string; correct: string; wrong: unknown[]; difficulty: unknown; explanation: string }
interface TFQ  { statement: string; is_true: unknown; explanation: string }
interface MPair { term: string; definition: string }
interface FBQ  { sentence: string; answer: string; hint: string }

interface ParsedWorld {
  summary: string
  key_concepts: unknown[]
  difficulty_overall: unknown
  multiple_choice: MCQ[]
  true_false: TFQ[]
  memory_pairs: MPair[]
  fill_blanks: FBQ[]
}

function validateSchema(data: Record<string, unknown>): ParsedWorld {
  function assertArray(val: unknown, field: string, minLen: number): unknown[] {
    if (!Array.isArray(val)) throw new Error(`${field} ist kein Array`)
    if (val.length < minLen) throw new Error(`${field} hat zu wenige Einträge (${val.length} < ${minLen})`)
    return val
  }
  function assertString(val: unknown, field: string): string {
    if (typeof val !== 'string' || val.trim() === '') throw new Error(`${field} fehlt oder ist leer`)
    return val
  }

  const mc = assertArray(data.multiple_choice, 'multiple_choice', 8) as MCQ[]
  const tf = assertArray(data.true_false, 'true_false', 4) as TFQ[]
  const mp = assertArray(data.memory_pairs, 'memory_pairs', 4) as MPair[]
  const fb = assertArray(data.fill_blanks, 'fill_blanks', 4) as FBQ[]

  // Stichproben-Validation der einzelnen Items
  mc.forEach((q, i) => {
    assertString(q?.question, `multiple_choice[${i}].question`)
    assertString(q?.correct, `multiple_choice[${i}].correct`)
    if (!Array.isArray(q?.wrong) || q.wrong.length < 3)
      throw new Error(`multiple_choice[${i}].wrong unvollständig`)
  })
  tf.forEach((q, i) => {
    assertString(q?.statement, `true_false[${i}].statement`)
    if (typeof q?.is_true !== 'boolean')
      throw new Error(`true_false[${i}].is_true ist kein Boolean`)
  })
  mp.forEach((p, i) => {
    assertString(p?.term, `memory_pairs[${i}].term`)
    assertString(p?.definition, `memory_pairs[${i}].definition`)
  })
  fb.forEach((f, i) => {
    const s = assertString(f?.sentence, `fill_blanks[${i}].sentence`)
    if (!s.includes('___'))
      throw new Error(`fill_blanks[${i}].sentence enthält kein ___`)
    assertString(f?.answer, `fill_blanks[${i}].answer`)
  })

  return {
    summary:            (data.summary as string | undefined) ?? '',
    key_concepts:       Array.isArray(data.key_concepts) ? data.key_concepts : [],
    difficulty_overall: data.difficulty_overall ?? 2,
    multiple_choice:    mc,
    true_false:         tf,
    memory_pairs:       mp,
    fill_blanks:        fb,
  }
}

function parseAIResponse(raw: string): ParsedWorld {
  // Stufe 1: Markdown-Fences entfernen
  const stripped = raw
    .replace(/^```(?:json)?\s*/gm, '')
    .replace(/```\s*$/gm, '')
    .trim()

  // Stufe 2: Ersten '{' bis letzten '}' extrahieren
  const start = stripped.indexOf('{')
  const end   = stripped.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Kein JSON-Objekt in KI-Antwort gefunden')
  }
  const extracted = stripped.slice(start, end + 1)

  // Stufe 3: JSON.parse
  let data: Record<string, unknown>
  try {
    data = JSON.parse(extracted) as Record<string, unknown>
  } catch (e) {
    throw new Error(`JSON.parse fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Stufe 4: Schema-Validation
  return validateSchema(data)
}

// ── Prompts ───────────────────────────────────────────────────

const SYSTEM_BASE = 'Du bist ein erfahrener Pädagoge und Didaktiker. Deine Aufgabe: Erstelle präzise, lehrreiche Lernfragen die echtes Verständnis statt bloßes Auswendiglernen fördern. Falschantworten müssen so formuliert sein dass nur wer den Stoff wirklich verstanden hat die richtige Antwort erkennt. Antworte AUSSCHLIESSLICH als valides JSON-Objekt ohne jeglichen anderen Text.'

// Verschärfte System-Anweisung für Retry-Versuche
const SYSTEM_RETRY = SYSTEM_BASE + ' WICHTIG: Antworte AUSSCHLIESSLICH mit validem JSON. Kein Markdown, keine Backticks, kein Text vor oder nach dem JSON-Objekt. Nur das reine JSON-Objekt, beginnend mit { und endend mit }.'

function buildGeneratePrompt(text: string): string {
  return `Analysiere diesen Lerntext und antworte NUR mit diesem JSON-Objekt – kein anderer Text, keine Markdown-Backticks, kein Kommentar:
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
7. difficulty:1 = Direkte Fakten (Was? Wann? Wer?), difficulty:2 = Zusammenhänge (Warum? Wie?), difficulty:3 = Transfer/Analyse
8. true_false-Statements: eindeutig wahr ODER eindeutig falsch – keine Graubereiche
9. memory_pairs: Term und Definition müssen ein echtes Lernpaar bilden (Fachbegriff ↔ Bedeutung)
10. "explanation" bei multiple_choice und true_false: erklär warum die Antwort stimmt

TEXT:\n\n${text}`
}

// ── Request-Handler ───────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin':  '*',
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

  // ── Auth check ──────────────────────────────────────────────
  const authHeader = req.headers['authorization']
  const token      = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  let userId: string | null = null
  if (token) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
    if (supabaseUrl && supabaseKey) {
      try {
        const sb = createClient(supabaseUrl, supabaseKey)
        const { data } = await sb.auth.getUser(token)
        userId = data?.user?.id ?? null
      } catch (e) {
        console.warn('[generate] auth validation failed:', e)
      }
    }
  }

  // ── Rate limiting ────────────────────────────────────────────
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

  // ── Body lesen ───────────────────────────────────────────────
  let body: string
  try {
    body = await new Promise<string>((resolve, reject) => {
      let data = ''
      let byteCount = 0
      req.on('data', (chunk: Buffer) => {
        byteCount += chunk.length
        if (byteCount > MAX_BODY_BYTES) { reject(new Error('PAYLOAD_TOO_LARGE')); req.destroy(); return }
        data += chunk.toString()
      })
      req.on('end',   () => resolve(data))
      req.on('error', reject)
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'PAYLOAD_TOO_LARGE') {
      sendJson(res, 413, { error: 'Payload zu groß (max. 200 KB)', data: null })
      return
    }
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
      error: `Text zu kurz – mindestens ${MIN_WORD_COUNT} Wörter benötigt.`,
      data:  null,
    })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[generate] ANTHROPIC_API_KEY missing')
    sendJson(res, 500, { error: 'API Key nicht konfiguriert', data: null })
    return
  }

  // ── Cache-Lookup ─────────────────────────────────────────────
  const cacheKey = md5(text)
  const cached   = await cacheGet(cacheKey)
  if (cached !== null) {
    res.setHeader('X-Cache', 'HIT')
    sendJson(res, 200, { error: null, data: cached })
    return
  }
  res.setHeader('X-Cache', 'MISS')

  try {
    // ── Langen Text zusammenfassen ──────────────────────────
    let workingText = text
    if (text.length > LONG_TEXT_THRESHOLD) {
      console.log('[generate] long text, summarizing. len:', text.length)
      workingText = await callClaude(
        apiKey,
        'Du extrahierst Lerninhalte aus Texten. Antworte NUR mit der strukturierten Zusammenfassung, kein anderer Text.',
        `Erstelle eine strukturierte Lernzusammenfassung (max. 3000 Zeichen). Behalte: Definitionen, Fachbegriffe, Zahlen, Ursache-Wirkung, zentrale Konzepte. Verwerfe: Einleitungen, Fülltext.\n\n${text}`,
        1800,
      )
    }

    const generatePrompt = buildGeneratePrompt(workingText)
    const promptHash     = md5(generatePrompt)

    // ── Retry-Schleife (1 initial + MAX_RETRIES) ────────────
    let parsedData: ParsedWorld | null = null
    let lastRawResponse = ''
    let lastError = ''

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const systemPrompt = attempt === 0 ? SYSTEM_BASE : SYSTEM_RETRY
      try {
        lastRawResponse = await callClaude(apiKey, systemPrompt, generatePrompt, 5000)
        parsedData = parseAIResponse(lastRawResponse)
        break // Erfolg
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        console.warn(`[generate] attempt ${attempt + 1}/${MAX_RETRIES + 1} failed: ${lastError}`)

        if (attempt === MAX_RETRIES) {
          // Alle Versuche erschöpft → loggen
          void logError({
            rawResponse: lastRawResponse,
            error:       lastError,
            promptHash,
            userId,
          })
        }
      }
    }

    if (parsedData) {
      // Erfolgreiche Antwort cachen
      await cacheSet(cacheKey, parsedData)
      sendJson(res, 200, { error: null, data: parsedData })
    } else {
      // ── Fallback-Pool ──────────────────────────────────────
      console.error('[generate] all attempts failed, serving fallback')
      // Einfache Theme-Heuristik aus dem Text
      const lower = text.toLowerCase()
      const theme =
        lower.includes('meer') || lower.includes('wasser') || lower.includes('ozean') || lower.includes('ocean') ? 'water'
        : lower.includes('computer') || lower.includes('software') || lower.includes('code') || lower.includes('digital') ? 'cyber'
        : lower.includes('wald') || lower.includes('pflanze') || lower.includes('tier') || lower.includes('forest') || lower.includes('biology') ? 'forest'
        : 'cosmos'
      const fallback = getFallbackWorld(theme)
      sendJson(res, 200, { error: null, data: fallback, fallback: true })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Interner Fehler'
    console.error('[generate] handler error:', msg)
    sendJson(res, 500, { error: msg, data: null })
  }
}
