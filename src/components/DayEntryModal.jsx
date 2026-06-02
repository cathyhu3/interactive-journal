import { useState, useEffect, useRef } from 'react'

export default function DayEntryModal({ day, ordinal, monthName, initialText, hasDocEntry, onSave, onClose, docId }) {
  const [text, setText] = useState(initialText)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function handleSave() {
    setSaving(true)
    setError('')
    const ok = await onSave(day, text)
    setSaving(false)
    if (ok === false) setError('Save failed — check your connection and try again.')
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
  }

  const docsUrl = docId ? `https://docs.google.com/document/d/${docId}/edit` : null
  const saveLabel = hasDocEntry ? 'Save to Google Docs' : 'Create in Google Docs'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{ordinal} — {monthName} 2026</h2>
          <div className="modal-header-right">
            {docsUrl && (
              <a
                href={docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="modal-gdocs-link"
              >
                Open in Google Docs ↗
              </a>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {!hasDocEntry && (
          <div className="modal-new-entry-notice">
            No entry yet — write below to create one.
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="modal-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write your journal entry here…"
          disabled={saving}
        />

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-footer">
          <span className="modal-hint">⌘↵ to save · Esc to cancel</span>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button className="btn-save" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
