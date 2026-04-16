/**
 * POST /api/process-image
 *
 * Accepts a base64-encoded image and returns the extracted text via Claude's
 * vision API. Used by the onboarding photo-capture flow.
 *
 * Body: { imageBase64: string, mimeType: "image/jpeg" | "image/png" | "image/webp" }
 * Response: { error: string | null, text: string | null }
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const MODEL = 'claude-haiku-4-5-20251001'
// 4.5 MB allows a ~3.4 MB actual image after base64 decoding.
// Client-side resize keeps the payload well under this.
const MAX_BODY_BYTES = 4_500_000

const ALLOWED_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
])

// ── Rate limiters (optional – only active when Upstash env vars are set) ──
// Vision requests are more expensive than text, so limits are tighter.
let authRatelimit: Ratelimit | null = null
let guestRatelimit: Ratelimit | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  authRatelimit  = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h'), analytics: false })
  guestRatelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(2, '1 h'), analytics: false })
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

async function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    let byteCount = 0
    req.on('data', (chunk: Buffer) => {
      byteCount += chunk.length
      if (byteCount > maxBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'))
        req.destroy()
        return
      }
      data += chunk.toString()
    })
    req.on('end',   () => resolve(data))
    req.on('error', reject)
  })
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // CORS preflight
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
    sendJson(res, 405, { error: 'Method not allowed', text: null })
    return
  }

  // ── Auth check (for rate limiting) ──
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
        console.warn('[process-image] auth validation failed:', e)
      }
    }
  }

  // ── Rate limiting ──
  if (authRatelimit && guestRatelimit) {
    const identifier = userId
      ?? (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
      ?? 'anonymous'
    const limiter = userId ? authRatelimit : guestRatelimit
    const { success, remaining } = await limiter.limit(`img:${identifier}`)
    if (!success) {
      res.setHeader('X-RateLimit-Remaining', remaining)
      sendJson(res, 429, { error: 'Rate limit überschritten. Bitte in einer Stunde erneut versuchen.', text: null })
      return
    }
  }

  // ── Body parsing ──
  let body: string
  try {
    body = await readBody(req, MAX_BODY_BYTES)
  } catch (err) {
    if (err instanceof Error && err.message === 'PAYLOAD_TOO_LARGE') {
      sendJson(res, 413, { error: 'Bild zu groß (max. ~3 MB). Bitte wähle ein kleineres Bild oder gib den Text direkt ein.', text: null })
      return
    }
    console.error('[process-image] body read failed:', err)
    sendJson(res, 400, { error: 'Body konnte nicht gelesen werden', text: null })
    return
  }

  let parsed: { imageBase64?: string; mimeType?: string }
  try {
    parsed = JSON.parse(body) as { imageBase64?: string; mimeType?: string }
  } catch {
    sendJson(res, 400, { error: 'Ungültiges JSON', text: null })
    return
  }

  const { imageBase64, mimeType } = parsed

  if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length < 100) {
    sendJson(res, 400, { error: 'imageBase64 ist erforderlich', text: null })
    return
  }

  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    sendJson(res, 400, { error: 'Ungültiger Bildtyp. Unterstützt: JPEG, PNG, WebP.', text: null })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[process-image] ANTHROPIC_API_KEY missing')
    sendJson(res, 500, { error: 'API Key nicht konfiguriert', text: null })
    return
  }

  try {
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 4000,
        system:     'Du extrahierst Text aus Fotos von Schulbüchern und Lernmaterialien. Gib AUSSCHLIESSLICH den extrahierten Text zurück – keine Kommentare, keine Erklärungen, keine Formatierungshinweise.',
        messages: [
          {
            role: 'user',
            content: [
              {
                type:   'image',
                source: {
                  type:       'base64',
                  media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
                  data:       imageBase64,
                },
              },
              {
                type: 'text',
                text: 'Extrahiere den gesamten lesbaren Text aus diesem Foto eines Schulbuchs oder Lernmaterials. Behalte die Struktur (Absätze, Aufzählungen) bei. Gib nur den extrahierten Text zurück.',
              },
            ],
          },
        ],
      }),
    })

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text()
      console.error('[process-image] Claude non-OK:', claudeResponse.status, errBody.slice(0, 200))
      throw new Error('Claude API Fehler: ' + claudeResponse.status)
    }

    const claudeData = await claudeResponse.json() as { content?: Array<{ text?: string }> }
    const extractedText = claudeData.content?.[0]?.text?.trim() ?? ''

    if (extractedText.length < 15) {
      // Text too short — likely image was unreadable
      sendJson(res, 422, {
        error: 'Der Text im Bild konnte nicht gelesen werden. Versuch es mit besserer Beleuchtung oder gib den Text direkt ein.',
        text:  null,
      })
      return
    }

    sendJson(res, 200, { error: null, text: extractedText })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Interner Fehler'
    console.error('[process-image] handler error:', msg)
    sendJson(res, 500, { error: msg, text: null })
  }
}
