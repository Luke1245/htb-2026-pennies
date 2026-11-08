import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'

const { generateHabits } = vi.hoisted(() => ({ generateHabits: vi.fn() }))

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    isLoading: false,
    isAuthenticated: true,
    user: { given_name: 'Alex' },
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn().mockResolvedValue('test-token'),
  }),
}))

vi.mock('../demoSpendingHabits.js', () => ({ generateDemoHabits: generateHabits }))

describe('App', () => {
  it('regenerates habits each time the user enters the page', async () => {
    generateHabits.mockResolvedValue({
      habits: [{
        id: 'weekend-eating-out',
        patternKey: 'weekend-eating-out',
        title: 'Weekend treats',
        explanation: 'You spend more on eating out at weekends.',
        evidence: 'Weekend spending is higher.',
        period: 'Last month',
      }],
    })
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ spent_this_month: '10.00', left_to_spend: '20.00', categories: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ transactions: [] }) }))
    render(<App />)

    await user.click(await screen.findByRole('link', { name: 'View spending habits' }))
    await screen.findByRole('heading', { name: 'Weekend treats' })
    await user.click(screen.getByRole('button', { name: '← Back to dashboard' }))
    await user.click(screen.getByRole('link', { name: 'View spending habits' }))

    expect(generateHabits).toHaveBeenCalledTimes(2)
  })
})
