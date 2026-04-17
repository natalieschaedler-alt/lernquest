/**
 * TeacherDashboardPage (/lehrer/dashboard)
 *
 * Drei Tabs:
 *  - Klassen   – erstellen, Einladungslink, Schülerliste (sortierbar)
 *  - Aufgaben  – Aufgaben zuweisen mit Deadline
 *  - Fragen    – eigene Multiple-Choice-Fragen erstellen
 *
 * Zugriff: nur role === 'teacher'. Pending-Screen für 'teacher_pending'.
 */
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useTeacher } from '../../hooks/useTeacher'
import {
  getTeacherClasses,
  createClass,
  deleteClass,
  getClassStudents,
  getClassMemberCount,
  getTeacherAssignments,
  createAssignment,
  deleteAssignment,
  getTeacherQuestions,
  createCustomQuestion,
  deleteCustomQuestion,
  daysAgo,
} from '../../lib/teacherDb'
import type {
  TeacherClass,
  ClassStudent,
  TeacherAssignment,
  CustomQuestion,
} from '../../lib/teacherDb'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import BulkInviteModal from '../../components/teacher/BulkInviteModal'
import CreateStudentModal from '../../components/teacher/CreateStudentModal'

// ── Typen ─────────────────────────────────────────────────────

type Tab = 'classes' | 'assignments' | 'questions'
type StudentSort = 'activity' | 'level' | 'name'

// ── Kleine Hilfskomponenten ───────────────────────────────────

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-display text-xs text-gray-400 uppercase tracking-widest">{title}</h2>
      {action}
    </div>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-body text-xs font-semibold px-3 py-1.5 rounded-xl cursor-pointer border-none"
      style={{ background: '#6C3CE130', color: '#9B5DE5' }}
    >
      + {label}
    </button>
  )
}

function TrashButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-body text-xs text-gray-500 hover:text-red-400 transition-colors cursor-pointer border-none bg-transparent px-1"
      aria-label="Löschen"
    >
      ✕
    </button>
  )
}

const inputClass = [
  'w-full font-body text-white rounded-xl px-3 py-2.5 outline-none text-sm',
  'bg-dark border border-dark-border focus:border-[#6C3CE1] transition-colors',
].join(' ')

// ── Pending-Screen ────────────────────────────────────────────

function PendingScreen({ t }: { t: (key: string) => string }) {
  return (
    <main className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-dark-card rounded-2xl p-8 border border-dark-border text-center">
        <p className="text-5xl mb-4 select-none">⏳</p>
        <h1 className="font-display text-white text-xl mb-2">{t('teacher.pending_title')}</h1>
        <p className="font-body text-sm text-gray-400 mt-2">{t('teacher.pending_desc')}</p>
        <p className="font-body text-xs text-gray-600 mt-4">{t('teacher.pending_hint')}</p>
      </div>
    </main>
  )
}

// ── Klassen-Tab ───────────────────────────────────────────────

interface ClassesTabProps {
  teacherId: string
  t: (key: string, opts?: Record<string, unknown>) => string
}

function ClassesTab({ teacherId, t }: ClassesTabProps) {
  const [classes, setClasses]         = useState<TeacherClass[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [bulkInviteCls, setBulkInviteCls] = useState<TeacherClass | null>(null)
  const [createStudentCls, setCreateStudentCls] = useState<TeacherClass | null>(null)
  const [students, setStudents]       = useState<ClassStudent[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [sortBy, setSortBy]           = useState<StudentSort>('activity')
  const [showForm, setShowForm]       = useState(false)
  const [loading, setLoading]         = useState(true)

  // Form state
  const [fname, setFname]     = useState('')
  const [fsubject, setFsubject] = useState('')
  const [fgrade, setFgrade]   = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const cls = await getTeacherClasses(teacherId)
    setClasses(cls)
    const counts: Record<string, number> = {}
    await Promise.all(cls.map(async (c) => {
      counts[c.id] = await getClassMemberCount(c.id)
    }))
    setMemberCounts(counts)
    setLoading(false)
  }, [teacherId])

  useEffect(() => { void load() }, [load])

  const handleExpand = useCallback(async (classId: string) => {
    if (expandedId === classId) { setExpandedId(null); return }
    setExpandedId(classId)
    setStudentsLoading(true)
    const s = await getClassStudents(classId)
    setStudents(s)
    setStudentsLoading(false)
  }, [expandedId])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fname.trim() || !fsubject.trim() || !fgrade.trim()) return
    setCreating(true)
    const cls = await createClass(teacherId, fname.trim(), fsubject.trim(), fgrade.trim())
    if (cls) {
      toast.success(t('teacher.class_created'))
      setFname(''); setFsubject(''); setFgrade('')
      setShowForm(false)
      await load()
    } else {
      toast.error(t('teacher.error_generic'))
    }
    setCreating(false)
  }

  const handleDelete = async (classId: string) => {
    if (!window.confirm(t('teacher.delete_confirm'))) return
    await deleteClass(classId)
    toast(t('teacher.class_deleted'))
    if (expandedId === classId) setExpandedId(null)
    await load()
  }

  const handleCopy = (code: string) => {
    void navigator.clipboard.writeText(code)
    toast.success(t('teacher.copy_code'))
  }

  const sortedStudents = [...students].sort((a, b) => {
    if (sortBy === 'activity') {
      const da = daysAgo(a.last_active) ?? 9999
      const db = daysAgo(b.last_active) ?? 9999
      return da - db
    }
    if (sortBy === 'level') return b.level - a.level
    return a.student_name.localeCompare(b.student_name)
  })

  function lastActiveLabel(dateStr: string | null): string {
    const d = daysAgo(dateStr)
    if (d === null) return t('teacher.last_active_never')
    if (d === 0) return t('teacher.last_active_today')
    if (d === 1) return t('teacher.last_active_yesterday')
    return t('teacher.last_active_days_ago', { count: d })
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <SectionHeader
        title={t('teacher.tab_classes')}
        action={<AddButton label={t('teacher.new_class_btn')} onClick={() => setShowForm((v) => !v)} />}
      />

      {/* Create class form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            onSubmit={(e) => void handleCreate(e)}
            className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-4 flex flex-col gap-2.5"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p className="font-display text-white text-sm mb-1">{t('teacher.new_class_btn')}</p>
            <input
              value={fname} onChange={(e) => setFname(e.target.value)}
              placeholder={t('teacher.class_name')} required className={inputClass}
            />
            <input
              value={fsubject} onChange={(e) => setFsubject(e.target.value)}
              placeholder={t('teacher.class_subject')} required className={inputClass}
            />
            <input
              value={fgrade} onChange={(e) => setFgrade(e.target.value)}
              placeholder={t('teacher.class_grade')} required className={inputClass}
            />
            <button
              type="submit" disabled={creating}
              className="font-body font-semibold text-white rounded-xl py-2.5 cursor-pointer border-none text-sm mt-1"
              style={{ background: '#6C3CE1', opacity: creating ? 0.7 : 1 }}
            >
              {creating ? '…' : t('teacher.create_class_btn')}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Class list */}
      {classes.length === 0 ? (
        <p className="font-body text-sm text-gray-500 text-center py-10">{t('teacher.no_classes')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {classes.map((cls) => (
            <div key={cls.id} className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
              {/* Card header */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-white text-base leading-tight">{cls.name}</p>
                    <p className="font-body text-xs text-gray-400 mt-0.5">
                      {cls.subject} · {t('teacher.grade_label')} {cls.grade}
                    </p>
                  </div>
                  <TrashButton onClick={() => void handleDelete(cls.id)} />
                </div>

                {/* Invite code row */}
                <div className="flex items-center gap-2 mt-3 p-2.5 rounded-xl" style={{ background: 'rgba(108,60,225,0.12)' }}>
                  <p className="font-body text-xs text-gray-400 shrink-0">{t('teacher.invite_code_label')}:</p>
                  <p className="font-display text-white text-base tracking-widest flex-1">{cls.invite_code}</p>
                  <button
                    type="button"
                    onClick={() => handleCopy(cls.invite_code)}
                    className="font-body text-xs text-purple-400 hover:text-white transition-colors cursor-pointer border-none bg-transparent whitespace-nowrap"
                  >
                    📋 {t('teacher.copy_btn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateStudentCls(cls)}
                    className="font-body text-xs text-purple-400 hover:text-white transition-colors cursor-pointer border-none bg-transparent whitespace-nowrap"
                  >
                    + Schüler
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkInviteCls(cls)}
                    className="font-body text-xs text-purple-400 hover:text-white transition-colors cursor-pointer border-none bg-transparent whitespace-nowrap"
                  >
                    📋 Liste
                  </button>
                </div>

                <p className="font-body text-xs text-gray-500 mt-2">
                  {t('teacher.students_count', { count: memberCounts[cls.id] ?? 0 })}
                </p>

                {/* Expand toggle */}
                <button
                  type="button"
                  onClick={() => void handleExpand(cls.id)}
                  className="font-body text-xs mt-2 cursor-pointer border-none bg-transparent transition-colors"
                  style={{ color: '#6C3CE1' }}
                >
                  {expandedId === cls.id ? '▲ ' : '▼ '}
                  {t('teacher.show_students')}
                </button>
              </div>

              {/* Students panel */}
              <AnimatePresence>
                {expandedId === cls.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-dark-border"
                  >
                    <div className="p-4">
                      {studentsLoading ? (
                        <div className="flex justify-center py-4">
                          <motion.span
                            className="inline-block w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                          />
                        </div>
                      ) : sortedStudents.length === 0 ? (
                        <p className="font-body text-xs text-gray-500 text-center py-2">
                          {t('teacher.no_students')}
                        </p>
                      ) : (
                        <>
                          {/* Sort bar */}
                          <div className="flex gap-2 mb-3 flex-wrap">
                            <span className="font-body text-xs text-gray-500 self-center mr-1">
                              {t('teacher.sort_label')}:
                            </span>
                            {(['activity', 'level', 'name'] as StudentSort[]).map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setSortBy(s)}
                                className="font-body text-xs px-2 py-1 rounded-lg cursor-pointer border-none transition-colors"
                                style={{
                                  background: sortBy === s ? '#6C3CE1' : '#1A1A2E',
                                  color: sortBy === s ? '#fff' : 'rgba(255,255,255,0.45)',
                                }}
                              >
                                {t(`teacher.sort_${s}`)}
                              </button>
                            ))}
                          </div>

                          {/* Student rows */}
                          <div className="flex flex-col gap-2">
                            {sortedStudents.map((s) => (
                              <div
                                key={s.student_id}
                                className="flex items-center gap-3 py-2 px-3 rounded-xl"
                                style={{ background: 'rgba(255,255,255,0.03)' }}
                              >
                                <div
                                  className="w-7 h-7 rounded-full flex items-center justify-center font-display text-xs text-white shrink-0"
                                  style={{ background: '#6C3CE1' }}
                                >
                                  {s.student_name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-body text-white text-sm truncate">{s.student_name}</p>
                                  <p className="font-body text-xs text-gray-500">
                                    {lastActiveLabel(s.last_active)}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-body text-xs text-white">
                                    {t('teacher.student_level', { level: s.level })}
                                  </p>
                                  <p className="font-body text-xs" style={{ color: '#FF9500' }}>
                                    🔥 {s.streak}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Invite code hint */}
      {classes.length > 0 && (
        <p className="font-body text-xs text-gray-600 text-center mt-4">
          {t('teacher.invite_code_hint')}
        </p>
      )}

      {/* Bulk invite modal */}
      {bulkInviteCls && (
        <BulkInviteModal
          cls={bulkInviteCls}
          open={!!bulkInviteCls}
          onClose={() => setBulkInviteCls(null)}
        />
      )}

      {/* Create single student modal */}
      {createStudentCls && (
        <CreateStudentModal
          cls={createStudentCls}
          open={!!createStudentCls}
          onClose={() => setCreateStudentCls(null)}
          onCreated={() => {
            // Refresh member count
            getClassMemberCount(createStudentCls.id).then((n) => {
              setMemberCounts((prev) => ({ ...prev, [createStudentCls.id]: n }))
            })
          }}
        />
      )}
    </div>
  )
}

// ── Aufgaben-Tab ──────────────────────────────────────────────

interface AssignmentsTabProps {
  teacherId: string
  classes: TeacherClass[]
  t: (key: string, opts?: Record<string, unknown>) => string
}

function AssignmentsTab({ teacherId, classes, t }: AssignmentsTabProps) {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [creating, setCreating]       = useState(false)

  // Form state
  const [fclass, setFclass]     = useState('')
  const [ftitle, setFtitle]     = useState('')
  const [ftopic, setFtopic]     = useState('')
  const [ftype, setFtype]       = useState('dungeon')
  const [fdeadline, setFdeadline] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const rows = await getTeacherAssignments(teacherId)
    setAssignments(rows)
    setLoading(false)
  }, [teacherId])

  useEffect(() => { void load() }, [load])

  // Pre-select first class
  useEffect(() => {
    if (classes.length > 0 && !fclass) setFclass(classes[0].id)
  }, [classes, fclass])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fclass || !ftitle.trim() || !ftopic.trim()) return
    setCreating(true)
    const a = await createAssignment(
      teacherId, fclass,
      ftitle.trim(), ftopic.trim(), ftype,
      fdeadline ? new Date(fdeadline).toISOString() : null,
    )
    if (a) {
      toast.success(t('teacher.assignment_created'))
      setFtitle(''); setFtopic(''); setFdeadline('')
      setShowForm(false)
      await load()
    } else {
      toast.error(t('teacher.error_generic'))
    }
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('teacher.delete_confirm'))) return
    await deleteAssignment(id)
    toast(t('teacher.assignment_deleted'))
    await load()
  }

  const classMap: Record<string, string> = {}
  for (const c of classes) classMap[c.id] = c.name

  function deadlineLabel(dl: string | null): string | null {
    if (!dl) return null
    const d = new Date(dl)
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <SectionHeader
        title={t('teacher.tab_assignments')}
        action={
          classes.length > 0
            ? <AddButton label={t('teacher.new_assignment_btn')} onClick={() => setShowForm((v) => !v)} />
            : undefined
        }
      />

      {classes.length === 0 && (
        <p className="font-body text-sm text-gray-500 text-center py-6">
          {t('teacher.assignments_need_class')}
        </p>
      )}

      {/* Create form */}
      <AnimatePresence>
        {showForm && classes.length > 0 && (
          <motion.form
            onSubmit={(e) => void handleCreate(e)}
            className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-4 flex flex-col gap-2.5"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <p className="font-display text-white text-sm mb-1">{t('teacher.new_assignment_btn')}</p>

            <select
              value={fclass} onChange={(e) => setFclass(e.target.value)}
              className={inputClass} required
              style={{ background: '#0d0d1a' }}
            >
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name} – {c.subject}</option>)}
            </select>

            <input
              value={ftitle} onChange={(e) => setFtitle(e.target.value)}
              placeholder={t('teacher.assignment_title')} required className={inputClass}
            />
            <input
              value={ftopic} onChange={(e) => setFtopic(e.target.value)}
              placeholder={t('teacher.assignment_topic')} required className={inputClass}
            />

            <select
              value={ftype} onChange={(e) => setFtype(e.target.value)}
              className={inputClass}
              style={{ background: '#0d0d1a' }}
            >
              <option value="dungeon">{t('teacher.assignment_type_dungeon')}</option>
              <option value="boss">{t('teacher.assignment_type_boss')}</option>
              <option value="review">{t('teacher.assignment_type_review')}</option>
            </select>

            <input
              type="datetime-local"
              value={fdeadline} onChange={(e) => setFdeadline(e.target.value)}
              className={inputClass}
              style={{ colorScheme: 'dark' }}
            />

            <button
              type="submit" disabled={creating}
              className="font-body font-semibold text-white rounded-xl py-2.5 cursor-pointer border-none text-sm mt-1"
              style={{ background: '#6C3CE1', opacity: creating ? 0.7 : 1 }}
            >
              {creating ? '…' : t('teacher.create_assignment_btn')}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Assignment list */}
      {assignments.length === 0 && classes.length > 0 ? (
        <p className="font-body text-sm text-gray-500 text-center py-10">{t('teacher.no_assignments')}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {assignments.map((a) => {
            const dl = deadlineLabel(a.deadline)
            const typeLabel = t(`teacher.assignment_type_${a.dungeon_type}`) || a.dungeon_type
            return (
              <div
                key={a.id}
                className="bg-dark-card border border-dark-border rounded-2xl p-4 flex items-start gap-3"
              >
                <div className="text-xl select-none mt-0.5">
                  {a.dungeon_type === 'boss' ? '⚔️' : a.dungeon_type === 'review' ? '🔄' : '🏰'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body font-semibold text-white text-sm">{a.title}</p>
                  <p className="font-body text-xs text-gray-400 mt-0.5">
                    {classMap[a.class_id] ?? '–'} · {a.topic} · {typeLabel}
                  </p>
                  {dl && (
                    <p className="font-body text-xs mt-1" style={{ color: '#F59E0B' }}>
                      📅 {t('teacher.assignment_due', { date: dl })}
                    </p>
                  )}
                </div>
                <TrashButton onClick={() => void handleDelete(a.id)} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Fragen-Tab ────────────────────────────────────────────────

interface QuestionsTabProps {
  teacherId: string
  classes: TeacherClass[]
  t: (key: string, opts?: Record<string, unknown>) => string
}

function QuestionsTab({ teacherId, classes, t }: QuestionsTabProps) {
  const [questions, setQuestions] = useState<CustomQuestion[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [creating, setCreating]   = useState(false)

  // Form state
  const [fclass, setFclass]           = useState('')
  const [fquestion, setFquestion]     = useState('')
  const [foptions, setFoptions]       = useState(['', '', '', ''])
  const [fcorrect, setFcorrect]       = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const rows = await getTeacherQuestions(teacherId)
    setQuestions(rows)
    setLoading(false)
  }, [teacherId])

  useEffect(() => { void load() }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fquestion.trim() || foptions.some((o) => !o.trim())) {
      toast.error(t('teacher.error_fields_required'))
      return
    }
    setCreating(true)
    const q = await createCustomQuestion(
      teacherId, fclass || null,
      fquestion.trim(), foptions.map((o) => o.trim()), fcorrect,
    )
    if (q) {
      toast.success(t('teacher.question_created'))
      setFquestion(''); setFoptions(['', '', '', '']); setFcorrect(0); setFclass('')
      setShowForm(false)
      await load()
    } else {
      toast.error(t('teacher.error_generic'))
    }
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('teacher.delete_confirm'))) return
    await deleteCustomQuestion(id)
    toast(t('teacher.question_deleted'))
    await load()
  }

  const classMap: Record<string, string> = {}
  for (const c of classes) classMap[c.id] = c.name

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <SectionHeader
        title={t('teacher.tab_questions')}
        action={<AddButton label={t('teacher.new_question_btn')} onClick={() => setShowForm((v) => !v)} />}
      />

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            onSubmit={(e) => void handleCreate(e)}
            className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-4 flex flex-col gap-2.5"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <p className="font-display text-white text-sm mb-1">{t('teacher.new_question_btn')}</p>

            <textarea
              value={fquestion}
              onChange={(e) => setFquestion(e.target.value)}
              placeholder={t('teacher.question_text')}
              required
              rows={2}
              className={`${inputClass} resize-none`}
            />

            {foptions.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={fcorrect === idx}
                  onChange={() => setFcorrect(idx)}
                  className="accent-[#6C3CE1] cursor-pointer shrink-0"
                />
                <input
                  value={opt}
                  onChange={(e) => {
                    const next = [...foptions]; next[idx] = e.target.value; setFoptions(next)
                  }}
                  placeholder={t('teacher.question_option', { n: idx + 1 })}
                  required
                  className={`${inputClass} flex-1`}
                />
              </div>
            ))}

            <p className="font-body text-xs text-gray-500">{t('teacher.question_correct_hint')}</p>

            {classes.length > 0 && (
              <select
                value={fclass} onChange={(e) => setFclass(e.target.value)}
                className={inputClass}
                style={{ background: '#0d0d1a' }}
              >
                <option value="">{t('teacher.question_no_class')}</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}

            <button
              type="submit" disabled={creating}
              className="font-body font-semibold text-white rounded-xl py-2.5 cursor-pointer border-none text-sm mt-1"
              style={{ background: '#6C3CE1', opacity: creating ? 0.7 : 1 }}
            >
              {creating ? '…' : t('teacher.create_question_btn')}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Question list */}
      {questions.length === 0 ? (
        <p className="font-body text-sm text-gray-500 text-center py-10">{t('teacher.no_questions')}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {questions.map((q) => (
            <div key={q.id} className="bg-dark-card border border-dark-border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-body text-white text-sm flex-1">{q.question}</p>
                <TrashButton onClick={() => void handleDelete(q.id)} />
              </div>
              <div className="mt-2 flex flex-col gap-1">
                {q.options.map((opt, idx) => (
                  <p key={idx} className="font-body text-xs" style={{
                    color: idx === q.correct_index ? '#00C896' : 'rgba(255,255,255,0.45)',
                  }}>
                    {idx === q.correct_index ? '✓ ' : '○ '}{opt}
                  </p>
                ))}
              </div>
              {q.class_id && classMap[q.class_id] && (
                <p className="font-body text-xs text-gray-600 mt-2">{classMap[q.class_id]}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────

export default function TeacherDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, loading, isTeacher, isPending } = useTeacher()

  const [activeTab, setActiveTab]   = useState<Tab>('classes')
  const [classes, setClasses]       = useState<TeacherClass[]>([])

  // Redirect if not authenticated
  useEffect(() => {
    if (loading) return
    if (!user) navigate('/lehrer/registrieren', { replace: true })
  }, [loading, user, navigate])

  // Load classes for shared use in Assignments and Questions tabs
  const loadClasses = useCallback(async () => {
    if (!user) return
    const cls = await getTeacherClasses(user.id)
    setClasses(cls)
  }, [user])

  useEffect(() => {
    if (isTeacher) void loadClasses()
  }, [isTeacher, loadClasses])

  const handleSignOut = () => {
    void (async () => {
      const { supabase: sb } = await import('../../lib/supabase')
      await sb.auth.signOut()
      navigate('/lehrer/registrieren', { replace: true })
    })()
  }

  if (loading) return <LoadingSpinner />
  if (isPending) return <PendingScreen t={t as (k: string) => string} />
  if (!isTeacher || !user) return null

  const TABS: { id: Tab; label: string }[] = [
    { id: 'classes',     label: t('teacher.tab_classes') },
    { id: 'assignments', label: t('teacher.tab_assignments') },
    { id: 'questions',   label: t('teacher.tab_questions') },
  ]

  return (
    <main
      className="min-h-screen bg-dark text-white flex flex-col px-4 pb-12"
      style={{ maxWidth: '600px', margin: '0 auto' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between pt-8 pb-5">
        <div>
          <p className="font-body text-xs text-gray-500 uppercase tracking-wider">{t('teacher.dashboard_title')}</p>
          <h1 className="font-display text-white text-xl leading-tight mt-0.5">
            {profile?.name ?? t('teacher.teacher_default_name')}
          </h1>
          {profile?.school && (
            <p className="font-body text-xs text-gray-400 mt-0.5">🏫 {profile.school}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="font-body text-xs text-gray-500 hover:text-white transition-colors cursor-pointer border border-dark-border rounded-lg px-3 py-1.5 bg-transparent mt-1"
        >
          {t('teacher.sign_out')}
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-dark-card rounded-2xl p-1 border border-dark-border mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 font-body text-sm py-2 rounded-xl cursor-pointer border-none transition-all"
            style={{
              background: activeTab === tab.id ? '#6C3CE1' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.45)',
              fontWeight: activeTab === tab.id ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'classes' && (
            <ClassesTab
              teacherId={user.id}
              t={t as (key: string, opts?: Record<string, unknown>) => string}
            />
          )}
          {activeTab === 'assignments' && (
            <AssignmentsTab
              teacherId={user.id}
              classes={classes}
              t={t as (key: string, opts?: Record<string, unknown>) => string}
            />
          )}
          {activeTab === 'questions' && (
            <QuestionsTab
              teacherId={user.id}
              classes={classes}
              t={t as (key: string, opts?: Record<string, unknown>) => string}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  )
}
