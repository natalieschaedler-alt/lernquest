/**
 * useTeacher – Reaktiver Hook für Lehrer-Authentifizierung und Rollenstatus.
 *
 * isTeacher:   role === 'teacher'   → Dashboard zeigen
 * isPending:   role === 'teacher_pending' → "Wird geprüft"-Screen
 * isStudent:   role === 'student'   → an /lehrer/registrieren weiterleiten
 */
import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'
import { getTeacherProfile } from '../lib/teacherDb'
import type { TeacherProfile } from '../lib/teacherDb'

export function useTeacher() {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile]         = useState<TeacherProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    setProfileLoading(true)
    void getTeacherProfile(user.id).then((p) => {
      setProfile(p)
      setProfileLoading(false)
    })
  }, [user, authLoading])

  const loading    = authLoading || profileLoading
  const isTeacher  = profile?.role === 'teacher'
  const isPending  = profile?.role === 'teacher_pending'
  const isLoggedIn = !!user

  return { user, profile, loading, isTeacher, isPending, isLoggedIn }
}
