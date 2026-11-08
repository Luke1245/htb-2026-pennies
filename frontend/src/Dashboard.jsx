import { useEffect, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import './dashboard.css'
import { AddTransaction } from './AddTransaction.jsx'
import { apiUrl, authHeaders } from './api.js'
import { GuideCards, GuideView } from './Guides.jsx'
import { useGuideRoute } from './useGuideRoute.js'
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

async function api(path, token, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.detail || loadMessage)
  }
  return body
}

export default function Dashboard() {
  const { user, logout, getAccessTokenSilently } = useAuth0()
  const { selectedGuide, openGuide, closeGuide } = useGuideRoute()
  const greeting = greetingFor(new Date())
  const name = user?.given_name || user?.name || 'Elodie'
  const [figures, setFigures] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [sharingMode, setSharingMode] = useState('raw')
  const [portrait, setPortrait] = useState(null)
  const [readingPending, setReadingPending] = useState(false)
  const [readingNote, setReadingNote] = useState('')
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
        if (cancelled) return
        setFigures(dashboard)
        setTransactions(page.transactions)
        await loadReading(headers, page.transactions, dashboard)
      } catch {
        if (!cancelled) {
          setStatus(afterRecord ? `${recordedMessage}. ${loadMessage}` : loadMessage)
        }
      }
    }

    async function loadReading(headers, pageTransactions, dashboard) {
      setReadingPending(true)
      try {
        const token = headers.Authorization.replace('Bearer ', '')
        const [sharingResponse, readingResponse] = await Promise.all([
          fetch(`${apiUrl}/sharing-mode`, { headers }),
          fetch(`${apiUrl}/reading`, { headers }),
        ])
        if (cancelled) return
        const sharing = sharingResponse.ok ? await sharingResponse.json() : { mode: 'raw' }
        const reading = readingResponse.ok ? await readingResponse.json() : { reading: null }
        setSharingMode(sharing.mode || 'raw')
        setPortrait(reading.reading)
        const hasHistory =
          pageTransactions.some((transaction) => transaction.kind === 'ordinary') ||
          Number(dashboard.subscriptions) > 0
        if (!hasHistory || reading.reading) return
        const updated = await api('/reading', token, { method: 'POST' })
        if (cancelled) return
        setPortrait(updated.reading)
        setSharingMode(updated.sharing_mode)
        if (!updated.updated) setReadingNote('Pennies could not update your reading.')
        const [refreshedDashboard, refreshedTransactions] = await Promise.all([
          api('/dashboard', token),
          api('/transactions?limit=20', token),
        ])
        if (cancelled) return
        setFigures(refreshedDashboard)
        setTransactions(refreshedTransactions.transactions)
      } catch {
        if (!cancelled) setReadingNote('Pennies could not update your reading.')
      } finally {
        if (!cancelled) setReadingPending(false)
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

  async function onSharingMode(mode) {
    if (mode === sharingMode) return
    try {
      const headers = await authHeaders(getAccessTokenSilently)
      const saved = await api('/sharing-mode', headers.Authorization.replace('Bearer ', ''), {
        method: 'PUT',
        body: JSON.stringify({ mode }),
      })
      setSharingMode(saved.mode)
      setPortrait(null)
      setReadingPending(true)
      setReadingNote('')
      const updated = await api('/reading', headers.Authorization.replace('Bearer ', ''), {
        method: 'POST',
      })
      setPortrait(updated.reading)
      if (!updated.updated && !updated.reading) {
        setReadingNote('Pennies could not update your reading.')
      }
    } catch {
      setReadingNote('Pennies could not update your reading.')
    } finally {
      setReadingPending(false)
    }
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
          <button
            type="button"
            className={sharingMode === 'raw' ? 'sharing active' : 'sharing'}
            onClick={() => onSharingMode('raw')}
          >
            Raw
          </button>
          <button
            type="button"
            className={sharingMode === 'sanitised' ? 'sharing active' : 'sharing'}
            onClick={() => onSharingMode('sanitised')}
          >
            Sanitised
          </button>
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
        {selectedGuide ? (
          <GuideView guide={selectedGuide} onBack={closeGuide} />
        ) : (
          <>
            <p className="greeting">
              {greeting}, {name}
            </p>
            {status && <p className="status">{status}</p>}
            {!status && !figures && <p className="status">Loading…</p>}
            {figures && (
              <div className="tiles">
                <section className="tile wide">
                  <h2>Financial portrait</h2>
                  {readingPending && <p className="status">Reading your spending…</p>}
                  {readingNote && <p className="status">{readingNote}</p>}
                  {portrait ? (
                    <>
                      <p className="reading">{portrait.reading}</p>
                      <h3>Spending habits</h3>
                      <HabitList items={portrait.spending_habits} empty="No spending habits yet" />
                      <h3>Projected habits</h3>
                      <HabitList items={portrait.projected_habits} empty="No projected habits yet" />
                      <h3>Education</h3>
                      {portrait.educations.length === 0 ? (
                        <p className="status">No education yet</p>
                      ) : (
                        portrait.educations.map((education) => (
                          <article key={education.id} className="reading-block">
                            <h4>{education.subject}</h4>
                            <p>{education.body}</p>
                          </article>
                        ))
                      )}
                      <h3>Suggestions</h3>
                      {portrait.suggestions.length === 0 ? (
                        <p className="status">No suggestions yet</p>
                      ) : (
                        <ul className="suggestions">
                          {portrait.suggestions.map((suggestion) => (
                            <li key={suggestion.id}>{suggestion.body}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    !readingPending && <p className="status">No reading yet</p>
                  )}
                </section>
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
            <GuideCards
              guides={guides}
              onSelect={(guide) => {
                setFormOpen(false)
                openGuide(guide)
              }}
            />
          </>
        )}
      </main>
    </div>
  )
}

function HabitList({ items, empty }) {
  if (!items || items.length === 0) return <p className="status">{empty}</p>
  return (
    <ul className="suggestions">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
