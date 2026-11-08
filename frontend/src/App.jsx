import { useAuth0 } from '@auth0/auth0-react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router'
import './dashboard.css'
import './App.css'
import AccountsPage from './AccountsPage.jsx'
import Dashboard from './Dashboard.jsx'
import { GuidePage } from './Guides.jsx'
import RecommendationsPage from './RecommendationsPage.jsx'
import SpendingHabitsPage from './SpendingHabitsPage.jsx'
import TransactionsPage from './TransactionsPage.jsx'

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
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/accounts" element={<AccountsPage />} />
      <Route path="/transactions" element={<TransactionsPage />} />
      <Route path="/spending-habits" element={<SpendingHabitsScreen />} />
      <Route path="/recommendations" element={<RecommendationsScreen />} />
      <Route path="/guides/:guideId" element={<GuidePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  const { isLoading, isAuthenticated, error, loginWithRedirect } = useAuth0()

  let screen
  if (isLoading) {
    screen = (
      <PenniesShell>
        <p className="status">Loading…</p>
      </PenniesShell>
    )
  } else if (!isAuthenticated) {
    screen = (
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
  } else {
    screen = <AuthedScreens />
  }

  return <BrowserRouter>{screen}</BrowserRouter>
}

export default App
