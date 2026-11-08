import { useEffect, useRef, useState } from 'react'
import { generateDemoHabits } from './demoSpendingHabits.js'
import './spending-habits.css'

function isDismissed(habit, dismissals) {
  return dismissals.some((item) =>
    item.patternKey === habit.patternKey && (item.until === null || item.until > Date.now()),
  )
}

export default function SpendingHabitsPage({ generateHabits = generateDemoHabits, onBack, onLogout, isActive = true }) {
  const [habits, setHabits] = useState([])
  const [status, setStatus] = useState('loading')
  const [dismissMenu, setDismissMenu] = useState(null)
  const [lastDismissal, setLastDismissal] = useState(null)
  const dismissals = useRef([])
  const [sharingMode, setSharingMode] = useState('raw')
  const [pendingSharingMode, setPendingSharingMode] = useState(null)
  const [error, setError] = useState(false)
  const [emptyReason, setEmptyReason] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const wasActive = useRef(isActive)
  const latestRequest = useRef(0)

  useEffect(() => {
    if (!lastDismissal) return
    const timeout = setTimeout(() => setLastDismissal(null), 6000)
    return () => clearTimeout(timeout)
  }, [lastDismissal])

  const dismissHabit = (duration) => {
    const habit = habits.find((item) => item.id === dismissMenu)
    const remainingHabits = habits.filter((item) => item.patternKey !== habit.patternKey)
    setHabits(remainingHabits)
    if (remainingHabits.length === 0) setEmptyReason('dismissed')
    const until = duration === 'forever' ? null : Date.now() + (duration === 'week' ? 7 : 30) * 24 * 60 * 60 * 1000
    setLastDismissal({ habits: habits.filter((item) => item.patternKey === habit.patternKey), duration })
    dismissals.current = [...dismissals.current, { patternKey: habit.patternKey, until }]
    setDismissMenu(null)
  }

  const undoDismissal = () => {
    setHabits((current) => [...lastDismissal.habits, ...current].slice(0, 3))
    setEmptyReason(null)
    dismissals.current = dismissals.current.filter((item) => item.patternKey !== lastDismissal.habits[0].patternKey)
    setLastDismissal(null)
  }

  const confirmSharingMode = async () => {
    const requestId = ++latestRequest.current
    const nextMode = pendingSharingMode
    setPendingSharingMode(null)
    setSharingMode(nextMode)
    setHabits([])
    setStatus('loading')
    try {
    const result = await generateHabits({ sharingMode: nextMode })
    if (requestId !== latestRequest.current) return
    setError(false)
    setEmptyReason(result.reason)
    setLastUpdated(new Date())
    setHabits(result.habits.filter((habit) =>
      !isDismissed(habit, dismissals.current),
    ).slice(0, 3))
    } catch {
      if (requestId !== latestRequest.current) return
      setError(true)
    }
    if (requestId === latestRequest.current) setStatus('ready')
  }

  const toggleLock = (id) => {
    setHabits((current) =>
      current.map((habit) =>
        habit.id === id ? { ...habit, locked: !habit.locked } : habit,
      ),
    )
  }

  useEffect(() => {
    if (isActive && !wasActive.current) {
      window.dispatchEvent(new Event('pennies:transactions-changed'))
    }
    wasActive.current = isActive
  }, [isActive])

  useEffect(() => {
    let active = true
    const requestId = ++latestRequest.current
    generateHabits({ sharingMode: 'raw' }).then((result) => {
      if (!active || requestId !== latestRequest.current) return
      setHabits(result.habits.slice(0, 3))
      setEmptyReason(result.reason)
      setLastUpdated(new Date())
      setStatus('ready')
    }).catch(() => {
      if (!active || requestId !== latestRequest.current) return
      setError(true)
      setStatus('ready')
    })
    return () => {
      active = false
    }
  }, [generateHabits])

  useEffect(() => {
    const refreshHabits = async () => {
      const requestId = ++latestRequest.current
      setError(false)
      try {
      const result = await generateHabits({ sharingMode })
      if (requestId !== latestRequest.current) return
      setEmptyReason(result.reason)
      setLastUpdated(new Date())
      setHabits((current) => {
        const lockedPatterns = new Set(current.filter((habit) => habit.locked).map((habit) => habit.patternKey))
        const available = result.habits.filter((habit) =>
          !lockedPatterns.has(habit.patternKey)
          && !isDismissed(habit, dismissals.current),
        )
        let nextIndex = 0
        const merged = current.map((habit) => habit.locked ? habit : available[nextIndex++]).filter(Boolean)
        return [...merged, ...available.slice(nextIndex)].slice(0, 3)
      })
      } catch {
        if (requestId === latestRequest.current) setError(true)
      }
    }
    window.addEventListener('pennies:transactions-changed', refreshHabits)
    return () => window.removeEventListener('pennies:transactions-changed', refreshHabits)
  }, [generateHabits, sharingMode])

  return (
    <div className="habits-page">
      <header className="banner">
        <h1>Pennies</h1>
        <button type="button" className="logout" onClick={onLogout}>Log out</button>
      </header>
      <main className="habits-main">
        <button type="button" className="back-link" onClick={onBack}>
          ← Back to dashboard
        </button>
        <div className="sharing-control">
          <label htmlFor="sharing-mode">AI sharing mode</label>
          <select id="sharing-mode" value={sharingMode} onChange={(event) => setPendingSharingMode(event.target.value)}>
            <option value="raw">Raw sharing</option>
            <option value="sanitised">Sanitised sharing</option>
          </select>
        </div>
        {sharingMode === 'sanitised' && (
          <p className="privacy-note">Sanitised sharing protects vendor names, notes, exact dates, and account names, so habits may be less specific.</p>
        )}
        <div className="habits-heading">
          <p className="eyebrow">Your money, made clearer</p>
          <h2>Spending habits</h2>
          <p>Little patterns in your spending, explained in plain English.</p>
        </div>
        {status === 'loading' && <p role="status">Finding your spending habits…</p>}
        {status === 'ready' && !error && lastUpdated && (
          <p className="updated-at">
            Updated at {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {error && (
          <div className="error-message" role="alert">
            <p>We couldn’t update your habits. {habits.length > 0 ? 'Your existing habits are still here.' : 'Please try again.'}</p>
            <button type="button" onClick={() => window.dispatchEvent(new Event('pennies:transactions-changed'))}>Try again</button>
          </div>
        )}
        {status === 'ready' && habits.length === 0 && !error && (
          <section className="empty-state">
            <h3>{emptyReason === 'no-history'
              ? 'No spending history yet'
              : emptyReason === 'insufficient-history'
              ? 'Not enough spending history yet'
              : 'No habits to show right now'}</h3>
            <p>{emptyReason === 'no-history'
              ? 'Add a Transaction from the dashboard when you’re ready. Pennies will use your real spending to find habits.'
              : emptyReason === 'insufficient-history'
              ? 'Keep adding Transactions. We’ll show a habit when there’s enough meaningful evidence.'
              : 'You’ve hidden all your current habits. New patterns can appear here as your spending changes.'}</p>
          </section>
        )}
        <div className="habit-list">
          {habits.map((habit) => (
            <article className="habit-card" key={habit.id}>
              <div className="habit-card-top">
                <p className="habit-period">{habit.period}</p>
                {habit.locked && <span className="locked-label"><span aria-hidden="true">🔒 </span>Locked</span>}
              </div>
              {habit.emerging && (
                <div className="emerging-note">
                  <strong>Emerging habit</strong>
                  <p>Something to keep an eye on as you add more Transactions.</p>
                </div>
              )}
              <h3>{habit.title}</h3>
              <p>{habit.explanation}</p>
              <p className="habit-evidence">{habit.evidence}</p>
              <div className="habit-actions">
                <button type="button" className="dismiss-button" aria-label={`Dismiss ${habit.title}`} onClick={() => setDismissMenu(habit.id)}>
                  Dismiss
                </button>
                <button type="button" onClick={() => toggleLock(habit.id)} aria-label={`${habit.locked ? 'Unlock' : 'Lock'} ${habit.title}`}>
                  {habit.locked ? 'Unlock' : 'Lock'} habit
                </button>
              </div>
              {dismissMenu === habit.id && (
                <div className="dismiss-menu">
                  <p>Hide this and similar habits:</p>
                  <button type="button" onClick={() => dismissHabit('week')}>Hide for a week</button>
                  <button type="button" onClick={() => dismissHabit('month')}>Hide for a month</button>
                  <button type="button" onClick={() => dismissHabit('forever')}>Don’t show again</button>
                  <button type="button" onClick={() => setDismissMenu(null)}>Cancel</button>
                </div>
              )}
            </article>
          ))}
        </div>
        {lastDismissal && (
          <div className="dismiss-toast" role="status">
            <p>
              Habit hidden. {lastDismissal.duration === 'forever'
                ? 'Similar habits won’t show again.'
                : `Similar habits will be hidden for a ${lastDismissal.duration}.`}
            </p>
            <button type="button" onClick={undoDismissal}>Undo</button>
          </div>
        )}
        {pendingSharingMode && (
          <div className="dialog-backdrop">
            <div className="sharing-dialog" role="dialog" aria-modal="true" aria-labelledby="sharing-dialog-title">
              <h2 id="sharing-dialog-title">Change how much Pennies shares?</h2>
              <p>To protect your privacy, all current Spending habits, including Locked habits, will be removed and regenerated.</p>
              <div>
                <button type="button" onClick={() => setPendingSharingMode(null)}>Cancel</button>
                <button type="button" className="primary-button" onClick={confirmSharingMode}>Change mode</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
