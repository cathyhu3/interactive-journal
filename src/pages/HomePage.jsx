import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useClaudeStream } from '../hooks/useClaudeStream'
import { useAuth } from '../context/AuthContext'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const SEASONS = [
  { name: 'Winter', id: 0, months: [0, 1, 2] },
  { name: 'Spring', id: 1, months: [3, 4, 5] },
  { name: 'Summer', id: 2, months: [6, 7, 8] },
  { name: 'Fall',   id: 3, months: [9, 10, 11] },
]

const themesKey = id => `season-themes-2026-${id}`
const blank = () => ['', '', '']

function loadThemes(id) {
  try {
    const arr = JSON.parse(localStorage.getItem(themesKey(id)))
    if (!Array.isArray(arr)) return blank()
    while (arr.length < 3) arr.push('')
    return arr.slice(0, 3)
  } catch { return blank() }
}

function persistThemes(id, themes) {
  localStorage.setItem(themesKey(id), JSON.stringify(themes))
}

function parseAIThemes(text) {
  const m = text.match(/\[[\s\S]*?\]/)
  if (m) {
    try {
      const arr = JSON.parse(m[0])
      if (Array.isArray(arr)) return arr.map(s => String(s).trim()).slice(0, 5)
    } catch {}
  }
  return text.split('\n')
    .map(l => l.replace(/^[\s\-\*\•\d\.\)]+/, '').trim())
    .filter(Boolean)
    .slice(0, 5)
}

// ── Editable theme chip ──────────────────────────────────────────────────────

function EditableTheme({ value, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  function commit() {
    onChange(draft.trim())
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        className="theme-input"
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
        placeholder="theme…"
      />
    )
  }

  return (
    <div
      className={`theme-item${!value ? ' theme-empty' : ''}`}
      onClick={() => { setDraft(value); setEditing(true) }}
    >
      <span className="theme-dot">·</span>
      <span>{value || <em>add theme</em>}</span>
    </div>
  )
}

// ── Season section ───────────────────────────────────────────────────────────

function SeasonSection({ season, allEntries }) {
  const { stream, streaming } = useClaudeStream()
  const [themes, setThemes] = useState(() => loadThemes(season.id))

  const hasEntries = season.months.some(mi => {
    const m = allEntries[mi]
    return m && Object.values(m).some(e => (e?.text || '').trim())
  })

  function updateTheme(i, val) {
    setThemes(prev => {
      const next = [...prev]
      next[i] = val
      persistThemes(season.id, next)
      return next
    })
  }

  function generate() {
    const parts = []
    for (const mi of season.months) {
      const monthEntries = allEntries[mi]
      if (!monthEntries) continue
      for (const [day, entry] of Object.entries(monthEntries)) {
        const text = entry?.text || ''
        if (text.trim()) parts.push(`${MONTH_NAMES[mi]} ${day}:\n${text}`)
      }
    }
    if (!parts.length) return

    stream({
      system:
        'You extract key themes from personal journal entries. Respond with ONLY a valid JSON array of exactly 3 strings — each a single word or short phrase (2–3 words max). No explanation, no markdown, just the raw JSON array.',
      messages: [{
        role: 'user',
        content: `Journal entries from ${season.name} 2026:\n\n${parts.join('\n\n')}\n\nReturn the 3 most significant recurring themes as a JSON array of short strings.`,
      }],
      maxTokens: 80,
      onDone: (full) => {
        const parsed = parseAIThemes(full)
        if (parsed.length) {
          while (parsed.length < 3) parsed.push('')
          setThemes(parsed)
          persistThemes(season.id, parsed)
        }
      },
    })
  }

  return (
    <div className="season-section">

      <div className="season-header-row">
        <p className="season-name">{season.name}</p>
        <div className="season-themes-header">
          <span className="season-themes-label">themes</span>
          {hasEntries && (
            <button
              className="season-gen-btn"
              onClick={generate}
              disabled={streaming}
              title="Generate with AI"
            >
              {streaming ? '…' : '✦'}
            </button>
          )}
        </div>
      </div>

      <div className="season-body">
        <div className="season-months-col">
          {season.months.map(mi => (
            <Link key={mi} to={`/month/${mi}`} className="season-month-link">
              {MONTH_NAMES[mi]}
            </Link>
          ))}
        </div>
        <div className="season-themes-col">
          <div className="season-themes-list">
            {themes.map((theme, i) => (
              <EditableTheme key={i} value={theme} onChange={v => updateTheme(i, v)} />
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}

// ── Home page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, signOut } = useAuth()
  const [allEntries] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gdoc-cache-2026'))?.entries ?? {}
    } catch { return {} }
  })

  return (
    <div className="home">
      <div className="home-header">
        <h1 className="home-year">2026</h1>
        <div className="home-user">
          {user?.picture && (
            <img className="header-avatar" src={user.picture} alt={user.name || ''} title={user.name || ''} />
          )}
          {user?.name && <span className="home-user-name">{user.name}</span>}
          <button className="gdocs-btn gdocs-btn-out" onClick={signOut}>Sign out</button>
        </div>
      </div>
      {SEASONS.map(season => (
        <SeasonSection key={season.id} season={season} allEntries={allEntries} />
      ))}
    </div>
  )
}
