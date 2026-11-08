import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAuth0 } from '@auth0/auth0-react'
import { expect, test, vi } from 'vitest'
import Dashboard from './Dashboard.jsx'

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
    vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          spent_this_month: '10.00',
          left_to_spend: '20.00',
          categories: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transactions: [] }),
      }),
  )

  return render(<Dashboard />)
}

test('user can read how to respond to a scam', async () => {
  const user = userEvent.setup()
  renderDashboard()

  await user.click(screen.getByRole('button', { name: /scam avoidance/i }))

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

  await user.click(screen.getByRole('button', { name: /budgeting basics/i }))

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

  await user.click(screen.getByRole('button', { name: /investing basics/i }))

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

async function expectBackOnDashboard(guideTitle) {
  expect(
    await screen.findByRole('heading', { name: 'Guides' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: guideTitle, level: 1 }),
  ).not.toBeInTheDocument()
}

test('pressing browser back button while viewing a guide returns to dashboard', async () => {
  const user = userEvent.setup()
  renderDashboard()

  await user.click(screen.getByRole('button', { name: /budgeting basics/i }))
  expect(
    screen.getByRole('heading', { name: 'Budgeting basics', level: 1 }),
  ).toBeInTheDocument()
  expect(window.location.hash).toBe('#guide/budgeting-basics')

  // Browser Back steps off the pushed guide entry onto the dashboard entry
  window.location.hash = ''
  window.dispatchEvent(new PopStateEvent('popstate'))

  await expectBackOnDashboard('Budgeting basics')
})

test('clicking Back to dashboard closes the guide and clears the URL', async () => {
  const user = userEvent.setup()
  renderDashboard()

  await user.click(screen.getByRole('button', { name: /budgeting basics/i }))
  expect(
    screen.getByRole('heading', { name: 'Budgeting basics', level: 1 }),
  ).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /back to dashboard/i }))

  await expectBackOnDashboard('Budgeting basics')
  expect(window.location.hash).toBe('')
})

test('guide opened directly from its URL closes to the dashboard, not away from the app', async () => {
  const user = userEvent.setup()
  window.location.hash = '#guide/scam-avoidance'
  renderDashboard()

  expect(
    await screen.findByRole('heading', { name: 'Scam avoidance', level: 1 }),
  ).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /back to dashboard/i }))

  await expectBackOnDashboard('Scam avoidance')
  expect(window.location.hash).toBe('')
})

test('an external hash change opens the matching guide', async () => {
  renderDashboard()

  window.location.hash = 'guide/investing-basics'

  expect(
    await screen.findByRole('heading', { name: 'Investing basics', level: 1 }),
  ).toBeInTheDocument()
})
