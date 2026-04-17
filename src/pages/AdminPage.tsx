/**
 * AdminPage – Godmode-Dashboard für den Projekt-Eigentümer.
 *
 * Zugriff NUR für User mit profiles.role = 'admin'. Gating erfolgt
 * clientseitig (Redirect bei Nicht-Admin) UND serverseitig via RLS +
 * SECURITY DEFINER Funktionen (siehe migration 010).
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { useTeacher } from '../hooks/useTeacher'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import {
  getAdminStats,
  listUsers,
  approveTeacher,
  rejectTeacher,
  setRoleByEmail,
  type AdminStats,
  type AdminUserRow,
} from '../lib/adminDb'

type RoleFilter = '' | 'student' | 'teacher_pending' | 'teacher' | 'admin'

const ROLE_LABEL: Record<string, string> = {
  student:         'Schüler',
  teacher_pending: 'Lehrer (wartet)',
  teacher:         'Lehrer',
  admin:           'Admin',
}

const ROLE_COLOR: Record<string, string> = {
  student:         '#3B82F6',
  teacher_pending: '#F59E0B',
  teacher:         '#00C896',
  admin:           '#FFD700',
}

export default function AdminPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { isAdmin, loading: roleLoading } = useTeacher()

  const [stats, setStats]       = useState<AdminStats | null>(null)
  const [users, setUsers]       = useState<AdminUserRow[]>([])
  const [filter, setFilter]     = useState<RoleFilter>('')
  const [query, setQuery]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [promoteEmail, setPromoteEmail] = useState('')
  const [promoteRole,  setPromoteRole]  = useState<AdminUserRow['role']>('teacher')

  // ── Access gate ─────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || roleLoading) return
    if (!user) {
      void navigate('/auth', { replace: true })
      return
    }
    if (!isAdmin) {
      toast.error('Kein Admin-Zugriff.')
      void navigate('/dashboard', { replace: true })
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate])

  // ── Data load ───────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    const [s, u] = await Promise.all([
      getAdminStats(),
      listUsers(filter ? { role: filter } : {}),
    ])
    setStats(s)
    setUsers(u)
    setLoading(false)
  }, [isAdmin, filter])

  useEffect(() => { void load() }, [load])

  // ── Actions ─────────────────────────────────────────────────
  const handleApprove = async (userId: string) => {
    const ok = await approveTeacher(userId)
    if (ok) {
      toast.success('Lehrer freigeschaltet')
      void load()
    } else {
      toast.error('Fehler bei Freischaltung')
    }
  }

  const handleReject = async (userId: string) => {
    const ok = await rejectTeacher(userId)
    if (ok) {
      toast('Anfrage abgelehnt', { icon: '❌' })
      void load()
    } else {
      toast.error('Fehler')
    }
  }

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoteEmail.trim()) return
    const ok = await setRoleByEmail(promoteEmail.trim(), promoteRole)
    if (ok) {
      toast.success(`${promoteEmail} → ${ROLE_LABEL[promoteRole]}`)
      setPromoteEmail('')
      void load()
    } else {
      toast.error('Fehler (Email nicht gefunden?)')
    }
  }

  // Client-side filtering by name/email query
  const filteredUsers = users.filter((u) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (u.name?.toLowerCase().includes(q) ?? false)
        || (u.school?.toLowerCase().includes(q) ?? false)
  })

  if (authLoading || roleLoading) return <LoadingSpinner />
  if (!isAdmin)                    return null

  return (
    <main className="min-h-screen bg-dark px-4 py-6 text-white">
      <div className="max-w-5xl mx-auto">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 className="font-display text-2xl" style={{ color: '#FFD700' }}>
              ⚡ Admin-Konsole
            </h1>
            <p className="font-body text-xs text-white/40 mt-1">
              Eingeloggt als Admin · {user?.email}
            </p>
          </div>
          <button
            onClick={() => void navigate('/dashboard')}
            className="font-body text-sm px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
          >
            ← Zurück
          </button>
        </motion.div>

        {/* ── Stats-Grid ── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard label="User gesamt"      value={stats?.total_users ?? 0} />
          <StatCard label="Aktive Lehrer"     value={stats?.active_teachers ?? 0} color="#00C896" />
          <StatCard label="Lehrer-Anträge"    value={stats?.pending_teachers ?? 0} color="#F59E0B" />
          <StatCard label="Schüler"           value={stats?.students ?? 0} color="#3B82F6" />
          <StatCard label="Welten gesamt"     value={stats?.total_worlds ?? 0} />
          <StatCard label="Welten 24h"        value={stats?.worlds_last_24h ?? 0} color="#EC4899" />
          <StatCard label="Sessions 7d"       value={stats?.sessions_last_7d ?? 0} color="#6C3CE1" />
          <StatCard label="Admin-Modus"       value="ON" color="#FFD700" />
        </section>

        {/* ── Lehrer-Anträge (separater Block, prominent) ── */}
        <PendingTeachersBlock
          users={users.filter((u) => u.role === 'teacher_pending')}
          onApprove={handleApprove}
          onReject={handleReject}
        />

        {/* ── Rollen-Manueller-Setter ── */}
        <section className="mb-8 bg-dark-card rounded-2xl p-5 border border-dark-border">
          <h2 className="font-display text-lg mb-3">🔧 Rolle manuell setzen</h2>
          <form onSubmit={handlePromote} className="flex flex-col md:flex-row gap-2">
            <input
              type="email"
              placeholder="email@example.com"
              value={promoteEmail}
              onChange={(e) => setPromoteEmail(e.target.value)}
              className="flex-1 font-body text-white rounded-xl px-4 py-3 outline-none"
              style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: '14px' }}
              required
            />
            <select
              value={promoteRole}
              onChange={(e) => setPromoteRole(e.target.value as AdminUserRow['role'])}
              className="font-body text-white rounded-xl px-4 py-3 outline-none"
              style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: '14px' }}
            >
              <option value="student">Schüler</option>
              <option value="teacher_pending">Lehrer (wartet)</option>
              <option value="teacher">Lehrer</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              className="font-body font-semibold px-5 py-3 rounded-xl border-none cursor-pointer text-white"
              style={{ background: '#6C3CE1' }}
            >
              Setzen
            </button>
          </form>
        </section>

        {/* ── User-Liste ── */}
        <section className="bg-dark-card rounded-2xl p-5 border border-dark-border">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4">
            <h2 className="font-display text-lg">👥 Alle User ({filteredUsers.length})</h2>
            <div className="flex gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as RoleFilter)}
                className="font-body text-white rounded-xl px-3 py-2 outline-none"
                style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: '13px' }}
              >
                <option value="">Alle Rollen</option>
                <option value="student">Schüler</option>
                <option value="teacher_pending">Lehrer (wartet)</option>
                <option value="teacher">Lehrer</option>
                <option value="admin">Admin</option>
              </select>
              <input
                type="text"
                placeholder="Name/Schule suchen…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="font-body text-white rounded-xl px-3 py-2 outline-none"
                style={{ background: '#1A1A2E', border: '1px solid #0F3460', fontSize: '13px', minWidth: 200 }}
              />
            </div>
          </div>

          {loading ? (
            <p className="text-white/40 text-center py-8">Lade…</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-white/40 text-center py-8">Keine User gefunden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead className="text-white/50 text-xs uppercase">
                  <tr className="text-left">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Rolle</th>
                    <th className="py-2 pr-3">Schule</th>
                    <th className="py-2 pr-3">Erstellt</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-t border-white/5">
                      <td className="py-2 pr-3">{u.name ?? <em className="text-white/30">(ohne Namen)</em>}</td>
                      <td className="py-2 pr-3">
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ background: ROLE_COLOR[u.role] + '25', color: ROLE_COLOR[u.role] }}
                        >
                          {ROLE_LABEL[u.role]}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-white/60">{u.school ?? '—'}</td>
                      <td className="py-2 pr-3 text-white/40 text-xs">
                        {new Date(u.created_at).toLocaleDateString('de-DE')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

// ── Sub-components ───────────────────────────────────────────

function StatCard({ label, value, color = '#fff' }: { label: string; value: number | string; color?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-dark-card rounded-2xl p-4 border border-dark-border"
    >
      <p className="font-body text-xs text-white/40 uppercase tracking-wide mb-1">{label}</p>
      <p className="font-display text-2xl" style={{ color }}>{value}</p>
    </motion.div>
  )
}

function PendingTeachersBlock({
  users,
  onApprove,
  onReject,
}: {
  users: AdminUserRow[]
  onApprove: (id: string) => void
  onReject:  (id: string) => void
}) {
  if (users.length === 0) return null
  return (
    <section className="mb-8 bg-dark-card rounded-2xl p-5 border border-yellow-500/40">
      <h2 className="font-display text-lg mb-3" style={{ color: '#F59E0B' }}>
        ⏳ Wartende Lehrer-Anträge ({users.length})
      </h2>
      <div className="space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
          >
            <div>
              <p className="font-body font-semibold">{u.name ?? '(ohne Namen)'}</p>
              <p className="font-body text-xs text-white/50">
                {u.school ?? 'Schule unbekannt'}
                {u.subjects ? ` · ${u.subjects}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onApprove(u.id)}
                className="font-body text-sm px-4 py-2 rounded-xl border-none cursor-pointer text-white"
                style={{ background: '#00C896' }}
              >
                ✓ Freischalten
              </button>
              <button
                onClick={() => onReject(u.id)}
                className="font-body text-sm px-4 py-2 rounded-xl border border-white/10 bg-white/5 cursor-pointer text-white/70"
              >
                ✕ Ablehnen
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
