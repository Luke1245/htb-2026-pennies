import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Dashboard from '../Dashboard.jsx'

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    user: { given_name: 'Alex' },
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn().mockResolvedValue('test-token'),
  }),
}))

describe('Dashboard', () => {
  it('opens Spending habits from Spending insights', async () => {
    const onViewSpendingHabits = vi.fn()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ spent_this_month: '10.00', left_to_spend: '20.00', categories: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ transactions: [] }) }))
    render(<Dashboard onViewSpendingHabits={onViewSpendingHabits} />)

    await userEvent.click(await screen.findByRole('link', { name: 'View spending habits' }))

    expect(onViewSpendingHabits).toHaveBeenCalledOnce()
  })
})
