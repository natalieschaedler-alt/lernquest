import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import LoadingSpinner from './components/ui/LoadingSpinner'
import CookieBanner from './components/ui/CookieBanner'

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

export default function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
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
      </Routes>
      <CookieBanner />
    </Suspense>
  )
}
