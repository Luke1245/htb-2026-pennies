import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAuth0 } from '@auth0/auth0-react'
import { expect, test, vi } from 'vitest'
import Dashboard from './Dashboard.jsx'
import { guides } from './guides.js'

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: vi.fn(),
}))

function renderDashboard() {
  useAuth0.mockReturnValue({
    user: { given_name: 'Elodie' },
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn().mockResolvedValue('test-token'),
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = String(url)
      if (path.includes('/dashboard')) {
        return json({
          spent_this_month: '10.00',
          left_to_spend: '20.00',
          monthly_budget: null,
          categories: [],
          subscriptions: '0.00',
        })
      }
      if (path.includes('/transactions')) return json({ transactions: [] })
      if (path.includes('/guides')) return json(guides)
      if (path.includes('/sharing-mode')) return json({ mode: 'raw' })
      if (path.includes('/reading')) return json({ sharing_mode: 'raw', updated: false, reading: null })
      return json({})
    }),
  )

  return render(<Dashboard />)
}

function json(body) {
  return { ok: true, json: async () => body }
}

test('user can read how to respond to a scam', async () => {
  const user = userEvent.setup()
  renderDashboard()

  await user.click(await screen.findByRole('button', { name: /scam avoidance/i }))

  expect(
    screen.getByRole('heading', { name: 'Scam avoidance', level: 1 }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: /if you have responded or sent money/i }),
  ).toBeInTheDocument()
  expect(
    screen.getByText(/contact your bank immediately using a trusted number/i),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: /reporting fraud/i }),
  ).toHaveAttribute(
    'href',
    'https://stopthinkfraud.campaign.gov.uk/reporting-fraud/',
  )
})

test('user can open the budgeting guide and return to the dashboard', async () => {
  const user = userEvent.setup()
  renderDashboard()

  await user.click(await screen.findByRole('button', { name: /budgeting basics/i }))

  expect(
    screen.getByRole('heading', { name: 'Budgeting basics', level: 1 }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: /student budget example/i }),
  ).toBeInTheDocument()
  expect(screen.queryByText('Spent this month')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /back to dashboard/i }))

  expect(await screen.findByText('Spent this month')).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'Guides' }),
  ).toBeInTheDocument()
})

test('user can read long-term investing guidance and risk warnings', async () => {
  const user = userEvent.setup()
  renderDashboard()

  await user.click(await screen.findByRole('button', { name: /investing basics/i }))

  expect(
    screen.getByRole('heading', { name: 'Investing basics', level: 1 }),
  ).toBeInTheDocument()
  expect(screen.getByText(/not a way to get rich quickly/i)).toBeInTheDocument()
  expect(screen.getByText(/at least five years/i)).toBeInTheDocument()
  expect(
    screen.getByText(/investments can fall as well as rise/i),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: /what investing can help with/i }),
  ).toBeInTheDocument()
  expect(
    screen.getByText(/investing can help you work towards long-term goals/i),
  ).toBeInTheDocument()
  expect(screen.getByText(/open an adult isa/i)).toBeInTheDocument()
})
