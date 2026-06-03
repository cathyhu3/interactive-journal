import { useState } from 'react'
import { useClaudeStream } from '../hooks/useClaudeStream'
import { appendLog, readLog } from '../pages/LogPage'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function formatEntries(monthEntries) {
  const days = Object.keys(monthEntries).sort((a, b) => parseInt(a) - parseInt(b))
  if (!days.length) return null
  return days.map(day => {
    const entry = monthEntries[day]
    const text = typeof entry === 'string' ? entry : (entry?.text || '')
    return `Day ${day}:\n${text}`
  }).join('\n\n')
}

// Pulls the most recent highlights + reflection log entry for each past month
// within the current year, stopping when the character budget is reached.
function buildHistoricalContext(year, currentMonthIndex) {
  const CHAR_BUDGET = 30000
  const parts = []
  let used = 0

  for (let mi = 0; mi < 12; mi++) {
    if (mi === currentMonthIndex) continue

    const hlText  = readLog(year, mi, 'highlights')[0]?.text?.trim()
    const refText = readLog(year, mi, 'reflections')[0]?.text?.trim()
    if (!hlText && !refText) continue

    let section = `${MONTH_NAMES[mi]}:\n`
    if (hlText)  section += `Highlights:\n${hlText}\n`
    if (refText) section += `Reflection:\n${refText}\n`

    if (used + section.length > CHAR_BUDGET) break
    parts.push(section)
    used += section.length
  }

  return parts.join('\n')
}

export default function MonthAI({ monthEntries, monthIndex, year }) {
  const monthName = MONTH_NAMES[monthIndex]
  const { stream, streaming, abort } = useClaudeStream()

  const [highlightsOpen, setHighlightsOpen]   = useState(false)
  const [highlightsText, setHighlightsText]   = useState('')
  const [reflectionOpen, setReflectionOpen]   = useState(false)
  const [reflectionText, setReflectionText]   = useState('')

  const entriesText = formatEntries(monthEntries)
  const hasEntries  = !!entriesText

  // ── Highlights ──────────────────────────────────────────────────────────

  function toggleHighlights() {
    if (highlightsOpen) {
      abort()
      setHighlightsOpen(false)
      setHighlightsText('')
      return
    }
    setHighlightsOpen(true)
    setHighlightsText('')
    stream({
      system:
        'You extract specific, concrete highlights from personal journal entries. ' +
        'Look for memorable activities, things learned, meaningful experiences, personal growth moments, ' +
        'interesting observations, and life reflections. ' +
        'Format as a bullet list (using "•") with vivid, specific phrases drawn directly from the entries. ' +
        'Avoid generic statements — every bullet should feel personal and particular.',
      messages: [{
        role: 'user',
        content:
          `Here are my journal entries for ${monthName} ${year}:\n\n${entriesText}\n\n` +
          `List the highlights of this month — memorable moments, activities, things I learned, ` +
          `and personal reflections. Be specific and draw directly from what I wrote.`,
      }],
      maxTokens: 1500,
      onChunk: (full) => setHighlightsText(full),
      onDone:  (full) => { setHighlightsText(full); appendLog(year, monthIndex, 'highlights', full) },
      onError: (err)  => setHighlightsText(`Error: ${err}`),
    })
  }

  // ── Reflection ──────────────────────────────────────────────────────────

  function toggleReflection() {
    if (reflectionOpen) {
      abort()
      setReflectionOpen(false)
      setReflectionText('')
      return
    }
    setReflectionOpen(true)
    setReflectionText('')

    const historical = buildHistoricalContext(year, monthIndex)

    // Cap current-month entries so they never crowd out everything else
    const MAX_ENTRY_CHARS = 20000
    const entries = entriesText && entriesText.length > MAX_ENTRY_CHARS
      ? entriesText.slice(0, MAX_ENTRY_CHARS) + '\n[truncated for length]'
      : entriesText

    const historicalSection = historical
      ? `Context from previous months' highlights and reflections:\n\n${historical}\n---\n\n`
      : ''

    stream({
      system:
        'You are a thoughtful journaling companion who has been following someone\'s journal over time. ' +
        'Write a warm, personal, specific reflection on their current month. ' +
        'Draw on concrete details from this month\'s entries, and where the historical context is available, ' +
        'notice patterns, growth, and connections across time. Write in flowing prose.',
      messages: [{
        role: 'user',
        content:
          `${historicalSection}` +
          `My journal entries for ${monthName} ${year}:\n\n${entries}\n\n` +
          `Write a thoughtful reflection on this month. ` +
          `Reference specific things I wrote about, and if past context is available, ` +
          `connect this month to the broader arc of the year.`,
      }],
      maxTokens: 2000,
      onChunk: (full) => setReflectionText(full),
      onDone:  (full) => { setReflectionText(full); appendLog(year, monthIndex, 'reflections', full) },
      onError: (err)  => setReflectionText(`Error: ${err}`),
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="month-ai">
      <div className="ai-btn-row">
        <button
          className={`ai-btn ${highlightsOpen ? 'ai-btn-on' : ''}`}
          onClick={toggleHighlights}
          disabled={!hasEntries}
          title={!hasEntries ? 'No journal entries loaded' : undefined}
        >
          {highlightsOpen ? 'Clear highlights' : 'Highlights'}
        </button>
        <button
          className={`ai-btn ${reflectionOpen ? 'ai-btn-on' : ''}`}
          onClick={toggleReflection}
          disabled={!hasEntries}
          title={!hasEntries ? 'No journal entries loaded' : undefined}
        >
          {reflectionOpen ? 'Clear reflection' : 'Reflect'}
        </button>
        {!hasEntries && (
          <span className="ai-empty-note">Connect Google Docs to enable AI features</span>
        )}
      </div>

      {highlightsOpen && (
        <div className="ai-themes">
          {!highlightsText
            ? <span className="ai-loading">Finding highlights…</span>
            : <div className="ai-themes-body">{highlightsText}</div>
          }
        </div>
      )}

      {reflectionOpen && (
        <div className="ai-themes">
          {!reflectionText
            ? <span className="ai-loading">Gathering your journal history…</span>
            : <div className="ai-themes-body">{reflectionText}</div>
          }
        </div>
      )}
    </div>
  )
}
