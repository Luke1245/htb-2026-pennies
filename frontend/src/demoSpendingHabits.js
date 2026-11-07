const rawHabits = [
  {
    id: 'weekend-eating-out',
    patternKey: 'weekend-eating-out',
    title: 'Weekend treats',
    explanation: 'You spend more on eating out at weekends. This may be worth keeping an eye on.',
    evidence: 'Last month, weekend spending averaged £24 per day, compared with £9 on weekdays.',
    period: 'Last month',
  },
  {
    id: 'steady-groceries',
    patternKey: 'steady-groceries',
    title: 'A steady food shop',
    explanation: 'Your grocery spending has stayed fairly consistent. That’s a useful routine to have.',
    evidence: 'You spent between £38 and £43 on groceries in each of the last three weeks.',
    period: 'The last three weeks',
  },
  {
    id: 'transport-emerging',
    patternKey: 'transport-emerging',
    title: 'A little more spent on transport',
    explanation: 'Your transport spending looks slightly higher recently, based on the Transactions added so far.',
    evidence: 'This is based on two weeks, so the pattern may change as you add more Transactions.',
    period: 'The last two weeks',
    emerging: true,
  },
]

const sanitisedHabits = rawHabits.map((habit) => ({
  ...habit,
  evidence: habit.emerging
    ? 'A small amount of recent category data suggests a change. More history will make this clearer.'
    : `Your ${habit.patternKey === 'weekend-eating-out' ? 'eating-out' : 'grocery'} amounts support this pattern across ${habit.period.toLowerCase()}.`,
}))

// Demo adapter: replace with the backend-owned Gemini endpoint when it is available.
export async function generateDemoHabits({ sharingMode }) {
  await new Promise((resolve) => setTimeout(resolve, 650))
  return { habits: sharingMode === 'sanitised' ? sanitisedHabits : rawHabits }
}
