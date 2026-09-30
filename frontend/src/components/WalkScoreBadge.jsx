import { useEffect, useRef, useState } from 'react';

export default function WalkScoreBadge({ score = 0 }) {
  const target = Math.max(0, Number(score) || 0);
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      displayRef.current = target;
      const frame = requestAnimationFrame(() => setDisplay(target));
      return () => cancelAnimationFrame(frame);
    }
    const start = displayRef.current;
    const startedAt = performance.now();
    let frame;
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / 900);
      const eased = 1 - (1 - progress) ** 3;
      const next = Math.round(start + (target - start) * eased);
      displayRef.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <div className="walk-score-badge" aria-label={`Walk Score ${target.toLocaleString()} steps`}>
      <span className="walk-score-label">Walk Score</span>
      <strong className="walk-score-number" aria-hidden="true">{display.toLocaleString()}</strong>
      <span className="walk-score-caption">Lifetime steps</span>
    </div>
  );
}
