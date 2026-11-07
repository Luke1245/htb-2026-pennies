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

export function GuideCards({ guides, onSelect }) {
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
            <span>{guide.summary}</span>
            <span className="read-guide">Read guide →</span>
          </button>
        ))}
      </div>
    </section>
  )
}
