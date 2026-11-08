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
      { path: '/accounts', element: <h2>Accounts</h2> },
      { path: '/transactions', element: <h2>Transactions</h2> },
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
    screen.getByRole('heading', { name: 'A budget example' }),
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
      {
        id: 'r2',
        kind: 'guide',
        guide_id: 'scam-avoidance',
        resource_id: null,
        reason: 'A strange payment needs a second look.',
        title: 'Scam avoidance',
        url: null,
        publisher: null,
      },
    ],
  }
  renderDashboard({ reading })

  const budgeting = await screen.findByRole('button', { name: /budgeting basics/i })
  expect(within(budgeting).queryByText('Recommended')).not.toBeInTheDocument()
  const scam = screen.getByRole('button', { name: /scam avoidance/i })
  expect(within(scam).getByText('Recommended')).toBeInTheDocument()
})

test('Accounts sits beside Log out', async () => {
  const user = userEvent.setup()
  const router = renderDashboard()

  const banner = await screen.findByRole('banner')
  expect(within(banner).getByRole('link', { name: 'Accounts' })).toBeInTheDocument()
  expect(within(banner).getByRole('button', { name: 'Log out' })).toBeInTheDocument()

  await user.click(within(banner).getByRole('link', { name: 'Accounts' }))

  expect(router.state.location.pathname).toBe('/accounts')
  expect(screen.getByRole('heading', { name: 'Accounts' })).toBeInTheDocument()
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

test('a monthly budget can be set from left to spend', async () => {
  const user = userEvent.setup()
  useAuth0.mockReturnValue({
    user: { given_name: 'Elodie' },
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn().mockResolvedValue('test-token'),
  })
  const period = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date())
  const year = period.find((part) => part.type === 'year').value
  const month = period.find((part) => part.type === 'month').value
  let saved = null
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      const path = String(url)
      calls.push({ path, method: options.method, body: options.body })
      if (options.method === 'PUT' && path.includes('/monthly-budgets/')) {
        saved = JSON.parse(options.body).amount
        return json({ year: Number(year), month: Number(month), amount: saved })
      }
      if (path.includes('/dashboard')) {
        return json({
          spent_this_month: '10.00',
          left_to_spend: saved ? '90.00' : '40.00',
          monthly_budget: saved,
          categories: [],
          subscriptions: '0.00',
        })
      }
      if (path.includes('/transactions')) return json({ transactions: [] })
      if (path.includes('/reading')) return json({ sharing_mode: 'raw', updated: false, reading: null })
      return json({})
    }),
  )
  renderAt('/')

  const heading = await screen.findByRole('heading', { name: 'Left to spend' })
  const tile = () => heading.closest('section')
  expect(within(tile()).getByText('£40.00')).toBeInTheDocument()

  await user.click(within(tile()).getByRole('button', { name: 'Set budget' }))
  const budgetField = () => within(tile()).getByRole('textbox', { name: /budget/i })
  await user.type(budgetField(), '-5')
  await user.click(screen.getByRole('button', { name: 'Save budget' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a budget in pounds and pence.')
  expect(calls.some((call) => call.method === 'PUT')).toBe(false)

  await user.clear(budgetField())
  await user.type(budgetField(), '100')
  await user.click(screen.getByRole('button', { name: 'Save budget' }))

  const savedCall = calls.find((call) => call.method === 'PUT')
  expect(savedCall.path).toContain(`/monthly-budgets/${year}/${month}`)
  expect(JSON.parse(savedCall.body)).toEqual({ amount: '100.00' })
  expect(await within(tile()).findByText('£90.00')).toBeInTheDocument()
  expect(within(tile()).getByText('Budget £100.00')).toBeInTheDocument()
  expect(within(tile()).getByRole('button', { name: 'Edit budget' })).toBeInTheDocument()
})

test('an empty budget removes the monthly budget', async () => {
  const user = userEvent.setup()
  useAuth0.mockReturnValue({
    user: { given_name: 'Elodie' },
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn().mockResolvedValue('test-token'),
  })
  let budget = '100.00'
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      const path = String(url)
      calls.push({ path, method: options.method, body: options.body })
      if (options.method === 'PUT' && path.includes('/monthly-budgets/')) {
        budget = JSON.parse(options.body).amount
        return json({ year: 2026, month: 11, amount: budget })
      }
      if (path.includes('/dashboard')) {
        return json({
          spent_this_month: '10.00',
          left_to_spend: budget ? '90.00' : '40.00',
          monthly_budget: budget,
          categories: [],
          subscriptions: '0.00',
        })
      }
      if (path.includes('/transactions')) return json({ transactions: [] })
      if (path.includes('/reading')) return json({ sharing_mode: 'raw', updated: false, reading: null })
      return json({})
    }),
  )
  renderAt('/')

  const heading = await screen.findByRole('heading', { name: 'Left to spend' })
  const tile = () => heading.closest('section')
  await user.click(await within(tile()).findByRole('button', { name: 'Edit budget' }))
  const budgetField = within(tile()).getByRole('textbox', { name: /budget/i })
  await user.clear(budgetField)
  await user.click(screen.getByRole('button', { name: 'Save budget' }))

  const savedCall = calls.find((call) => call.method === 'PUT')
  expect(JSON.parse(savedCall.body)).toEqual({ amount: null })
  expect(await within(tile()).findByText('£40.00')).toBeInTheDocument()
  expect(within(tile()).queryByText(/Budget £/)).not.toBeInTheDocument()
  expect(within(tile()).getByRole('button', { name: 'Set budget' })).toBeInTheDocument()
})

test('an Account is required before the form opens', async () => {
  const user = userEvent.setup()
  renderRecords((call) => {
    if (call.url.endsWith('/accounts')) return ok([])
    if (call.url.includes('/transactions')) return ok({ transactions: [] })
    return ok({ spent_this_month: '0.00', left_to_spend: '0.00', categories: [] })
  })

  await user.click(await screen.findByRole('button', { name: 'Add transaction' }))

  expect(screen.getByText('An Account is needed.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Add account' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Vendor')).not.toBeInTheDocument()
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

test('user transfers money between two Accounts without counting it as spending', async () => {
  const user = userEvent.setup()
  let lists = 0
  const calls = renderRecords((call) => {
    if (call.url.endsWith('/accounts')) {
      return ok([
        { id: 'cash', name: 'Cash' },
        { id: 'bank', name: 'Bank' },
      ])
    }
    if (call.url.endsWith('/transfers') && call.options.method === 'POST') {
      return ok({ id: 'transfer-1' })
    }
    if (call.url.includes('/transactions')) {
      lists += 1
      return ok({
        transactions:
          lists === 1
            ? []
            : [
                {
                  id: 'tx-out',
                  account_id: 'cash',
                  vendor: null,
                  category: 'Other',
                  kind: 'transfer',
                  occurred_at: '2026-11-03T00:00:00+00:00',
                  amount: '-20.00',
                },
                {
                  id: 'tx-in',
                  account_id: 'bank',
                  vendor: null,
                  category: 'Other',
                  kind: 'transfer',
                  occurred_at: '2026-11-03T00:00:00+00:00',
                  amount: '20.00',
                },
              ],
      })
    }
    return ok({
      spent_this_month: '18.40',
      left_to_spend: '80.00',
      categories: [{ name: 'Groceries', amount: '18.40' }],
    })
  })

  await user.click(await screen.findByRole('button', { name: 'Transfer' }))
  await user.type(screen.getByLabelText('Amount'), '20')
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-03' } })
  await user.click(screen.getByRole('button', { name: 'Transfer' }))

  expect(await screen.findByText('Transfer recorded')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()
  expect(screen.getByText('Cash · 3 Nov')).toBeInTheDocument()
  expect(screen.getByText('Bank · 3 Nov')).toBeInTheDocument()
  expect(screen.getByText('-£20.00')).toBeInTheDocument()
  expect(screen.getByText('+£20.00')).toBeInTheDocument()
  expect(screen.getAllByText('£18.40')).toHaveLength(2)
  expect(screen.queryByLabelText('From')).not.toBeInTheDocument()

  const post = calls.find((call) => call.options.method === 'POST')
  expect(post.url).toMatch(/\/transfers$/)
  expect(JSON.parse(post.options.body)).toEqual({
    from_account_id: 'cash',
    to_account_id: 'bank',
    amount: '20.00',
    note: null,
    occurred_at: '2026-11-03T00:00:00',
  })
})

test('two Accounts are required before a transfer opens', async () => {
  const user = userEvent.setup()
  renderRecords((call) => {
    if (call.url.endsWith('/accounts')) return ok([{ id: 'cash', name: 'Cash' }])
    if (call.url.includes('/transactions')) return ok({ transactions: [] })
    return ok({ spent_this_month: '0.00', left_to_spend: '0.00', categories: [] })
  })

  await user.click(await screen.findByRole('button', { name: 'Transfer' }))

  expect(screen.getByText('Two Accounts are needed.')).toBeInTheDocument()
  expect(screen.queryByLabelText('From')).not.toBeInTheDocument()
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

test('recent transactions shows three entries and opens the transactions screen', async () => {
  const user = userEvent.setup()
  useAuth0.mockReturnValue({
    user: { given_name: 'Elodie' },
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn().mockResolvedValue('test-token'),
  })
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = String(url)
      calls.push(path)
      if (path.includes('/dashboard')) {
        return json({
          spent_this_month: '0.00',
          left_to_spend: '0.00',
          monthly_budget: null,
          categories: [],
          subscriptions: '0.00',
        })
      }
      if (path.endsWith('/accounts')) return json([{ id: 'acc-1', name: 'Monzo' }])
      if (path.includes('/transactions')) {
        return json({
          transactions: ['Tesco', 'Pret', 'Cafe', 'Old shop'].map((vendor, index) => ({
            id: `tx-${index}`,
            account_id: 'acc-1',
            vendor,
            category: 'Groceries',
            occurred_at: '2026-11-08T00:00:00+00:00',
            amount: '-1.00',
          })),
        })
      }
      if (path.includes('/reading')) return json({ sharing_mode: 'raw', updated: false, reading: null })
      return json({})
    }),
  )
  const router = renderAt('/')

  expect(await screen.findByText('Tesco')).toBeInTheDocument()
  expect(screen.getAllByText('Monzo · Groceries · 8 Nov')).toHaveLength(3)
  expect(screen.getByText('Pret')).toBeInTheDocument()
  expect(screen.getByText('Cafe')).toBeInTheDocument()
  expect(screen.queryByText('Old shop')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()
  expect(calls.some((path) => path.includes('/transactions?limit=3'))).toBe(true)

  await user.click(screen.getByRole('link', { name: 'View all transactions' }))
  expect(router.state.location.pathname).toBe('/transactions')
  expect(screen.getByRole('heading', { name: 'Transactions' })).toBeInTheDocument()
})

test('one recorded outflow shows up in spending insights', async () => {
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
          spent_this_month: '6.00',
          left_to_spend: '0.00',
          monthly_budget: null,
          categories: [{ name: 'Groceries', amount: '6.00' }],
          subscriptions: '0.00',
        })
      }
      if (path.includes('/transactions')) {
        return json({
          transactions: [
            {
              id: 'tx-1',
              vendor: 'Tesco',
              category: 'Groceries',
              occurred_at: '2026-11-08T00:00:00+00:00',
              amount: '-6.00',
            },
          ],
        })
      }
      if (path.includes('/reading')) return json({ sharing_mode: 'raw', updated: false, reading: null })
      return json({})
    }),
  )
  renderAt('/')

  const insights = await screen.findByRole('heading', { name: 'Spending insights' })
  const tile = insights.closest('section')
  expect(within(tile).getByText('Groceries')).toBeInTheDocument()
  expect(within(tile).getByText('£6.00')).toBeInTheDocument()
  expect(within(tile).queryByText(/went to/)).not.toBeInTheDocument()
  expect(screen.getByText('Tesco')).toBeInTheDocument()
  expect(screen.queryByText('No spending this month')).not.toBeInTheDocument()
})

test('opening a guide URL shows that guide', async () => {
  renderDashboard({ path: '/guides/investing-basics' })

  expect(
    await screen.findByRole('heading', { name: 'Investing basics', level: 1 }),
  ).toBeInTheDocument()
})
