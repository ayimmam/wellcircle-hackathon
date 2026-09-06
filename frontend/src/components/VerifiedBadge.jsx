import Icon from './Icon';

export default function VerifiedBadge({ compact = false }) {
  return (
    <span className="verified-badge" title="Verified trainer" aria-label="Verified trainer">
      <Icon name="check" size={11} strokeWidth={2.5} />
      {compact ? '' : ' Verified Trainer'}
    </span>
  );
}
