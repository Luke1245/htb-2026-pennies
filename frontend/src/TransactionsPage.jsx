import { useEffect, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { apiUrl, authHeaders } from './api.js'
import { EditTransactionDialog } from './EditTransactionDialog.jsx'
import { accountNamesById, movementName, transactionDetail } from './movementName.js'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedAccount = searchParams.get('account')
  const { logout, getAccessTokenSilently } = useAuth0()
  const tokenProvider = useRef(getAccessTokenSilently)
  useEffect(() => {
    tokenProvider.current = getAccessTokenSilently
  }, [getAccessTokenSilently])
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [accountNames, setAccountNames] = useState({})
  const [categories, setCategories] = useState([])
  const [status, setStatus] = useState('loading')
  const [problem, setProblem] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [editing, setEditing] = useState(null)

  async function loadAccounts(headers) {
    const response = await fetch(`${apiUrl}/accounts`, { headers })
    if (!response.ok) throw new Error('Pennies could not load your accounts')
    return response.json()
  }

  async function loadAllTransactions(headers, accountId) {
    const accountQuery = accountId ? `&account_id=${accountId}` : ''
    const collected = []
    const seenOffsets = new Set()
    let offset = 0
    while (!seenOffsets.has(offset)) {
      seenOffsets.add(offset)
      const response = await fetch(
        `${apiUrl}/transactions?limit=100&offset=${offset}${accountQuery}`,
        { headers },
      )
      if (!response.ok) throw new Error('Pennies could not load your transactions')
      const page = await response.json()
      collected.push(...page.transactions)
      if (page.next_offset == null) break
      offset = page.next_offset
    }
    return collected
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const headers = await authHeaders(tokenProvider.current)
      const accountsPromise = loadAccounts(headers)
      const [collected, accountList, categoryResponse] = await Promise.all([
        loadAllTransactions(headers, selectedAccount),
        accountsPromise,
        fetch(`${apiUrl}/categories`, { headers }),
      ])
      const names = accountNamesById(accountList)
      const categoryList = categoryResponse.ok
        ? (await categoryResponse.json()).map((item) => item.name)
        : []
      if (!cancelled) {
        setAccounts(accountList)
        setCategories(categoryList)
        setAccountNames(names)
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
  }, [selectedAccount])

  async function refreshAccounts() {
    const headers = await authHeaders(tokenProvider.current)
    const accountList = await loadAccounts(headers)
    setAccounts(accountList)
    setAccountNames(accountNamesById(accountList))
  }

  function chooseAccount(accountId) {
    setSearchParams(accountId ? { account: accountId } : {})
  }

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
      await refreshAccounts()
      window.dispatchEvent(new Event('pennies:transactions-changed'))
    } catch {
      setProblem('Pennies could not delete this transaction')
    } finally {
      setDeletingId('')
    }
  }

  async function onTransactionSaved(updated) {
    if (updated.kind === 'transfer') {
      // A transfer leg may have moved accounts; the twin row changes too, so
      // simplest correct refresh is a refetch of the current filter.
      await loadCurrentPage()
    } else {
      setTransactions((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      )
    }
    setEditing(null)
    await refreshAccounts()
    window.dispatchEvent(new Event('pennies:transactions-changed'))
  }

  async function loadCurrentPage() {
    const headers = await authHeaders(tokenProvider.current)
    const collected = []
    const seenOffsets = new Set()
    let offset = 0
    const accountQuery = selectedAccount ? `&account_id=${selectedAccount}` : ''
    while (!seenOffsets.has(offset)) {
      seenOffsets.add(offset)
      const response = await fetch(
        `${apiUrl}/transactions?limit=100&offset=${offset}${accountQuery}`,
        { headers },
      )
      if (!response.ok) throw new Error('Pennies could not load your transactions')
      const page = await response.json()
      collected.push(...page.transactions)
      if (page.next_offset == null) break
      offset = page.next_offset
    }
    setTransactions(collected)
  }

  const totalBalance = accounts.reduce(
    (sum, account) => sum + Number(account.calculated_balance),
    0,
  )
  const emptyLabel = selectedAccount
    ? `No transactions in ${accountNames[selectedAccount] ?? 'this account'} yet`
    : 'No transactions yet'

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
      <main className="dashboard-main transactions-layout">
        <aside className="account-sidebar" aria-label="Accounts">
          <button
            type="button"
            className={`account-row all-accounts${selectedAccount ? '' : ' active'}`}
            aria-pressed={!selectedAccount}
            onClick={() => chooseAccount(null)}
          >
            <span className="account-row-name">All accounts</span>
            <span className="account-row-balance">{pounds(totalBalance)}</span>
          </button>
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              className={`account-row${selectedAccount === account.id ? ' active' : ''}`}
              aria-pressed={selectedAccount === account.id}
              onClick={() => chooseAccount(account.id)}
            >
              <span className="account-row-name">{account.name}</span>
              <span className="account-row-balance">{pounds(account.calculated_balance)}</span>
            </button>
          ))}
        </aside>
        <section className="transactions-panel">
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
            <p className="status">{emptyLabel}</p>
          )}
          <ul className="transactions">
            {transactions.map((transaction) => (
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
                  {transaction.note && (
                    <small className="transaction-note" title={transaction.note}>
                      {transaction.note}
                    </small>
                  )}
                </span>
                <span>{signedPounds(transaction.amount)}</span>
                <span className="transaction-actions">
                  {transaction.kind !== 'adjustment' && (
                    <button
                      type="button"
                      className="edit-transaction"
                      aria-label={`Edit ${movementName(transaction)}`}
                      onClick={() => setEditing(transaction)}
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    className="delete-transaction"
                    aria-label={`Delete ${movementName(transaction)}`}
                    disabled={deletingId === transaction.id}
                    onClick={() => removeTransaction(transaction)}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
      {editing && (
        <EditTransactionDialog
          transaction={editing}
          accounts={accounts}
          categories={categories}
          getAccessTokenSilently={getAccessTokenSilently}
          onSaved={onTransactionSaved}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
