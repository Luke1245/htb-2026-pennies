import { useEffect, useRef, useState } from 'react'
import { apiUrl, authHeaders } from './api.js'
import { londonDate, transactionBody, validationMessage } from './transactionForm.js'
import { fetchVendorNames, matchingVendors } from './vendorSearch.js'

export function AddTransaction({
  accounts,
  getAccessTokenSilently,
  onRecorded,
  onCancel,
  now,
}) {
  const clock = () => now ?? new Date()
  const [accountId, setAccountId] = useState(
    accounts.length === 1 ? accounts[0].id : '',
  )
  const [direction, setDirection] = useState('')
  const [amount, setAmount] = useState('')
  const [vendor, setVendor] = useState('')
  const [note, setNote] = useState('')
  const [when, setWhen] = useState(() => londonDate(clock()))
  const [problem, setProblem] = useState('')
  const [sending, setSending] = useState(false)
  const [knownVendors, setKnownVendors] = useState([])
  const [vendorsOpen, setVendorsOpen] = useState(false)
  const [activeVendor, setActiveVendor] = useState(0)
  const saving = useRef(false)
  const vendorMatches = matchingVendors(knownVendors, vendor)

  useEffect(() => {
    let cancelled = false
    async function loadVendors() {
      try {
        const names = await fetchVendorNames(getAccessTokenSilently)
        if (!cancelled) setKnownVendors(names)
      } catch {
        if (!cancelled) setKnownVendors([])
      }
    }
    loadVendors()
    return () => {
      cancelled = true
    }
  }, [getAccessTokenSilently])

  function chooseVendor(name) {
    setVendor(name)
    setVendorsOpen(false)
  }

  function onVendorKey(event) {
    if (!vendorsOpen || vendorMatches.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveVendor((current) => (current + 1) % vendorMatches.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveVendor((current) => (current - 1 + vendorMatches.length) % vendorMatches.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      chooseVendor(vendorMatches[activeVendor] ?? vendorMatches[0])
    } else if (event.key === 'Escape') {
      setVendorsOpen(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (saving.current) return
    const fields = { accountId, direction, amount, vendor, note, when }
    const message = validationMessage(fields, clock())
    if (message) {
      setProblem(message)
      return
    }
    saving.current = true
    setSending(true)
    setProblem('')
    try {
      const headers = await authHeaders(getAccessTokenSilently)
      const response = await fetch(`${apiUrl}/transactions`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionBody(fields)),
      })
      if (!response.ok) throw new Error('Pennies could not record this transaction')
      onRecorded()
    } catch {
      saving.current = false
      setSending(false)
      setProblem('Pennies could not record this transaction')
    }
  }

  return (
    <form className="record-form" aria-label="Add transaction" onSubmit={submit}>
      <label>
        Account
        <select
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          {accounts.length > 1 && <option value="">Choose an Account</option>}
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
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
      <label>
        Amount
        <input
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <div className="vendor-field">
        <label htmlFor="vendor">Vendor</label>
        <input
          id="vendor"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={vendorsOpen}
          aria-controls="vendor-options"
          aria-activedescendant={
            vendorsOpen && vendorMatches[activeVendor]
              ? `vendor-option-${activeVendor}`
              : undefined
          }
          value={vendor}
          maxLength={120}
          onChange={(event) => {
            setVendor(event.target.value)
            setVendorsOpen(true)
            setActiveVendor(0)
          }}
          onFocus={() => setVendorsOpen(true)}
          onBlur={() => setVendorsOpen(false)}
          onKeyDown={onVendorKey}
        />
        {vendorsOpen && vendorMatches.length > 0 && (
          <ul id="vendor-options" role="listbox">
            {vendorMatches.map((name, index) => (
              <li
                id={`vendor-option-${index}`}
                key={name}
                role="option"
                aria-selected={index === activeVendor}
                onMouseDown={(event) => {
                  event.preventDefault()
                  chooseVendor(name)
                }}
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <label>
        <span className="field-name">
          Category
          <svg className="ai-mark" viewBox="0 0 32 22" aria-hidden="true">
            <path
              fill="currentColor"
              transform="translate(0 2.6) scale(0.74)"
              d="M12 0C12 6.627 6.627 12 0 12 6.627 12 12 17.373 12 24 12 17.373 17.373 12 24 12 17.373 12 12 6.627 12 0Z"
            />
            <path
              fill="currentColor"
              transform="translate(18.2 0) scale(0.42)"
              d="M12 0C12 6.627 6.627 12 0 12 6.627 12 12 17.373 12 24 12 17.373 17.373 12 24 12 17.373 12 12 6.627 12 0Z"
            />
          </svg>
        </span>
        <select disabled defaultValue="">
          <option value="" />
        </select>
      </label>
      <label>
        Date
        <input
          type="date"
          value={when}
          onChange={(event) => setWhen(event.target.value)}
        />
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
          Add transaction
        </button>
        <button type="button" onClick={onCancel} disabled={sending}>
          Cancel
        </button>
      </div>
    </form>
  )
}
