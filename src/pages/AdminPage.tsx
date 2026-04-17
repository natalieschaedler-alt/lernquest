/**
 * AdminPage – Vollständige Admin-Konsole mit 7 Tabs.
 * Zugriff nur für profiles.role = 'admin'.
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { useTeacher } from '../hooks/useTeacher'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import {
  getAdminStats, listUsers, approveTeacher, rejectTeacher, setRoleByEmail,
  listSchools, createSchool, deleteSchool, assignTeacherToSchool,
  adminCreateUser, getOverviewSeries, getTopWorlds, getSchoolDetail,
  getUserDetail, listAuditLog, listSettings, setSetting, deleteUser,
  toCsv, downloadCsv,
  type AdminStats, type AdminUserRow, type SchoolRow, type DailyPoint,
  type TopWorld, type SchoolDetailRow, type UserDetail, type AuditEntry,
  type AppSetting,
} from '../lib/adminDb'

type TabKey = 'overview' | 'users' | 'teachers' | 'schools' | 'content' | 'audit' | 'settings'

const ROLE_LABEL: Record<string, string> = {
  student: 'Schüler', teacher_pending: 'Lehrer (wartet)', teacher: 'Lehrer', admin: 'Admin',
}
const ROLE_COLOR: Record<string, string> = {
  student: '#3B82F6', teacher_pending: '#F59E0B', teacher: '#00C896', admin: '#FFD700',
}

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'overview', label: 'Übersicht',  icon: '📊' },
  { key: 'users',    label: 'User',       icon: '👥' },
  { key: 'teachers', label: 'Lehrer',     icon: '👨‍🏫' },
  { key: 'schools',  label: 'Schulen',    icon: '🏫' },
  { key: 'content',  label: 'Content',    icon: '🌍' },
  { key: 'audit',    label: 'Audit-Log',  icon: '📝' },
  { key: 'settings', label: 'Einst.',     icon: '⚙️' },
]

export default function AdminPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { isAdmin, loading: roleLoading } = useTeacher()
  const [tab, setTab] = useState<TabKey>('overview')

  useEffect(() => {
    if (authLoading || roleLoading) return
    if (!user)      { void navigate('/auth', { replace: true }); return }
    if (!isAdmin)   { toast.error('Kein Admin-Zugriff.'); void navigate('/dashboard', { replace: true }) }
  }, [user, isAdmin, authLoading, roleLoading, navigate])

  if (authLoading || roleLoading) return <LoadingSpinner />
  if (!isAdmin) return null

  return (
    <main className="min-h-screen bg-dark px-4 py-6 text-white">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl" style={{ color: '#FFD700' }}>⚡ Admin-Konsole</h1>
            <p className="font-body text-xs text-white/40 mt-1">Eingeloggt als {user?.email}</p>
          </div>
          <button
            onClick={() => void navigate('/dashboard')}
            className="font-body text-sm px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
          >
            ← Zurück
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 font-body font-semibold text-sm px-4 py-2 rounded-xl transition ${
                tab === t.key ? 'text-black' : 'text-white/60 bg-white/5 border border-white/10 hover:text-white'
              }`}
              style={tab === t.key ? { background: '#FFD700' } : {}}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {tab === 'overview'  && <OverviewTab />}
            {tab === 'users'     && <UsersTab />}
            {tab === 'teachers'  && <TeachersTab />}
            {tab === 'schools'   && <SchoolsTab />}
            {tab === 'content'   && <ContentTab />}
            {tab === 'audit'     && <AuditTab />}
            {tab === 'settings'  && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  )
}

// ──────────────────────────────────────────────────────────────
// TAB: OVERVIEW
// ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const [stats, setStats]   = useState<AdminStats | null>(null)
  const [series, setSeries] = useState<DailyPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const [s, sr] = await Promise.all([getAdminStats(), getOverviewSeries()])
      setStats(s); setSeries(sr); setLoading(false)
    })()
  }, [])

  if (loading) return <p className="text-white/40 text-center py-8">Lade…</p>

  const maxSessions = Math.max(1, ...series.map((d) => d.new_sessions))
  const maxUsers    = Math.max(1, ...series.map((d) => d.new_users))

  return (
    <>
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="User gesamt"    value={stats?.total_users ?? 0} />
        <StatCard label="Aktive Lehrer"   value={stats?.active_teachers ?? 0} color="#00C896" />
        <StatCard label="Lehrer-Anträge"  value={stats?.pending_teachers ?? 0} color="#F59E0B" />
        <StatCard label="Schüler"         value={stats?.students ?? 0} color="#3B82F6" />
        <StatCard label="Welten gesamt"   value={stats?.total_worlds ?? 0} />
        <StatCard label="Welten 24h"      value={stats?.worlds_last_24h ?? 0} color="#EC4899" />
        <StatCard label="Sessions 7d"     value={stats?.sessions_last_7d ?? 0} color="#6C3CE1" />
        <StatCard label="Admin-Mode"      value="ON" color="#FFD700" />
      </section>

      {/* Time-series charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <MiniChart title="Neue User / Tag (30d)"    data={series.map((d) => ({ day: d.day, v: d.new_users }))}    max={maxUsers}    color="#3B82F6" />
        <MiniChart title="Sessions / Tag (30d)"     data={series.map((d) => ({ day: d.day, v: d.new_sessions }))} max={maxSessions} color="#6C3CE1" />
      </div>
    </>
  )
}

function StatCard({ label, value, color = '#fff' }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-dark-card rounded-2xl p-4 border border-dark-border">
      <p className="font-body text-xs text-white/40 uppercase tracking-wide mb-1">{label}</p>
      <p className="font-display text-2xl" style={{ color }}>{value}</p>
    </div>
  )
}

function MiniChart({ title, data, max, color }: { title: string; data: Array<{ day: string; v: number }>; max: number; color: string }) {
  return (
    <div className="bg-dark-card rounded-2xl p-4 border border-dark-border">
      <p className="font-body text-xs text-white/50 uppercase tracking-wide mb-2">{title}</p>
      <div className="flex items-end gap-[2px]" style={{ height: 80 }}>
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{
              height: `${(d.v / max) * 100}%`,
              minHeight: d.v > 0 ? 2 : 0,
              background: color,
              opacity: 0.3 + 0.7 * (d.v / max),
            }}
            title={`${d.day}: ${d.v}`}
          />
        ))}
      </div>
      <p className="font-body text-[10px] text-white/30 mt-1">Total: {data.reduce((s, d) => s + d.v, 0)}</p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// TAB: USERS
// ──────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [filter, setFilter] = useState('')
  const [query, setQuery]   = useState('')
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailUser, setDetailUser] = useState<AdminUserRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const u = await listUsers(filter ? { role: filter } : {})
    setUsers(u); setLoading(false)
  }, [filter])

  useEffect(() => { void load() }, [load])

  const filtered = users.filter((u) =>
    !query.trim() || (u.name?.toLowerCase().includes(query.toLowerCase()) ?? false)
  )

  const handleExport = () => {
    const csv = toCsv(filtered.map((u) => ({
      id: u.id, name: u.name ?? '', role: u.role, school: u.school ?? '', created_at: u.created_at,
    })))
    downloadCsv(`users-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  return (
    <>
      <section className="bg-dark-card rounded-2xl p-5 border border-dark-border">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4">
          <h2 className="font-display text-lg">👥 Alle User ({filtered.length})</h2>
          <div className="flex gap-2 flex-wrap">
            <select
              value={filter} onChange={(e) => setFilter(e.target.value)}
              className="font-body text-white rounded-xl px-3 py-2 outline-none"
              style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: 13 }}
            >
              <option value="">Alle Rollen</option>
              <option value="student">Schüler</option>
              <option value="teacher_pending">Lehrer (wartet)</option>
              <option value="teacher">Lehrer</option>
              <option value="admin">Admin</option>
            </select>
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Suchen…"
              className="font-body text-white rounded-xl px-3 py-2 outline-none"
              style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: 13, minWidth: 160 }}
            />
            <button onClick={handleExport} className="font-body text-sm px-3 py-2 rounded-xl bg-white/5 border border-white/10">⬇ CSV</button>
            <button
              onClick={() => setCreateOpen(true)}
              className="font-body text-sm px-4 py-2 rounded-xl text-white border-none"
              style={{ background: '#00C896' }}
            >+ User</button>
          </div>
        </div>

        {loading ? (
          <p className="text-white/40 text-center py-8">Lade…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead className="text-white/50 text-xs uppercase">
                <tr className="text-left">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Rolle</th>
                  <th className="py-2 pr-3">Schule</th>
                  <th className="py-2 pr-3">Erstellt</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-t border-white/5">
                    <td className="py-2 pr-3">{u.name ?? <em className="text-white/30">(kein Name)</em>}</td>
                    <td className="py-2 pr-3">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ background: ROLE_COLOR[u.role] + '25', color: ROLE_COLOR[u.role] }}
                      >
                        {ROLE_LABEL[u.role]}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-white/60">{u.school ?? '—'}</td>
                    <td className="py-2 pr-3 text-white/40 text-xs">{new Date(u.created_at).toLocaleDateString('de-DE')}</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => setDetailUser(u)}
                        className="text-xs text-purple-400 hover:text-white"
                      >Details →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {createOpen && <CreateUserModal onClose={() => { setCreateOpen(false); void load() }} />}
      {detailUser && <UserDetailModal u={detailUser} onClose={() => setDetailUser(null)} onDeleted={() => { setDetailUser(null); void load() }} />}
    </>
  )
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [name, setName]   = useState('')
  const [role, setRole]   = useState<'teacher' | 'admin' | 'student'>('teacher')
  const [password, setPassword] = useState('')
  const [autoPass, setAutoPass] = useState(true)
  const [loading, setLoading]   = useState(false)
  const [created, setCreated]   = useState<{ email: string; password: string; role: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await adminCreateUser({
      email: email.trim(), password: autoPass ? 'auto' : password,
      displayName: name.trim(), role,
    })
    setLoading(false)
    if ('error' in res) { toast.error(res.error); return }
    setCreated(res)
    toast.success('User angelegt')
  }

  return (
    <ModalShell onClose={onClose} title={created ? '✓ User erstellt' : '+ User anlegen'}>
      {!created ? (
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
          <input type="email" placeholder="email@schule.de" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full font-body text-white rounded-xl px-4 py-2.5 outline-none" style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: 14 }} />
          <input type="text" placeholder="Name" required value={name} onChange={(e) => setName(e.target.value)}
            className="w-full font-body text-white rounded-xl px-4 py-2.5 outline-none" style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: 14 }} />
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}
            className="w-full font-body text-white rounded-xl px-4 py-2.5 outline-none" style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: 14 }}>
            <option value="teacher">Lehrer (direkt aktiv)</option>
            <option value="student">Schüler (mit Email)</option>
            <option value="admin">Admin</option>
          </select>
          <label className="font-body text-xs text-white/60 flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={autoPass} onChange={(e) => setAutoPass(e.target.checked)} />
            Passwort automatisch generieren
          </label>
          {!autoPass && (
            <input type="text" placeholder="Passwort (≥8 Zeichen)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8}
              className="w-full font-mono text-white rounded-xl px-4 py-2.5 outline-none" style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: 14 }} />
          )}
          <button type="submit" disabled={loading} className="mt-2 font-body font-semibold text-white rounded-xl py-3 border-none disabled:opacity-40" style={{ background: '#00C896' }}>
            {loading ? 'Lege an…' : 'Erstellen'}
          </button>
        </form>
      ) : (
        <div>
          <p className="font-body text-sm text-green-400 mb-3">✓ {ROLE_LABEL[created.role]} angelegt</p>
          <div className="rounded-xl p-4 bg-white/5 border border-white/10 space-y-2 font-body">
            <p className="text-xs text-white/50 uppercase">Email</p>
            <p className="font-mono text-sm">{created.email}</p>
            <p className="text-xs text-white/50 uppercase mt-2">Passwort</p>
            <p className="font-mono text-sm font-bold" style={{ color: '#FFD700' }}>{created.password}</p>
          </div>
          <button onClick={async () => { await navigator.clipboard.writeText(`${created.email} / ${created.password}`); toast.success('Kopiert') }}
            className="mt-3 w-full font-body text-sm py-2.5 rounded-xl bg-white/5 border border-white/10">📋 Kopieren</button>
          <button onClick={onClose} className="mt-2 w-full font-body text-sm py-2.5 rounded-xl" style={{ background: '#6C3CE1' }}>Fertig</button>
        </div>
      )}
    </ModalShell>
  )
}

function UserDetailModal({ u, onClose, onDeleted }: { u: AdminUserRow; onClose: () => void; onDeleted: () => void }) {
  const [detail, setDetail] = useState<UserDetail | null>(null)

  useEffect(() => { void getUserDetail(u.id).then(setDetail) }, [u.id])

  const handleDelete = async () => {
    if (!window.confirm(`User "${u.name ?? u.id}" wirklich löschen? Alle Daten gehen verloren.`)) return
    const ok = await deleteUser(u.id)
    if (ok) { toast.success('User gelöscht'); onDeleted() }
    else    { toast.error('Fehler beim Löschen') }
  }

  return (
    <ModalShell onClose={onClose} title={u.name ?? 'User'}>
      {!detail ? (
        <p className="text-white/40 py-4">Lade…</p>
      ) : (
        <div className="space-y-3 font-body">
          <DetailRow label="Email"    value={detail.email} />
          <DetailRow label="Rolle"    value={ROLE_LABEL[detail.role] ?? detail.role} />
          <DetailRow label="Schule"   value={detail.school_name ?? '—'} />
          <DetailRow label="Level"    value={`${detail.level} (${detail.xp} XP)`} />
          <DetailRow label="Streak"   value={`${detail.current_streak} Tage (best: ${detail.longest_streak})`} />
          <DetailRow label="Sessions" value={detail.total_sessions} />
          <DetailRow label="Welten"   value={detail.total_worlds_created} />
          <DetailRow label="Erstellt" value={new Date(detail.created_at).toLocaleDateString('de-DE')} />
          <DetailRow label="Letzte Aktivität" value={detail.last_active ? new Date(detail.last_active).toLocaleDateString('de-DE') : '—'} />

          <div className="pt-3 border-t border-white/10 flex gap-2">
            <button onClick={handleDelete} className="flex-1 font-body text-sm py-2.5 rounded-xl border-none text-white" style={{ background: '#DC2626' }}>🗑 Löschen</button>
            <button onClick={onClose} className="flex-1 font-body text-sm py-2.5 rounded-xl bg-white/5 border border-white/10">Schließen</button>
          </div>
        </div>
      )}
    </ModalShell>
  )
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-baseline border-b border-white/5 pb-1">
      <span className="text-xs text-white/40 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-white font-mono">{value}</span>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// TAB: TEACHERS
// ──────────────────────────────────────────────────────────────

function TeachersTab() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [promoteEmail, setPromoteEmail] = useState('')
  const [promoteRole, setPromoteRole]   = useState<AdminUserRow['role']>('teacher')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const u = await listUsers()
    setUsers(u); setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const pending = users.filter((u) => u.role === 'teacher_pending')
  const active  = users.filter((u) => u.role === 'teacher')

  const handleApprove = async (id: string) => {
    const ok = await approveTeacher(id)
    if (ok) { toast.success('Freigeschaltet'); void load() } else toast.error('Fehler')
  }
  const handleReject = async (id: string) => {
    const ok = await rejectTeacher(id)
    if (ok) { toast('Abgelehnt', { icon: '❌' }); void load() } else toast.error('Fehler')
  }
  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await setRoleByEmail(promoteEmail.trim(), promoteRole)
    if (ok) { toast.success(`${promoteEmail} → ${ROLE_LABEL[promoteRole]}`); setPromoteEmail(''); void load() } else toast.error('Fehler')
  }

  if (loading) return <p className="text-white/40 py-8 text-center">Lade…</p>

  return (
    <>
      {pending.length > 0 && (
        <section className="mb-5 bg-dark-card rounded-2xl p-5 border border-yellow-500/40">
          <h2 className="font-display text-lg mb-3" style={{ color: '#F59E0B' }}>⏳ Wartende Anträge ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                <div>
                  <p className="font-body font-semibold">{u.name ?? '(kein Name)'}</p>
                  <p className="font-body text-xs text-white/50">{u.school ?? 'Schule unbekannt'}{u.subjects ? ` · ${u.subjects}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(u.id)} className="font-body text-sm px-4 py-2 rounded-xl text-white" style={{ background: '#00C896', border: 'none' }}>✓ Freischalten</button>
                  <button onClick={() => handleReject(u.id)} className="font-body text-sm px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70">✕ Ablehnen</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-5 bg-dark-card rounded-2xl p-5 border border-dark-border">
        <h2 className="font-display text-lg mb-3">🔧 Rolle per Email setzen</h2>
        <form onSubmit={(e) => void handlePromote(e)} className="flex flex-col md:flex-row gap-2">
          <input type="email" placeholder="email@example.com" value={promoteEmail} onChange={(e) => setPromoteEmail(e.target.value)} required
            className="flex-1 font-body text-white rounded-xl px-4 py-2.5 outline-none" style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: 14 }} />
          <select value={promoteRole} onChange={(e) => setPromoteRole(e.target.value as AdminUserRow['role'])}
            className="font-body text-white rounded-xl px-4 py-2.5 outline-none" style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: 14 }}>
            <option value="student">Schüler</option>
            <option value="teacher_pending">Lehrer (wartet)</option>
            <option value="teacher">Lehrer</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" className="font-body font-semibold px-5 py-2.5 rounded-xl border-none text-white" style={{ background: '#6C3CE1' }}>Setzen</button>
        </form>
      </section>

      <section className="bg-dark-card rounded-2xl p-5 border border-dark-border">
        <h2 className="font-display text-lg mb-3">👨‍🏫 Aktive Lehrer ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-white/40 text-sm">Noch keine aktiven Lehrer.</p>
        ) : (
          <div className="space-y-1">
            {active.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5">
                <div className="text-sm">
                  <strong>{u.name ?? '(kein Name)'}</strong>
                  <span className="text-white/40 ml-2">{u.school ?? '—'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

// ──────────────────────────────────────────────────────────────
// TAB: SCHOOLS
// ──────────────────────────────────────────────────────────────

function SchoolsTab() {
  const [schools, setSchools] = useState<SchoolRow[]>([])
  const [newName, setNewName] = useState('')
  const [newCity, setNewCity] = useState('')
  const [assignEmail, setAssignEmail] = useState('')
  const [assignId, setAssignId] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => { setLoading(true); setSchools(await listSchools()); setLoading(false) }, [])
  useEffect(() => { void load() }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const r = await createSchool(newName.trim(), newCity.trim())
    if (r) { toast.success('Schule erstellt'); setNewName(''); setNewCity(''); void load() } else toast.error('Fehler')
  }
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Schule "${name}" löschen?`)) return
    const ok = await deleteSchool(id)
    if (ok) { toast.success('Gelöscht'); void load() } else toast.error('Fehler')
  }
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await assignTeacherToSchool(assignEmail.trim(), assignId)
    if (ok) { toast.success('Zugeordnet'); setAssignEmail(''); void load() } else toast.error('Fehler')
  }

  if (loading) return <p className="text-white/40 py-8 text-center">Lade…</p>

  return (
    <>
      <section className="mb-5 bg-dark-card rounded-2xl p-5 border border-dark-border">
        <h2 className="font-display text-lg mb-3">🏫 Schulen ({schools.length})</h2>
        <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col md:flex-row gap-2 mb-4">
          <input type="text" placeholder="Schulname" required value={newName} onChange={(e) => setNewName(e.target.value)}
            className="flex-1 font-body text-white rounded-xl px-4 py-2.5 outline-none" style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: 14 }} />
          <input type="text" placeholder="Stadt" value={newCity} onChange={(e) => setNewCity(e.target.value)}
            className="font-body text-white rounded-xl px-4 py-2.5 outline-none" style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: 14, width: 160 }} />
          <button type="submit" className="font-body font-semibold px-5 py-2.5 rounded-xl border-none text-white" style={{ background: '#00C896' }}>+ Erstellen</button>
        </form>

        {schools.length === 0 ? (
          <p className="text-white/40 text-center py-4 text-sm">Noch keine Schulen.</p>
        ) : (
          <div className="space-y-2">
            {schools.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div>
                  <p className="font-body font-semibold">{s.name}</p>
                  <p className="font-body text-xs text-white/50">
                    {s.city ?? '—'} · <strong style={{ color: '#00C896' }}>{s.teacher_count}</strong> Lehrer · <strong style={{ color: '#3B82F6' }}>{s.student_count}</strong> Schüler
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setDetailId(s.id)} className="font-body text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">Details</button>
                  <button onClick={() => handleDelete(s.id, s.name)} className="font-body text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-red-400">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {schools.length > 0 && (
          <div className="pt-3 mt-4 border-t border-white/10">
            <p className="font-body text-xs text-white/60 uppercase tracking-wide mb-2">Lehrer zu Schule zuordnen</p>
            <form onSubmit={(e) => void handleAssign(e)} className="flex flex-col md:flex-row gap-2">
              <input type="email" placeholder="lehrer@email.de" required value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)}
                className="flex-1 font-body text-white rounded-xl px-4 py-2.5 outline-none" style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: 14 }} />
              <select required value={assignId} onChange={(e) => setAssignId(e.target.value)}
                className="font-body text-white rounded-xl px-4 py-2.5 outline-none" style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: 14 }}>
                <option value="">Schule wählen</option>
                {schools.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
              <button type="submit" className="font-body font-semibold px-5 py-2.5 rounded-xl border-none text-white" style={{ background: '#6C3CE1' }}>Zuordnen</button>
            </form>
          </div>
        )}
      </section>

      {detailId && <SchoolDetailModal id={detailId} schoolName={schools.find((s) => s.id === detailId)?.name ?? ''} onClose={() => setDetailId(null)} />}
    </>
  )
}

function SchoolDetailModal({ id, schoolName, onClose }: { id: string; schoolName: string; onClose: () => void }) {
  const [rows, setRows] = useState<SchoolDetailRow[]>([])
  useEffect(() => { void getSchoolDetail(id).then(setRows) }, [id])

  const teachers = rows.filter((r) => r.kind === 'teacher')
  const classes  = rows.filter((r) => r.kind === 'class')

  return (
    <ModalShell onClose={onClose} title={`🏫 ${schoolName}`}>
      <div className="space-y-4 font-body">
        <div>
          <p className="text-xs text-white/50 uppercase mb-1">Lehrer ({teachers.length})</p>
          {teachers.length === 0 ? (
            <p className="text-white/40 text-sm">Noch keine Lehrer zugeordnet.</p>
          ) : (
            <div className="space-y-1">{teachers.map((t) => (
              <div key={t.id} className="flex justify-between text-sm py-1 border-b border-white/5">
                <span>{t.name}</span>
                <span className="text-white/40 text-xs">{t.count_info} Klassen · {t.sub_info}</span>
              </div>
            ))}</div>
          )}
        </div>
        <div>
          <p className="text-xs text-white/50 uppercase mb-1">Klassen ({classes.length})</p>
          {classes.length === 0 ? (
            <p className="text-white/40 text-sm">Noch keine Klassen.</p>
          ) : (
            <div className="space-y-1">{classes.map((c) => (
              <div key={c.id} className="flex justify-between text-sm py-1 border-b border-white/5">
                <span>{c.name}<span className="text-white/40 ml-2">{c.sub_info}</span></span>
                <span className="text-white/40 text-xs">{c.count_info} Schüler</span>
              </div>
            ))}</div>
          )}
        </div>
      </div>
    </ModalShell>
  )
}

// ──────────────────────────────────────────────────────────────
// TAB: CONTENT (top worlds)
// ──────────────────────────────────────────────────────────────

function ContentTab() {
  const [worlds, setWorlds] = useState<TopWorld[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { void getTopWorlds(20).then((w) => { setWorlds(w); setLoading(false) }) }, [])

  const handleExport = () => {
    const csv = toCsv(worlds.map((w) => ({ title: w.title, sessions: w.sessions, unique_users: w.unique_users })))
    downloadCsv(`top-worlds-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  if (loading) return <p className="text-white/40 py-8 text-center">Lade…</p>

  return (
    <section className="bg-dark-card rounded-2xl p-5 border border-dark-border">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg">🌍 Top-Welten</h2>
        <button onClick={handleExport} className="font-body text-sm px-3 py-2 rounded-xl bg-white/5 border border-white/10">⬇ CSV</button>
      </div>
      {worlds.length === 0 ? (
        <p className="text-white/40 text-sm">Noch keine Welten gespielt.</p>
      ) : (
        <table className="w-full text-sm font-body">
          <thead className="text-white/50 text-xs uppercase">
            <tr className="text-left"><th className="py-2 pr-3">#</th><th className="py-2 pr-3">Titel</th><th className="py-2 pr-3 text-right">Sessions</th><th className="py-2 text-right">User</th></tr>
          </thead>
          <tbody>
            {worlds.map((w, i) => (
              <tr key={w.world_id} className="border-t border-white/5">
                <td className="py-2 pr-3 text-white/40">{i + 1}</td>
                <td className="py-2 pr-3">{w.title}</td>
                <td className="py-2 pr-3 text-right font-mono">{w.sessions}</td>
                <td className="py-2 text-right font-mono text-white/60">{w.unique_users}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

// ──────────────────────────────────────────────────────────────
// TAB: AUDIT LOG
// ──────────────────────────────────────────────────────────────

function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { void listAuditLog(200).then((e) => { setEntries(e); setLoading(false) }) }, [])

  if (loading) return <p className="text-white/40 py-8 text-center">Lade…</p>

  return (
    <section className="bg-dark-card rounded-2xl p-5 border border-dark-border">
      <h2 className="font-display text-lg mb-3">📝 Audit-Log ({entries.length})</h2>
      {entries.length === 0 ? (
        <p className="text-white/40 text-sm">Noch keine Admin-Aktionen protokolliert.</p>
      ) : (
        <div className="space-y-1">
          {entries.map((e) => (
            <div key={e.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-white/5 text-sm font-body">
              <div className="flex-1 min-w-0">
                <span className="font-mono text-[11px] text-white/40">{new Date(e.created_at).toLocaleString('de-DE')}</span>
                <span className="ml-2 text-white">{e.admin_email ?? '(unknown)'}</span>
                <span className="ml-2 text-purple-400">{e.action}</span>
                {e.target && <span className="ml-2 text-white/60">→ {e.target}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ──────────────────────────────────────────────────────────────
// TAB: SETTINGS
// ──────────────────────────────────────────────────────────────

function SettingsTab() {
  const [items, setItems] = useState<AppSetting[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => { setLoading(true); setItems(await listSettings()); setLoading(false) }, [])
  useEffect(() => { void load() }, [load])

  const handleEdit = async (key: string, currentValue: unknown) => {
    const newVal = window.prompt(`Neuer Wert für "${key}" (als JSON):`, JSON.stringify(currentValue))
    if (newVal === null) return
    let parsed: unknown
    try { parsed = JSON.parse(newVal) } catch { toast.error('Ungültiges JSON'); return }
    const ok = await setSetting(key, parsed)
    if (ok) { toast.success('Gespeichert'); void load() } else toast.error('Fehler')
  }

  if (loading) return <p className="text-white/40 py-8 text-center">Lade…</p>

  return (
    <section className="bg-dark-card rounded-2xl p-5 border border-dark-border">
      <h2 className="font-display text-lg mb-3">⚙️ Globale Einstellungen</h2>
      {items.length === 0 ? (
        <p className="text-white/40 text-sm">Noch keine Einstellungen.</p>
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <div key={s.key} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm">{s.key}</p>
                <p className="font-mono text-xs text-white/50 mt-0.5">{JSON.stringify(s.value)}</p>
              </div>
              <button onClick={() => void handleEdit(s.key, s.value)}
                className="font-body text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">✏️ Ändern</button>
            </div>
          ))}
        </div>
      )}
      <p className="font-body text-xs text-white/30 mt-4">
        Änderungen greifen sofort serverseitig. Client-Code muss die Settings ggf. neu laden.
      </p>
    </section>
  )
}

// ──────────────────────────────────────────────────────────────
// SHARED: ModalShell
// ──────────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-dark-card w-full max-w-md rounded-2xl p-6 border border-dark-border max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-start justify-between mb-4">
            <h2 className="font-display text-xl text-white">{title}</h2>
            <button onClick={onClose} className="text-white/40 text-2xl leading-none">×</button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
