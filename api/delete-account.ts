/**
 * DELETE /api/delete-account
 *
 * DSGVO Art. 17 – Recht auf Löschung.
 * Verifiziert das Bearer-JWT des anfragenden Users und löscht den Auth-User
 * danach mit der Supabase Service Role (CASCADE-Constraints löschen alle
 * zugehörigen Daten automatisch mit).
 *
 * Benötigte Server-Env-Vars (ohne VITE_-Prefix):
 *   SUPABASE_URL              – öffentliche URL des Projekts
 *   SUPABASE_SERVICE_ROLE_KEY – Service-Role-Key (niemals ans Frontend geben!)
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient } from '@supabase/supabase-js'

// ── Hilfsfunktionen ──────────────────────────────────────────

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Length', Buffer.byteLength(payload))
  res.end(payload)
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => { data += chunk.toString() })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

// ── Handler ───────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method Not Allowed' })
    return
  }

  // ── Env vars ────────────────────────────────────────────────
  // Vercel Functions können VITE_-Vars auch serverseitig lesen.
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('delete-account: missing env vars SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    json(res, 500, { error: 'Server configuration error' })
    return
  }

  // ── JWT aus Authorization-Header ────────────────────────────
  const authHeader = (req.headers['authorization'] as string | undefined) ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    json(res, 401, { error: 'Missing or invalid Authorization header' })
    return
  }
  const token = authHeader.slice(7)

  // ── User-Identität verifizieren (anon client) ───────────────
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token)

  if (authError || !user) {
    json(res, 401, { error: 'Invalid or expired token' })
    return
  }

  // ── User löschen (admin client) ─────────────────────────────
  // CASCADE-Policies in den Tabellen löschen alle zugehörigen Daten automatisch.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)

  if (deleteError) {
    console.error('delete-account: deleteUser failed', deleteError)
    json(res, 500, { error: deleteError.message })
    return
  }

  json(res, 200, { success: true })
}
