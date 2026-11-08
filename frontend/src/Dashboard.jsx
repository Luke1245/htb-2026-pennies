import { useEffect, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import './dashboard.css'
import { AddTransaction } from './AddTransaction.jsx'
import { apiUrl, authHeaders } from './api.js'
import { GuideCards, GuideView } from './Guides.jsx'
import { guides } from './guides.js'

const recordedMessage = 'Transaction recorded'
const loadMessage = 'Pennies could not load your records'

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
  const [selectedGuide, setSelectedGuide] = useState(null)
  const greeting = greetingFor(new Date())
  const name = user?.given_name || user?.name || 'Elodie'
  const [figures, setFigures] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [status, setStatus] = useState('')
  const [accounts, setAccounts] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const recorded = useRef(false)

  useEffect(() => {
    const afterRecord = recorded.current
    let cancelled = false

    async function load() {
      try {
        const headers = await authHeaders(getAccessTokenSilently)
        const [dashboardResponse, transactionResponse] = await Promise.all([
          fetch(`${apiUrl}/dashboard`, { headers }),
          fetch(`${apiUrl}/transactions?limit=20`, { headers }),
        ])
        if (!dashboardResponse.ok || !transactionResponse.ok) {
          throw new Error(loadMessage)
        }
        const dashboard = await dashboardResponse.json()
        const page = await transactionResponse.json()
        if (!cancelled) {
          setFigures(dashboard)
          setTransactions(page.transactions)
        }
      } catch {
        if (!cancelled) {
          setStatus(afterRecord ? `${recordedMessage}. ${loadMessage}` : loadMessage)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [getAccessTokenSilently, reloadKey])

  async function openForm() {
    if (formOpen) return
    try {
      const headers = await authHeaders(getAccessTokenSilently)
      const response = await fetch(`${apiUrl}/accounts`, { headers })
      if (!response.ok) throw new Error(loadMessage)
      const list = await response.json()
      if (list.length === 0) {
        setFormOpen(false)
        setStatus('An Account is needed.')
        return
      }
      recorded.current = false
      setAccounts(list)
      setStatus('')
      setFormOpen(true)
    } catch {
      setFormOpen(false)
      setStatus(loadMessage)
    }
  }

  function closeForm() {
    setFormOpen(false)
  }

  function handleRecorded() {
    recorded.current = true
    setFormOpen(false)
    setStatus(recordedMessage)
    setReloadKey((key) => key + 1)
  }

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
          <GuideView guide={selectedGuide} onBack={() => setSelectedGuide(null)} />
        ) : (
          <>
            <p className="greeting">
              {greeting}, {name}
            </p>
            {status && <p className="status">{status}</p>}
            {!status && !figures && <p className="status">Loading…</p>}
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
                  {!formOpen && (
                    <div className="tile-heading">
                      <h2>Recent transactions</h2>
                      <button type="button" className="add-transaction" onClick={openForm}>
                        Add transaction
                      </button>
                    </div>
                  )}
                  {formOpen && (
                    <AddTransaction
                      accounts={accounts}
                      getAccessTokenSilently={getAccessTokenSilently}
                      onRecorded={handleRecorded}
                      onCancel={closeForm}
                    />
                  )}
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
            <GuideCards
              guides={guides}
              onSelect={(guide) => {
                setFormOpen(false)
                setSelectedGuide(guide)
              }}
            />
          </>
        )}
      </main>
    </div>
  )
}
