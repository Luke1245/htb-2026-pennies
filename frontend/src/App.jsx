import { useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import './App.css'
import Dashboard from './Dashboard.jsx'
import SpendingHabitsPage from './SpendingHabitsPage.jsx'

function App() {
  const { isLoading, isAuthenticated, error, loginWithRedirect, logout } = useAuth0()
  const [page, setPage] = useState('dashboard')
  const [hasOpenedHabits, setHasOpenedHabits] = useState(false)

  if (isLoading) {
    return (
      <main className="screen">
        <p>Loading…</p>
      </main>
    )
  }

  if (!isAuthenticated) {
    return (
      <main className="screen">
        <h1>Log in</h1>
        {error && <p>Error: {error.message}</p>}
        <button
          type="button"
          className="login"
          onClick={() => loginWithRedirect()}
        >
          Log in
        </button>
      </main>
    )
  }

  const openHabits = () => {
    setHasOpenedHabits(true)
    setPage('spending-habits')
  }

  return (
    <>
      <div hidden={page !== 'dashboard'}>
        <Dashboard onViewSpendingHabits={openHabits} />
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
    </>
  )
}

export default App
