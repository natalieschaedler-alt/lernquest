import { useState, useEffect } from 'react'
import { getMistakesForReview } from '../lib/database'
import { useAuth } from './useAuth'

export function useMistakesReview() {
  const { user } = useAuth()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!user) {
      // Defer state update out of the synchronous effect body (react-hooks/immutability)
      const t = setTimeout(() => setPendingCount(0), 0)
      return () => clearTimeout(t)
    }
    getMistakesForReview(user.id).then((mistakes) => {
      setPendingCount(mistakes.length)
    })
    return undefined
  }, [user])

  return { pendingCount }
}
