import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SpendingHabitsPage from '../SpendingHabitsPage.jsx'

const habits = [
  {
    id: 'weekend-eating-out',
    patternKey: 'weekend-eating-out',
    title: 'Weekend treats',
    explanation: 'You spend more on eating out at weekends.',
    evidence: 'Last month, weekend spending averaged £24 per day, compared with £9 on weekdays.',
    period: 'Last month',
  },
]

describe('Spending habits page', () => {
  it('shows generated habits with their explanation, evidence, and time period', async () => {
    const generateHabits = vi.fn().mockResolvedValue({ habits })

    render(<SpendingHabitsPage generateHabits={generateHabits} onBack={() => {}} />)

    expect(screen.getByRole('status')).toHaveTextContent('Finding your spending habits')
    expect(await screen.findByRole('heading', { name: 'Weekend treats' })).toBeInTheDocument()
    expect(screen.getByText('You spend more on eating out at weekends.')).toBeInTheDocument()
    expect(screen.getByText(/weekend spending averaged £24/)).toBeInTheDocument()
    expect(screen.getByText('Last month')).toBeInTheDocument()
    expect(screen.getByText(/^Updated at /)).toBeInTheDocument()
  })

  it('labels tentative patterns as emerging habits', async () => {
    const generateHabits = vi.fn().mockResolvedValue({
      habits: [{ ...habits[0], emerging: true }],
    })

    render(<SpendingHabitsPage generateHabits={generateHabits} onBack={() => {}} />)

    expect(await screen.findByText('Emerging habit')).toBeInTheDocument()
    expect(screen.getByText('Something to keep an eye on as you add more Transactions.')).toBeInTheDocument()
  })

  it('lets a user lock and unlock a habit without moving it', async () => {
    const user = userEvent.setup()
    const generateHabits = vi.fn().mockResolvedValue({ habits })
    render(<SpendingHabitsPage generateHabits={generateHabits} onBack={() => {}} />)

    await screen.findByRole('heading', { name: 'Weekend treats' })
    await user.click(screen.getByRole('button', { name: 'Lock Weekend treats' }))

    expect(screen.getByText('Locked')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unlock Weekend treats' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Unlock Weekend treats' }))
    expect(screen.queryByText('Locked')).not.toBeInTheDocument()
  })

  it('dismisses a habit and its similar patterns temporarily, with an undo option', async () => {
    const user = userEvent.setup()
    const generateHabits = vi.fn().mockResolvedValue({
      habits: [habits[0], { ...habits[0], id: 'similar-weekend', title: 'Similar weekend spending' }],
    })
    render(<SpendingHabitsPage generateHabits={generateHabits} onBack={() => {}} />)

    await screen.findByRole('heading', { name: 'Weekend treats' })
    await user.click(screen.getByRole('button', { name: 'Dismiss Weekend treats' }))
    await user.click(screen.getByRole('button', { name: 'Hide for a week' }))

    expect(screen.queryByRole('heading', { name: 'Weekend treats' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Similar weekend spending' })).not.toBeInTheDocument()
    expect(screen.getByText(/Similar habits will be hidden for a week/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('heading', { name: 'Weekend treats' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Similar weekend spending' })).toBeInTheDocument()
  })

  it('warns before changing sharing mode, removes locked habits, and keeps dismissals active', async () => {
    const user = userEvent.setup()
    const generateHabits = vi.fn()
      .mockResolvedValueOnce({ habits })
      .mockResolvedValueOnce({ habits: [{ ...habits[0], title: 'A newly worded weekend pattern' }] })
    render(<SpendingHabitsPage generateHabits={generateHabits} onBack={() => {}} />)

    await screen.findByRole('heading', { name: 'Weekend treats' })
    await user.click(screen.getByRole('button', { name: 'Lock Weekend treats' }))
    await user.click(screen.getByRole('button', { name: 'Dismiss Weekend treats' }))
    await user.click(screen.getByRole('button', { name: 'Don’t show again' }))
    await user.selectOptions(screen.getByLabelText('AI sharing mode'), 'sanitised')

    expect(screen.getByRole('dialog')).toHaveTextContent('all current Spending habits, including Locked habits, will be removed')
    await user.click(screen.getByRole('button', { name: 'Change mode' }))

    await screen.findByText('Sanitised sharing protects vendor names, notes, exact dates, and account names, so habits may be less specific.')
    expect(screen.queryByRole('heading', { name: 'A newly worded weekend pattern' })).not.toBeInTheDocument()
    expect(generateHabits).toHaveBeenLastCalledWith({ sharingMode: 'sanitised' })
  })

  it('automatically refreshes unlocked habits after Transaction changes while preserving Locked habits', async () => {
    const generateHabits = vi.fn()
      .mockResolvedValueOnce({ habits: [habits[0], { ...habits[0], id: 'food-shop', patternKey: 'food-shop', title: 'A steady food shop' }] })
      .mockResolvedValueOnce({ habits: [{ ...habits[0], title: 'Changed wording' }, { ...habits[0], id: 'food-shop', patternKey: 'food-shop', title: 'Food shops are changing' }] })
    render(<SpendingHabitsPage generateHabits={generateHabits} onBack={() => {}} />)

    await screen.findByRole('heading', { name: 'Weekend treats' })
    await userEvent.click(screen.getByRole('button', { name: 'Lock A steady food shop' }))
    fireEvent(window, new Event('pennies:transactions-changed'))

    expect(await screen.findByRole('heading', { name: 'Changed wording' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'A steady food shop' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Food shops are changing' })).not.toBeInTheDocument()
    const titles = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(titles).toEqual(['Changed wording', 'A steady food shop'])
  })

  it('keeps existing habits and offers a retry when an ordinary update fails', async () => {
    const generateHabits = vi.fn()
      .mockResolvedValueOnce({ habits })
      .mockRejectedValueOnce(new Error('AI unavailable'))
      .mockResolvedValueOnce({ habits })
    render(<SpendingHabitsPage generateHabits={generateHabits} onBack={() => {}} />)

    await screen.findByRole('heading', { name: 'Weekend treats' })
    fireEvent(window, new Event('pennies:transactions-changed'))

    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t update your habits')
    expect(screen.getByRole('heading', { name: 'Weekend treats' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByRole('heading', { name: 'Weekend treats' })
    expect(generateHabits).toHaveBeenCalledTimes(3)
  })

  it('explains when there is no spending history instead of inventing habits', async () => {
    const generateHabits = vi.fn().mockResolvedValue({ habits: [], reason: 'no-history' })
    render(<SpendingHabitsPage generateHabits={generateHabits} onBack={() => {}} />)

    expect(await screen.findByRole('heading', { name: 'No spending history yet' })).toBeInTheDocument()
    expect(screen.getByText('Add a Transaction from the dashboard when you’re ready. Pennies will use your real spending to find habits.')).toBeInTheDocument()
  })
})
