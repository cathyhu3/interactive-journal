import { Routes, Route } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import HomePage from './pages/HomePage'
import MonthPage from './pages/MonthPage'
import LogPage from './pages/LogPage'

function SignInScreen() {
  const { signIn, initializing, configured } = useAuth()
  return (
    <div className="signin-page">
      <div className="signin-card">
        <h1 className="signin-year">2026</h1>
        <p className="signin-sub">your personal journal</p>
        {!configured ? (
          <p className="signin-notice">
            Add <code>VITE_GOOGLE_CLIENT_ID</code> to <code>.env.local</code> to continue.
          </p>
        ) : initializing ? (
          <p className="signin-loading">Signing you in…</p>
        ) : (
          <button className="signin-btn" onClick={signIn}>
            Sign in with Google
          </button>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const { isSignedIn, initializing } = useAuth()

  if (!isSignedIn) return <SignInScreen />

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/month/:monthIndex" element={<MonthPage />} />
      <Route path="/month/:monthIndex/log/:logType" element={<LogPage />} />
    </Routes>
  )
}
