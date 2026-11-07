import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Dashboard from '../Dashboard.jsx'

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ user: { given_name: 'Alex' }, logout: vi.fn() }),
}))

describe('Dashboard', () => {
  it('opens Spending habits from Spending insights', async () => {
    const onViewSpendingHabits = vi.fn()
    render(<Dashboard onViewSpendingHabits={onViewSpendingHabits} />)

    await userEvent.click(screen.getByRole('link', { name: 'View spending habits' }))

    expect(onViewSpendingHabits).toHaveBeenCalledOnce()
  })
})
