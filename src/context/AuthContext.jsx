import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

const SCOPES = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.readonly'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const AUTH_KEY = 'journal-auth-2026'

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

function loadStored() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) } catch { return null }
}

function isTokenFresh(stored) {
  return stored?.token && stored?.expiry && Date.now() < stored.expiry - 5 * 60 * 1000
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const stored = loadStored()
  const fresh = isTokenFresh(stored)

  const [token, setToken] = useState(fresh ? stored.token : null)
  const [user, setUser]   = useState(stored?.email ? { email: stored.email, name: stored.name, picture: stored.picture } : null)
  // True while we're attempting a silent re-auth on a previously-signed-in machine
  const [initializing, setInitializing] = useState(!fresh && !!stored?.email)
  const tokenClientRef = useRef(null)
  const tokenRef = useRef(fresh ? stored.token : null)

  const persist = useCallback((tok, userData) => {
    tokenRef.current = tok
    const entry = { token: tok, expiry: Date.now() + 55 * 60 * 1000, ...userData }
    localStorage.setItem(AUTH_KEY, JSON.stringify(entry))
  }, [])

  const applyToken = useCallback(async (tok, knownUser) => {
    let userData = knownUser || {}
    if (!userData.email) {
      try {
        const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tok}` },
        })
        if (r.ok) {
          const info = await r.json()
          userData = { email: info.email, name: info.name, picture: info.picture }
        }
      } catch { /* ignore */ }
    }
    setToken(tok)
    setUser(userData)
    persist(tok, userData)
  }, [persist])

  useEffect(() => {
    if (!CLIENT_ID) { setInitializing(false); return }
    let cancelled = false

    waitForGoogle().then(() => {
      if (cancelled) return
      const knownUser = stored?.email ? { email: stored.email, name: stored.name, picture: stored.picture } : null

      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
          setInitializing(false)
          if (resp.access_token) applyToken(resp.access_token, knownUser)
          // If resp.error: silent re-auth failed, stays signed out
        },
      })

      if (fresh) return // token already valid, nothing to do

      if (stored?.email) {
        // Previously signed in — try to get a new token without prompting
        tokenClientRef.current.requestAccessToken({ prompt: '' })
      } else {
        setInitializing(false)
      }
    }).catch(() => setInitializing(false))

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signIn = useCallback(() => {
    tokenClientRef.current?.requestAccessToken({ prompt: 'select_account' })
  }, [])

  const signOut = useCallback(() => {
    const tok = tokenRef.current
    if (tok) window.google?.accounts?.oauth2?.revoke(tok, () => {})
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem('gdoc-cache-2026')
    tokenRef.current = null
    setToken(null)
    setUser(null)
  }, [])

  // Called by useGoogleDocs when a 401 is received — try silent refresh
  const handleAuthExpired = useCallback(() => {
    const savedUser = user
    const stored_ = loadStored()
    localStorage.setItem(AUTH_KEY, JSON.stringify({ ...stored_, token: null }))
    tokenRef.current = null
    setToken(null)
    if (tokenClientRef.current && savedUser?.email) {
      tokenClientRef.current.requestAccessToken({ prompt: '' })
    }
  }, [user])

  return (
    <AuthContext.Provider value={{
      token,
      tokenRef,
      user,
      isSignedIn: !!token,
      initializing,
      signIn,
      signOut,
      handleAuthExpired,
      configured: !!CLIENT_ID,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
