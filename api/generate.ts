import type { IncomingMessage, ServerResponse } from 'node:http'

const MODEL = 'claude-haiku-4-5-20251001'
const LONG_TEXT_THRESHOLD = 6000

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
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  if (req.method !== 'POST') {
    console.error('[generate] invalid method:', req.method)
    sendJson(res, 405, { error: 'Method not allowed', data: null })
    return
  }

  let body: string
  try {
    body = await new Promise<string>((resolve, reject) => {
      let data = ''
      req.on('data', (chunk: Buffer) => { data += chunk.toString() })
      req.on('end', () => resolve(data))
      req.on('error', reject)
    })
  } catch (err) {
    console.error('[generate] body read failed:', err)
    sendJson(res, 400, { error: 'Body konnte nicht gelesen werden', data: null })
    return
  }

  let parsed: { text?: string }
  try {
    parsed = JSON.parse(body) as { text?: string }
  } catch (err) {
    console.error('[generate] JSON parse failed:', err)
    sendJson(res, 400, { error: 'Ungültiges JSON', data: null })
    return
  }

  const { text } = parsed
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    console.error('[generate] invalid text. len:', text?.length)
    sendJson(res, 400, { error: 'text ist erforderlich (min. 10 Zeichen)', data: null })
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

    if (text.length > LONG_TEXT_THRESHOLD) {
      console.error('[generate] long text, summarizing. len:', text.length)
      workingText = await callClaude(
        apiKey,
        'Fasse Lerntexte zusammen. Antworte NUR mit der Zusammenfassung, kein anderer Text.',
        `Fasse diesen Text auf maximal 3000 Zeichen zusammen. Behalte alle wichtigen Fakten und Definitionen.\n\n${text}`,
        1500
      )
    }

    const generatePrompt = `Analysiere diesen Lerntext und antworte NUR mit diesem JSON-Objekt, kein anderer Text:
{
  "summary": "Zusammenfassung in 2 Sätzen auf Deutsch",
  "key_concepts": ["Begriff1","Begriff2","Begriff3"],
  "difficulty_overall": 2,
  "multiple_choice": [
    {
      "question": "Frage auf Deutsch?",
      "correct": "Richtige Antwort",
      "wrong": ["Falsch1","Falsch2","Falsch3"],
      "difficulty": 1,
      "explanation": "Warum diese Antwort richtig ist",
      "variants": []
    }
  ],
  "true_false": [
    { "statement": "Aussage über den Text", "is_true": true, "explanation": "Erklärung" }
  ],
  "memory_pairs": [
    { "term": "Begriff max 4 Wörter", "definition": "Erklärung max 8 Wörter" }
  ],
  "fill_blanks": [
    { "sentence": "Der ___ macht etwas.", "answer": "Begriff", "hint": "Kleiner Tipp" }
  ]
}
Erstelle GENAU:
- 8 multiple_choice: 3x difficulty:1, 3x difficulty:2, 2x difficulty:3
- 4 true_false
- 4 memory_pairs
- 4 fill_blanks
Nur Fakten die direkt im Text stehen. Alles auf Deutsch.
TEXT:\n\n${workingText}`

    const rawText = await callClaude(
      apiKey,
      'Du bist ein Lernexperte. Antworte IMMER nur als valides JSON-Objekt. Kein anderer Text, keine Backticks.',
      generatePrompt,
      4000
    )

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[generate] no JSON object. raw:', rawText.slice(0, 300))
      sendJson(res, 500, { error: 'Kein JSON in KI-Antwort', data: null })
      return
    }

    let parsedData: unknown
    try {
      parsedData = JSON.parse(jsonMatch[0])
    } catch (err) {
      console.error('[generate] parse failed:', err)
      sendJson(res, 500, { error: 'KI-Antwort nicht parsebar', data: null })
      return
    }

    const obj = parsedData as { multiple_choice?: unknown[] }
    if (!Array.isArray(obj?.multiple_choice) || obj.multiple_choice.length === 0) {
      console.error('[generate] invalid schema:', JSON.stringify(parsedData).slice(0, 300))
      sendJson(res, 500, { error: 'KI-Schema ungültig', data: null })
      return
    }

    sendJson(res, 200, { error: null, data: parsedData })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Interner Fehler'
    console.error('[generate] handler error:', msg)
    sendJson(res, 500, { error: msg, data: null })
  }
}
