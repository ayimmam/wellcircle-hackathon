/**
 * EmptyStateHero — a floating emoji illustration with headline and body copy.
 * Drop-in replacement for text-only empty states throughout the app.
 */
export default function EmptyStateHero({ emoji, title, body, cta, onCta, id }) {
  return (
    <div className="empty-state-hero" id={id}>
      <span className="empty-state-hero-emoji" role="img" aria-hidden="true">{emoji}</span>
      {title && <p className="empty-state-hero-title">{title}</p>}
      {body && <p className="empty-state-hero-body">{body}</p>}
      {cta && onCta && (
        <button type="button" className="btn btn-primary btn-sm" onClick={onCta} style={{ marginTop: 4 }}>
          {cta}
        </button>
      )}
    </div>
  );
}
