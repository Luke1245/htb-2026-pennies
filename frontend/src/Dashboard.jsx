import { useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import './dashboard.css'
import { GuideCards, GuideView } from './Guides.jsx'
import { useGuideRoute } from './useGuideRoute.js'
import { guides } from './guides.js'

const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

function greetingFor(date) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function pounds(value) {
  const amount = Number(value)
  const text = `£${Math.abs(amount).toFixed(2)}`
  return amount < 0 ? `-${text}` : text
}

function signedPounds(value) {
  const amount = Number(value)
  const text = pounds(Math.abs(amount))
  if (amount < 0) return `-${text}`
  if (amount > 0) return `+${text}`
  return text
}

function whenLabel(occurredAt) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
  }).format(new Date(occurredAt))
}

export default function Dashboard() {
  const { user, logout, getAccessTokenSilently } = useAuth0()
  const { selectedGuide, openGuide, closeGuide } = useGuideRoute()
  const greeting = greetingFor(new Date())
  const name = user?.given_name || user?.name || 'Elodie'
  const [figures, setFigures] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const audience = import.meta.env.VITE_AUTH0_AUDIENCE
        const token = await getAccessTokenSilently({
          authorizationParams: audience ? { audience } : undefined,
        })
        const headers = { Authorization: `Bearer ${token}` }
        const [dashboardResponse, transactionResponse] = await Promise.all([
          fetch(`${apiUrl}/dashboard`, { headers }),
          fetch(`${apiUrl}/transactions?limit=20`, { headers }),
        ])
        if (!dashboardResponse.ok || !transactionResponse.ok) {
          throw new Error('Pennies could not load your records')
        }
        const dashboard = await dashboardResponse.json()
        const page = await transactionResponse.json()
        if (!cancelled) {
          setFigures(dashboard)
          setTransactions(page.transactions)
        }
      } catch {
        if (!cancelled) setError('Pennies could not load your records')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [getAccessTokenSilently])

  const largest = figures?.categories.reduce(
    (highest, category) => Math.max(highest, Number(category.amount)),
    0,
  )

  return (
    <div className="dashboard">
      <header className="banner">
        <h1>Pennies</h1>
        <button
          type="button"
          className="logout"
          onClick={() =>
            logout({ logoutParams: { returnTo: window.location.origin } })
          }
        >
          Log out
        </button>
      </header>
      <main className="dashboard-main">
        {selectedGuide ? (
          <GuideView guide={selectedGuide} onBack={closeGuide} />
        ) : (
          <>
            <p className="greeting">
              {greeting}, {name}
            </p>
            {error && <p className="status">{error}</p>}
            {!error && !figures && <p className="status">Loading…</p>}
            {figures && (
              <div className="tiles">
                <section className="tile">
                  <h2>Spent this month</h2>
                  <p className="stat">{pounds(figures.spent_this_month)}</p>
                </section>
                <section className="tile">
                  <h2>Left to spend</h2>
                  <p className="stat">{pounds(figures.left_to_spend)}</p>
                </section>
                <section className="tile">
                  <h2>Spending insights</h2>
                  {figures.categories.length === 0 ? (
                    <p className="status">No spending this month</p>
                  ) : (
                    <ul className="bars">
                      {figures.categories.map((category) => (
                        <li key={category.name}>
                          <span>{category.name}</span>
                          <span className="bar" aria-hidden="true">
                            <span
                              style={{
                                width: `${largest ? (Number(category.amount) / largest) * 100 : 0}%`,
                              }}
                            />
                          </span>
                          <span>{pounds(category.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="tile">
                  <h2>Recent transactions</h2>
                  {transactions.length === 0 ? (
                    <p className="status">No transactions yet</p>
                  ) : (
                    <ul className="transactions">
                      {transactions.map((transaction) => (
                        <li key={transaction.id}>
                          <span>
                            {transaction.vendor || transaction.category}
                            <small>{whenLabel(transaction.occurred_at)}</small>
                          </span>
                          <span>{signedPounds(transaction.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
            <GuideCards guides={guides} onSelect={openGuide} />
          </>
        )}
      </main>
    </div>
  )
}
