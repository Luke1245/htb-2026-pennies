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
  recommendations: [
    {
      id: 'r1',
      kind: 'guide',
      guide_id: 'budgeting-basics',
      resource_id: null,
      reason: 'The grocery shops need a budget.',
      title: 'Budgeting basics',
      url: null,
      publisher: null,
    },
  ],
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
  })

  it('opens Recommendations from the dashboard and a Guide pick opens the guide', async () => {
    const user = userEvent.setup()
    window.location.hash = ''
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

    await user.click(await screen.findByRole('link', { name: /recommends for you/i }))
    expect(await screen.findByText('The grocery shops need a budget.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /read guide/i }))

    expect(await screen.findByRole('heading', { name: 'Budgeting basics', level: 1 })).toBeInTheDocument()
    expect(window.location.hash).toBe('#guide/budgeting-basics')
  })
})
