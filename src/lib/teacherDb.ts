/**
 * teacherDb – Supabase-Hilfsfunktionen für den Lehrer-Bereich.
 *
 * Alle Funktionen sind "fire and forget"-freundlich:
 *  - Fehler werden geloggt, aber nicht re-thrown (Caller prüft Rückgabe)
 *  - Leere Arrays / null als sichere Fallback-Werte
 */
import { supabase } from './supabase'

// ── Typen ─────────────────────────────────────────────────────

export interface TeacherProfile {
  id: string
  name: string
  school: string | null
  subjects: string | null
  role: 'student' | 'teacher_pending' | 'teacher' | 'admin'
}

export interface TeacherClass {
  id: string
  teacher_id: string
  name: string
  subject: string
  grade: string
  invite_code: string
  created_at: string
}

export interface ClassStudent {
  student_id: string
  student_name: string
  level: number
  streak: number
  last_active: string | null
  total_sessions: number
}

export interface TeacherAssignment {
  id: string
  class_id: string
  teacher_id: string
  title: string
  topic: string
  dungeon_type: string
  deadline: string | null
  created_at: string
}

export interface CustomQuestion {
  id: string
  teacher_id: string
  class_id: string | null
  question: string
  options: string[]
  correct_index: number
  created_at: string
}

// Student-side: Aufgaben die Schüler sehen
export interface StudentAssignment {
  id: string
  title: string
  topic: string
  dungeon_type: string
  deadline: string | null
  class_name: string
  created_at: string
}

// ── Hilfsfunktionen ───────────────────────────────────────────

/** 6-stelliger Einladungscode ohne verwechselbare Zeichen */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}
export { daysAgo }

// ── Profil ────────────────────────────────────────────────────

export async function getTeacherProfile(userId: string): Promise<TeacherProfile | null> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, school, subjects, role')
      .eq('id', userId)
      .maybeSingle()
    return data as TeacherProfile | null
  } catch (err) {
    console.error('getTeacherProfile:', err)
    return null
  }
}

/** Setzt Lehrer-spezifische Profilfelder nach der Registrierung */
export async function updateTeacherProfile(
  userId: string,
  name: string,
  school: string,
  subjects: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, name, school, subjects, role: 'teacher_pending' })
    if (error) throw error
  } catch (err) {
    console.error('updateTeacherProfile:', err)
  }
}

// ── Klassen ───────────────────────────────────────────────────

export async function getTeacherClasses(teacherId: string): Promise<TeacherClass[]> {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as TeacherClass[]
  } catch (err) {
    console.error('getTeacherClasses:', err)
    return []
  }
}

export async function createClass(
  teacherId: string,
  name: string,
  subject: string,
  grade: string,
): Promise<TeacherClass | null> {
  try {
    const inviteCode = generateInviteCode()
    const { data, error } = await supabase
      .from('classes')
      .insert({ teacher_id: teacherId, name, subject, grade, invite_code: inviteCode })
      .select()
      .single()
    if (error) throw error
    return data as TeacherClass
  } catch (err) {
    console.error('createClass:', err)
    return null
  }
}

export async function deleteClass(classId: string): Promise<void> {
  try {
    const { error } = await supabase.from('classes').delete().eq('id', classId)
    if (error) throw error
  } catch (err) {
    console.error('deleteClass:', err)
  }
}

// ── Schüler ───────────────────────────────────────────────────

/** Lädt Schüler-Statistiken via SECURITY DEFINER Funktion */
export async function getClassStudents(classId: string): Promise<ClassStudent[]> {
  try {
    const { data, error } = await supabase.rpc('get_class_students', { p_class_id: classId })
    if (error) throw error
    return (data ?? []) as ClassStudent[]
  } catch (err) {
    console.error('getClassStudents:', err)
    return []
  }
}

/** Zählt Schüler einer Klasse (schnell, ohne Profil-Join) */
export async function getClassMemberCount(classId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from('class_members')
      .select('student_id', { count: 'exact', head: true })
      .eq('class_id', classId)
    return count ?? 0
  } catch {
    return 0
  }
}

// ── Aufgaben (Lehrer) ─────────────────────────────────────────

export async function getTeacherAssignments(teacherId: string): Promise<TeacherAssignment[]> {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as TeacherAssignment[]
  } catch (err) {
    console.error('getTeacherAssignments:', err)
    return []
  }
}

export async function createAssignment(
  teacherId: string,
  classId: string,
  title: string,
  topic: string,
  dungeonType: string,
  deadline: string | null,
): Promise<TeacherAssignment | null> {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .insert({ teacher_id: teacherId, class_id: classId, title, topic, dungeon_type: dungeonType, deadline: deadline || null })
      .select()
      .single()
    if (error) throw error
    return data as TeacherAssignment
  } catch (err) {
    console.error('createAssignment:', err)
    return null
  }
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  try {
    const { error } = await supabase.from('assignments').delete().eq('id', assignmentId)
    if (error) throw error
  } catch (err) {
    console.error('deleteAssignment:', err)
  }
}

// ── Eigene Fragen (Lehrer) ────────────────────────────────────

export async function getTeacherQuestions(teacherId: string): Promise<CustomQuestion[]> {
  try {
    const { data, error } = await supabase
      .from('custom_questions')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as CustomQuestion[]
  } catch (err) {
    console.error('getTeacherQuestions:', err)
    return []
  }
}

export async function createCustomQuestion(
  teacherId: string,
  classId: string | null,
  question: string,
  options: string[],
  correctIndex: number,
): Promise<CustomQuestion | null> {
  try {
    const { data, error } = await supabase
      .from('custom_questions')
      .insert({ teacher_id: teacherId, class_id: classId || null, question, options, correct_index: correctIndex })
      .select()
      .single()
    if (error) throw error
    return data as CustomQuestion
  } catch (err) {
    console.error('createCustomQuestion:', err)
    return null
  }
}

export async function deleteCustomQuestion(questionId: string): Promise<void> {
  try {
    const { error } = await supabase.from('custom_questions').delete().eq('id', questionId)
    if (error) throw error
  } catch (err) {
    console.error('deleteCustomQuestion:', err)
  }
}

// ── Schüler-Seite ─────────────────────────────────────────────

/** Lädt Aufgaben für einen Schüler aus allen seinen Klassen */
export async function getStudentAssignments(studentId: string): Promise<StudentAssignment[]> {
  try {
    // Eigene Klassen-IDs laden
    const { data: memberRows } = await supabase
      .from('class_members')
      .select('class_id')
      .eq('student_id', studentId)

    const classIds = (memberRows ?? []).map((r) => r.class_id as string)
    if (classIds.length === 0) return []

    // Aufgaben laden (RLS erlaubt Schülern den Zugriff via class_members)
    const { data: rows } = await supabase
      .from('assignments')
      .select('id, title, topic, dungeon_type, deadline, created_at, class_id')
      .in('class_id', classIds)
      .order('deadline', { ascending: true, nullsFirst: false })

    if (!rows) return []

    // Klassen-Namen laden
    const { data: classes } = await supabase
      .from('classes')
      .select('id, name')
      .in('id', classIds)

    const classMap: Record<string, string> = {}
    for (const cls of classes ?? []) {
      classMap[cls.id as string] = cls.name as string
    }

    return rows.map((r) => ({
      id:           r.id as string,
      title:        r.title as string,
      topic:        r.topic as string,
      dungeon_type: r.dungeon_type as string,
      deadline:     r.deadline as string | null,
      class_name:   classMap[r.class_id as string] ?? '',
      created_at:   r.created_at as string,
    }))
  } catch (err) {
    console.error('getStudentAssignments:', err)
    return []
  }
}

/** Schüler tritt einer Klasse per Einladungscode bei */
export async function joinClassByCode(
  code: string,
): Promise<{ ok: boolean; class_name?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('join_class_by_code', {
      p_code: code.toUpperCase().trim(),
    })
    if (error) throw error
    return data as { ok: boolean; class_name?: string; error?: string }
  } catch (err) {
    console.error('joinClassByCode:', err)
    return { ok: false, error: 'generic' }
  }
}
