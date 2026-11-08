import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import AccountsPage from './AccountsPage.jsx'

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn().mockResolvedValue('test-token'),
  }),
}))

function json(body) {
  return { ok: true, json: async () => body }
}

test('edits an account name and a category name without touching transactions', async () => {
  const user = userEvent.setup()
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method, body: options.body })
      const path = String(url)
      if (options.method === 'PATCH' && path.includes('/accounts/')) {
        return json({
          id: 'acc-1',
          name: 'Bank',
          opening_balance: '10.00',
          calculated_balance: '6.00',
        })
      }
      if (options.method === 'PATCH' && path.includes('/categories/cat-1')) {
        return json({ id: 'cat-1', name: 'Food' })
      }
      if (path.includes('/accounts')) {
        return json([
          { id: 'acc-1', name: 'Cash', opening_balance: '10.00', calculated_balance: '6.00' },
        ])
      }
      if (path.includes('/categories')) {
        return json([
          { id: 'cat-1', name: 'Groceries' },
          { id: 'cat-2', name: 'Transport' },
        ])
      }
      return json([])
    }),
  )

  render(
    <MemoryRouter>
      <AccountsPage />
    </MemoryRouter>,
  )

  expect(await screen.findByText('Cash')).toBeInTheDocument()
  expect(screen.getByText(/Balance £6\.00/)).toBeInTheDocument()
  expect(screen.queryByText(/Opening/)).not.toBeInTheDocument()
  expect(screen.getByText('Groceries')).toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

  const accounts = screen.getByRole('region', { name: 'Bank accounts' })
  await user.click(within(accounts).getByRole('button', { name: 'Edit' }))
  const accountForm = screen.getByRole('form', { name: 'Edit Cash' })
  expect(within(accountForm).queryByLabelText('Opening balance')).not.toBeInTheDocument()
  await user.clear(within(accountForm).getByLabelText('Name'))
  await user.type(within(accountForm).getByLabelText('Name'), 'Bank')
  await user.click(screen.getByRole('button', { name: 'Save account' }))

  const accountPatch = calls.find((call) => call.method === 'PATCH' && call.url.includes('/accounts/'))
  expect(accountPatch.url).toContain('/accounts/acc-1')
  expect(JSON.parse(accountPatch.body)).toEqual({ name: 'Bank' })
  expect(await screen.findByText('Bank')).toBeInTheDocument()
  expect(screen.getByText(/Balance £6\.00/)).toBeInTheDocument()

  const categories = screen.getByRole('region', { name: 'Categories' })
  await user.click(within(categories).getAllByRole('button', { name: 'Edit' })[0])
  const categoryForm = screen.getByRole('form', { name: 'Edit Groceries' })
  await user.clear(within(categoryForm).getByLabelText('Name'))
  await user.type(within(categoryForm).getByLabelText('Name'), 'Food')
  await user.click(screen.getByRole('button', { name: 'Save category' }))

  const categoryPatch = calls.find((call) => call.method === 'PATCH' && call.url.includes('/categories/'))
  expect(categoryPatch.url).toContain('/categories/cat-1')
  expect(JSON.parse(categoryPatch.body)).toEqual({ name: 'Food' })
  expect(await screen.findByText('Food')).toBeInTheDocument()
  expect(calls.some((call) => call.url.includes('/transactions'))).toBe(false)
})
