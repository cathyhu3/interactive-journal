import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import DayEntryModal from '../components/DayEntryModal'
import MonthCalendar from '../components/MonthCalendar'
import MonthAI from '../components/MonthAI'
import JournalToggle from '../components/JournalToggle'
import { useGoogleDocs } from '../hooks/useGoogleDocs'
import { useAuth } from '../context/AuthContext'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const ORDINALS = [
  '1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th',
  '11th','12th','13th','14th','15th','16th','17th','18th','19th','20th',
  '21st','22nd','23rd','24th','25th','26th','27th','28th','29th','30th','31st',
]

export default function MonthPage() {
  const { journalType, year, monthIndex } = useParams()
  const yearNum = parseInt(year, 10)
  const idx = parseInt(monthIndex, 10)
  const monthName = MONTH_NAMES[idx]

  const { token, handleAuthExpired, user, signOut } = useAuth()
  const [editingDay, setEditingDay] = useState(null)
  const { allEntries, lastRefreshed, loading, refresh, saveEntry, createEntry, docId } =
    useGoogleDocs(token, handleAuthExpired, yearNum, journalType)

  const monthEntries = allEntries[idx] || {}

  async function handleSave(day, text) {
    const hasEntry = !!monthEntries[day]
    const ok = hasEntry
      ? await saveEntry(idx, day, text)
      : await createEntry(idx, day, text)
    if (ok) setEditingDay(null)
    return ok
  }

  return (
    <div className="month-page">
      <Link to={`/${journalType}/year/${year}`} className="back-link">← {yearNum}</Link>
      <div className="month-page-header">
        <h1>{monthName} {yearNum}</h1>
        <div className="gdocs-auth">
          <span className="gdocs-status">
            {loading ? 'Syncing…' : lastRefreshed
              ? `Synced ${new Date(lastRefreshed).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
              : ''}
          </span>
          <button className="gdocs-btn gdocs-btn-refresh" onClick={refresh} disabled={loading} title="Refresh from Google Docs">
            ↻
          </button>
          <JournalToggle />
          {user?.picture && (
            <img className="header-avatar" src={user.picture} alt={user.name || ''} title={user.name || ''} />
          )}
          <button className="gdocs-btn gdocs-btn-out" onClick={signOut}>Sign out</button>
        </div>
      </div>

      <section className="calendar-section">
        <div className="calendar-outer">
          <MonthCalendar
            monthIndex={idx}
            entries={monthEntries}
            onDayClick={setEditingDay}
          />
          <div className="log-nav-btns">
            <Link to={`/${journalType}/year/${year}/month/${idx}/log/highlights`} className="log-nav-btn">
              <span className="log-nav-icon">◈</span>
              Highlights Log
            </Link>
            <Link to={`/${journalType}/year/${year}/month/${idx}/log/reflections`} className="log-nav-btn">
              <span className="log-nav-icon">◎</span>
              Reflections Log
            </Link>
          </div>
        </div>
      </section>

      <MonthAI monthEntries={monthEntries} monthIndex={idx} year={yearNum} journalType={journalType} />

      {editingDay !== null && (
        <DayEntryModal
          day={editingDay}
          ordinal={ORDINALS[editingDay - 1]}
          monthName={`${monthName} ${yearNum}`}
          initialText={monthEntries[editingDay]?.text || ''}
          hasDocEntry={!!monthEntries[editingDay]}
          onSave={handleSave}
          onClose={() => setEditingDay(null)}
          docId={docId}
        />
      )}
    </div>
  )
}
