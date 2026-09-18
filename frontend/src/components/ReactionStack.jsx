/**
 * ReactionStack — LinkedIn-style stacked avatar reaction display (WS15 of
 * docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026_ROUND2.md).
 *
 * Overlapping small avatar circles topped by the dominant emoji, with
 * a +N tail for the remainder.
 */

import SmartImage from './SmartImage';
import Icon from './Icon';

export default function ReactionStack({ reactions = {}, reactorsPreview = {} }) {
  const entries = Object.entries(reactions).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;

  return (
    <div className="reaction-stack">
      {entries.map(([emoji, count]) => {
        const reactors = reactorsPreview[emoji] || [];
        const remainder = count - reactors.length;
        const emojiDisplay = emoji === 'wc' ? (
          <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>WC</span>
        ) : emoji;

        return (
          <div key={emoji} className="reaction-stack-group" title={`${count} ${emoji}`}>
            <span style={{ marginRight: 2 }}>{emojiDisplay}</span>
            {reactors.length > 0 && (
              <div className="reaction-stack-avatars">
                {reactors.map(r => (
                  <div key={r.id} className="avatar">
                    <SmartImage
                      src={r.photo_url}
                      alt={r.name || ''}
                      width={20}
                      fallback={<Icon name="user" size={10} />}
                    />
                  </div>
                ))}
              </div>
            )}
            {remainder > 0 && (
              <span style={{ fontSize: '0.75rem', marginLeft: 2 }}>+{remainder}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
