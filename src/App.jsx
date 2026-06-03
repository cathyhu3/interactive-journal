import { useState } from 'react'
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
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
        <button className="signin-btn year-picker-btn" onClick={() => saveStartYear(selected)}>
          Continue
        </button>
        <p className="year-picker-hint">You can flip between years on the home page.</p>
      </div>
    </div>
  )
}

// Forces remount when journal type or year changes so useState re-initialises
// from the correct localStorage keys.
function RouteKeyed({ Page }) {
  const { journalType, year } = useParams()
  return <Page key={`${journalType}-${year}`} />
}

export default function App() {
  const { isSignedIn, startYear } = useAuth()
  const location = useLocation()
  const journalType = location.pathname.startsWith('/career') ? 'career' : 'life'

  if (!isSignedIn) return <SignInScreen />
  if (!startYear)  return <YearPickerScreen />

  return (
    <div data-journal={journalType}>
      <Routes>
        <Route path="/" element={<Navigate to={`/life/year/${CURRENT_YEAR}`} replace />} />
        <Route path="/:journalType/year/:year" element={<RouteKeyed Page={HomePage} />} />
        <Route path="/:journalType/year/:year/month/:monthIndex" element={<RouteKeyed Page={MonthPage} />} />
        <Route path="/:journalType/year/:year/month/:monthIndex/log/:logType" element={<RouteKeyed Page={LogPage} />} />
      </Routes>
    </div>
  )
}
