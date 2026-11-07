import { useAuth0 } from '@auth0/auth0-react'
import './App.css'

function App() {
  const { isLoading, isAuthenticated, error, loginWithRedirect, logout } =
    useAuth0()

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
        <button type="button" className="login" onClick={() => loginWithRedirect()}>
          Log in
        </button>
      </main>
    )
  }

  return (
    <main>
      <h1>Hello, World!</h1>
      <button
        type="button"
        className="login"
        onClick={() =>
          logout({ logoutParams: { returnTo: window.location.origin } })
        }
      >
        Log out
      </button>
    </main>
  )
}

export default App