import { useState, useEffect, useRef, useCallback } from 'react'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

// ── Cache ────────────────────────────────────────────────────────────────────

function loadCache(key) {
  try { return JSON.parse(localStorage.getItem(key)) } catch { return null }
}

function saveCache(key, entries, docId) {
  try {
    localStorage.setItem(key, JSON.stringify({ entries, docId, lastRefreshed: new Date().toISOString() }))
  } catch { /* quota exceeded */ }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function getOrdinal(n) {
  if (n >= 11 && n <= 13) return n + 'th'
  switch (n % 10) {
    case 1: return n + 'st'
    case 2: return n + 'nd'
    case 3: return n + 'rd'
    default: return n + 'th'
  }
}

function formatDateHeading(year, monthIndex, day) {
  const date = new Date(year, monthIndex, day)
  return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[monthIndex]} ${getOrdinal(day)}`
}

// ── Document parsing ──────────────────────────────────────────────────────────

function parseDateHeading(text) {
  const stripped = text.trim().replace(
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+/i, ''
  )
  const m1 = stripped.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+\d{4})?$/i
  )
  if (m1) {
    const monthIndex = MONTH_NAMES.findIndex(n => n.toLowerCase().startsWith(m1[1].slice(0,3).toLowerCase()))
    const day = parseInt(m1[2], 10)
    if (monthIndex >= 0 && day >= 1 && day <= 31) return { monthIndex, day }
  }
  const m2 = stripped.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\.?\s+\d{4})?$/i
  )
  if (m2) {
    const day = parseInt(m2[1], 10)
    const monthIndex = MONTH_NAMES.findIndex(n => n.toLowerCase().startsWith(m2[2].slice(0,3).toLowerCase()))
    if (monthIndex >= 0 && day >= 1 && day <= 31) return { monthIndex, day }
  }
  return null
}

function getParagraphText(para) {
  return (para.elements || []).map(el => el.textRun?.content || '').join('')
}

function isBoldSectionHeader(para) {
  const runs = (para.elements || []).filter(el => (el.textRun?.content || '').replace(/\s/g, ''))
  return runs.length > 0 && runs.every(el => el.textRun?.textStyle?.bold === true)
}

function isSectionHeader(para) {
  return (para.paragraphStyle?.namedStyleType || '').startsWith('HEADING_') || isBoldSectionHeader(para)
}

function parseDocument(doc) {
  const result = {}
  const elements = doc.body?.content || []
  let current = null
  let currentText = ''

  const save = (endIndex) => {
    if (!current) return
    const { monthIndex, day, headingStartIndex, contentStartIndex } = current
    if (!result[monthIndex]) result[monthIndex] = {}
    result[monthIndex][day] = { text: currentText.replace(/\n+$/, ''), headingStartIndex, contentStartIndex, contentEndIndex: endIndex }
  }

  for (const el of elements) {
    if (!el.paragraph) continue
    const para = el.paragraph
    const rawText = getParagraphText(para)
    const text = rawText.trim()
    if (isSectionHeader(para) && text) {
      const parsed = parseDateHeading(text)
      if (parsed) {
        save(el.startIndex)
        current = { ...parsed, headingStartIndex: el.startIndex, contentStartIndex: el.endIndex }
        currentText = ''
      } else if (current) { currentText += rawText }
    } else if (current) { currentText += rawText }
  }

  if (current) {
    const lastEl = elements[elements.length - 1]
    save(lastEl ? Math.max(current.contentStartIndex, (lastEl.endIndex ?? 1) - 1) : current.contentStartIndex)
  }
  return result
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGoogleDocs(token, onAuthExpired, year) {
  const cacheKey = `gdoc-cache-${year}`
  const cached = loadCache(cacheKey)
  const hasCachedEntries = !!(cached?.entries && Object.keys(cached.entries).length > 0)

  const [allEntries, setAllEntries]       = useState(cached?.entries ?? {})
  const [lastRefreshed, setLastRefreshed] = useState(cached?.lastRefreshed ?? null)
  const [loading, setLoading]             = useState(false)
  const [docId, setDocId]                 = useState(cached?.docId ?? null)
  const docIdRef  = useRef(cached?.docId ?? null)
  const tokenRef  = useRef(token)

  // Keep tokenRef current
  useEffect(() => { tokenRef.current = token }, [token])

  const handle401 = useCallback(() => onAuthExpired?.(), [onAuthExpired])

  const fetchDoc = useCallback(async (tok) => {
    if (!tok) return
    setLoading(true)
    try {
      let id = docIdRef.current
      if (!id) {
        const q = encodeURIComponent(`name='${year}' and mimeType='application/vnd.google-apps.document' and trashed=false`)
        const r = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
          { headers: { Authorization: `Bearer ${tok}` } }
        )
        if (r.status === 401) { handle401(); return }
        if (!r.ok) return
        const data = await r.json()
        id = data.files?.[0]?.id
        if (!id) return
        docIdRef.current = id
        setDocId(id)
      }

      const r = await fetch(
        `https://docs.googleapis.com/v1/documents/${id}`,
        { headers: { Authorization: `Bearer ${tok}` } }
      )
      if (r.status === 401) { handle401(); return }
      if (!r.ok) return
      const doc = await r.json()
      const parsed = parseDocument(doc)
      setAllEntries(parsed)
      const now = new Date().toISOString()
      setLastRefreshed(now)
      saveCache(cacheKey, parsed, id)
    } catch { /* network errors */ } finally {
      setLoading(false)
    }
  }, [handle401])

  // Fetch once on mount if no cache
  useEffect(() => {
    if (token && !hasCachedEntries) fetchDoc(token)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const refresh = useCallback(() => {
    if (tokenRef.current) fetchDoc(tokenRef.current)
  }, [fetchDoc])

  const fetchFreshDoc = useCallback(async () => {
    const id = docIdRef.current
    const tok = tokenRef.current
    if (!id || !tok) return null
    try {
      const r = await fetch(`https://docs.googleapis.com/v1/documents/${id}`, { headers: { Authorization: `Bearer ${tok}` } })
      return r.ok ? await r.json() : null
    } catch { return null }
  }, [])

  const batchUpdate = useCallback(async (requests) => {
    const id = docIdRef.current
    const tok = tokenRef.current
    if (!id || !tok) return false
    try {
      const r = await fetch(`https://docs.googleapis.com/v1/documents/${id}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      })
      return r.ok
    } catch { return false }
  }, [])

  const saveEntry = useCallback(async (monthIndex, day, newText) => {
    const doc = await fetchFreshDoc()
    if (!doc) return false
    const fresh = parseDocument(doc)
    const entry = fresh[monthIndex]?.[day]
    if (!entry) return false
    const { contentStartIndex: start, contentEndIndex: end } = entry
    const text = newText.endsWith('\n') ? newText : newText + '\n'
    const requests = []
    if (end > start) requests.push({ deleteContentRange: { range: { startIndex: start, endIndex: end } } })
    requests.push({ insertText: { location: { index: start }, text } })
    requests.push({ updateTextStyle: { range: { startIndex: start, endIndex: start + text.length }, textStyle: { bold: false }, fields: 'bold' } })
    const ok = await batchUpdate(requests)
    if (ok) await fetchDoc(tokenRef.current)
    return ok
  }, [fetchFreshDoc, batchUpdate, fetchDoc])

  const createEntry = useCallback(async (monthIndex, day, newText) => {
    const doc = await fetchFreshDoc()
    if (!doc) return false
    const fresh = parseDocument(doc)
    const allDates = []
    for (const [mi, days] of Object.entries(fresh)) {
      for (const [d, entry] of Object.entries(days)) {
        allDates.push({ monthIndex: parseInt(mi, 10), day: parseInt(d, 10), entry })
      }
    }
    allDates.sort((a, b) => a.monthIndex !== b.monthIndex ? a.monthIndex - b.monthIndex : a.day - b.day)
    // afterIdx = first entry (ascending sort) with a date strictly after the new entry
    const afterIdx = allDates.findIndex(e => e.monthIndex > monthIndex || (e.monthIndex === monthIndex && e.day > day))
    let insertIndex
    // Doc is descending (newest first). In the sorted array, entries with index < afterIdx
    // have smaller dates and therefore appear later in the doc.
    if (allDates.length === 0) {
      insertIndex = 1
    } else if (afterIdx === -1) {
      // New entry is the largest date → goes at the very top of the doc
      insertIndex = allDates[allDates.length - 1].entry.headingStartIndex
    } else if (afterIdx === 0) {
      // New entry is smaller than all existing → goes at the very bottom
      insertIndex = allDates[0].entry.contentEndIndex
    } else {
      // Insert just before the entry with the next smaller date (which appears just below in the doc)
      insertIndex = allDates[afterIdx - 1].entry.headingStartIndex
    }
    const heading = formatDateHeading(year, monthIndex, day)
    const content = (newText.trim() ? (newText.endsWith('\n') ? newText : newText + '\n') : '\n') + '\n'
    const headingEnd = insertIndex + heading.length
    const contentStart = headingEnd + 1  // skip the '\n' between heading and body
    const requests = [
      { insertText: { location: { index: insertIndex }, text: heading + '\n' + content } },
      { updateTextStyle: { range: { startIndex: insertIndex, endIndex: headingEnd }, textStyle: { bold: true }, fields: 'bold' } },
      { updateTextStyle: { range: { startIndex: contentStart, endIndex: contentStart + content.length }, textStyle: { bold: false }, fields: 'bold' } },
    ]
    const ok = await batchUpdate(requests)
    if (ok) await fetchDoc(tokenRef.current)
    return ok
  }, [fetchFreshDoc, batchUpdate, fetchDoc])

  return { allEntries, lastRefreshed, loading, refresh, saveEntry, createEntry, docId }
}
