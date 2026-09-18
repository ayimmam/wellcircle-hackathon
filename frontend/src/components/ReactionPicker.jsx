/**
 * ReactionPicker — long-press reaction selector with 6 icons (WS15 of
 * docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026_ROUND2.md).
 *
 * Default tap = ❤️. Long-press reveals all 6:
 * 🔥 👏 ❤️ 💪 + Well Circle icon (locked until purchased).
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import Icon from './Icon';

const REACTION_SET = [
  { emoji: '❤️', label: 'Love' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '💪', label: 'Strong' },
  { emoji: 'wc', label: 'Well Circle', icon: true },
];

const LONG_PRESS_MS = 400;

export default function ReactionPicker({
  onReact,
  onUnlockPurchase,
  viewerReactions = [],
  hasWellcircleReaction = false,
  disabled = false,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const timerRef = useRef(null);
  const hasLiked = viewerReactions.includes('❤️');

  const startLongPress = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setPickerOpen(true);
      timerRef.current = null;
    }, LONG_PRESS_MS);
  }, []);

  const endLongPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      // Short press — toggle default ❤️
      if (!pickerOpen && !disabled) {
        onReact?.('❤️');
      }
    }
  }, [pickerOpen, onReact, disabled]);

  const handlePick = (emoji) => {
    if (emoji === 'wc' && !hasWellcircleReaction) {
      onUnlockPurchase?.();
      setPickerOpen(false);
      return;
    }
    onReact?.(emoji);
    setPickerOpen(false);
  };

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const close = () => setPickerOpen(false);
    window.addEventListener('click', close, { once: true });
    return () => window.removeEventListener('click', close);
  }, [pickerOpen]);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className={`post-action-btn ${hasLiked ? 'active' : ''}`}
        onPointerDown={startLongPress}
        onPointerUp={endLongPress}
        onPointerLeave={() => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } }}
        onContextMenu={(e) => { e.preventDefault(); setPickerOpen(true); }}
        disabled={disabled}
        id="reaction-picker-trigger"
        aria-label="React"
      >
        <Icon name="heart" size={18} strokeWidth={hasLiked ? 0 : 1.5} />
      </button>

      {pickerOpen && (
        <>
          <div className="reaction-picker-overlay" onClick={() => setPickerOpen(false)} />
          <div className="reaction-picker" onClick={(e) => e.stopPropagation()}>
            {REACTION_SET.map(r => (
              <button
                key={r.emoji}
                type="button"
                className={`${r.emoji === 'wc' && !hasWellcircleReaction ? 'locked' : ''} ${viewerReactions.includes(r.emoji) ? 'active' : ''}`}
                onClick={() => handlePick(r.emoji)}
                title={r.label}
                id={`reaction-pick-${r.emoji}`}
              >
                {r.icon ? (
                  <>
                    <span style={{ fontSize: '1rem', fontWeight: 700 }}>WC</span>
                    {!hasWellcircleReaction && <span className="lock-badge">🔒</span>}
                  </>
                ) : r.emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
