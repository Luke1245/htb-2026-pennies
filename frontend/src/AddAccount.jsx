import { useRef, useState } from 'react'
import { apiUrl, authHeaders } from './api.js'

const AMOUNT = /^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/

function balanceMessage(raw) {
  const text = raw.trim()
  if (!text || !AMOUNT.test(text)) return 'Enter an opening balance in pounds and pence.'
  return ''
}

function openingBalance(raw) {
  const text = raw.trim()
  const negative = text.startsWith('-')
  const unsigned = negative ? text.slice(1) : text
  const [whole, fraction = ''] = unsigned.split('.')
  const positive = `${whole}.${(fraction + '00').slice(0, 2)}`
  return negative ? `-${positive}` : positive
}

export function AddAccount({ getAccessTokenSilently, onRecorded, onCancel }) {
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('0.00')
  const [problem, setProblem] = useState('')
  const [sending, setSending] = useState(false)
  const saving = useRef(false)

  async function submit(event) {
    event.preventDefault()
    if (saving.current) return
    const accountName = name.trim()
    if (!accountName) {
      setProblem('Enter an Account name.')
      return
    }
    if (accountName.length > 80) {
      setProblem('An Account name must be 80 characters or fewer.')
      return
    }
    const balanceProblem = balanceMessage(balance)
    if (balanceProblem) {
      setProblem(balanceProblem)
      return
    }
    saving.current = true
    setSending(true)
    setProblem('')
    try {
      const headers = await authHeaders(getAccessTokenSilently)
      const response = await fetch(`${apiUrl}/accounts`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: accountName,
          opening_balance: openingBalance(balance),
        }),
      })
      if (!response.ok) throw new Error('Pennies could not record this Account')
      onRecorded()
    } catch {
      saving.current = false
      setSending(false)
      setProblem('Pennies could not record this Account')
    }
  }

  return (
    <form className="record-form" aria-label="Add account" onSubmit={submit}>
      <label>
        Name
        <input
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label>
        Opening balance
        <input
          inputMode="decimal"
          value={balance}
          onChange={(event) => setBalance(event.target.value)}
        />
      </label>
      {problem && (
        <p className="form-problem" role="alert">
          {problem}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" disabled={sending}>
          Add account
        </button>
        <button type="button" onClick={onCancel} disabled={sending}>
          Cancel
        </button>
      </div>
    </form>
  )
}
