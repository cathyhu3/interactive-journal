import { useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export function logKey(monthIndex, logType) {
  return `log-2026-${monthIndex}-${logType}`
}

export function readLog(monthIndex, logType) {
  try { return JSON.parse(localStorage.getItem(logKey(monthIndex, logType)) || '[]') }
  catch { return [] }
}

export function appendLog(monthIndex, logType, text) {
  const entries = readLog(monthIndex, logType)
  entries.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }),
    text,
  })
  localStorage.setItem(logKey(monthIndex, logType), JSON.stringify(entries))
}

function LogEntry({ entry, onChange, onDelete }) {
  return (
    <div className="log-entry">
      <div className="log-entry-header">
        <span className="log-entry-ts">{entry.timestamp}</span>
        <button className="log-delete-btn" onClick={() => onDelete(entry.id)}>Delete</button>
      </div>
      <textarea
        className="log-entry-area"
        value={entry.text}
        onChange={e => onChange(entry.id, e.target.value)}
        spellCheck
      />
    </div>
  )
}

export default function LogPage() {
  const { monthIndex, logType } = useParams()
  const idx = parseInt(monthIndex, 10)
  const monthName = MONTH_NAMES[idx]
  const title = logType === 'themes' ? 'Themes Log' : 'Chat Log'

  const [entries, setEntries] = useState(() => readLog(idx, logType))

  const persist = useCallback((next) => {
    localStorage.setItem(logKey(idx, logType), JSON.stringify(next))
  }, [idx, logType])

  function addBlank() {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      }),
      text: '',
    }
    setEntries(prev => { const next = [entry, ...prev]; persist(next); return next })
  }

  function handleChange(id, text) {
    setEntries(prev => {
      const next = prev.map(e => e.id === id ? { ...e, text } : e)
      persist(next)
      return next
    })
  }

  function handleDelete(id) {
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id)
      persist(next)
      return next
    })
  }

  return (
    <div className="log-page">
      <Link to={`/month/${monthIndex}`} className="back-link">← {monthName} 2026</Link>
      <div className="log-page-header">
        <h1>{monthName} — {title}</h1>
        <button className="log-add-btn" onClick={addBlank}>+ New entry</button>
      </div>

      {entries.length === 0 ? (
        <p className="log-empty">
          No entries yet. Generate {logType === 'themes' ? 'a themes summary' : 'a chat'} from the
          calendar page — it will be saved here automatically.
          You can also add a blank entry above to paste notes in.
        </p>
      ) : (
        <div className="log-entries">
          {entries.map(entry => (
            <LogEntry
              key={entry.id}
              entry={entry}
              onChange={handleChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
