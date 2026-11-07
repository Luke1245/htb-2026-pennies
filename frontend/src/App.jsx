import { useAuth0 } from '@auth0/auth0-react'
import './App.css'
import Dashboard from './dashboard.jsx'

function App() {
  const { isLoading, isAuthenticated, error, loginWithRedirect } = useAuth0()

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

  return <Dashboard />
}

export default App
