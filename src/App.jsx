import { useState } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useAuth, CURRENT_YEAR } from './context/AuthContext'
import HomePage from './pages/HomePage'
import MonthPage from './pages/MonthPage'
import LogPage from './pages/LogPage'

function SignInScreen() {
  const { signIn, initializing, configured } = useAuth()
  return (
    <div className="signin-page">
      <div className="signin-card">
        <h1 className="signin-year">Journal</h1>
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

function YearPickerScreen() {
  const { saveStartYear } = useAuth()
  const [selected, setSelected] = useState(CURRENT_YEAR)

  const years = []
  for (let y = CURRENT_YEAR; y >= 2000; y--) years.push(y)

  function confirm() {
    saveStartYear(selected)
  }

  return (
    <div className="signin-page">
      <div className="signin-card">
        <h1 className="signin-year">Journal</h1>
        <p className="signin-sub">Which year did you start journaling?</p>
        <select
          className="year-picker-select"
          value={selected}
          onChange={e => setSelected(parseInt(e.target.value, 10))}
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="signin-btn year-picker-btn" onClick={confirm}>
          Continue
        </button>
        <p className="year-picker-hint">
          You can flip between years on the home page.
        </p>
      </div>
    </div>
  )
}

// Forces a full remount when the year URL segment changes so that all
// useState initialisations re-run with fresh localStorage data.
function YearKeyed({ Page }) {
  const { year } = useParams()
  return <Page key={year} />
}

export default function App() {
  const { isSignedIn, initializing, startYear } = useAuth()

  if (!isSignedIn) return <SignInScreen />
  if (!startYear) return <YearPickerScreen />

  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/year/${CURRENT_YEAR}`} replace />} />
      <Route path="/year/:year" element={<YearKeyed Page={HomePage} />} />
      <Route path="/year/:year/month/:monthIndex" element={<YearKeyed Page={MonthPage} />} />
      <Route path="/year/:year/month/:monthIndex/log/:logType" element={<YearKeyed Page={LogPage} />} />
    </Routes>
  )
}
