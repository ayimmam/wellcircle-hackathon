import { useEffect } from 'react';

/** Closes a modal/sheet on Escape, matching the click-outside-to-dismiss
 * behavior every overlay in the app already has. Pass `active` so the
 * listener only attaches while the overlay is actually open. */
export default function useDismissOnEscape(onDismiss, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, onDismiss]);
}
