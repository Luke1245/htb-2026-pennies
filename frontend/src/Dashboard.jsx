import { useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import './dashboard.css'
import { GuideCards, GuideView } from './Guides.jsx'

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
    throw new Error(body.detail || 'Pennies could not load your records')
  }
  return body
}

export default function Dashboard() {
  const { user, logout, getAccessTokenSilently } = useAuth0()
  const [selectedGuide, setSelectedGuide] = useState(null)
  const greeting = greetingFor(new Date())
  const name = user?.given_name || user?.name || 'Elodie'
  const [figures, setFigures] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [guideList, setGuideList] = useState([])
  const [sharingMode, setSharingMode] = useState('raw')
  const [portrait, setPortrait] = useState(null)
  const [readingPending, setReadingPending] = useState(false)
  const [readingNote, setReadingNote] = useState('')
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
        const [dashboardResponse, transactionResponse, guideResponse, sharingResponse, readingResponse] =
          await Promise.all([
            fetch(`${apiUrl}/dashboard`, { headers }),
            fetch(`${apiUrl}/transactions?limit=20`, { headers }),
            fetch(`${apiUrl}/guides`, { headers }),
            fetch(`${apiUrl}/sharing-mode`, { headers }),
            fetch(`${apiUrl}/reading`, { headers }),
          ])
        if (!dashboardResponse.ok || !transactionResponse.ok || !guideResponse.ok) {
          throw new Error('Pennies could not load your records')
        }
        const dashboard = await dashboardResponse.json()
        const page = await transactionResponse.json()
        const guides = await guideResponse.json()
        const sharing = sharingResponse.ok ? await sharingResponse.json() : { mode: 'raw' }
        const reading = readingResponse.ok ? await readingResponse.json() : { reading: null }
        if (cancelled) return
        setFigures(dashboard)
        setTransactions(page.transactions)
        setGuideList(guides)
        setSharingMode(sharing.mode)
        setPortrait(reading.reading)
        const hasHistory =
          page.transactions.some((transaction) => transaction.kind === 'ordinary') ||
          Number(dashboard.subscriptions) > 0
        if (hasHistory && !reading.reading) {
          setReadingPending(true)
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
        }
      } catch {
        if (!cancelled) setError('Pennies could not load your records')
      } finally {
        if (!cancelled) setReadingPending(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [getAccessTokenSilently])

  async function onSharingMode(mode) {
    if (mode === sharingMode) return
    try {
      const audience = import.meta.env.VITE_AUTH0_AUDIENCE
      const token = await getAccessTokenSilently({
        authorizationParams: audience ? { audience } : undefined,
      })
      const saved = await api('/sharing-mode', token, {
        method: 'PUT',
        body: JSON.stringify({ mode }),
      })
      setSharingMode(saved.mode)
      setPortrait(null)
      setReadingPending(true)
      setReadingNote('')
      const updated = await api('/reading', token, { method: 'POST' })
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
          <GuideView guide={selectedGuide} onBack={() => setSelectedGuide(null)} />
        ) : (
          <>
            <p className="greeting">
              {greeting}, {name}
            </p>
            {error && <p className="status">{error}</p>}
            {!error && !figures && <p className="status">Loading…</p>}
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
                        <Bar key={category.name} label={category.name} amount={category.amount} largest={largest} />
                      ))}
                      {subscriptionTotal > 0 && (
                        <Bar label="Subscriptions" amount={figures.subscriptions} largest={largest} />
                      )}
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
            <GuideCards guides={guideList} onSelect={setSelectedGuide} />
          </>
        )}
      </main>
    </div>
  )
}

function Bar({ label, amount, largest }) {
  return (
    <li>
      <span>{label}</span>
      <span className="bar" aria-hidden="true">
        <span style={{ width: `${largest ? (Number(amount) / largest) * 100 : 0}%` }} />
      </span>
      <span>{pounds(amount)}</span>
    </li>
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
