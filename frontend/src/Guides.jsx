import { Navigate, useNavigate, useParams } from 'react-router'
import { useAuth0 } from '@auth0/auth0-react'
import { guides } from './guides.js'

export function GuidePage() {
  const { guideId } = useParams()
  const navigate = useNavigate()
  const { logout } = useAuth0()
  const guide = guides.find((item) => item.id === guideId)
  if (!guide) return <Navigate to="/" replace />
  return (
    <div className="dashboard">
      <header className="banner">
        <h1>Pennies</h1>
        <button
          type="button"
          className="logout"
          onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        >
          Log out
        </button>
      </header>
      <main className="dashboard-main">
        <GuideView guide={guide} onBack={() => navigate('/')} />
      </main>
    </div>
  )
}

export function GuideView({ guide, onBack }) {
  return (
    <article className="guide">
      <button className="back-button" type="button" onClick={onBack}>
        ← Back to dashboard
      </button>
      <p className="guide-label">Guide</p>
      <h1>{guide.title}</h1>
      <p className="guide-summary">{guide.summary}</p>
      <p className="reviewed">Last reviewed: {guide.reviewed}</p>

      {guide.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.bullets && (
            <ul>
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section>
        <h2>Key takeaways</h2>
        <ul>
          {guide.takeaways.map((takeaway) => (
            <li key={takeaway}>{takeaway}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Sources</h2>
        <ul className="sources">
          {guide.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className="disclaimer">
        {guide.disclaimer ||
          'This Guide provides general information, not personalised financial advice.'}
      </p>
    </article>
  )
}

export function GuideCards({ guides, onSelect, recommendedIds = [] }) {
  return (
    <section className="guides" aria-labelledby="guides-heading">
      <h2 id="guides-heading">Guides</h2>
      <p>Trusted, practical financial literacy for student life.</p>
      <div className="guide-cards">
        {guides.map((guide) => (
          <button
            className="guide-card"
            type="button"
            key={guide.id}
            onClick={() => onSelect(guide)}
          >
            <span className="guide-card-title">{guide.title}</span>
            {recommendedIds.includes(guide.id) && <span className="badge">Recommended</span>}
            <span>{guide.summary}</span>
            <span className="read-guide">Read guide →</span>
          </button>
        ))}
      </div>
    </section>
  )
}
