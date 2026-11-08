import { fireEvent, render as renderWithTestingLibrary, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import RecommendationsPage from '../RecommendationsPage.jsx'

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ getAccessTokenSilently: vi.fn() }),
}))

function render(ui) {
  return renderWithTestingLibrary(<MemoryRouter>{ui}</MemoryRouter>)
}

const recommendations = [
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
    kind: 'resource',
    guide_id: null,
    resource_id: 'stepchange',
    reason: 'Free debt advice fits the pattern.',
    title: 'Free debt advice',
    url: 'https://www.stepchange.org/',
    publisher: 'StepChange Debt Charity',
  },
]

describe('Recommendations page', () => {
  it('teaches a lesson from the user’s own spending', async () => {
    const user = userEvent.setup()
    const onOpenGuide = vi.fn()
    const loadRecommendations = vi.fn().mockResolvedValue({
      educations: [
        {
          id: 'e1',
          subject: 'Eating out',
          guide_id: 'budgeting-basics',
          body: '£107.83 at Greggs and Domino’s is the pattern to watch.',
        },
      ],
      suggestions: [{ id: 's1', education_id: 'e1', body: 'Pick two days this week without a takeaway.' }],
      recommendations: [],
      updated: true,
    })
    render(
      <RecommendationsPage
        loadRecommendations={loadRecommendations}
        onBack={() => {}}
        onOpenGuide={onOpenGuide}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'Eating out' })).toBeInTheDocument()
    expect(screen.getByText('£107.83 at Greggs and Domino’s is the pattern to watch.')).toBeInTheDocument()
    expect(screen.getByText('Pick two days this week without a takeaway.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /read guide/i }))
    expect(onOpenGuide).toHaveBeenCalledWith(expect.objectContaining({ id: 'budgeting-basics' }))
    expect(screen.queryByRole('heading', { name: 'No recommendations yet' })).not.toBeInTheDocument()
  })

  it('shows ranked Guide and Resource recommendations with reasons', async () => {
    const loadRecommendations = vi.fn().mockResolvedValue({ recommendations, updated: true })
    render(
      <RecommendationsPage
        loadRecommendations={loadRecommendations}
        onBack={() => {}}
        onOpenGuide={() => {}}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Finding your recommendations')
    expect(await screen.findByText('Budgeting basics')).toBeInTheDocument()
    expect(screen.getByText('The grocery shops need a budget.')).toBeInTheDocument()
    expect(screen.getByText('Free debt advice')).toBeInTheDocument()
    expect(screen.getByText('StepChange Debt Charity')).toBeInTheDocument()
    expect(screen.getByText('Free debt advice fits the pattern.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /visit resource/i })).toHaveAttribute(
      'href',
      'https://www.stepchange.org/',
    )
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Budgeting basics')
    expect(items[1]).toHaveTextContent('Free debt advice')
    expect(loadRecommendations).toHaveBeenCalledWith({ action: 'load' })
  })

  it('opens a Guide recommendation with the matching guide', async () => {
    const user = userEvent.setup()
    const onOpenGuide = vi.fn()
    const loadRecommendations = vi.fn().mockResolvedValue({ recommendations, updated: true })
    render(
      <RecommendationsPage
        loadRecommendations={loadRecommendations}
        onBack={() => {}}
        onOpenGuide={onOpenGuide}
      />,
    )

    await user.click(await screen.findByRole('button', { name: /budgeting basics/i }))

    expect(onOpenGuide).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'budgeting-basics', title: 'Budgeting basics' }),
    )
  })

  it('explains when there is no spending history yet', async () => {
    const loadRecommendations = vi.fn().mockResolvedValue({ recommendations: null, updated: true })
    render(
      <RecommendationsPage
        loadRecommendations={loadRecommendations}
        onBack={() => {}}
        onOpenGuide={() => {}}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'No recommendations yet' })).toBeInTheDocument()
    expect(screen.getByText(/Add a Transaction from the dashboard/)).toBeInTheDocument()
  })

  it('says nothing stands out when the portrait has no recommendations', async () => {
    const loadRecommendations = vi.fn().mockResolvedValue({ recommendations: [], updated: true })
    render(
      <RecommendationsPage
        loadRecommendations={loadRecommendations}
        onBack={() => {}}
        onOpenGuide={() => {}}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'No recommendations yet' })).toBeInTheDocument()
    expect(screen.getByText(/Nothing stands out yet/)).toBeInTheDocument()
  })

  it('keeps the current recommendations and offers a retry when an update fails', async () => {
    const loadRecommendations = vi
      .fn()
      .mockResolvedValueOnce({ recommendations, updated: true })
      .mockRejectedValueOnce(new Error('AI unavailable'))
      .mockResolvedValueOnce({ recommendations, updated: true })
    render(
      <RecommendationsPage
        loadRecommendations={loadRecommendations}
        onBack={() => {}}
        onOpenGuide={() => {}}
      />,
    )

    await screen.findByText('Budgeting basics')
    fireEvent(window, new Event('pennies:transactions-changed'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your existing recommendations are still here',
    )
    expect(screen.getByText('Budgeting basics')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('Free debt advice')
    expect(loadRecommendations).toHaveBeenCalledTimes(3)
    expect(loadRecommendations).toHaveBeenLastCalledWith({ action: 'refresh' })
  })

  it('surfaces a failed rebuild over the real fetch path', async () => {
    const body = { reading: 'Shops little and often.', recommendations }
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ sharing_mode: 'raw', updated: false, reading: body }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ sharing_mode: 'raw', updated: false, reading: body }) }),
    )
    render(<RecommendationsPage onBack={() => {}} onOpenGuide={() => {}} />)

    await screen.findByText('Budgeting basics')
    fireEvent(window, new Event('pennies:transactions-changed'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your existing recommendations are still here',
    )
    expect(screen.getByText('Budgeting basics')).toBeInTheDocument()
  })
})
