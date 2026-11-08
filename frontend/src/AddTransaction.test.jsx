import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { AddTransaction } from './AddTransaction.jsx'

const now = new Date('2026-11-07T12:00:00Z')
const accounts = [{ id: 'acc-1', name: 'Monzo' }]

function emptyVendors() {
  return { ok: true, json: async () => ({ transactions: [], next_offset: null }) }
}

function renderForm({ fetchImpl, ...props } = {}) {
  const onRecorded = vi.fn()
  const onCancel = vi.fn()
  const getAccessTokenSilently = vi.fn().mockResolvedValue('test-token')
  const fetchMock = vi.fn(
    fetchImpl ??
      (async (_url, options = {}) => {
        if (options.method === 'POST') return { ok: false, json: async () => ({}) }
        return emptyVendors()
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  render(
    <AddTransaction
      accounts={accounts}
      getAccessTokenSilently={getAccessTokenSilently}
      onRecorded={onRecorded}
      onCancel={onCancel}
      now={now}
      {...props}
    />,
  )
  return { onRecorded, onCancel, fetchMock }
}

function postCalls(fetchMock) {
  return fetchMock.mock.calls.filter(
    ([url, options]) =>
      options?.method === 'POST' && !String(url).endsWith('/category-suggestions'),
  )
}

async function fillOutflow(user) {
  await user.click(screen.getByRole('radio', { name: 'Outflow' }))
  await user.type(screen.getByLabelText('Amount'), '3.4')
  await user.type(screen.getByLabelText('Vendor'), 'Pret')
  fireEvent.change(screen.getByLabelText('Date'), {
    target: { value: '2026-10-15' },
  })
}

test('the only Account is selected and a missing direction is explained', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderForm()

  expect(screen.getByLabelText('Account')).toHaveValue('acc-1')
  expect(screen.getByLabelText('Date')).toHaveValue('2026-11-07')
  await user.click(screen.getByRole('button', { name: 'Add transaction' }))

  expect(screen.getByRole('alert')).toHaveTextContent('Choose Inflow or Outflow.')
  expect(postCalls(fetchMock)).toHaveLength(0)
})

test('several Accounts require a choice and show names only', async () => {
  const user = userEvent.setup()
  renderForm({
    accounts: [
      { id: 'acc-1', name: 'Cash' },
      { id: 'acc-2', name: 'Cash' },
    ],
  })

  expect(screen.getByRole('option', { name: 'Choose an Account' }).selected).toBe(true)
  expect(screen.getAllByRole('option', { name: 'Cash' })).toHaveLength(2)
  await user.click(screen.getByRole('button', { name: 'Add transaction' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Choose an Account.')
})

test('a future date is refused before sending', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderForm()
  await fillOutflow(user)
  fireEvent.change(screen.getByLabelText('Date'), {
    target: { value: '2026-11-08' },
  })
  await user.click(screen.getByRole('button', { name: 'Add transaction' }))

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Choose a date that is today or in the past.',
  )
  expect(postCalls(fetchMock)).toHaveLength(0)
})

test('a failed save keeps the Vendor', async () => {
  const user = userEvent.setup()
  renderForm()
  await fillOutflow(user)
  await user.click(screen.getByRole('button', { name: 'Add transaction' }))

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Pennies could not record this transaction',
  )
  expect(screen.getByLabelText('Vendor')).toHaveValue('Pret')
})

test('one save in flight sends a single request', async () => {
  let release
  const pending = new Promise((resolve) => {
    release = resolve
  })
  const { onRecorded, fetchMock } = renderForm({
    fetchImpl: (_url, options = {}) => {
      if (options.method === 'POST') return pending
      return Promise.resolve(emptyVendors())
    },
  })
  const user = userEvent.setup()
  await fillOutflow(user)

  const form = screen.getByRole('form', { name: 'Add transaction' })
  fireEvent.submit(form)
  fireEvent.submit(form)
  await vi.waitFor(() => expect(postCalls(fetchMock)).toHaveLength(1))

  release({ ok: true, json: async () => ({ id: 'tx-1' }) })
  await vi.waitFor(() => expect(onRecorded).toHaveBeenCalledOnce())
})

test('vendor suggestions fuzzy-match ordinary vendors', async () => {
  const user = userEvent.setup()
  renderForm({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        transactions: [
          { vendor: 'Pret', kind: 'ordinary' },
          { vendor: 'Tesco', kind: 'ordinary' },
          { vendor: 'Adjustment', kind: 'adjustment' },
          { vendor: null, kind: 'transfer' },
        ],
        next_offset: null,
      }),
    }),
  })

  const vendor = screen.getByLabelText('Vendor')
  await user.click(vendor)
  await user.type(vendor, 'Prt')

  expect(await screen.findByRole('option', { name: 'Pret' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Tesco' })).not.toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Adjustment' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('option', { name: 'Pret' }))
  expect(vendor).toHaveValue('Pret')
})

test('a finished vendor selects a category and notes update it', async () => {
  const user = userEvent.setup()
  const calls = []
  renderForm({
    fetchImpl: async (url, options = {}) => {
      if (String(url).endsWith('/category-suggestions')) {
        const body = JSON.parse(options.body)
        calls.push(body)
        const category = body.vendor === 'Pret' && body.note === 'lunch' ? 'Eating out' : 'Other'
        return { ok: true, json: async () => ({ category }) }
      }
      return emptyVendors()
    },
  })

  const vendor = screen.getByLabelText('Vendor')
  await user.type(vendor, 'Pret')
  expect(calls).toHaveLength(0)
  expect(screen.getByLabelText('Category')).toHaveValue('')

  fireEvent.blur(vendor)
  await waitFor(() => expect(screen.getByLabelText('Category')).toHaveValue('Other'))
  expect(calls).toEqual([{ vendor: 'Pret', note: null }])

  await user.type(screen.getByLabelText('Note'), 'lunch')
  await waitFor(() => expect(screen.getByLabelText('Category')).toHaveValue('Eating out'))
  expect(calls.at(-1)).toEqual({ vendor: 'Pret', note: 'lunch' })
  expect(screen.getByLabelText('Category')).toBeDisabled()
})

test('a known vendor selects a category as soon as the name is complete', async () => {
  const user = userEvent.setup()
  const calls = []
  renderForm({
    fetchImpl: async (url, options = {}) => {
      if (String(url).endsWith('/category-suggestions')) {
        calls.push(JSON.parse(options.body))
        return { ok: true, json: async () => ({ category: 'Groceries' }) }
      }
      return {
        ok: true,
        json: async () => ({
          transactions: [{ vendor: 'Tesco', kind: 'ordinary' }],
          next_offset: null,
        }),
      }
    },
  })

  const vendor = screen.getByLabelText('Vendor')
  await user.click(vendor)
  expect(await screen.findByRole('option', { name: 'Tesco' })).toBeInTheDocument()
  await user.type(vendor, 'Tes')
  expect(calls).toHaveLength(0)

  await user.type(vendor, 'co')
  await waitFor(() => expect(screen.getByLabelText('Category')).toHaveValue('Groceries'))
  expect(calls).toEqual([{ vendor: 'Tesco', note: null }])
})

test('Cancel discards the form', async () => {
  const user = userEvent.setup()
  const { onCancel } = renderForm()
  await user.type(screen.getByLabelText('Vendor'), 'Pret')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onCancel).toHaveBeenCalledOnce()
})
