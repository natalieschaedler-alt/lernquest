// Vercel Serverless Function – schützt den Anthropic API-Key vor dem Browser
// Liegt auf dem Server, der Key ist NIE im Frontend-Bundle sichtbar!
// Vercel erkennt Dateien in /api/ automatisch als Serverless Functions.

import type { IncomingMessage, ServerResponse } from 'node:http'

const MODEL = 'claude-haiku-4-5-20251001'
const LONG_TEXT_THRESHOLD = 6000

const SYSTEM_PROMPT = `Du bist ein Lernexperte für Schüler (10-18 Jahre) in Deutschland.
Analysiere Lerntexte und erstelle strukturiertes Lernmaterial.
Antworte IMMER nur als valides JSON-Objekt. Kein anderer Text, keine Backticks, keine Erklärungen.`

const SUMMARIZE_SYSTEM_PROMPT = `Du fasst Lerntexte zusammen. Antworte NUR mit der Zusammenfassung.`

function buildGeneratePrompt(text: string): string {
  return `Analysiere diesen Lerntext und antworte NUR mit diesem JSON:
{
  "summary": "Zusammenfassung in genau 2 Sätzen",
  "key_concepts": ["Begriff1","Begriff2","Begriff3"],
  "difficulty_overall": 2,
  "multiple_choice": [
    {
      "question": "Frage?",
      "correct": "Richtige Antwort",
      "wrong": ["Falsch1","Falsch2","Falsch3"],
      "difficulty": 1,
      "explanation": "Warum diese Antwort richtig ist",
      "variants": []
    }
  ],
  "true_false": [
    {
      "statement": "Aussage über den Text",
      "is_true": true,
      "explanation": "Erklärung"
    }
  ],
  "memory_pairs": [
    { "term": "Begriff", "definition": "Kurze Erklärung" }
  ],
  "fill_blanks": [
    {
      "sentence": "Der ___ wandelt Licht in Energie um.",
      "answer": "Chlorophyll",
      "hint": "Grüner Farbstoff"
    }
  ]
}
Erstelle genau: 10 multiple_choice (Mix difficulty 1/2/3), 5 true_false, 5 memory_pairs, 5 fill_blanks.
TEXT:\n\n${text}`
}

function buildSummarizePrompt(text: string): string {
  return `Fasse zusammen auf max 3000 Zeichen. Behalte alle wichtigen Fakten, Definitionen, Daten. NUR die Zusammenfassung, kein anderer Text.\n\nTEXT:\n\n${text}`
}

function sendJson(res: ServerResponse, status: number, payload: { error: string | null; data: unknown }) {
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
    console.error('[generate] Claude API non-OK. status:', response.status, 'body:', errBody)
    let message = 'Claude API Fehler'
    try {
      const parsedErr = JSON.parse(errBody) as { error?: { message?: string } }
      message = parsedErr.error?.message ?? message
    } catch {
      // non-JSON error body – keep default
    }
    throw new Error(message)
  }

  const claudeResponse = await response.json() as { content?: Array<{ text?: string }> }
  const rawText = claudeResponse.content?.[0]?.text?.trim()
  if (!rawText) {
    console.error('[generate] empty Claude content:', JSON.stringify(claudeResponse).slice(0, 500))
    throw new Error('Leere KI-Antwort')
  }
  return rawText
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
    console.error('[generate] JSON parse failed. body:', body, 'err:', err)
    sendJson(res, 400, { error: 'Ungültiges JSON', data: null })
    return
  }

  const { text } = parsed
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    console.error('[generate] invalid text. len:', text?.length, 'type:', typeof text)
    sendJson(res, 400, { error: 'text ist erforderlich (min. 10 Zeichen)', data: null })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[generate] ANTHROPIC_API_KEY missing in env')
    sendJson(res, 500, { error: 'API Key nicht konfiguriert', data: null })
    return
  }

  try {
    // 1. Long-Text-Vorverarbeitung: > 6000 Zeichen → zuerst zusammenfassen
    let workingText = text
    if (text.length > LONG_TEXT_THRESHOLD) {
      try {
        workingText = await callClaude(apiKey, SUMMARIZE_SYSTEM_PROMPT, buildSummarizePrompt(text), 1500)
      } catch (err) {
        console.error('[generate] summarization failed:', err)
        sendJson(res, 500, { error: 'Zusammenfassung fehlgeschlagen', data: null })
        return
      }
    }

    // 2. Fragen generieren (Haiku 4.5, 4000 tokens, volles Schema)
    let rawText: string
    try {
      rawText = await callClaude(apiKey, SYSTEM_PROMPT, buildGeneratePrompt(workingText), 4000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Claude API Fehler'
      sendJson(res, 502, { error: message, data: null })
      return
    }

    // 3. JSON-Objekt parsen (nicht mehr Array!)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[generate] no JSON object in Claude text. raw:', rawText.slice(0, 500))
      sendJson(res, 500, { error: 'Kein JSON in KI-Antwort gefunden', data: null })
      return
    }

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(jsonMatch[0])
    } catch (err) {
      console.error('[generate] JSON.parse failed. match:', jsonMatch[0].slice(0, 500), 'err:', err)
      sendJson(res, 500, { error: 'KI-Antwort konnte nicht geparst werden', data: null })
      return
    }

    // 4. Minimalvalidierung: multiple_choice muss ein non-empty Array sein
    const obj = parsedJson as { multiple_choice?: unknown[] }
    if (!obj || !Array.isArray(obj.multiple_choice) || obj.multiple_choice.length === 0) {
      console.error('[generate] invalid schema. parsed:', JSON.stringify(parsedJson).slice(0, 500))
      sendJson(res, 500, { error: 'KI-Antwort hat kein gültiges multiple_choice-Array', data: null })
      return
    }

    sendJson(res, 200, { error: null, data: parsedJson })
  } catch (err) {
    console.error('[generate] unexpected handler error:', err)
    sendJson(res, 500, { error: 'Interner Serverfehler', data: null })
  }
}
