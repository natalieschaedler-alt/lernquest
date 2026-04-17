/**
 * POST /api/admin/create-user
 *
 * Admin legt direkt einen User an — beliebige Rolle. Für Lehrer & Admins.
 * (Für Schüler ohne Email → /api/create-student benutzen.)
 *
 * Body: {
 *   email:       string
 *   password:    string | 'auto'
 *   displayName: string
 *   role:        'teacher' | 'teacher_pending' | 'admin' | 'student'
 *   schoolId?:   string (UUID) — optional für Lehrer
 * }
 * Response: { error: string | null, credentials?: { email, password, role } }
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient } from '@supabase/supabase-js'

export const config = {
  maxDuration: 10,
}

const MAX_BODY_BYTES = 10_000

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Length', Buffer.byteLength(payload))
  res.end(payload)
}

async function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    let byteCount = 0
    req.on('data', (chunk: Buffer) => {
      byteCount += chunk.length
      if (byteCount > maxBytes) { reject(new Error('TOO_LARGE')); req.destroy(); return }
      data += chunk.toString()
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!#@$'
  let out = ''
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

const ALLOWED_ROLES = new Set(['teacher', 'teacher_pending', 'admin', 'student'])

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
  if (req.method !== 'POST')    { json(res, 405, { error: 'Method Not Allowed' }); return }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey     = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !serviceKey || !anonKey) {
    json(res, 500, { error: 'Server configuration error' })
    return
  }

  // Auth caller
  const authHeader = (req.headers['authorization'] as string | undefined) ?? ''
  if (!authHeader.startsWith('Bearer ')) { json(res, 401, { error: 'Auth fehlt' }); return }
  const token = authHeader.slice(7)

  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: { user: caller }, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !caller) { json(res, 401, { error: 'Ungültig' }); return }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Only admins may call this
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .maybeSingle()
  if (callerProfile?.role !== 'admin') {
    json(res, 403, { error: 'Nur Admins dürfen User anlegen.' })
    return
  }

  // Body
  let bodyRaw: string
  try { bodyRaw = await readBody(req, MAX_BODY_BYTES) }
  catch { json(res, 413, { error: 'Body zu groß' }); return }

  let body: {
    email?: string
    password?: string
    displayName?: string
    role?: string
    schoolId?: string
  }
  try { body = JSON.parse(bodyRaw) as typeof body }
  catch { json(res, 400, { error: 'Ungültiges JSON' }); return }

  const email       = (body.email ?? '').trim().toLowerCase()
  const displayName = (body.displayName ?? '').trim()
  const role        = (body.role ?? '').trim()
  const schoolId    = (body.schoolId ?? '').trim() || null
  let   password    = (body.password ?? '').trim()

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { json(res, 400, { error: 'Ungültige Email' }); return }
  if (!displayName || displayName.length > 60)    { json(res, 400, { error: 'Name erforderlich' }); return }
  if (!ALLOWED_ROLES.has(role))                   { json(res, 400, { error: 'Ungültige Rolle' }); return }
  if (password === '' || password === 'auto') password = randomPassword()
  else if (password.length < 8) { json(res, 400, { error: 'Passwort mind. 8 Zeichen' }); return }

  // Create auth user
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: displayName, role },
  })
  if (createError || !created?.user) {
    console.error('[admin/create-user]', createError)
    json(res, 500, { error: createError?.message ?? 'Fehler' })
    return
  }

  // Upsert profile with role + optional schoolId
  const profilePatch: Record<string, unknown> = {
    id: created.user.id,
    name: displayName,
    role,
  }
  if (schoolId) profilePatch.school_id = schoolId

  const { error: profileError } = await admin.from('profiles').upsert(profilePatch)
  if (profileError) {
    console.error('[admin/create-user] profile upsert:', profileError)
    await admin.auth.admin.deleteUser(created.user.id)
    json(res, 500, { error: 'Profil-Update fehlgeschlagen' })
    return
  }

  // Audit log
  void admin.rpc('log_admin_action', {
    p_action: 'create_user',
    p_target: email,
    p_details: { role, schoolId },
  })

  json(res, 200, {
    error: null,
    credentials: { email, password, role },
  })
}
