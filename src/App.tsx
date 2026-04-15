import { lazy, Suspense, useEffect, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from './components/ui/LoadingSpinner'
import CookieBanner from './components/ui/CookieBanner'
import ErrorBoundary from './components/ErrorBoundary'
import { supabase } from './lib/supabase'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const StartPage = lazy(() => import('./pages/StartPage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const DungeonPage = lazy(() => import('./pages/DungeonPage'))
const BossPage = lazy(() => import('./pages/BossPage'))
const VictoryPage = lazy(() => import('./pages/VictoryPage'))
const GameOverPage = lazy(() => import('./pages/GameOverPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const LeaguePage = lazy(() => import('./pages/LeaguePage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const OfflinePage = lazy(() => import('./pages/OfflinePage'))
const ImpressumPage = lazy(() => import('./pages/ImpressumPage'))
const DatenschutzPage = lazy(() => import('./pages/DatenschutzPage'))
const AGBPage = lazy(() => import('./pages/AGBPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

/** Fires a toast when a user's Supabase session expires unexpectedly. */
function SessionWatcher() {
  const { t } = useTranslation()
  const wasLoggedIn = useRef(false)

  useEffect(() => {
    // Initialise the "was logged in" flag from the current session
    supabase.auth.getSession().then(({ data }) => {
      wasLoggedIn.current = !!data.session?.user
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && wasLoggedIn.current) {
        toast(t('auth_extra.session_expired'), { icon: '⚠️', duration: 6000 })
      }
      if (event === 'SIGNED_IN') wasLoggedIn.current = true
      if (event === 'SIGNED_OUT') wasLoggedIn.current = false
    })

    return () => subscription.unsubscribe()
  }, [t])

  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <SessionWatcher />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/start" element={<StartPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dungeon" element={<DungeonPage />} />
          <Route path="/boss" element={<BossPage />} />
          <Route path="/victory" element={<VictoryPage />} />
          <Route path="/gameover" element={<GameOverPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/league" element={<LeaguePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/offline" element={<OfflinePage />} />
          <Route path="/impressum" element={<ImpressumPage />} />
          <Route path="/datenschutz" element={<DatenschutzPage />} />
          <Route path="/agb" element={<AGBPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <CookieBanner />
      </Suspense>
    </ErrorBoundary>
  )
}
