import { useState, useRef, useEffect } from 'react'
import { useClaudeStream } from '../hooks/useClaudeStream'
import { appendLog } from '../pages/LogPage'

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

function formatTranscript(messages) {
  return messages
    .map(m => `${m.role === 'assistant' ? 'Claude' : 'You'}:\n${m.content}`)
    .join('\n\n')
}

export default function MonthAI({ monthEntries, monthIndex }) {
  const monthName = MONTH_NAMES[monthIndex]
  const { stream, streaming, abort } = useClaudeStream()

  const [themesOpen, setThemesOpen] = useState(false)
  const [themesText, setThemesText] = useState('')

  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [pendingText, setPendingText] = useState('')
  const [chatInput, setChatInput] = useState('')

  const chatEndRef = useRef(null)
  // Keep a ref so the close handler always sees the latest messages
  const messagesRef = useRef(messages)
  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingText, chatOpen])

  const entriesText = formatEntries(monthEntries)
  const hasEntries = !!entriesText

  // ── Themes ──────────────────────────────────────────────────────────────

  function toggleThemes() {
    if (themesOpen) {
      abort()
      setThemesOpen(false)
      setThemesText('')
      return
    }
    setThemesOpen(true)
    setThemesText('')
    stream({
      system:
        'You are a thoughtful reader of personal journals. Identify key recurring themes, emotional patterns, and meaningful threads across the entries. Be specific and warm. Write in flowing paragraphs — no bullet points.',
      messages: [{
        role: 'user',
        content: `Here are my journal entries for ${monthName} 2026:\n\n${entriesText}\n\nSummarize the themes and reflections of this month.`,
      }],
      maxTokens: 1200,
      onChunk: (full) => setThemesText(full),
      onDone: (full) => {
        setThemesText(full)
        appendLog(monthIndex, 'themes', full)
      },
      onError: (err) => setThemesText(`Error: ${err}`),
    })
  }

  // ── Chat ────────────────────────────────────────────────────────────────

  const CHAT_SYSTEM =
    'You are a warm, curious conversation partner helping someone reflect on their personal journal. Stay grounded in what they actually wrote. Be specific, not generic. Keep responses focused and conversational.'

  function buildApiMessages(visibleMessages) {
    return [
      {
        role: 'user',
        content:
          `Here are my journal entries for ${monthName} 2026:\n\n${entriesText}\n\n` +
          `Pick ONE specific topic, moment, or insight from my entries that you find interesting. ` +
          `Share your thoughts on it and invite me to keep talking.`,
      },
      ...visibleMessages,
    ]
  }

  function saveChat(msgs) {
    if (!msgs.length) return
    appendLog(monthIndex, 'chat', formatTranscript(msgs))
  }

  function toggleChat() {
    if (chatOpen) {
      abort()
      saveChat(messagesRef.current)
      setChatOpen(false)
      setMessages([])
      setPendingText('')
      setChatInput('')
      return
    }
    setChatOpen(true)
    setMessages([])
    setPendingText('')
    stream({
      system: CHAT_SYSTEM,
      messages: buildApiMessages([]),
      maxTokens: 600,
      onChunk: (full) => setPendingText(full),
      onDone: (full) => {
        setPendingText('')
        setMessages([{ role: 'assistant', content: full }])
      },
      onError: (err) => {
        setPendingText('')
        setMessages([{ role: 'assistant', content: `Error: ${err}` }])
      },
    })
  }

  function sendMessage() {
    if (!chatInput.trim() || streaming) return
    const userMsg = { role: 'user', content: chatInput.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setChatInput('')
    setPendingText('')

    stream({
      system: CHAT_SYSTEM,
      messages: buildApiMessages(next),
      maxTokens: 600,
      onChunk: (full) => setPendingText(full),
      onDone: (full) => {
        setPendingText('')
        setMessages(prev => [...prev, { role: 'assistant', content: full }])
      },
      onError: (err) => {
        setPendingText('')
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err}` }])
      },
    })
  }

  function handleInputKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="month-ai">
      <div className="ai-btn-row">
        <button
          className={`ai-btn ${themesOpen ? 'ai-btn-on' : ''}`}
          onClick={toggleThemes}
          disabled={!hasEntries}
          title={!hasEntries ? 'No journal entries loaded' : undefined}
        >
          {themesOpen ? 'Clear themes' : 'Themes'}
        </button>
        <button
          className={`ai-btn ${chatOpen ? 'ai-btn-on' : ''}`}
          onClick={toggleChat}
          disabled={!hasEntries}
          title={!hasEntries ? 'No journal entries loaded' : undefined}
        >
          {chatOpen ? 'Close chat' : 'Chat about this month'}
        </button>
        {!hasEntries && (
          <span className="ai-empty-note">Connect Google Docs to enable AI features</span>
        )}
      </div>

      {themesOpen && (
        <div className="ai-themes">
          {!themesText
            ? <span className="ai-loading">Reflecting on your entries…</span>
            : <div className="ai-themes-body">{themesText}</div>
          }
        </div>
      )}

      {chatOpen && (
        <div className="ai-chat">
          <div className="ai-chat-log">
            {messages.map((msg, i) => (
              <div key={i} className={`ai-bubble ai-bubble-${msg.role}`}>
                {msg.content}
              </div>
            ))}
            {pendingText && (
              <div className="ai-bubble ai-bubble-assistant">
                {pendingText}<span className="ai-cursor">▋</span>
              </div>
            )}
            {streaming && !pendingText && messages.length === 0 && (
              <span className="ai-loading">Starting conversation…</span>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="ai-chat-footer">
            <textarea
              className="ai-chat-input"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={handleInputKey}
              placeholder="Reply… (Enter to send, Shift+Enter for newline)"
              rows={2}
              disabled={streaming}
            />
            <button
              className="ai-send-btn"
              onClick={sendMessage}
              disabled={streaming || !chatInput.trim()}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
