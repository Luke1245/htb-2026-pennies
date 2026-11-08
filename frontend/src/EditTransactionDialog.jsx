import { useRef, useState } from 'react'
import { apiUrl, authHeaders } from './api.js'
import { amountMessage, positiveAmount } from './transactionForm.js'

function initialDirection(transaction) {
  return Number(transaction.amount) < 0 ? 'outflow' : 'inflow'
}

const ERROR_FIELDS = ['amount', 'vendor', 'when', 'account', 'category', 'note']

function fieldFor(message) {
  const text = message.toLowerCase()
  if (text.includes('amount')) return 'amount'
  if (text.includes('account')) return 'account'
  if (text.includes('vendor')) return 'vendor'
  if (text.includes('category')) return 'category'
  if (text.includes('date') || text.includes('occurred')) return 'when'
  if (text.includes('note')) return 'note'
  return ''
}

function FieldErrors({ fieldErrors }) {
  return ERROR_FIELDS.filter((field) => fieldErrors[field]).map((field) => (
    <p key={field} className="field-error" role="alert">
      {fieldErrors[field]}
    </p>
  ))
}

export function EditTransactionDialog({
  transaction,
  accounts,
  categories,
  getAccessTokenSilently,
  onSaved,
  onClose,
}) {
  const isTransfer = transaction.kind === 'transfer'
  const [accountId, setAccountId] = useState(transaction.account_id)
  const [direction, setDirection] = useState(initialDirection(transaction))
  const [amount, setAmount] = useState(() =>
    positiveAmount(String(Math.abs(Number(transaction.amount)))),
  )
  const [vendor, setVendor] = useState(transaction.vendor ?? '')
  const [note, setNote] = useState(transaction.note ?? '')
  const [category, setCategory] = useState(transaction.category)
  const [when, setWhen] = useState(() => transaction.occurred_at.slice(0, 10))
  const [fieldErrors, setFieldErrors] = useState({})
  const [problem, setProblem] = useState('')
  const [sending, setSending] = useState(false)
  const tokenProvider = useRef(getAccessTokenSilently)

  async function submit(event) {
    event.preventDefault()
    if (sending) return
    const errors = {}
    if (!isTransfer) {
      const amountError = amountMessage(amount)
      if (amountError) errors.amount = amountError
      if (!vendor.trim()) errors.vendor = 'Enter a Vendor.'
      if (!when) errors.when = 'Choose a date.'
    } else {
      if (amountMessage(amount)) errors.amount = 'Enter an amount greater than zero.'
      if (!when) errors.when = 'Choose a date.'
    }
    setFieldErrors(errors)
    setProblem('')
    if (Object.keys(errors).length > 0) return

    const body = {}
    if (accountId !== transaction.account_id) body.account_id = accountId
    if (!isTransfer) {
      const signed =
        direction === 'outflow' ? `-${positiveAmount(amount)}` : positiveAmount(amount)
      if (signed !== transaction.amount) body.amount = signed
      const trimmedVendor = vendor.trim()
      if (trimmedVendor !== transaction.vendor) body.vendor = trimmedVendor
      if (category !== transaction.category) body.category = category
    } else {
      const magnitude = positiveAmount(amount)
      if (magnitude !== String(Math.abs(Number(transaction.amount)))) body.amount = magnitude
    }
    const trimmedNote = note.trim()
    if (trimmedNote !== (transaction.note ?? '')) {
      body.note = trimmedNote || null
    }
    if (when !== transaction.occurred_at.slice(0, 10)) {
      body.occurred_at = `${when}T00:00:00`
    }

    setSending(true)
    try {
      const response = await fetch(`${apiUrl}/transactions/${transaction.id}`, {
        method: 'PATCH',
        headers: { ...(await authHeaders(tokenProvider.current)), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const detail = (await response.json().catch(() => null))?.detail
        const message = Array.isArray(detail)
          ? detail.map((item) => item.msg).join(' ')
          : detail || 'Pennies could not save this transaction'
        const field = fieldFor(message)
        if (field) {
          setFieldErrors({ [field]: message })
        } else {
          setProblem(message)
        }
        return
      }
      onSaved(await response.json())
    } catch {
      setProblem('Pennies could not save this transaction')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form
        className="record-form dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Edit transaction"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <h3>{isTransfer ? 'Edit transfer' : 'Edit transaction'}</h3>
        <label>
          Account
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        {!isTransfer && (
          <>
            <label>
              Vendor
              <input value={vendor} onChange={(event) => setVendor(event.target.value)} />
            </label>
            <label>
              Category
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {!isTransfer && (
          <fieldset className="direction">
            <legend>Direction</legend>
            <div className="direction-choices">
              <label>
                <input
                  type="radio"
                  name="direction"
                  value="inflow"
                  checked={direction === 'inflow'}
                  onChange={() => setDirection('inflow')}
                />
                Inflow
              </label>
              <label>
                <input
                  type="radio"
                  name="direction"
                  value="outflow"
                  checked={direction === 'outflow'}
                  onChange={() => setDirection('outflow')}
                />
                Outflow
              </label>
            </div>
          </fieldset>
        )}
        <label>
          Amount
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <FieldErrors fieldErrors={fieldErrors} />
        <label>
          Date
          <input type="date" value={when} onChange={(event) => setWhen(event.target.value)} />
        </label>
        <label>
          Note
          <input value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        {problem && (
          <p className="status" role="alert">
            {problem}
          </p>
        )}
        <div className="dialog-actions">
          <button type="submit" disabled={sending}>
            {sending ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" className="logout" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
