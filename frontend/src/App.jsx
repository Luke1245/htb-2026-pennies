import { useEffect, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router'
import './dashboard.css'
import './App.css'
import pennieRound from './assets/pennie_round.png'
import Dashboard from './Dashboard.jsx'
import { GuidePage } from './Guides.jsx'
import RecommendationsPage from './RecommendationsPage.jsx'
import SpendingHabitsPage from './SpendingHabitsPage.jsx'
import { apiUrl, authHeaders } from './api.js'
import { firstNameError } from './displayName.js'

function PenniesShell({ children, onLogout }) {
  return (
    <div className="dashboard">
      <header className="banner">
        <h1>Pennies</h1>
        {onLogout && (
          <button type="button" className="logout" onClick={onLogout}>
            Log out
          </button>
        )}
      </header>
      <main className="dashboard-main">{children}</main>
    </div>
  )
}

function Welcome({ error }) {
  const { loginWithRedirect } = useAuth0()

  return (
    <PenniesShell>
      <section className="auth-panel">
        <h2>Welcome</h2>
        <p>Log in or create an account to see your spending.</p>
        {error && <p className="status">Error: {error.message}</p>}
        <div className="auth-actions">
          <button type="button" className="primary" onClick={() => loginWithRedirect()}>
            Log in
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              loginWithRedirect({
                authorizationParams: { screen_hint: 'signup' },
              })
            }
          >
            Sign up
          </button>
        </div>
      </section>
    </PenniesShell>
  )
}

function AboutYouDialog({ onSaved }) {
  const dialogRef = useRef(null)
  const { getAccessTokenSilently } = useAuth0()
  const [firstName, setFirstName] = useState('')
  const [problem, setProblem] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  async function submit(event) {
    event.preventDefault()
    const nameProblem = firstNameError(firstName)
    if (nameProblem) {
      setProblem(nameProblem)
      return
    }
    setSending(true)
    setProblem('')
    try {
      const headers = await authHeaders(getAccessTokenSilently)
      const response = await fetch(`${apiUrl}/me`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: firstName.trim() }),
      })
      if (!response.ok) throw new Error('save')
      const body = await response.json()
      onSaved(body.display_name)
    } catch {
      setSending(false)
      setProblem('Pennies could not save your name.')
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="about-you"
      aria-labelledby="about-you-title"
      onCancel={(event) => event.preventDefault()}
    >
      <form onSubmit={submit}>
        <img className="about-you-portrait" src={pennieRound} alt="Penny" />
        <h2 id="about-you-title">Tell Penny about yourself</h2>
        <label>
          First name
          <input
            value={firstName}
            maxLength={80}
            autoComplete="given-name"
            onChange={(event) => setFirstName(event.target.value)}
          />
        </label>
        {problem && <p className="status">{problem}</p>}
        <div className="auth-actions">
          <button type="submit" className="primary" disabled={sending}>
            Save
          </button>
        </div>
      </form>
    </dialog>
  )
}

function SpendingHabitsScreen() {
  const navigate = useNavigate()
  const { logout } = useAuth0()
  return (
    <SpendingHabitsPage
      onBack={() => navigate('/')}
      onLogout={() => logout({ logoutParams: { returnTo: window.location.origin } })}
    />
  )
}

function RecommendationsScreen() {
  const navigate = useNavigate()
  const { logout } = useAuth0()
  return (
    <RecommendationsPage
      onBack={() => navigate('/')}
      onOpenGuide={(guide) => navigate(`/guides/${guide.id}`)}
      onLogout={() => logout({ logoutParams: { returnTo: window.location.origin } })}
    />
  )
}

function AuthedScreens() {
  const { logout, getAccessTokenSilently } = useAuth0()
  const [displayName, setDisplayName] = useState(undefined)

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      try {
        const headers = await authHeaders(getAccessTokenSilently)
        const response = await fetch(`${apiUrl}/me`, { headers })
        if (!response.ok) throw new Error('load')
        const body = await response.json()
        if (!cancelled) setDisplayName(body.display_name)
      } catch {
        if (!cancelled) setDisplayName(null)
      }
    }

    loadProfile()
    return () => {
      cancelled = true
    }
  }, [getAccessTokenSilently])

  const signOut = () => logout({ logoutParams: { returnTo: window.location.origin } })

  if (displayName === undefined) {
    return (
      <PenniesShell onLogout={signOut}>
        <p className="status">Loading…</p>
      </PenniesShell>
    )
  }

  return (
    <>
      {!displayName && <AboutYouDialog onSaved={setDisplayName} />}
      <Routes>
        <Route path="/" element={<Dashboard name={displayName || ''} />} />
        <Route path="/spending-habits" element={<SpendingHabitsScreen />} />
        <Route path="/recommendations" element={<RecommendationsScreen />} />
        <Route path="/guides/:guideId" element={<GuidePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

function App() {
  const { isLoading, isAuthenticated, error } = useAuth0()

  let screen
  if (isLoading) {
    screen = (
      <PenniesShell>
        <p className="status">Loading…</p>
      </PenniesShell>
    )
  } else if (!isAuthenticated) {
    screen = <Welcome error={error} />
  } else {
    screen = <AuthedScreens />
  }

  return <BrowserRouter>{screen}</BrowserRouter>
}

export default App
