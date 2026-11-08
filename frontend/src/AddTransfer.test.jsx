import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { AddTransfer } from './AddTransfer.jsx'

const now = new Date('2026-11-07T12:00:00Z')
const accounts = [
  { id: 'cash', name: 'Cash' },
  { id: 'bank', name: 'Bank' },
]

function renderForm({ fetchImpl, ...props } = {}) {
  const onRecorded = vi.fn()
  const onCancel = vi.fn()
  const getAccessTokenSilently = vi.fn().mockResolvedValue('test-token')
  const fetchMock = vi.fn(
    fetchImpl ?? (async () => ({ ok: false, json: async () => ({}) })),
  )
  vi.stubGlobal('fetch', fetchMock)
  render(
    <AddTransfer
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

test('a transfer between two Accounts posts one positive amount', async () => {
  const user = userEvent.setup()
  const { onRecorded, fetchMock } = renderForm({
    fetchImpl: async () => ({ ok: true, json: async () => ({ id: 'transfer-1' }) }),
  })

  expect(screen.getByLabelText('From')).toHaveValue('cash')
  expect(screen.getByLabelText('To')).toHaveValue('bank')
  expect(screen.getByLabelText('Date')).toHaveValue('2026-11-07')
  await user.type(screen.getByLabelText('Amount'), '20')
  await user.type(screen.getByLabelText('Note'), '  rent float  ')
  await user.click(screen.getByRole('button', { name: 'Transfer' }))

  expect(onRecorded).toHaveBeenCalledOnce()
  expect(fetchMock).toHaveBeenCalledOnce()
  const [url, options] = fetchMock.mock.calls[0]
  expect(String(url)).toMatch(/\/transfers$/)
  expect(options.method).toBe('POST')
  expect(options.headers.Authorization).toBe('Bearer test-token')
  expect(JSON.parse(options.body)).toEqual({
    from_account_id: 'cash',
    to_account_id: 'bank',
    amount: '20.00',
    note: 'rent float',
    occurred_at: '2026-11-07T00:00:00',
  })
})

test('more than two Accounts must be chosen, and the same Account is refused', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderForm({
    accounts: [
      { id: 'cash', name: 'Cash' },
      { id: 'bank', name: 'Bank' },
      { id: 'savings', name: 'Savings' },
    ],
  })

  expect(screen.getByLabelText('From')).toHaveValue('')
  await user.click(screen.getByRole('button', { name: 'Transfer' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Choose an Account to transfer from.')
  expect(fetchMock).not.toHaveBeenCalled()

  await user.selectOptions(screen.getByLabelText('From'), 'cash')
  await user.selectOptions(screen.getByLabelText('To'), 'cash')
  await user.click(screen.getByRole('button', { name: 'Transfer' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Choose two different Accounts.')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('a future date is refused before sending', async () => {
  const user = userEvent.setup()
  const { fetchMock } = renderForm()
  await user.type(screen.getByLabelText('Amount'), '20')
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-08' } })
  await user.click(screen.getByRole('button', { name: 'Transfer' }))

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Choose a date that is today or in the past.',
  )
  expect(fetchMock).not.toHaveBeenCalled()
})

test('a failed save keeps the amount', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.type(screen.getByLabelText('Amount'), '20')
  await user.click(screen.getByRole('button', { name: 'Transfer' }))

  expect(screen.getByRole('alert')).toHaveTextContent('Pennies could not record this transfer')
  expect(screen.getByLabelText('Amount')).toHaveValue('20')
})
