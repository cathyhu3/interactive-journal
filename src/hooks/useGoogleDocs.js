import { useState, useEffect, useRef, useCallback } from 'react'

const SCOPES = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.readonly'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const CACHE_KEY = 'gdoc-cache-2026'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

// ── Cache helpers ────────────────────────────────────────────────────────────

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveCache(entries, docId) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      entries,
      docId,
      lastRefreshed: new Date().toISOString(),
    }))
  } catch { /* storage quota exceeded */ }
}

function clearCache() {
  localStorage.removeItem(CACHE_KEY)
}

// ── Google OAuth helper ──────────────────────────────────────────────────────

function waitForGoogle() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return }
    let tries = 0
    const id = setInterval(() => {
      if (window.google?.accounts?.oauth2) { clearInterval(id); resolve() }
      else if (++tries > 60) { clearInterval(id); reject(new Error('timeout')) }
    }, 100)
  })
}

// ── Date formatting ──────────────────────────────────────────────────────────

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

// ── Document parsing ─────────────────────────────────────────────────────────

function parseDateHeading(text) {
  const stripped = text.trim().replace(
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+/i,
    ''
  )
  const m1 = stripped.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+\d{4})?$/i
  )
  if (m1) {
    const monthIndex = MONTH_NAMES.findIndex(n => n.toLowerCase().startsWith(m1[1].slice(0, 3).toLowerCase()))
    const day = parseInt(m1[2], 10)
    if (monthIndex >= 0 && day >= 1 && day <= 31) return { monthIndex, day }
  }
  const m2 = stripped.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\.?\s+\d{4})?$/i
  )
  if (m2) {
    const day = parseInt(m2[1], 10)
    const monthIndex = MONTH_NAMES.findIndex(n => n.toLowerCase().startsWith(m2[2].slice(0, 3).toLowerCase()))
    if (monthIndex >= 0 && day >= 1 && day <= 31) return { monthIndex, day }
  }
  return null
}

function getParagraphText(para) {
  return (para.elements || []).map(el => el.textRun?.content || '').join('')
}

function isBoldSectionHeader(para) {
  const contentRuns = (para.elements || []).filter(el => (el.textRun?.content || '').replace(/\s/g, ''))
  if (!contentRuns.length) return false
  return contentRuns.every(el => el.textRun?.textStyle?.bold === true)
}

function isSectionHeader(para) {
  return (para.paragraphStyle?.namedStyleType || '').startsWith('HEADING_') || isBoldSectionHeader(para)
}

function parseDocument(doc) {
  const result = {}
  const elements = doc.body?.content || []
  let current = null
  let currentText = ''

  const saveEntry = (contentEndIndex) => {
    if (!current) return
    const { monthIndex, day, headingStartIndex, contentStartIndex } = current
    if (!result[monthIndex]) result[monthIndex] = {}
    result[monthIndex][day] = {
      text: currentText.replace(/\n+$/, ''),
      headingStartIndex,
      contentStartIndex,
      contentEndIndex,
    }
  }

  for (const el of elements) {
    if (!el.paragraph) continue
    const para = el.paragraph
    const rawText = getParagraphText(para)
    const text = rawText.trim()
    if (isSectionHeader(para) && text) {
      const parsed = parseDateHeading(text)
      if (parsed) {
        saveEntry(el.startIndex)
        current = { ...parsed, headingStartIndex: el.startIndex, contentStartIndex: el.endIndex }
        currentText = ''
      } else if (current) {
        currentText += rawText
      }
    } else if (current) {
      currentText += rawText
    }
  }

  if (current) {
    const lastEl = elements[elements.length - 1]
    const docEnd = lastEl ? Math.max(current.contentStartIndex, (lastEl.endIndex ?? 1) - 1) : current.contentStartIndex
    saveEntry(docEnd)
  }

  return result
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGoogleDocs() {
  const cached = loadCache()

  const [allEntries, setAllEntries] = useState(cached?.entries ?? {})
  const [lastRefreshed, setLastRefreshed] = useState(cached?.lastRefreshed ?? null)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [loading, setLoading] = useState(false)

  // Restore docId from cache first, then fall back to sessionStorage
  const initialDocId = cached?.docId || sessionStorage.getItem('gdoc_2026_id') || null
  const [docId, setDocId] = useState(initialDocId)
  const docIdRef = useRef(initialDocId)
  const tokenRef = useRef(sessionStorage.getItem('gdocs_token') || null)
  const tokenClientRef = useRef(null)

  const clearAuth = useCallback(() => {
    sessionStorage.removeItem('gdocs_token')
    tokenRef.current = null
    setIsSignedIn(false)
  }, [])

  const fetchDoc = useCallback(async (token) => {
    setLoading(true)
    try {
      let id = docIdRef.current
      if (!id) {
        const q = encodeURIComponent(
          "name='2026' and mimeType='application/vnd.google-apps.document' and trashed=false"
        )
        const r = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (r.status === 401) { clearAuth(); return }
        if (!r.ok) return
        const data = await r.json()
        id = data.files?.[0]?.id
        if (!id) return
        sessionStorage.setItem('gdoc_2026_id', id)
        docIdRef.current = id
        setDocId(id)
      }

      const r = await fetch(
        `https://docs.googleapis.com/v1/documents/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (r.status === 401) { clearAuth(); return }
      if (!r.ok) return
      const doc = await r.json()
      const parsed = parseDocument(doc)

      setAllEntries(parsed)
      const now = new Date().toISOString()
      setLastRefreshed(now)
      saveCache(parsed, id)
    } catch { /* network errors */ } finally {
      setLoading(false)
    }
  }, [clearAuth])

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    const hasCachedEntries = !!(cached?.entries && Object.keys(cached.entries).length > 0)

    waitForGoogle().then(() => {
      if (cancelled) return
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
          if (!resp.access_token) return
          sessionStorage.setItem('gdocs_token', resp.access_token)
          tokenRef.current = resp.access_token
          setIsSignedIn(true)
          // Always fetch on a fresh sign-in
          fetchDoc(resp.access_token)
        },
      })
      const token = sessionStorage.getItem('gdocs_token')
      if (token) {
        tokenRef.current = token
        setIsSignedIn(true)
        // Only auto-fetch if there's nothing in the cache yet
        if (!hasCachedEntries) {
          fetchDoc(token)
        }
      }
    }).catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // run once on mount; fetchDoc is stable

  const signIn = useCallback(() => tokenClientRef.current?.requestAccessToken(), [])

  const signOut = useCallback(() => {
    const token = sessionStorage.getItem('gdocs_token')
    if (token) window.google?.accounts?.oauth2?.revoke(token, () => {})
    sessionStorage.removeItem('gdocs_token')
    sessionStorage.removeItem('gdoc_2026_id')
    clearCache()
    tokenRef.current = null
    docIdRef.current = null
    setIsSignedIn(false)
    setAllEntries({})
    setLastRefreshed(null)
    setDocId(null)
  }, [])

  const refresh = useCallback(() => {
    const token = tokenRef.current
    if (token) fetchDoc(token)
  }, [fetchDoc])

  // ── Write helpers ──────────────────────────────────────────────────────────

  const fetchFreshDoc = useCallback(async (token) => {
    const id = docIdRef.current
    if (!id) return null
    try {
      const r = await fetch(
        `https://docs.googleapis.com/v1/documents/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return r.ok ? await r.json() : null
    } catch { return null }
  }, [])

  const batchUpdate = useCallback(async (token, requests) => {
    const id = docIdRef.current
    if (!id) return false
    try {
      const r = await fetch(
        `https://docs.googleapis.com/v1/documents/${id}:batchUpdate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests }),
        }
      )
      return r.ok
    } catch { return false }
  }, [])

  const saveEntry = useCallback(async (monthIndex, day, newText) => {
    const token = tokenRef.current
    if (!token) return false
    const doc = await fetchFreshDoc(token)
    if (!doc) return false
    const fresh = parseDocument(doc)
    const entry = fresh[monthIndex]?.[day]
    if (!entry) return false
    const { contentStartIndex: start, contentEndIndex: end } = entry
    const text = newText.endsWith('\n') ? newText : newText + '\n'
    const requests = []
    if (end > start) requests.push({ deleteContentRange: { range: { startIndex: start, endIndex: end } } })
    requests.push({ insertText: { location: { index: start }, text } })
    const ok = await batchUpdate(token, requests)
    if (ok) await fetchDoc(token)   // fetchDoc updates cache automatically
    return ok
  }, [fetchFreshDoc, batchUpdate, fetchDoc])

  const createEntry = useCallback(async (monthIndex, day, newText) => {
    const token = tokenRef.current
    if (!token) return false
    const doc = await fetchFreshDoc(token)
    if (!doc) return false
    const fresh = parseDocument(doc)
    const allDates = []
    for (const [mi, days] of Object.entries(fresh)) {
      for (const [d, entry] of Object.entries(days)) {
        allDates.push({ monthIndex: parseInt(mi, 10), day: parseInt(d, 10), entry })
      }
    }
    allDates.sort((a, b) => a.monthIndex !== b.monthIndex ? a.monthIndex - b.monthIndex : a.day - b.day)
    const afterIdx = allDates.findIndex(
      e => e.monthIndex > monthIndex || (e.monthIndex === monthIndex && e.day > day)
    )
    let insertIndex
    if (allDates.length === 0) insertIndex = 1
    else if (afterIdx === -1) insertIndex = allDates[allDates.length - 1].entry.contentEndIndex
    else if (afterIdx === 0) insertIndex = allDates[0].entry.headingStartIndex
    else insertIndex = allDates[afterIdx].entry.headingStartIndex
    const heading = formatDateHeading(2026, monthIndex, day)
    const content = newText.trim() ? (newText.endsWith('\n') ? newText : newText + '\n') : '\n'
    const fullText = heading + '\n' + content
    const requests = [
      { insertText: { location: { index: insertIndex }, text: fullText } },
      { updateTextStyle: { range: { startIndex: insertIndex, endIndex: insertIndex + heading.length }, textStyle: { bold: true }, fields: 'bold' } },
    ]
    const ok = await batchUpdate(token, requests)
    if (ok) await fetchDoc(token)   // fetchDoc updates cache automatically
    return ok
  }, [fetchFreshDoc, batchUpdate, fetchDoc])

  return {
    allEntries,
    lastRefreshed,
    isSignedIn,
    loading,
    signIn,
    signOut,
    refresh,
    saveEntry,
    createEntry,
    docId,
    configured: !!CLIENT_ID,
  }
}
