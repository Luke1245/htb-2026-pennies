import { useEffect, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { Link, useNavigate } from 'react-router'
import { apiUrl, authHeaders } from './api.js'
import { movementName } from './movementName.js'

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
    year: 'numeric',
  }).format(new Date(occurredAt))
}

export default function TransactionsPage() {
  const navigate = useNavigate()
  const { logout, getAccessTokenSilently } = useAuth0()
  const tokenProvider = useRef(getAccessTokenSilently)
  useEffect(() => {
    tokenProvider.current = getAccessTokenSilently
  }, [getAccessTokenSilently])
  const [transactions, setTransactions] = useState([])
  const [status, setStatus] = useState('loading')
  const [problem, setProblem] = useState('')
  const [deletingId, setDeletingId] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const headers = await authHeaders(tokenProvider.current)
      const collected = []
      const seenOffsets = new Set()
      let offset = 0
      while (!seenOffsets.has(offset)) {
        seenOffsets.add(offset)
        const response = await fetch(`${apiUrl}/transactions?limit=100&offset=${offset}`, { headers })
        if (!response.ok) throw new Error('Pennies could not load your transactions')
        const page = await response.json()
        collected.push(...page.transactions)
        if (page.next_offset == null) break
        offset = page.next_offset
      }
      if (!cancelled) {
        setTransactions(collected)
        setStatus('ready')
      }
    }
    load().catch(() => {
      if (!cancelled) {
        setProblem('Pennies could not load your transactions')
        setStatus('ready')
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function removeTransaction(transaction) {
    setDeletingId(transaction.id)
    setProblem('')
    try {
      const headers = await authHeaders(tokenProvider.current)
      const response = await fetch(`${apiUrl}/transactions/${transaction.id}`, {
        method: 'DELETE',
        headers,
      })
      if (!response.ok) throw new Error('Pennies could not delete this transaction')
      const body = await response.json()
      const removed = new Set(body.ids || [transaction.id])
      setTransactions((current) => current.filter((item) => !removed.has(item.id)))
      window.dispatchEvent(new Event('pennies:transactions-changed'))
    } catch {
      setProblem('Pennies could not delete this transaction')
    } finally {
      setDeletingId('')
    }
  }

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
        <button type="button" className="back-button" onClick={() => navigate('/')}>
          ← Back to dashboard
        </button>
        <h2 className="page-heading">Transactions</h2>
        {status === 'loading' && <p className="status">Loading…</p>}
        {problem && (
          <p className="status" role="alert">
            {problem}
          </p>
        )}
        {status === 'ready' && transactions.length === 0 && !problem && (
          <p className="status">No transactions yet</p>
        )}
        <ul className="transactions">
          {transactions.map((transaction) => (
            <li key={transaction.id}>
              <span>
                {movementName(transaction)}
                <small>
                  {transaction.vendor ? `${transaction.category} · ` : ''}
                  {whenLabel(transaction.occurred_at)}
                </small>
              </span>
              <span>{signedPounds(transaction.amount)}</span>
              <button
                type="button"
                className="delete-transaction"
                aria-label={`Delete ${movementName(transaction)}`}
                disabled={deletingId === transaction.id}
                onClick={() => removeTransaction(transaction)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
