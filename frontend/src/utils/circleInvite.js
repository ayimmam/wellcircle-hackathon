import { isWebApp } from './platform';
import { showToast } from '../components/Toast';
import { track } from '../analytics';

// Telegram Mini Apps can't read a phone/Telegram contacts list — the native
// share-sheet (switchInlineQuery) is the closest equivalent: it opens
// Telegram's own "forward to..." picker so the user chooses who to send the
// invite link to from their real chats/contacts. Falls back to a clipboard
// copy (then a raw-link toast) when that API isn't available.
export function shareCircleInvite(circle, { source = 'circle_detail' } = {}) {
  const botUsername = import.meta.env.VITE_BOT_USERNAME || 'WellCircleBot';
  const link = isWebApp()
    ? `${window.location.origin}/circle/${encodeURIComponent(circle.id)}?join=${encodeURIComponent(circle.join_code)}`
    : `https://t.me/${botUsername}?startapp=circle_${circle.join_code}`;
  const text = `Join my "${circle.name}" circle on Well Circle! ${link}`;
  const tg = window.Telegram?.WebApp;

  track('circle_invite_shared', {
    circle_id: circle.id,
    source,
    method: isWebApp() && navigator.share ? 'web_share' : tg?.switchInlineQuery ? 'inline_query' : 'clipboard',
  });

  if (isWebApp() && navigator.share) {
    navigator.share({ title: 'Well Circle', text, url: link }).catch(err => {
      if (err?.name !== 'AbortError') copyInvite(link);
    });
    return;
  }
  if (tg?.switchInlineQuery) {
    tg.switchInlineQuery(text, ['users', 'groups']);
    return;
  }
  copyInvite(link);
}

function copyInvite(link) {
  if (!navigator.clipboard?.writeText) { showToast(link); return; }
  navigator.clipboard.writeText(link)
    .then(() => showToast('Invite link copied!', 'success'))
    .catch(() => showToast(link));
}
