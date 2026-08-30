export default function VerifiedBadge({ compact = false }) {
  return (
    <span className="verified-badge" title="Verified trainer" aria-label="Verified trainer">
      ✓{compact ? '' : ' Verified Trainer'}
    </span>
  );
}
