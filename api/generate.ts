// Vercel Serverless Function – schützt den Anthropic API-Key vor dem Browser
// Liegt auf dem Server, der Key ist NIE im Frontend-Bundle sichtbar!
// Vercel erkennt Dateien in /api/ automatisch als Serverless Functions.

import type { IncomingMessage, ServerResponse } from 'node:http'

const SYSTEM_PROMPT = `Du bist ein pädagogischer Assistent für Schüler (10-18 Jahre).
Generiere ausschließlich lehrreiche Multiple-Choice-Fragen auf Deutsch.
Antworte NUR mit einem validen JSON-Array. Kein anderer Text. Keine Markdown-Formatierung. Keine Backticks.
Format: [{"question":"string","answers":["string","string","string","string"],"correctIndex":0,"difficulty":1}]
- correctIndex: 0-3 (Index der richtigen Antwort)
- difficulty: 1 (leicht), 2 (mittel), 3 (schwer)
- Genau 10 Fragen
- Antworten: 1 richtige + 3 plausible falsche
- Fragen klar und eindeutig formuliert`

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  // Body einlesen
  const body = await new Promise<string>((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => { data += chunk.toString() })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })

  let parsed: { text?: string }
  try {
    parsed = JSON.parse(body) as { text?: string }
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Ungültiges JSON' }))
    return
  }

  const { text } = parsed
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'text ist erforderlich (min. 10 Zeichen)' }))
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'API Key nicht konfiguriert' }))
    return
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Generiere 10 Multiple-Choice-Fragen zu diesem Lernstoff:\n\n${text}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.json() as { error?: { message?: string } }
      res.writeHead(response.status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: error.error?.message ?? 'Claude API Fehler' }))
      return
    }

    const data = await response.json() as { content: Array<{ text: string }> }
    const rawText = data.content[0].text.trim()

    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Kein JSON in KI-Antwort gefunden' }))
      return
    }

    const questions = JSON.parse(jsonMatch[0]) as unknown[]
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ questions }))
  } catch (err) {
    console.error('generate handler error:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Interner Serverfehler' }))
  }
}
