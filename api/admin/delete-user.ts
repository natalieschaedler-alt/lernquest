/**
 * POST /api/admin/delete-user
 * Body: { userId: string }
 * Admin-only.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient } from '@supabase/supabase-js'

export const config = { maxDuration: 10 }

function json(res: ServerResponse, s: number, b: unknown) {
  const p = JSON.stringify(b)
  res.statusCode = s
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Length', Buffer.byteLength(p))
  res.end(p)
}

async function readBody(req: IncomingMessage, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let d = ''; let n = 0
    req.on('data', (c: Buffer) => { n += c.length; if (n > max) { reject(new Error('big')); req.destroy(); return } d += c.toString() })
    req.on('end', () => resolve(d))
    req.on('error', reject)
  })
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
  if (req.method !== 'POST')    { json(res, 405, { error: 'Method Not Allowed' }); return }

  const url      = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const service  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anon     = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !service || !anon) { json(res, 500, { error: 'Server config' }); return }

  const authHeader = (req.headers['authorization'] as string | undefined) ?? ''
  if (!authHeader.startsWith('Bearer ')) { json(res, 401, { error: 'Auth fehlt' }); return }
  const token = authHeader.slice(7)

  const anonClient = createClient(url, anon)
  const { data: { user: caller } } = await anonClient.auth.getUser(token)
  if (!caller) { json(res, 401, { error: 'Ungültig' }); return }

  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: prof } = await admin.from('profiles').select('role').eq('id', caller.id).maybeSingle()
  if (prof?.role !== 'admin') { json(res, 403, { error: 'Nur Admins' }); return }

  let body: { userId?: string }
  try { body = JSON.parse(await readBody(req, 5000)) as typeof body }
  catch { json(res, 400, { error: 'JSON' }); return }

  if (!body.userId) { json(res, 400, { error: 'userId fehlt' }); return }
  if (body.userId === caller.id) { json(res, 400, { error: 'Du kannst dich nicht selbst löschen.' }); return }

  const { error: delError } = await admin.auth.admin.deleteUser(body.userId)
  if (delError) { json(res, 500, { error: delError.message }); return }

  void admin.rpc('log_admin_action', {
    p_action: 'delete_user',
    p_target: body.userId,
    p_details: {},
  })

  json(res, 200, { error: null })
}
