import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { Link } from 'react-router'
import { apiUrl, authHeaders } from './api.js'
import { guides } from './guides.js'
import './spending-habits.css'

const loadMessage = 'Pennies could not load your records'

async function api(path, token, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.detail || loadMessage)
  return body
}

function lessonResult(readingResponse, updated) {
  if (!readingResponse.reading) return { educations: null, suggestions: null, recommendations: null, updated }
  return {
    educations: readingResponse.reading.educations || [],
    suggestions: readingResponse.reading.suggestions || [],
    recommendations: readingResponse.reading.recommendations || [],
    updated,
  }
}

function rebuildResult(readingResponse) {
  return lessonResult(readingResponse, readingResponse.updated !== false)
}

async function fetchRecommendations(getAccessTokenSilently, request) {
  const headers = await authHeaders(getAccessTokenSilently)
  const token = headers.Authorization.replace('Bearer ', '')
  if (request.action === 'refresh') {
    const rebuilt = await api('/reading', token, { method: 'POST' })
    return rebuildResult(rebuilt)
  }
  const reading = await api('/reading', token)
  if (reading.stored !== false && reading.reading) {
    return lessonResult(reading, true)
  }
  const built = await api('/reading', token, { method: 'POST' })
  return rebuildResult(built)
}

export default function RecommendationsPage({ loadRecommendations, onBack, onOpenGuide, onLogout, isActive = true }) {
  const { getAccessTokenSilently } = useAuth0()
  const tokenProvider = useRef(getAccessTokenSilently)
  useEffect(() => {
    tokenProvider.current = getAccessTokenSilently
  }, [getAccessTokenSilently])
  const load = useCallback(
    (request) =>
      loadRecommendations
        ? loadRecommendations(request)
        : fetchRecommendations(tokenProvider.current, request),
    [loadRecommendations],
  )
  const [educations, setEducations] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [recommendations, setRecommendations] = useState(null)
  const [hasPortrait, setHasPortrait] = useState(false)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(false)
  const wasActive = useRef(isActive)
  const latestRequest = useRef(0)

  const applyResult = useCallback((result) => {
    if (result.educations || result.recommendations) {
      setEducations(result.educations || [])
      setSuggestions(result.suggestions || [])
      setRecommendations(result.recommendations || [])
      setHasPortrait(true)
      setError(result.updated === false)
    } else if (result.updated) {
      setEducations(null)
      setSuggestions([])
      setRecommendations(null)
      setHasPortrait(false)
      setError(false)
    } else {
      setError(true)
    }
    setStatus('ready')
  }, [])

  useEffect(() => {
    let active = true
    const requestId = ++latestRequest.current
    load({ action: 'load' })
      .then((result) => {
        if (!active || requestId !== latestRequest.current) return
        applyResult(result)
      })
      .catch(() => {
        if (!active || requestId !== latestRequest.current) return
        setError(true)
        setStatus('ready')
      })
    return () => {
      active = false
    }
  }, [load, applyResult])

  useEffect(() => {
    if (isActive && !wasActive.current) {
      const requestId = ++latestRequest.current
      load({ action: 'load' })
        .then((result) => {
          if (requestId !== latestRequest.current) return
          applyResult(result)
        })
        .catch(() => {
          if (requestId === latestRequest.current) setError(true)
        })
    }
    wasActive.current = isActive
  }, [isActive, load, applyResult])

  useEffect(() => {
    const refresh = async () => {
      const requestId = ++latestRequest.current
      setError(false)
      try {
        const result = await load({ action: 'refresh' })
        if (requestId !== latestRequest.current) return
        applyResult(result)
      } catch {
        if (requestId === latestRequest.current) setError(true)
      }
    }
    window.addEventListener('pennies:transactions-changed', refresh)
    return () => window.removeEventListener('pennies:transactions-changed', refresh)
  }, [load, applyResult])

  return (
    <div className="habits-page">
      <header className="banner">
        <h1>Pennies</h1>
        <div className="banner-actions">
          <Link to="/accounts" className="logout">
            Accounts
          </Link>
          <button type="button" className="logout" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="habits-main">
        <button type="button" className="back-link" onClick={onBack}>
          ← Back to dashboard
        </button>
        <div className="habits-heading">
          <p className="eyebrow">Learning picked for your spending</p>
          <h2>For you</h2>
          <p>Lessons from your own spending, then anything worth reading next.</p>
        </div>
        {status === 'loading' && <p role="status">Finding your recommendations…</p>}
        {error && (
          <div className="error-message" role="alert">
            <p>
              We couldn’t update your recommendations.
              {recommendations ? ' Your existing recommendations are still here.' : ' Please try again.'}
            </p>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('pennies:transactions-changed'))}
            >
              Try again
            </button>
          </div>
        )}
        {status === 'ready' && !hasPortrait && !error && (
          <section className="empty-state">
            <h3>No recommendations yet</h3>
            <p>
              Add a Transaction from the dashboard when you’re ready. Pennies will teach from your spending
              once there is something to read.
            </p>
          </section>
        )}
        {status === 'ready' &&
          hasPortrait &&
          educations.length === 0 &&
          recommendations.length === 0 &&
          !error && (
          <section className="empty-state">
            <h3>No recommendations yet</h3>
            <p>Nothing stands out yet. New recommendations appear as your spending story grows.</p>
          </section>
        )}
        {hasPortrait && educations.length > 0 && (
          <ol className="habit-list recommendation-list">
            {educations.map((education) => (
              <li key={education.id}>
                <EducationLesson
                  education={education}
                  suggestion={suggestions.find((item) => item.education_id === education.id)}
                  onOpenGuide={onOpenGuide}
                />
              </li>
            ))}
          </ol>
        )}
        {hasPortrait && recommendations.length > 0 && (
          <ol className="habit-list recommendation-list">
            {recommendations.map((recommendation) => (
              <li key={recommendation.id}>
                {recommendation.kind === 'guide' ? (
                  <GuideRecommendation recommendation={recommendation} onOpenGuide={onOpenGuide} />
                ) : (
                  <ResourceRecommendation recommendation={recommendation} />
                )}
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  )
}

function EducationLesson({ education, suggestion, onOpenGuide }) {
  const guide = guides.find((candidate) => candidate.id === education.guide_id)
  return (
    <article className="habit-card">
      <span className="recommendation-kind">Lesson</span>
      <h3>{education.subject}</h3>
      <p>{education.body}</p>
      {suggestion && <p>{suggestion.body}</p>}
      {guide && (
        <button type="button" className="read-guide" onClick={() => onOpenGuide(guide)}>
          Read guide →
        </button>
      )}
    </article>
  )
}

function GuideRecommendation({ recommendation, onOpenGuide }) {
  const guide = guides.find((candidate) => candidate.id === recommendation.guide_id)
  if (!guide) return null
  return (
    <article className="habit-card">
      <button type="button" className="recommendation-open" onClick={() => onOpenGuide(guide)}>
        <span className="recommendation-kind">Guide</span>
        <h3>{recommendation.title}</h3>
        <p>{recommendation.reason}</p>
        <span className="read-guide">Read guide →</span>
      </button>
    </article>
  )
}

function ResourceRecommendation({ recommendation }) {
  return (
    <article className="habit-card">
      <span className="recommendation-kind">{recommendation.publisher}</span>
      <h3>{recommendation.title}</h3>
      <p>{recommendation.reason}</p>
      <a className="read-guide" href={recommendation.url} target="_blank" rel="noreferrer">
        Visit resource →
      </a>
    </article>
  )
}
