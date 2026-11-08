import { useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import './dashboard.css'
import './App.css'
import Dashboard from './Dashboard.jsx'
import SpendingHabitsPage from './SpendingHabitsPage.jsx'
import RecommendationsPage from './RecommendationsPage.jsx'

function PenniesShell({ children }) {
  return (
    <div className="dashboard">
      <header className="banner">
        <h1>Pennies</h1>
      </header>
      <main className="dashboard-main">{children}</main>
    </div>
  )
}

function App() {
  const { isLoading, isAuthenticated, error, loginWithRedirect, logout } = useAuth0()
  const [page, setPage] = useState('dashboard')
  const [hasOpenedHabits, setHasOpenedHabits] = useState(false)
  const [hasOpenedRecommendations, setHasOpenedRecommendations] = useState(false)

  if (isLoading) {
    return (
      <PenniesShell>
        <p className="status">Loading…</p>
      </PenniesShell>
    )
  }

  if (!isAuthenticated) {
    return (
      <PenniesShell>
        <section className="auth-panel">
          <h2>Welcome</h2>
          <p>Log in or create an account to see your spending.</p>
          {error && <p className="status">Error: {error.message}</p>}
          <div className="auth-actions">
            <button
              type="button"
              className="primary"
              onClick={() => loginWithRedirect()}
            >
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

  const openHabits = () => {
    setHasOpenedHabits(true)
    setPage('spending-habits')
  }

  const openRecommendations = () => {
    setHasOpenedRecommendations(true)
    setPage('recommendations')
  }

  const openGuideFromRecommendations = (guide) => {
    window.location.hash = `#guide/${guide.id}`
    setPage('dashboard')
  }

  return (
    <>
      <div hidden={page !== 'dashboard'}>
        <Dashboard onViewSpendingHabits={openHabits} onViewRecommendations={openRecommendations} />
      </div>
      {hasOpenedHabits && (
        <div hidden={page !== 'spending-habits'}>
          <SpendingHabitsPage
            isActive={page === 'spending-habits'}
            onBack={() => setPage('dashboard')}
            onLogout={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          />
        </div>
      )}
      {hasOpenedRecommendations && (
        <div hidden={page !== 'recommendations'}>
          <RecommendationsPage
            isActive={page === 'recommendations'}
            onBack={() => setPage('dashboard')}
            onOpenGuide={openGuideFromRecommendations}
            onLogout={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          />
        </div>
      )}
    </>
  )
}

export default App
