import { useEffect, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { useNavigate } from 'react-router'
import { apiUrl, authHeaders } from './api.js'
import { AddAccount } from './AddAccount.jsx'

export default function AccountsPage() {
  const navigate = useNavigate()
  const { logout, getAccessTokenSilently } = useAuth0()
  const tokenProvider = useRef(getAccessTokenSilently)
  useEffect(() => {
    tokenProvider.current = getAccessTokenSilently
  }, [getAccessTokenSilently])
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [status, setStatus] = useState('loading')
  const [problem, setProblem] = useState('')
  const [adding, setAdding] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [editing, setEditing] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const headers = await authHeaders(tokenProvider.current)
      const [accountResponse, categoryResponse] = await Promise.all([
        fetch(`${apiUrl}/accounts`, { headers }),
        fetch(`${apiUrl}/categories`, { headers }),
      ])
      if (!accountResponse.ok || !categoryResponse.ok) {
        throw new Error('Pennies could not load your accounts')
      }
      const accountList = await accountResponse.json()
      const categoryList = await categoryResponse.json()
      if (!cancelled) {
        setAccounts(accountList)
        setCategories(categoryList)
        setStatus('ready')
      }
    }
    load().catch(() => {
      if (!cancelled) {
        setProblem('Pennies could not load your accounts')
        setStatus('ready')
      }
    })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  function pounds(value) {
    const amount = Number(value)
    const text = `£${Math.abs(amount).toFixed(2)}`
    return amount < 0 ? `-${text}` : text
  }

  async function saveAccount(event) {
    event.preventDefault()
    const name = editing.name.trim()
    if (!name) {
      setProblem('Enter an Account name.')
      return
    }
    if (name.length > 80) {
      setProblem('An Account name must be 80 characters or fewer.')
      return
    }
    setProblem('')
    try {
      const headers = await authHeaders(tokenProvider.current)
      const response = await fetch(`${apiUrl}/accounts/${editing.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!response.ok) throw new Error('Pennies could not update this Account')
      const updated = await response.json()
      setAccounts((current) =>
        current
          .map((account) => (account.id === updated.id ? updated : account))
          .sort((left, right) => left.name.localeCompare(right.name)),
      )
      setEditing(null)
    } catch {
      setProblem('Pennies could not update this Account')
    }
  }

  async function saveCategory(event) {
    event.preventDefault()
    const name = editing.name.trim()
    if (!name) {
      setProblem('Enter a category name.')
      return
    }
    if (name.length > 40) {
      setProblem('A category name must be 40 characters or fewer.')
      return
    }
    setProblem('')
    const creating = editing.id === null
    try {
      const headers = await authHeaders(tokenProvider.current)
      const response = await fetch(creating ? `${apiUrl}/categories` : `${apiUrl}/categories/${editing.id}`, {
        method: creating ? 'POST' : 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!response.ok) throw new Error('Pennies could not update this category')
      const updated = await response.json()
      setCategories((current) =>
        creating ? [...current, updated] : current.map((category) => (category.id === updated.id ? updated : category)),
      )
      setEditing(null)
      setAddingCategory(false)
    } catch {
      setProblem('Pennies could not update this category')
    }
  }

  return (
    <div className="dashboard">
      <header className="banner">
        <h1>Pennies</h1>
        <button
          type="button"
          className="logout"
          onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        >
          Log out
        </button>
      </header>
      <main className="dashboard-main">
        <button type="button" className="back-button" onClick={() => navigate('/')}>
          ← Back to dashboard
        </button>
        <h2 className="page-heading">Accounts</h2>
        {status === 'loading' && <p className="status">Loading…</p>}
        {problem && (
          <p className="status" role="alert">
            {problem}
          </p>
        )}
        <section className="tile manage-section" aria-labelledby="bank-accounts-heading">
          <div className="tile-heading">
            <h3 id="bank-accounts-heading">Bank accounts</h3>
            {!adding && (
              <button type="button" className="add-account" onClick={() => setAdding(true)}>
                Add account
              </button>
            )}
          </div>
          {adding && (
            <AddAccount
              getAccessTokenSilently={getAccessTokenSilently}
              onCancel={() => setAdding(false)}
              onRecorded={() => {
                setAdding(false)
                setReloadKey((key) => key + 1)
              }}
            />
          )}
          {status === 'ready' && accounts.length === 0 && <p className="status">No accounts yet</p>}
          <ul className="manage-list">
            {accounts.map((account) =>
              editing?.kind === 'account' && editing.id === account.id ? (
                <li key={account.id}>
                  <form className="record-form" aria-label={`Edit ${account.name}`} onSubmit={saveAccount}>
                    <label>
                      Name
                      <input
                        value={editing.name}
                        maxLength={80}
                        onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                      />
                    </label>
                    <div className="form-actions">
                      <button type="submit">Save account</button>
                      <button type="button" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </li>
              ) : (
                <li key={account.id}>
                  <span>
                    {account.name}
                    <small>Balance {pounds(account.calculated_balance)}</small>
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditing({ kind: 'account', id: account.id, name: account.name })}
                  >
                    Edit
                  </button>
                </li>
              ),
            )}
          </ul>
        </section>
        <section className="tile manage-section" aria-labelledby="categories-heading">
          <div className="tile-heading">
            <h3 id="categories-heading">Categories</h3>
            {!addingCategory && (
              <button
                type="button"
                className="add-account"
                onClick={() => {
                  setAddingCategory(true)
                  setEditing({ kind: 'category', id: null, name: '' })
                }}
              >
                Add category
              </button>
            )}
          </div>
          {addingCategory && editing?.kind === 'category' && editing.id === null && (
            <form className="record-form" aria-label="Add category" onSubmit={saveCategory}>
              <label>
                Name
                <input
                  value={editing.name}
                  maxLength={40}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                />
              </label>
              <div className="form-actions">
                <button type="submit">Save category</button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingCategory(false)
                    setEditing(null)
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          <ul className="manage-list">
            {categories.map((category) =>
              editing?.kind === 'category' && editing.id === category.id ? (
                <li key={category.id}>
                  <form className="record-form" aria-label={`Edit ${category.name}`} onSubmit={saveCategory}>
                    <label>
                      Name
                      <input
                        value={editing.name}
                        maxLength={40}
                        onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                      />
                    </label>
                    <div className="form-actions">
                      <button type="submit">Save category</button>
                      <button type="button" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </li>
              ) : (
                <li key={category.id}>
                  <span>{category.name}</span>
                  <button
                    type="button"
                    onClick={() => setEditing({ kind: 'category', id: category.id, name: category.name })}
                  >
                    Edit
                  </button>
                </li>
              ),
            )}
          </ul>
        </section>
      </main>
    </div>
  )
}
