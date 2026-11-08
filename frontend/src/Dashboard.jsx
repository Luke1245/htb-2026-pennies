import { useEffect, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { Link, useNavigate } from 'react-router'
import './dashboard.css'
import { AddTransaction } from './AddTransaction.jsx'
import { AddTransfer } from './AddTransfer.jsx'
import { apiUrl, authHeaders } from './api.js'
import { accountNamesById, movementName, transactionDetail } from './movementName.js'
import { GuideCards } from './Guides.jsx'
import { guides } from './guides.js'

const recordedMessage = 'Transaction recorded'
const transferRecordedMessage = 'Transfer recorded'
const loadMessage = 'Pennies could not load your records'
const BUDGET_AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/

function londonYearMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date)
  return {
    year: Number(parts.find((part) => part.type === 'year').value),
    month: Number(parts.find((part) => part.type === 'month').value),
    label: new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', month: 'long' }).format(date),
  }
}

function budgetPounds(raw) {
  const text = raw.trim()
  const [whole, fraction = ''] = text.split('.')
  return `${whole}.${(fraction + '00').slice(0, 2)}`
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

export default function Dashboard({ name }) {
  const { logout, getAccessTokenSilently } = useAuth0()
  const navigate = useNavigate()
  const [figures, setFigures] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [accountNames, setAccountNames] = useState({})
  const [status, setStatus] = useState('')
  const [accounts, setAccounts] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [transferFormOpen, setTransferFormOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [recommendedGuideIds, setRecommendedGuideIds] = useState([])
  const [budgetFormOpen, setBudgetFormOpen] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState('')
  const [budgetProblem, setBudgetProblem] = useState('')
  const [savingBudget, setSavingBudget] = useState(false)
  const recordedLabel = useRef('')

  useEffect(() => {
    const afterRecord = recordedLabel.current
    let cancelled = false

    async function load() {
      const headers = await authHeaders(getAccessTokenSilently)
      const [dashboardResponse, transactionResponse, accountResponse] = await Promise.all([
        fetch(`${apiUrl}/dashboard`, { headers }),
        fetch(`${apiUrl}/transactions?limit=3`, { headers }),
        fetch(`${apiUrl}/accounts`, { headers }),
      ])
      if (!dashboardResponse.ok || !transactionResponse.ok) {
        throw new Error(loadMessage)
      }
      const dashboard = await dashboardResponse.json()
      const page = await transactionResponse.json()
      const names = accountResponse.ok ? accountNamesById(await accountResponse.json()) : {}
      if (!cancelled) {
        setFigures(dashboard)
        setTransactions(page.transactions)
        setAccountNames(names)
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
        setStatus(afterRecord ? `${afterRecord}. ${loadMessage}` : loadMessage)
      }
    })
    loadRecommendedGuides()
    return () => {
      cancelled = true
    }
  }, [getAccessTokenSilently, reloadKey])

  function openBudgetForm() {
    setBudgetDraft(figures?.monthly_budget ?? '')
    setBudgetProblem('')
    setBudgetFormOpen(true)
  }

  async function saveBudget(event) {
    event.preventDefault()
    if (savingBudget) return
    const amount = budgetDraft.trim()
    if (!BUDGET_AMOUNT.test(amount)) {
      setBudgetProblem('Enter a budget in pounds and pence.')
      return
    }
    setSavingBudget(true)
    setBudgetProblem('')
    const period = londonYearMonth()
    try {
      const headers = await authHeaders(getAccessTokenSilently)
      const response = await fetch(`${apiUrl}/monthly-budgets/${period.year}/${period.month}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: budgetPounds(amount) }),
      })
      if (!response.ok) throw new Error('Pennies could not save this budget')
      setBudgetFormOpen(false)
      setReloadKey((key) => key + 1)
    } catch {
      setBudgetProblem('Pennies could not save this budget')
    } finally {
      setSavingBudget(false)
    }
  }

  async function openForm() {
    if (formOpen) return
    setTransferFormOpen(false)
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
      recordedLabel.current = ''
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

  async function openTransfer() {
    if (transferFormOpen) return
    setFormOpen(false)
    try {
      const headers = await authHeaders(getAccessTokenSilently)
      const response = await fetch(`${apiUrl}/accounts`, { headers })
      if (!response.ok) throw new Error(loadMessage)
      const list = await response.json()
      if (list.length < 2) {
        setTransferFormOpen(false)
        setStatus('Two Accounts are needed.')
        return
      }
      recordedLabel.current = ''
      setAccounts(list)
      setStatus('')
      setTransferFormOpen(true)
    } catch {
      setTransferFormOpen(false)
      setStatus(loadMessage)
    }
  }

  function closeTransfer() {
    setTransferFormOpen(false)
  }

  function handleRecorded() {
    recordedLabel.current = recordedMessage
    setFormOpen(false)
    setStatus(recordedMessage)
    setReloadKey((key) => key + 1)
    window.dispatchEvent(new Event('pennies:transactions-changed'))
  }

  function handleTransferRecorded() {
    recordedLabel.current = transferRecordedMessage
    setTransferFormOpen(false)
    setStatus(transferRecordedMessage)
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
                  <div className="tile-heading">
                    <h2>Left to spend</h2>
                    {!budgetFormOpen && (
                      <button type="button" className="add-account" onClick={openBudgetForm}>
                        {figures.monthly_budget == null ? 'Set budget' : 'Edit budget'}
                      </button>
                    )}
                  </div>
                  {budgetFormOpen ? (
                    <form className="record-form" aria-label="Monthly budget" onSubmit={saveBudget}>
                      <label>
                        {londonYearMonth().label} budget
                        <input
                          inputMode="decimal"
                          value={budgetDraft}
                          onChange={(event) => setBudgetDraft(event.target.value)}
                        />
                      </label>
                      {budgetProblem && (
                        <p className="form-problem" role="alert">
                          {budgetProblem}
                        </p>
                      )}
                      <div className="form-actions">
                        <button type="submit" disabled={savingBudget}>
                          Save budget
                        </button>
                        <button type="button" onClick={() => setBudgetFormOpen(false)} disabled={savingBudget}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p className="stat">{pounds(figures.left_to_spend)}</p>
                      {figures.monthly_budget != null && (
                        <p className="status">Budget {pounds(figures.monthly_budget)}</p>
                      )}
                    </>
                  )}
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
                  {!formOpen && !transferFormOpen && (
                    <div className="tile-heading">
                      <h2>Recent transactions</h2>
                      <div className="tile-actions">
                        <button type="button" className="add-transfer" onClick={openTransfer}>
                          Transfer
                        </button>
                        <button type="button" className="add-transaction" onClick={openForm}>
                          Add transaction
                        </button>
                      </div>
                    </div>
                  )}
                  {transferFormOpen && (
                    <AddTransfer
                      accounts={accounts}
                      getAccessTokenSilently={getAccessTokenSilently}
                      onRecorded={handleTransferRecorded}
                      onCancel={closeTransfer}
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
                      {transactions.slice(0, 3).map((transaction) => (
                        <li key={transaction.id}>
                          <span>
                            {movementName(transaction)}
                            <small>
                              {transactionDetail(
                                transaction,
                                accountNames[transaction.account_id],
                                whenLabel(transaction.occurred_at),
                              )}
                            </small>
                          </span>
                          <span>{signedPounds(transaction.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link to="/transactions" className="habits-link">
                    View all transactions <span aria-hidden="true">→</span>
                  </Link>
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
