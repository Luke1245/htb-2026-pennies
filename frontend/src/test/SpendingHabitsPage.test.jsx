import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SpendingHabitsPage from '../SpendingHabitsPage.jsx'

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ getAccessTokenSilently: vi.fn() }),
}))

const portrait = {
  reading: 'Friday takeaway is becoming the month.',
  spending_habits: ['Coffee every weekday'],
  projected_habits: ['Eating out will pass the budget'],
  educations: [{ id: 'e1', subject: 'Budgeting basics', body: 'The Friday orders are the leak.' }],
  suggestions: [{ id: 's1', body: 'Keep Friday under £20.' }],
}

describe('Spending habits page', () => {
  it('shows the financial portrait, habits, education, and suggestions', async () => {
    const loadPortrait = vi.fn().mockResolvedValue({ mode: 'raw', portrait, updated: true })
    render(<SpendingHabitsPage loadPortrait={loadPortrait} onBack={() => {}} />)

    expect(screen.getByRole('status')).toHaveTextContent('Finding your spending habits')
    expect(await screen.findByText('Friday takeaway is becoming the month.')).toBeInTheDocument()
    expect(screen.getByText('Coffee every weekday')).toBeInTheDocument()
    expect(screen.getByText('Eating out will pass the budget')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Budgeting basics' })).toBeInTheDocument()
    expect(screen.getByText('The Friday orders are the leak.')).toBeInTheDocument()
    expect(screen.getByText('Keep Friday under £20.')).toBeInTheDocument()
    expect(loadPortrait).toHaveBeenCalledWith({ action: 'load' })
  })

  it('warns before changing sharing mode and asks for a new reading', async () => {
    const user = userEvent.setup()
    const loadPortrait = vi.fn()
      .mockResolvedValueOnce({ mode: 'raw', portrait, updated: true })
      .mockResolvedValueOnce({
        mode: 'sanitised',
        portrait: { ...portrait, reading: 'A less specific picture.' },
        updated: true,
      })
    render(<SpendingHabitsPage loadPortrait={loadPortrait} onBack={() => {}} />)

    await screen.findByText('Friday takeaway is becoming the month.')
    await user.selectOptions(screen.getByLabelText('AI sharing mode'), 'sanitised')

    expect(screen.getByRole('dialog')).toHaveTextContent('the current Financial portrait will be removed')
    await user.click(screen.getByRole('button', { name: 'Change mode' }))

    expect(await screen.findByText('A less specific picture.')).toBeInTheDocument()
    expect(screen.getByText(/Sanitised sharing protects vendor names/)).toBeInTheDocument()
    expect(loadPortrait).toHaveBeenLastCalledWith({ action: 'share', mode: 'sanitised' })
  })

  it('keeps the current reading and offers a retry when an update fails', async () => {
    const loadPortrait = vi.fn()
      .mockResolvedValueOnce({ mode: 'raw', portrait, updated: true })
      .mockRejectedValueOnce(new Error('AI unavailable'))
      .mockResolvedValueOnce({ mode: 'raw', portrait, updated: true })
    render(<SpendingHabitsPage loadPortrait={loadPortrait} onBack={() => {}} />)

    await screen.findByText('Friday takeaway is becoming the month.')
    fireEvent(window, new Event('pennies:transactions-changed'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your existing reading is still here')
    expect(screen.getByText('Friday takeaway is becoming the month.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('Coffee every weekday')
    expect(loadPortrait).toHaveBeenCalledTimes(3)
    expect(loadPortrait).toHaveBeenLastCalledWith({ action: 'refresh' })
  })

  it('explains when there is no spending history', async () => {
    const loadPortrait = vi.fn().mockResolvedValue({ mode: 'raw', portrait: null, updated: true })
    render(<SpendingHabitsPage loadPortrait={loadPortrait} onBack={() => {}} />)

    expect(await screen.findByRole('heading', { name: 'No spending history yet' })).toBeInTheDocument()
    expect(screen.getByText(/Add a Transaction from the dashboard/)).toBeInTheDocument()
  })

  it('asks for a new reading when transactions change', async () => {
    const loadPortrait = vi.fn()
      .mockResolvedValueOnce({ mode: 'raw', portrait, updated: true })
      .mockResolvedValueOnce({
        mode: 'raw',
        portrait: { ...portrait, reading: 'The new shop changed the picture.' },
        updated: true,
      })
    render(<SpendingHabitsPage loadPortrait={loadPortrait} onBack={() => {}} />)

    await screen.findByText('Friday takeaway is becoming the month.')
    fireEvent(window, new Event('pennies:transactions-changed'))

    expect(await screen.findByText('The new shop changed the picture.')).toBeInTheDocument()
    expect(loadPortrait).toHaveBeenLastCalledWith({ action: 'refresh' })
  })

  it('ignores an older refresh that finishes after a newer refresh', async () => {
    let resolveOlder
    let resolveNewer
    const olderRequest = new Promise((resolve) => {
      resolveOlder = resolve
    })
    const newerRequest = new Promise((resolve) => {
      resolveNewer = resolve
    })
    const loadPortrait = vi.fn()
      .mockResolvedValueOnce({ mode: 'raw', portrait, updated: true })
      .mockReturnValueOnce(olderRequest)
      .mockReturnValueOnce(newerRequest)
    render(<SpendingHabitsPage loadPortrait={loadPortrait} onBack={() => {}} />)
    await screen.findByText('Friday takeaway is becoming the month.')

    fireEvent(window, new Event('pennies:transactions-changed'))
    fireEvent(window, new Event('pennies:transactions-changed'))
    await act(async () => {
      resolveNewer({
        mode: 'raw',
        portrait: { ...portrait, reading: 'Newest reading.' },
        updated: true,
      })
    })
    await act(async () => {
      resolveOlder({
        mode: 'raw',
        portrait: { ...portrait, reading: 'Outdated reading.' },
        updated: true,
      })
    })

    expect(screen.getByText('Newest reading.')).toBeInTheDocument()
    expect(screen.queryByText('Outdated reading.')).not.toBeInTheDocument()
  })
})
