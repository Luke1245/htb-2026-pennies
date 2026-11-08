import { useEffect, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { Link, useNavigate } from 'react-router'
import './dashboard.css'
import { AddAccount } from './AddAccount.jsx'
import { AddTransaction } from './AddTransaction.jsx'
import { apiUrl, authHeaders } from './api.js'
import { GuideCards } from './Guides.jsx'
import { guides } from './guides.js'

const recordedMessage = 'Transaction recorded'
const accountRecordedMessage = 'Account recorded'
const loadMessage = 'Pennies could not load your records'

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

export default function Dashboard({ name }) {
  const { logout, getAccessTokenSilently } = useAuth0()
  const navigate = useNavigate()
  const [figures, setFigures] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [status, setStatus] = useState('')
  const [accounts, setAccounts] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [accountFormOpen, setAccountFormOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [recommendedGuideIds, setRecommendedGuideIds] = useState([])
  const recorded = useRef(false)

  useEffect(() => {
    const afterRecord = recorded.current
    let cancelled = false

    async function load() {
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
    }

    async function loadRecommendedGuides() {
      try {
        const headers = await authHeaders(getAccessTokenSilently)
        const response = await fetch(`${apiUrl}/reading`, { headers })
        if (!response.ok) throw new Error(loadMessage)
        const body = await response.json()
        const recommended = (body.reading?.recommendations || [])
          .filter(
            (recommendation) =>
              recommendation.kind === 'guide' && recommendation.guide_id !== 'budgeting-basics',
          )
          .map((recommendation) => recommendation.guide_id)
        if (!cancelled) setRecommendedGuideIds(recommended)
      } catch {
        if (!cancelled) setRecommendedGuideIds([])
      }
    }

    load().catch(() => {
      if (!cancelled) {
        setStatus(afterRecord ? `${recordedMessage}. ${loadMessage}` : loadMessage)
      }
    })
    loadRecommendedGuides()
    return () => {
      cancelled = true
    }
  }, [getAccessTokenSilently, reloadKey])

  function openAccountForm() {
    if (accountFormOpen) return
    setFormOpen(false)
    setStatus('')
    setAccountFormOpen(true)
  }

  function closeAccountForm() {
    setAccountFormOpen(false)
  }

  function handleAccountRecorded() {
    setAccountFormOpen(false)
    setStatus(accountRecordedMessage)
    setReloadKey((key) => key + 1)
  }

  async function openForm() {
    if (formOpen) return
    setAccountFormOpen(false)
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
    window.dispatchEvent(new Event('pennies:transactions-changed'))
  }

  const subscriptionTotal = Number(figures?.subscriptions || 0)
  const largest = Math.max(
    subscriptionTotal,
    ...(figures?.categories.map((category) => Number(category.amount)) || [0]),
  )
  const noSpending = figures && figures.categories.length === 0 && subscriptionTotal === 0

  return (
    <div className="dashboard">
      <header className="banner">
        <h1>Pennies</h1>
        <div className="banner-actions">
          <Link to="/accounts" className="logout">
            Accounts
          </Link>
          <button
            type="button"
            className="logout"
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          >
            Log out
          </button>
        </div>
      </header>
      <main className="dashboard-main">
            {name && <p className="greeting">Hi, {name}</p>}
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
                  {noSpending ? (
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
                      {subscriptionTotal > 0 && (
                        <li>
                          <span>Subscriptions</span>
                          <span className="bar" aria-hidden="true">
                            <span
                              style={{
                                width: `${largest ? (subscriptionTotal / largest) * 100 : 0}%`,
                              }}
                            />
                          </span>
                          <span>{pounds(figures.subscriptions)}</span>
                        </li>
                      )}
                    </ul>
                  )}
                  <Link to="/spending-habits" className="habits-link">
                    View spending habits <span aria-hidden="true">→</span>
                  </Link>
                </section>
                <section className="tile">
                  {!formOpen && !accountFormOpen && (
                    <div className="tile-heading">
                      <h2>Recent transactions</h2>
                      <div className="tile-actions">
                        <button
                          type="button"
                          className="add-account"
                          onClick={openAccountForm}
                        >
                          Add account
                        </button>
                        <button type="button" className="add-transaction" onClick={openForm}>
                          Add transaction
                        </button>
                      </div>
                    </div>
                  )}
                  {accountFormOpen && (
                    <AddAccount
                      getAccessTokenSilently={getAccessTokenSilently}
                      onRecorded={handleAccountRecorded}
                      onCancel={closeAccountForm}
                    />
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
                            <small>
                              {transaction.vendor ? `${transaction.category} · ` : ''}
                              {whenLabel(transaction.occurred_at)}
                            </small>
                          </span>
                          <span>{signedPounds(transaction.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
            <Link to="/recommendations" className="recommendations-link">
              See what Pennies recommends for you <span aria-hidden="true">→</span>
            </Link>
            <GuideCards
              guides={guides}
              recommendedIds={recommendedGuideIds}
              onSelect={(guide) => navigate(`/guides/${guide.id}`)}
            />
      </main>
    </div>
  )
}
