/**
 * POST /api/create-student
 *
 * Erstellt einen Schüler-Account: Username + Passwort, kein Email-Confirm.
 * Intern wird ein Fake-Email `{username}@students.learnquest.local` angelegt.
 *
 * Aufrufbar nur von:
 *  - Lehrern (role='teacher') für ihre eigenen Klassen
 *  - Admins (role='admin')
 *
 * Body: {
 *   username:    string (3-20 chars, a-z 0-9 _ -)
 *   password:    string (≥8 chars) – oder 'auto' für generated
 *   displayName: string
 *   classId?:    string (UUID) – wird als pending_class_code gesetzt
 * }
 *
 * Response: { error: string | null, credentials?: { username, password } }
 *
 * Benötigte Env-Vars (server-only):
 *   SUPABASE_URL              (oder VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (NEU: sb_secret_...)
 *   SUPABASE_ANON_KEY         (oder VITE_SUPABASE_ANON_KEY) – für JWT-Verify
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient } from '@supabase/supabase-js'

export const config = {
  maxDuration: 10,
}

const FAKE_EMAIL_DOMAIN = 'students.learnquest.local'
const MAX_BODY_BYTES    = 10_000

// ── Helpers ───────────────────────────────────────────────────

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
      if (byteCount > maxBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'))
        req.destroy()
        return
      }
      data += chunk.toString()
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function randomPassword(): string {
  // 10-char password, no ambiguous chars (0/O, 1/l/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!#@$'
  let out = ''
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

const USERNAME_RE = /^[a-z0-9_-]{3,20}$/

// ── Handler ───────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
  if (req.method !== 'POST')    { json(res, 405, { error: 'Method Not Allowed' }); return }

  // ── Env ─────────────────────────────────────────────────────
  const supabaseUrl    = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey     = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey        = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !serviceKey || !anonKey) {
    json(res, 500, { error: 'Server configuration error' })
    return
  }

  // ── Auth (caller JWT) ──────────────────────────────────────
  const authHeader = (req.headers['authorization'] as string | undefined) ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    json(res, 401, { error: 'Authorization fehlt' })
    return
  }
  const token = authHeader.slice(7)

  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: { user: caller }, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !caller) {
    json(res, 401, { error: 'Ungültiger Token' })
    return
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Role check: teacher or admin
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .maybeSingle()
  const role = callerProfile?.role
  if (role !== 'teacher' && role !== 'admin') {
    json(res, 403, { error: 'Nur Lehrer und Admins dürfen Schüler anlegen.' })
    return
  }

  // ── Body ───────────────────────────────────────────────────
  let bodyRaw: string
  try {
    bodyRaw = await readBody(req, MAX_BODY_BYTES)
  } catch {
    json(res, 413, { error: 'Body zu groß' })
    return
  }

  let body: {
    username?: string
    password?: string
    displayName?: string
    classId?: string
  }
  try {
    body = JSON.parse(bodyRaw) as typeof body
  } catch {
    json(res, 400, { error: 'Ungültiges JSON' })
    return
  }

  const username = (body.username ?? '').trim().toLowerCase()
  const displayName = (body.displayName ?? '').trim()
  let password = (body.password ?? '').trim()
  const classId = (body.classId ?? '').trim() || null

  if (!USERNAME_RE.test(username)) {
    json(res, 400, { error: 'Username muss 3-20 Zeichen haben (a-z, 0-9, _ , -)' })
    return
  }
  if (!displayName || displayName.length > 60) {
    json(res, 400, { error: 'Anzeigename erforderlich (max 60 Zeichen)' })
    return
  }
  if (password === 'auto' || password === '') {
    password = randomPassword()
  } else if (password.length < 8) {
    json(res, 400, { error: 'Passwort muss mindestens 8 Zeichen haben' })
    return
  }

  // ── Username collision check ──────────────────────────────
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (existing) {
    json(res, 409, { error: `Username "${username}" ist bereits vergeben.` })
    return
  }

  // ── If classId provided, verify caller owns this class (teachers only) ──
  let inviteCode: string | null = null
  if (classId) {
    const { data: cls } = await admin
      .from('classes')
      .select('id, teacher_id, invite_code')
      .eq('id', classId)
      .maybeSingle()
    if (!cls) {
      json(res, 404, { error: 'Klasse nicht gefunden' })
      return
    }
    if (role === 'teacher' && cls.teacher_id !== caller.id) {
      json(res, 403, { error: 'Diese Klasse gehört dir nicht.' })
      return
    }
    inviteCode = cls.invite_code
  }

  // ── Create the auth user ──────────────────────────────────
  const fakeEmail = `${username}@${FAKE_EMAIL_DOMAIN}`
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email:         fakeEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: displayName,
      role:      'student',
      ...(inviteCode ? { pending_class_code: inviteCode } : {}),
    },
  })
  if (createError || !created?.user) {
    console.error('[create-student] createUser failed:', createError)
    json(res, 500, { error: createError?.message ?? 'Fehler beim Anlegen' })
    return
  }

  // ── Set username + name on profile (trigger created profile with role=student) ──
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      id:       created.user.id,
      name:     displayName,
      username,
      role:     'student',
    })
  if (profileError) {
    console.error('[create-student] profile upsert failed:', profileError)
    // Roll back: delete auth user
    await admin.auth.admin.deleteUser(created.user.id)
    json(res, 500, { error: 'Profil-Update fehlgeschlagen' })
    return
  }

  // Success
  json(res, 200, {
    error:       null,
    credentials: { username, password, displayName },
  })
}
