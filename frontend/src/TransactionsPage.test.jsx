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
  { id: 'cash', name: 'Cash' },
  { id: 'bank', name: 'Bank' },
]

test('lists every transaction and returns to the dashboard', async () => {
  const user = userEvent.setup()
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = String(url)
      calls.push(path)
      if (path.endsWith('/accounts')) return json(accounts)
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
