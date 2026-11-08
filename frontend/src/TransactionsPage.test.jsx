import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, test, vi } from 'vitest'
import TransactionsPage from './TransactionsPage.jsx'

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn().mockResolvedValue('test-token'),
  }),
}))

function json(body) {
  return { ok: true, json: async () => body }
}

function transaction(id, vendor, accountId = 'cash') {
  return {
    id,
    account_id: accountId,
    vendor,
    category: 'Groceries',
    occurred_at: '2026-11-02T10:00:00+00:00',
    amount: '-4.00',
    kind: 'ordinary',
  }
}

const accounts = [
  { id: 'cash', name: 'Cash', calculated_balance: '40.00' },
  { id: 'bank', name: 'Bank', calculated_balance: '10.00' },
]

const categories = [{ id: 'cat-1', name: 'Groceries' }, { id: 'cat-2', name: 'Other' }]

test('lists every transaction and returns to the dashboard', async () => {
  const user = userEvent.setup()
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = String(url)
      calls.push(path)
      if (path.endsWith('/accounts')) return json(accounts)
      if (path.endsWith('/categories')) return json(categories)
      if (path.includes('offset=0')) {
        return json({
          transactions: [transaction('tx-1', 'Tesco'), transaction('tx-2', 'Pret', 'bank')],
          next_offset: 2,
        })
      }
      if (path.includes('offset=2')) {
        return json({
          transactions: [transaction('tx-3', 'Cafe'), transaction('tx-4', 'Old shop', 'bank')],
          next_offset: null,
        })
      }
      return json({ transactions: [], next_offset: null })
    }),
  )

  render(
    <MemoryRouter initialEntries={['/transactions']}>
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/" element={<h2>Dashboard</h2>} />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByText('Tesco')).toBeInTheDocument()
  expect(screen.getAllByText('Cash · Groceries · 2 Nov 2026')).toHaveLength(2)
  expect(screen.getAllByText('Bank · Groceries · 2 Nov 2026')).toHaveLength(2)
  expect(screen.getByText('Pret')).toBeInTheDocument()
  expect(screen.getByText('Cafe')).toBeInTheDocument()
  expect(screen.getByText('Old shop')).toBeInTheDocument()
  expect(calls.some((path) => path.includes('/transactions?limit=100&offset=0'))).toBe(true)
  expect(calls.some((path) => path.includes('/transactions?limit=100&offset=2'))).toBe(true)

  await user.click(screen.getByRole('button', { name: '← Back to dashboard' }))
  expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
})

test('deletes a transaction and its transfer partner', async () => {
  const user = userEvent.setup()
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method })
      if (options.method === 'DELETE') {
        return json({ deleted: true, ids: ['tx-out', 'tx-in'] })
      }
      if (String(url).endsWith('/accounts')) return json(accounts)
      if (String(url).endsWith('/categories')) return json(categories)
      return json({
        transactions: [
          { ...transaction('tx-out', null), vendor: null, category: 'Transfer', kind: 'transfer' },
          transaction('tx-keep', 'Tesco'),
          { ...transaction('tx-in', null), vendor: null, category: 'Transfer', kind: 'transfer' },
        ],
        next_offset: null,
      })
    }),
  )

  render(
    <MemoryRouter>
      <TransactionsPage />
    </MemoryRouter>,
  )

  expect(await screen.findByText('Tesco')).toBeInTheDocument()
  await user.click(screen.getAllByRole('button', { name: 'Delete Transfer' })[0])

  const deleted = calls.find((call) => call.method === 'DELETE')
  expect(deleted.url).toContain('/transactions/tx-out')
  expect(screen.queryByText('Transfer')).not.toBeInTheDocument()
  expect(screen.getByText('Tesco')).toBeInTheDocument()
})

test('filters by account from the sidebar and shows balances', async () => {
  const user = userEvent.setup()
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = String(url)
      calls.push(path)
      if (path.endsWith('/accounts')) return json(accounts)
      if (path.endsWith('/categories')) return json(categories)
      if (path.includes('account_id=bank')) {
        return json({ transactions: [transaction('tx-2', 'Pret', 'bank')], next_offset: null })
      }
      return json({
        transactions: [transaction('tx-1', 'Tesco'), transaction('tx-2', 'Pret', 'bank')],
        next_offset: null,
      })
    }),
  )

  render(
    <MemoryRouter initialEntries={['/transactions']}>
      <TransactionsPage />
    </MemoryRouter>,
  )

  expect(await screen.findByText('All accounts')).toBeInTheDocument()
  expect(screen.getByText('£50.00')).toBeInTheDocument()
  expect(screen.getByText('£40.00')).toBeInTheDocument()
  expect(screen.getByText('Tesco')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /Bank/ }))
  expect(calls.some((path) => path.includes('account_id=bank'))).toBe(true)
  expect(await screen.findByText('Pret')).toBeInTheDocument()
  expect(screen.queryByText('Tesco')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /All accounts/ }))
  expect(await screen.findByText('Tesco')).toBeInTheDocument()
})

test('shows the note as a third line with its full text on hover', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = String(url)
      if (path.endsWith('/accounts')) return json(accounts)
      if (path.endsWith('/categories')) return json(categories)
      return json({
        transactions: [{ ...transaction('tx-1', 'Tesco'), note: 'weekly shop' }],
        next_offset: null,
      })
    }),
  )

  render(
    <MemoryRouter>
      <TransactionsPage />
    </MemoryRouter>,
  )

  const note = await screen.findByText('weekly shop')
  expect(note).toHaveClass('transaction-note')
  expect(note).toHaveAttribute('title', 'weekly shop')
})

test('edits an ordinary transaction through the dialog', async () => {
  const user = userEvent.setup()
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      const path = String(url)
      calls.push({ path, options })
      if (options.method === 'PATCH') {
        return json({ ...transaction('tx-1', 'Sainsbury'), amount: '-7.50' })
      }
      if (path.endsWith('/accounts')) return json(accounts)
      if (path.endsWith('/categories')) return json(categories)
      return json({ transactions: [transaction('tx-1', 'Tesco')], next_offset: null })
    }),
  )

  render(
    <MemoryRouter>
      <TransactionsPage />
    </MemoryRouter>,
  )

  await user.click(await screen.findByRole('button', { name: 'Edit Tesco' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit transaction' })
  expect(dialog).toBeInTheDocument()

  const amount = screen.getByRole('textbox', { name: 'Amount' })
  await user.clear(amount)
  await user.type(amount, '7.50')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  const patched = calls.find((call) => call.options.method === 'PATCH')
  expect(patched.path).toContain('/transactions/tx-1')
  expect(JSON.parse(patched.options.body)).toEqual({ amount: '-7.50' })
  expect(await screen.findByText('-£7.50')).toBeInTheDocument()
})

test('edits a transfer without vendor or category and mirrors the amount', async () => {
  const user = userEvent.setup()
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      const path = String(url)
      calls.push({ path, options })
      if (options.method === 'PATCH') {
        return json({ ...transaction('tx-out', null), vendor: null, category: 'Transfer', kind: 'transfer', amount: '-20.00' })
      }
      if (path.endsWith('/accounts')) return json(accounts)
      if (path.endsWith('/categories')) return json(categories)
      return json({
        transactions: [
          { ...transaction('tx-out', null), vendor: null, category: 'Transfer', kind: 'transfer', transfer_id: 'tr-1' },
        ],
        next_offset: null,
      })
    }),
  )

  render(
    <MemoryRouter>
      <TransactionsPage />
    </MemoryRouter>,
  )

  await user.click(await screen.findByRole('button', { name: 'Edit Transfer' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit transaction' })
  expect(dialog).toHaveTextContent('Edit transfer')
  expect(screen.queryByRole('textbox', { name: /Vendor/ })).not.toBeInTheDocument()

  await user.clear(screen.getByRole('textbox', { name: /Amount/ }))
  await user.type(screen.getByRole('textbox', { name: /Amount/ }), '20.00')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  const patched = calls.find((call) => call.options.method === 'PATCH')
  expect(JSON.parse(patched.options.body)).toEqual({ amount: '20.00' })
})

test('adjustments cannot be edited', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = String(url)
      if (path.endsWith('/accounts')) return json(accounts)
      if (path.endsWith('/categories')) return json(categories)
      return json({
        transactions: [
          { ...transaction('tx-adj', 'Adjustment'), category: 'Adjustment', kind: 'adjustment' },
        ],
        next_offset: null,
      })
    }),
  )

  render(
    <MemoryRouter>
      <TransactionsPage />
    </MemoryRouter>,
  )

  expect(await screen.findByText('Adjustment')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit Adjustment' })).not.toBeInTheDocument()
})
