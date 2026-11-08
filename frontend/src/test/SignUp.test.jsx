import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'

const { auth } = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    isAuthenticated: false,
    error: null,
    loginWithRedirect: vi.fn(),
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn().mockResolvedValue('test-token'),
  },
}))

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => auth,
}))

function json(body) {
  return { ok: true, json: async () => body }
}

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      const path = String(url)
      if (path.endsWith('/me') && options.method === 'PUT') {
        return json({ display_name: JSON.parse(options.body).display_name })
      }
      if (path.endsWith('/me')) return json({ display_name: null })
      if (path.includes('/dashboard')) {
        return json({
          spent_this_month: '0.00',
          left_to_spend: '0.00',
          categories: [],
          subscriptions: '0.00',
        })
      }
      if (path.includes('/transactions')) return json({ transactions: [] })
      if (path.includes('/reading')) return json({ sharing_mode: 'raw', updated: false, reading: null })
      return json({})
    }),
  )
}

describe('first name', () => {
  beforeEach(() => {
    auth.isAuthenticated = false
    auth.loginWithRedirect.mockReset()
  })

  it('opens Auth0 without a welcome screen', async () => {
    render(<App />)

    expect(screen.queryByRole('heading', { name: 'Welcome' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign up' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
    expect(auth.loginWithRedirect).toHaveBeenCalledWith()
  })

  it('asks for a first name in a popup after sign-in', async () => {
    const user = userEvent.setup()
    auth.isAuthenticated = true
    stubApi()
    render(<App />)

    const dialog = await screen.findByRole('dialog', { name: 'Tell Penny about yourself' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Penny' })).toHaveAttribute('src', expect.stringContaining('pennie_round'))
    expect(screen.queryByText('Hi, Sam')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('First name'), 'Sam')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Hi, Sam')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Penny' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
