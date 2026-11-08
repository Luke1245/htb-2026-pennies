import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { apiUrl, authHeaders } from './api.js'
import './spending-habits.css'

const loadMessage = 'Pennies could not load your records'

async function api(path, token, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.detail || loadMessage)
  return body
}

async function fetchPortrait(getAccessTokenSilently, request) {
  const headers = await authHeaders(getAccessTokenSilently)
  const token = headers.Authorization.replace('Bearer ', '')
  if (request.action === 'share') {
    await api('/sharing-mode', token, { method: 'PUT', body: JSON.stringify({ mode: request.mode }) })
    const updated = await api('/reading', token, { method: 'POST' })
    return { mode: updated.sharing_mode, portrait: updated.reading, updated: updated.updated }
  }
  if (request.action === 'refresh') {
    const updated = await api('/reading', token, { method: 'POST' })
    return { mode: updated.sharing_mode, portrait: updated.reading, updated: updated.updated }
  }
  const [sharingResponse, readingResponse] = await Promise.all([
    fetch(`${apiUrl}/sharing-mode`, { headers }),
    fetch(`${apiUrl}/reading`, { headers }),
  ])
  if (!sharingResponse.ok || !readingResponse.ok) throw new Error(loadMessage)
  const sharing = await sharingResponse.json()
  const reading = await readingResponse.json()
  if (reading.reading) {
    return { mode: sharing.mode || 'raw', portrait: reading.reading, updated: true }
  }
  const updated = await api('/reading', token, { method: 'POST' })
  return {
    mode: updated.sharing_mode || sharing.mode || 'raw',
    portrait: updated.reading,
    updated: updated.updated,
  }
}

export default function SpendingHabitsPage({ loadPortrait, onBack, onLogout, isActive = true }) {
  const { getAccessTokenSilently } = useAuth0()
  const tokenProvider = useRef(getAccessTokenSilently)
  useEffect(() => {
    tokenProvider.current = getAccessTokenSilently
  }, [getAccessTokenSilently])
  const load = useCallback(
    (request) => (loadPortrait ? loadPortrait(request) : fetchPortrait(tokenProvider.current, request)),
    [loadPortrait],
  )
  const [portrait, setPortrait] = useState(null)
  const [status, setStatus] = useState('loading')
  const [sharingMode, setSharingMode] = useState('raw')
  const [pendingSharingMode, setPendingSharingMode] = useState(null)
  const [error, setError] = useState(false)
  const wasActive = useRef(isActive)
  const latestRequest = useRef(0)
  const portraitRef = useRef(null)

  const applyResult = useCallback((result, keepExisting) => {
    if (result.mode) setSharingMode(result.mode)
    if (result.portrait) {
      portraitRef.current = result.portrait
      setPortrait(result.portrait)
      setError(result.updated === false)
    } else if (result.updated) {
      portraitRef.current = null
      setPortrait(null)
      setError(false)
    } else if (keepExisting && portraitRef.current) {
      setError(true)
    } else {
      setError(true)
    }
    setStatus('ready')
  }, [])

  useEffect(() => {
    let active = true
    const requestId = ++latestRequest.current
    load({ action: 'load' })
      .then((result) => {
        if (!active || requestId !== latestRequest.current) return
        applyResult(result, false)
      })
      .catch(() => {
        if (!active || requestId !== latestRequest.current) return
        setError(true)
        setStatus('ready')
      })
    return () => {
      active = false
    }
  }, [load, applyResult])

  useEffect(() => {
    if (isActive && !wasActive.current) {
      const requestId = ++latestRequest.current
      load({ action: 'load' })
        .then((result) => {
          if (requestId !== latestRequest.current) return
          applyResult(result, true)
        })
        .catch(() => {
          if (requestId === latestRequest.current) setError(true)
        })
    }
    wasActive.current = isActive
  }, [isActive, load, applyResult])

  useEffect(() => {
    const refresh = async () => {
      const requestId = ++latestRequest.current
      setError(false)
      try {
        const result = await load({ action: 'refresh' })
        if (requestId !== latestRequest.current) return
        applyResult(result, true)
      } catch {
        if (requestId === latestRequest.current) setError(true)
      }
    }
    window.addEventListener('pennies:transactions-changed', refresh)
    return () => window.removeEventListener('pennies:transactions-changed', refresh)
  }, [load, applyResult])

  const confirmSharingMode = async () => {
    const requestId = ++latestRequest.current
    const nextMode = pendingSharingMode
    setPendingSharingMode(null)
    setSharingMode(nextMode)
    setPortrait(null)
    portraitRef.current = null
    setStatus('loading')
    setError(false)
    try {
      const result = await load({ action: 'share', mode: nextMode })
      if (requestId !== latestRequest.current) return
      applyResult(result, false)
    } catch {
      if (requestId !== latestRequest.current) return
      setError(true)
      setStatus('ready')
    }
  }

  return (
    <div className="habits-page">
      <header className="banner">
        <h1>Pennies</h1>
        <button type="button" className="logout" onClick={onLogout}>
          Log out
        </button>
      </header>
      <main className="habits-main">
        <button type="button" className="back-link" onClick={onBack}>
          ← Back to dashboard
        </button>
        <div className="sharing-control">
          <label htmlFor="sharing-mode">AI sharing mode</label>
          <select
            id="sharing-mode"
            value={sharingMode}
            onChange={(event) => setPendingSharingMode(event.target.value)}
          >
            <option value="raw">Raw sharing</option>
            <option value="sanitised">Sanitised sharing</option>
          </select>
        </div>
        {sharingMode === 'sanitised' && (
          <p className="privacy-note">
            Sanitised sharing protects vendor names, notes, exact dates, and account names, so habits may be less specific.
          </p>
        )}
        <div className="habits-heading">
          <p className="eyebrow">Your money, made clearer</p>
          <h2>Spending habits</h2>
          <p>A detailed reading of your spending, and the patterns it suggests.</p>
        </div>
        {status === 'loading' && <p role="status">Finding your spending habits…</p>}
        {error && (
          <div className="error-message" role="alert">
            <p>
              We couldn’t update your habits.
              {portrait ? ' Your existing reading is still here.' : ' Please try again.'}
            </p>
            <button type="button" onClick={() => window.dispatchEvent(new Event('pennies:transactions-changed'))}>
              Try again
            </button>
          </div>
        )}
        {status === 'ready' && !portrait && !error && (
          <section className="empty-state">
            <h3>No spending history yet</h3>
            <p>
              Add a Transaction from the dashboard when you’re ready. Pennies will use your real spending to find habits.
            </p>
          </section>
        )}
        {portrait && (
          <>
            <p className="portrait-reading">{portrait.reading}</p>
            <section className="habit-section">
              <h3>Spending habits</h3>
              <HabitCards items={portrait.spending_habits} empty="No spending habits yet" />
            </section>
            <section className="habit-section">
              <h3>Projected habits</h3>
              <HabitCards items={portrait.projected_habits} empty="No projected habits yet" />
            </section>
            <section className="habit-section">
              <h3>Education</h3>
              {portrait.educations.length === 0 ? (
                <p className="status">No education yet</p>
              ) : (
                <div className="habit-list">
                  {portrait.educations.map((education) => (
                    <article className="habit-card" key={education.id}>
                      <h3>{education.subject}</h3>
                      <p>{education.body}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
            <section className="habit-section">
              <h3>Suggestions</h3>
              {portrait.suggestions.length === 0 ? (
                <p className="status">No suggestions yet</p>
              ) : (
                <div className="habit-list">
                  {portrait.suggestions.map((suggestion) => (
                    <article className="habit-card" key={suggestion.id}>
                      <p>{suggestion.body}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
        {pendingSharingMode && (
          <div className="dialog-backdrop">
            <div className="sharing-dialog" role="dialog" aria-modal="true" aria-labelledby="sharing-dialog-title">
              <h2 id="sharing-dialog-title">Change how much Pennies shares?</h2>
              <p>
                To protect your privacy, the current Financial portrait will be removed and written again for the new
                sharing mode.
              </p>
              <div>
                <button type="button" onClick={() => setPendingSharingMode(null)}>
                  Cancel
                </button>
                <button type="button" className="primary-button" onClick={confirmSharingMode}>
                  Change mode
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function HabitCards({ items, empty }) {
  if (!items || items.length === 0) return <p className="status">{empty}</p>
  return (
    <div className="habit-list">
      {items.map((item) => (
        <article className="habit-card" key={item}>
          <p>{item}</p>
        </article>
      ))}
    </div>
  )
}
