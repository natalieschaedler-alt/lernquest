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
    return (data ?? []) as SchoolRow[]
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
