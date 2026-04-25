import { useEffect, useMemo, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage      from './pages/LandingPage'
import LoginPage        from './pages/LoginPage'
import SignupPage       from './pages/SignupPage'
import ResumeUploadPage from './pages/ResumeUploadPage'
import OnboardingPage   from './pages/OnboardingPage'
import DashboardPage    from './pages/DashboardPage'
import InterviewPage    from './pages/InterviewPage'
import ResultPage       from './pages/ResultPage'
import ChallengePage    from './pages/ChallengePage'
import FlashcardsPage   from './pages/FlashcardsPage'
import LeaderboardPage  from './pages/LeaderboardPage'
import ProfilePage      from './pages/ProfilePage'
import ObjectivePage    from './pages/ObjectivePage'
import { getCurrentUser } from './api/user'
import { setUnauthorizedHandler } from './api/client'
import { getAppState, getPostLoginPath } from './utils/userState'
import { AUTH_CHANGED_EVENT } from './utils/authEvents'

function AppLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-sm text-gray-500">Loading PrepAI...</p>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const appState = useMemo(() => getAppState(user), [user])

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      try {
        const me = await getCurrentUser()
        if (active) setUser(me)
      } catch {
        if (active) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    bootstrap()

    const onAuthChanged = (event) => {
      if (!active) return
      setUser(event.detail || null)
    }

    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged)

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
      active = false
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      const currentPath = window.location.pathname
      if (currentPath !== '/login' && currentPath !== '/signup' && currentPath !== '/') {
        window.location.assign('/login')
      }
    })

    return () => setUnauthorizedHandler(null)
  }, [])

  if (loading) {
    return <AppLoadingScreen />
  }

  const isPublicPath = ['/', '/login', '/signup'].includes(location.pathname)
  const postLoginPath = getPostLoginPath(user)

  const requireAuth = (element) => {
    if (!user) {
      return <Navigate to="/login" replace />
    }
    return element
  }

  const publicOnly = (element) => {
    if (user && isPublicPath) {
      return <Navigate to={postLoginPath} replace />
    }
    return element
  }

  const onboardingOnly = (element) => {
    if (!user) return <Navigate to="/login" replace />
    if (appState !== 'needs_onboarding') {
      return <Navigate to={postLoginPath} replace />
    }
    return element
  }

  const resumeOnly = (element) => {
    if (!user) return <Navigate to="/login" replace />
    if (appState === 'needs_onboarding') return <Navigate to="/onboarding" replace />
    return element
  }

  return (
    <Routes>
      <Route path="/" element={publicOnly(<LandingPage />)} />
      <Route path="/login" element={publicOnly(<LoginPage />)} />
      <Route path="/signup" element={publicOnly(<SignupPage />)} />

      <Route path="/onboarding" element={onboardingOnly(<OnboardingPage />)} />
      <Route path="/setup" element={resumeOnly(<ResumeUploadPage />)} />

      <Route path="/dashboard" element={requireAuth(<DashboardPage />)} />
      <Route path="/interview" element={requireAuth(<InterviewPage />)} />
      <Route path="/result" element={requireAuth(<ResultPage />)} />
      <Route path="/challenge" element={requireAuth(<ChallengePage />)} />
      <Route path="/flashcards" element={requireAuth(<FlashcardsPage />)} />
      <Route path="/leaderboard" element={requireAuth(<LeaderboardPage />)} />
      <Route path="/profile" element={requireAuth(<ProfilePage />)} />
      <Route path="/objective" element={requireAuth(<ObjectivePage />)} />
      <Route path="/aptitude" element={requireAuth(<ObjectivePage initialPracticeType="aptitude" />)} />
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
  )
}
