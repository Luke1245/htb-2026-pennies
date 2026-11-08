import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    isLoading: false,
    isAuthenticated: true,
    user: { given_name: 'Alex' },
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn().mockResolvedValue('test-token'),
  }),
}))

const portrait = {
  reading: 'Friday takeaway is becoming the month.',
  spending_habits: ['Coffee every weekday'],
  projected_habits: [],
  educations: [],
  suggestions: [],
}

function json(body) {
  return { ok: true, json: async () => body }
}

describe('App', () => {
  it('loads the financial portrait each time the user opens Spending habits', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url) => {
      const path = String(url)
      if (path.includes('/dashboard')) {
        return json({ spent_this_month: '10.00', left_to_spend: '20.00', categories: [], subscriptions: '0.00' })
      }
      if (path.includes('/transactions')) return json({ transactions: [] })
      if (path.includes('/sharing-mode')) return json({ mode: 'raw' })
      if (path.includes('/reading')) return json({ sharing_mode: 'raw', updated: false, reading: portrait })
      return json({})
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    await user.click(await screen.findByRole('link', { name: 'View spending habits' }))
    expect(await screen.findByText('Friday takeaway is becoming the month.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← Back to dashboard' }))
    await user.click(screen.getByRole('link', { name: 'View spending habits' }))
    expect(await screen.findByText('Friday takeaway is becoming the month.')).toBeInTheDocument()

    const readingCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/reading'))
    expect(readingCalls).toHaveLength(2)
  })
})
