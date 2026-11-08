import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAuth0 } from '@auth0/auth0-react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test, vi } from 'vitest'
import Dashboard from './Dashboard.jsx'
import { GuidePage } from './Guides.jsx'
import { guides } from './guides.js'

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: vi.fn(),
}))

function renderAt(path) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <Dashboard /> },
      { path: '/guides/:guideId', element: <GuidePage /> },
      { path: '/spending-habits', element: <h2>Spending habits</h2> },
      { path: '/recommendations', element: <h2>Recommendations</h2> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

function renderDashboard({ reading = null, path = '/' } = {}) {
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
      if (path.includes('/reading')) return json({ sharing_mode: 'raw', updated: false, reading })
      return json({})
    }),
  )

  return renderAt(path)
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

test('badges the guides named in the current portrait recommendations', async () => {
  const reading = {
    reading: 'Shops little and often.',
    spending_habits: [],
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
  renderDashboard({ reading })

  const budgeting = await screen.findByRole('button', { name: /budgeting basics/i })
  expect(within(budgeting).getByText('Recommended')).toBeInTheDocument()
  const scam = screen.getByRole('button', { name: /scam avoidance/i })
  expect(within(scam).queryByText('Recommended')).not.toBeInTheDocument()
})

test('links to the Recommendations screen', async () => {
  const user = userEvent.setup()
  const router = renderDashboard()

  await user.click(await screen.findByRole('link', { name: /recommends for you/i }))

  expect(router.state.location.pathname).toBe('/recommendations')
  expect(screen.getByRole('heading', { name: 'Recommendations' })).toBeInTheDocument()
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

function ok(body) {
  return { ok: true, json: async () => body }
}

function renderRecords(handler) {
  useAuth0.mockReturnValue({
    user: { given_name: 'Elodie' },
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn().mockResolvedValue('test-token'),
  })
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      const call = { url: String(url), options }
      calls.push(call)
      return handler(call)
    }),
  )
  renderAt('/')
  return calls
}

test('an Account is required before the form opens', async () => {
  const user = userEvent.setup()
  renderRecords((call) => {
    if (call.url.endsWith('/accounts')) return ok([])
    if (call.url.includes('/transactions')) return ok({ transactions: [] })
    return ok({ spent_this_month: '0.00', left_to_spend: '0.00', categories: [] })
  })

  await user.click(await screen.findByRole('button', { name: 'Add transaction' }))

  expect(screen.getByText('An Account is needed.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Vendor')).not.toBeInTheDocument()
})

test('user records an Account from beside Add transaction', async () => {
  const user = userEvent.setup()
  const calls = renderRecords((call) => {
    if (call.url.endsWith('/accounts') && call.options.method === 'POST') {
      return ok({ id: 'acc-1', name: 'Cash', opening_balance: '40.00', calculated_balance: '40.00' })
    }
    if (call.url.includes('/transactions')) return ok({ transactions: [] })
    return ok({ spent_this_month: '0.00', left_to_spend: '0.00', categories: [] })
  })

  expect(await screen.findByRole('button', { name: 'Add transaction' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Add account' }))
  await user.type(screen.getByLabelText('Name'), 'Cash')
  await user.clear(screen.getByLabelText('Opening balance'))
  await user.type(screen.getByLabelText('Opening balance'), '40')
  await user.click(screen.getByRole('button', { name: 'Add account' }))

  expect(await screen.findByText('Account recorded')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add transaction' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()

  const post = calls.find((call) => call.options.method === 'POST')
  expect(JSON.parse(post.options.body)).toEqual({
    name: 'Cash',
    opening_balance: '40.00',
  })
  expect(post.options.headers.Authorization).toBe('Bearer test-token')
})

test('a failed Account load keeps the form closed', async () => {
  const user = userEvent.setup()
  renderRecords((call) => {
    if (call.url.endsWith('/accounts')) return { ok: false, json: async () => ({}) }
    if (call.url.includes('/transactions')) return ok({ transactions: [] })
    return ok({ spent_this_month: '0.00', left_to_spend: '0.00', categories: [] })
  })

  await user.click(await screen.findByRole('button', { name: 'Add transaction' }))

  expect(screen.getByText('Pennies could not load your records')).toBeInTheDocument()
  expect(screen.queryByLabelText('Vendor')).not.toBeInTheDocument()
})

test('user records an outflow and the dashboard shows it was recorded', async () => {
  const user = userEvent.setup()
  let dashboards = 0
  let lists = 0
  const calls = renderRecords((call) => {
    if (call.url.endsWith('/accounts')) {
      return ok([{ id: 'acc-1', name: 'Monzo' }])
    }
    if (call.url.endsWith('/transactions') && call.options.method === 'POST') {
      return ok({ id: 'tx-1' })
    }
    if (call.url.includes('limit=100')) {
      return ok({ transactions: [], next_offset: null })
    }
    if (call.url.includes('/transactions')) {
      lists += 1
      return ok({
        transactions:
          lists === 1
            ? []
            : [
                {
                  id: 'tx-1',
                  vendor: 'Pret',
                  category: 'Other',
                  occurred_at: '2020-10-15T09:30:00+01:00',
                  amount: '-3.40',
                },
              ],
      })
    }
    dashboards += 1
    return ok({
      spent_this_month: dashboards === 1 ? '10.00' : '13.40',
      left_to_spend: '20.00',
      categories: [],
    })
  })

  await user.click(await screen.findByRole('button', { name: 'Add transaction' }))
  await user.click(screen.getByRole('radio', { name: 'Outflow' }))
  await user.type(screen.getByLabelText('Amount'), '3.4')
  await user.type(screen.getByLabelText('Vendor'), 'Pret')
  fireEvent.change(screen.getByLabelText('Date'), {
    target: { value: '2020-10-15' },
  })
  await user.click(screen.getByRole('button', { name: 'Add transaction' }))

  expect(await screen.findByText('Transaction recorded')).toBeInTheDocument()
  expect(screen.getByText('Pret')).toBeInTheDocument()
  expect(screen.getByText('-£3.40')).toBeInTheDocument()
  expect(screen.getByText('£13.40')).toBeInTheDocument()
  expect(screen.queryByLabelText('Vendor')).not.toBeInTheDocument()

  const post = calls.find((call) => call.options.method === 'POST')
  expect(JSON.parse(post.options.body)).toEqual({
    account_id: 'acc-1',
    amount: '-3.40',
    vendor: 'Pret',
    note: null,
    occurred_at: '2020-10-15T00:00:00',
  })
  expect(post.options.headers.Authorization).toBe('Bearer test-token')
})

test('a failed reload still says the Transaction was recorded', async () => {
  const user = userEvent.setup()
  let dashboards = 0
  renderRecords((call) => {
    if (call.url.endsWith('/accounts')) return ok([{ id: 'acc-1', name: 'Monzo' }])
    if (call.url.endsWith('/transactions') && call.options.method === 'POST') {
      return ok({ id: 'tx-1' })
    }
    if (call.url.includes('/transactions')) {
      return ok({ transactions: [], next_offset: null })
    }
    dashboards += 1
    if (dashboards > 1) return { ok: false, json: async () => ({}) }
    return ok({ spent_this_month: '10.00', left_to_spend: '20.00', categories: [] })
  })

  await user.click(await screen.findByRole('button', { name: 'Add transaction' }))
  await user.click(screen.getByRole('radio', { name: 'Inflow' }))
  await user.type(screen.getByLabelText('Amount'), '1850')
  await user.type(screen.getByLabelText('Vendor'), 'Employer')
  fireEvent.change(screen.getByLabelText('Date'), {
    target: { value: '2020-11-01' },
  })
  await user.click(screen.getByRole('button', { name: 'Add transaction' }))

  expect(
    await screen.findByText(
      'Transaction recorded. Pennies could not load your records',
    ),
  ).toBeInTheDocument()
  expect(screen.getByText('£10.00')).toBeInTheDocument()
  expect(screen.queryByLabelText('Vendor')).not.toBeInTheDocument()
})

test('opening a guide closes the form', async () => {
  const user = userEvent.setup()
  renderRecords((call) => {
    if (call.url.endsWith('/accounts')) return ok([{ id: 'acc-1', name: 'Monzo' }])
    if (call.url.includes('/transactions')) return ok({ transactions: [] })
    return ok({ spent_this_month: '0.00', left_to_spend: '0.00', categories: [] })
  })

  await user.click(await screen.findByRole('button', { name: 'Add transaction' }))
  expect(screen.getByLabelText('Vendor')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /budgeting basics/i }))
  await user.click(screen.getByRole('button', { name: /back to dashboard/i }))

  expect(screen.queryByLabelText('Vendor')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add transaction' })).toBeInTheDocument()
})

test('Cancel closes the form without recording', async () => {
  const user = userEvent.setup()
  const calls = renderRecords((call) => {
    if (call.url.endsWith('/accounts')) return ok([{ id: 'acc-1', name: 'Monzo' }])
    if (call.url.includes('/transactions')) return ok({ transactions: [] })
    return ok({ spent_this_month: '0.00', left_to_spend: '0.00', categories: [] })
  })

  await user.click(await screen.findByRole('button', { name: 'Add transaction' }))
  expect(screen.queryByRole('heading', { name: 'Recent transactions' })).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('Vendor'), 'Pret')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(screen.getByRole('heading', { name: 'Recent transactions' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Vendor')).not.toBeInTheDocument()
  expect(calls.some((call) => call.options.method === 'POST')).toBe(false)
  await user.click(screen.getByRole('button', { name: 'Add transaction' }))
  expect(screen.getByLabelText('Vendor')).toHaveValue('')
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
  const router = renderDashboard()

  await user.click(screen.getByRole('button', { name: /budgeting basics/i }))
  expect(
    screen.getByRole('heading', { name: 'Budgeting basics', level: 1 }),
  ).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/guides/budgeting-basics')

  await act(async () => {
    await router.navigate(-1)
  })

  await expectBackOnDashboard('Budgeting basics')
})

test('clicking Back to dashboard closes the guide and clears the URL', async () => {
  const user = userEvent.setup()
  const router = renderDashboard()

  await user.click(screen.getByRole('button', { name: /budgeting basics/i }))
  expect(
    screen.getByRole('heading', { name: 'Budgeting basics', level: 1 }),
  ).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /back to dashboard/i }))

  await expectBackOnDashboard('Budgeting basics')
  expect(router.state.location.pathname).toBe('/')
})

test('guide opened directly from its URL closes to the dashboard, not away from the app', async () => {
  const user = userEvent.setup()
  const router = renderDashboard({ path: '/guides/scam-avoidance' })

  expect(
    await screen.findByRole('heading', { name: 'Scam avoidance', level: 1 }),
  ).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /back to dashboard/i }))

  await expectBackOnDashboard('Scam avoidance')
  expect(router.state.location.pathname).toBe('/')
})

test('opening a guide URL shows that guide', async () => {
  renderDashboard({ path: '/guides/investing-basics' })

  expect(
    await screen.findByRole('heading', { name: 'Investing basics', level: 1 }),
  ).toBeInTheDocument()
})
