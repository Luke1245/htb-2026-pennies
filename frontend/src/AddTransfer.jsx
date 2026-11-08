import { useRef, useState } from 'react'
import { apiUrl, authHeaders } from './api.js'
import { londonDate, transferBody, transferValidationMessage } from './transactionForm.js'

export function AddTransfer({
  accounts,
  getAccessTokenSilently,
  onRecorded,
  onCancel,
  now,
}) {
  const clock = () => now ?? new Date()
  const pair = accounts.length === 2
  const [fromAccountId, setFromAccountId] = useState(pair ? accounts[0].id : '')
  const [toAccountId, setToAccountId] = useState(pair ? accounts[1].id : '')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [when, setWhen] = useState(() => londonDate(clock()))
  const [problem, setProblem] = useState('')
  const [sending, setSending] = useState(false)
  const saving = useRef(false)

  async function submit(event) {
    event.preventDefault()
    if (saving.current) return
    const fields = { fromAccountId, toAccountId, amount, note, when }
    const message = transferValidationMessage(fields, clock())
    if (message) {
      setProblem(message)
      return
    }
    saving.current = true
    setSending(true)
    setProblem('')
    try {
      const headers = await authHeaders(getAccessTokenSilently)
      const response = await fetch(`${apiUrl}/transfers`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(transferBody(fields)),
      })
      if (!response.ok) throw new Error('Pennies could not record this transfer')
      onRecorded()
    } catch {
      saving.current = false
      setSending(false)
      setProblem('Pennies could not record this transfer')
    }
  }

  function accountChoices(value, onChange) {
    return (
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {accounts.length > 2 && <option value="">Choose an Account</option>}
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
    )
  }

  return (
    <form className="record-form" aria-label="Transfer" onSubmit={submit}>
      <label>
        From
        {accountChoices(fromAccountId, setFromAccountId)}
      </label>
      <label>
        To
        {accountChoices(toAccountId, setToAccountId)}
      </label>
      <label>
        Amount
        <input
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <label>
        Date
        <input type="date" value={when} onChange={(event) => setWhen(event.target.value)} />
      </label>
      <label>
        Note
        <textarea
          value={note}
          maxLength={500}
          rows={2}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {problem && (
        <p className="form-problem" role="alert">
          {problem}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" disabled={sending}>
          Transfer
        </button>
        <button type="button" onClick={onCancel} disabled={sending}>
          Cancel
        </button>
      </div>
    </form>
  )
}
