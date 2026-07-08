import { useEffect, useState } from 'react';
import { getCircleSocialProof } from '../api/client';

/**
 * E2: social proof surface — "circle-mates checked in today" reuses existing
 * circle membership + check-in data, no new leaderboard system.
 */
export default function SocialProofBanner() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCircleSocialProof()
      .then(res => { if (!cancelled) setCount(res.checked_in_today || 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!count) return null;

  return (
    <div className="alert-banner mb-24" id="social-proof-banner" style={{ background: 'var(--bg-elevated)' }}>
      <span className="alert-banner-icon">🔥</span>
      <span className="alert-banner-text">
        {count} circle-mate{count === 1 ? '' : 's'} checked in today
      </span>
    </div>
  );
}
