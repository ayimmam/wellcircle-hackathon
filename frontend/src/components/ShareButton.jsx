/**
 * ShareButton — shared component for sharing branded images of stories,
 * providers, and events (WS12 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026_ROUND2.md).
 *
 * Wraps the "generate branded image → share" flow so it isn't reimplemented
 * per screen. Used by StoryViewer, ProviderDetail, and EventsScreen.
 */

import { useState } from 'react';
import Icon from './Icon';
import { shareBrandedImage } from '../utils/brandedCanvas';

export default function ShareButton({
  imageUrl,
  title,
  subtitle,
  tag = 'share',
  className = 'detail-share-btn',
  label = 'Share',
  size = 16,
}) {
  const [busy, setBusy] = useState(false);

  const handleShare = async (e) => {
    e?.stopPropagation?.();
    if (busy) return;
    setBusy(true);
    try {
      await shareBrandedImage({ imageUrl, title, subtitle, tag });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={className}
      onClick={handleShare}
      disabled={busy}
      id={`share-btn-${tag}`}
      aria-label={label}
    >
      <Icon name="share" size={size} /> {label}
    </button>
  );
}
