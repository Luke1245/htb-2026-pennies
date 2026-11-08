import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
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
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ spent_this_month: '10.00', left_to_spend: '20.00', categories: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ transactions: [] }) }))
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/spending-habits" element={<h2>Spending habits</h2>} />
        </Routes>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('link', { name: 'View spending habits' }))

    expect(screen.getByRole('heading', { name: 'Spending habits' })).toBeInTheDocument()
  })
})
