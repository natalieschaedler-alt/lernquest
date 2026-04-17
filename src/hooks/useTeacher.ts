/**
 * useTeacher – Reaktiver Hook für Lehrer- & Admin-Rollenstatus.
 *
 * isTeacher:  role === 'teacher'
 * isPending:  role === 'teacher_pending'
 * isAdmin:    role === 'admin'
 * isStudent:  role === 'student'  (fallback)
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
  const isAdmin    = profile?.role === 'admin'
  const isLoggedIn = !!user

  return { user, profile, loading, isTeacher, isPending, isAdmin, isLoggedIn }
}
