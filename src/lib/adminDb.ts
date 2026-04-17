/**
 * adminDb – Supabase-Helpers für den Admin-Bereich.
 *
 * ALLE Operationen hier laufen nur, wenn der aufrufende User
 * profiles.role = 'admin' hat (enforced via RLS + security-definer RPCs).
 */
import { supabase } from './supabase'

export interface AdminStats {
  total_users: number
  active_teachers: number
  pending_teachers: number
  students: number
  total_worlds: number
  worlds_last_24h: number
  sessions_last_7d: number
}

export interface AdminUserRow {
  id: string
  name: string | null
  role: 'student' | 'teacher_pending' | 'teacher' | 'admin'
  school: string | null
  subjects: string | null
  created_at: string
}

// ── Stats ─────────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats | null> {
  try {
    const { data, error } = await supabase.rpc('get_admin_stats')
    if (error) throw error
    // RPC returns a single-row set
    const row = Array.isArray(data) ? data[0] : data
    return (row ?? null) as AdminStats | null
  } catch (err) {
    console.error('getAdminStats:', err)
    return null
  }
}

// ── Users ─────────────────────────────────────────────────────

export async function listUsers(filter: { role?: string } = {}): Promise<AdminUserRow[]> {
  try {
    let q = supabase
      .from('profiles')
      .select('id, name, role, school, subjects, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (filter.role) q = q.eq('role', filter.role)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as AdminUserRow[]
  } catch (err) {
    console.error('listUsers:', err)
    return []
  }
}

/** Approve a teacher_pending → teacher. */
export async function approveTeacher(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'teacher' })
      .eq('id', userId)
    if (error) throw error
    return true
  } catch (err) {
    console.error('approveTeacher:', err)
    return false
  }
}

/** Reject a teacher_pending → student. */
export async function rejectTeacher(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'student' })
      .eq('id', userId)
    if (error) throw error
    return true
  } catch (err) {
    console.error('rejectTeacher:', err)
    return false
  }
}

/** Promote user to admin by email. Requires caller to be admin (enforced server-side). */
export async function setRoleByEmail(email: string, role: AdminUserRow['role']): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('admin_set_role', {
      target_email: email,
      new_role: role,
    })
    if (error) throw error
    return data === true
  } catch (err) {
    console.error('setRoleByEmail:', err)
    return false
  }
}

// ── Schools ───────────────────────────────────────────────────

export interface SchoolRow {
  id: string
  name: string
  city: string | null
  country: string | null
  created_at: string
  teacher_count: number
  student_count: number
}

export async function listSchools(): Promise<SchoolRow[]> {
  try {
    const { data, error } = await supabase.rpc('get_schools_with_counts')
    if (error) throw error
    // RPC returns out_* prefixed columns (see migration 014). Map to clean names.
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id:            r.out_id as string,
      name:          r.out_name as string,
      city:          (r.out_city ?? null) as string | null,
      country:       (r.out_country ?? null) as string | null,
      created_at:    r.out_created_at as string,
      teacher_count: Number(r.out_teacher_count ?? 0),
      student_count: Number(r.out_student_count ?? 0),
    })) as SchoolRow[]
  } catch (err) {
    console.error('listSchools:', err)
    return []
  }
}

export async function createSchool(name: string, city: string): Promise<SchoolRow | null> {
  try {
    const { data, error } = await supabase
      .from('schools')
      .insert({ name, city: city || null })
      .select('*, teacher_count:id, student_count:id')
      .single()
    if (error) throw error
    return { ...data, teacher_count: 0, student_count: 0 } as SchoolRow
  } catch (err) {
    console.error('createSchool:', err)
    return null
  }
}

export async function deleteSchool(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('schools').delete().eq('id', id)
    if (error) throw error
    return true
  } catch (err) {
    console.error('deleteSchool:', err)
    return false
  }
}

export async function assignTeacherToSchool(email: string, schoolId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('admin_assign_teacher_to_school', {
      target_email: email,
      p_school_id: schoolId,
    })
    if (error) throw error
    return data === true
  } catch (err) {
    console.error('assignTeacherToSchool:', err)
    return false
  }
}

// ── Create user via admin API ────────────────────────────────

export interface CreatedUserCreds {
  email: string
  password: string
  role: string
}

export async function adminCreateUser(input: {
  email: string
  password: string     // or 'auto'
  displayName: string
  role: 'teacher' | 'teacher_pending' | 'admin' | 'student'
  schoolId?: string
}): Promise<CreatedUserCreds | { error: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (!token) return { error: 'Nicht eingeloggt' }

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    })
    const j = await res.json() as { error: string | null; credentials?: CreatedUserCreds }
    if (!res.ok || j.error) return { error: j.error ?? 'Fehler' }
    return j.credentials ?? { error: 'Keine Credentials zurückgegeben' }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

// ── Time-series + top content + school detail + user detail ──

export interface DailyPoint {
  day: string  // ISO date
  new_users: number
  new_sessions: number
  new_worlds: number
}

export async function getOverviewSeries(): Promise<DailyPoint[]> {
  try {
    const { data, error } = await supabase.rpc('get_admin_overview_series')
    if (error) throw error
    return (data ?? []) as DailyPoint[]
  } catch (err) {
    console.error('getOverviewSeries:', err)
    return []
  }
}

export interface TopWorld {
  world_id: string
  title: string
  sessions: number
  unique_users: number
}

export async function getTopWorlds(limit = 10): Promise<TopWorld[]> {
  try {
    const { data, error } = await supabase.rpc('get_top_worlds', { p_limit: limit })
    if (error) throw error
    return (data ?? []).map((r: Record<string, unknown>) => ({
      world_id:     r.out_world_id as string,
      title:        r.out_title as string,
      sessions:     Number(r.out_sessions ?? 0),
      unique_users: Number(r.out_unique_users ?? 0),
    })) as TopWorld[]
  } catch (err) {
    console.error('getTopWorlds:', err)
    return []
  }
}

export interface SchoolDetailRow {
  kind: 'teacher' | 'class'
  id: string
  name: string
  sub_info: string
  count_info: number
}

export async function getSchoolDetail(schoolId: string): Promise<SchoolDetailRow[]> {
  try {
    const { data, error } = await supabase.rpc('get_school_detail', { p_school_id: schoolId })
    if (error) throw error
    return (data ?? []) as SchoolDetailRow[]
  } catch (err) {
    console.error('getSchoolDetail:', err)
    return []
  }
}

export interface UserDetail {
  email: string
  role: string
  name: string
  school_name: string | null
  total_sessions: number
  total_worlds_created: number
  current_streak: number
  longest_streak: number
  level: number
  xp: number
  created_at: string
  last_active: string | null
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  try {
    const { data, error } = await supabase.rpc('get_user_detail', { p_user_id: userId })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    return (row ?? null) as UserDetail | null
  } catch (err) {
    console.error('getUserDetail:', err)
    return null
  }
}

// ── Audit log ─────────────────────────────────────────────────

export interface AuditEntry {
  id: number
  admin_email: string | null
  action: string
  target: string | null
  details: Record<string, unknown>
  created_at: string
}

export async function listAuditLog(limit = 100): Promise<AuditEntry[]> {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as AuditEntry[]
  } catch (err) {
    console.error('listAuditLog:', err)
    return []
  }
}

// ── App settings ──────────────────────────────────────────────

export interface AppSetting {
  key: string
  value: unknown
  updated_at: string
}

export async function listSettings(): Promise<AppSetting[]> {
  try {
    const { data, error } = await supabase.from('app_settings').select('*').order('key')
    if (error) throw error
    return (data ?? []) as AppSetting[]
  } catch (err) {
    console.error('listSettings:', err)
    return []
  }
}

export async function setSetting(key: string, value: unknown): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
    if (error) throw error
    return true
  } catch (err) {
    console.error('setSetting:', err)
    return false
  }
}

// ── Delete user (admin) ───────────────────────────────────────

export async function deleteUser(userId: string): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (!token) return false
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId }),
    })
    const j = await res.json() as { error: string | null }
    return res.ok && !j.error
  } catch (err) {
    console.error('deleteUser:', err)
    return false
  }
}

// ── CSV helper ────────────────────────────────────────────────

export function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return ''
  const keys = Object.keys(rows[0])
  const header = keys.join(',')
  const lines = rows.map((row) => keys.map((k) => {
    const v = row[k]
    if (v === null || v === undefined) return ''
    const s = String(v).replace(/"/g, '""')
    return /[,"\n]/.test(s) ? `"${s}"` : s
  }).join(','))
  return [header, ...lines].join('\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
