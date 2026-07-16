import { showToast } from '../components/Toast';
import { track } from '../analytics';

// Telegram Mini Apps can't read a phone/Telegram contacts list — the native
// share-sheet (switchInlineQuery) is the closest equivalent: it opens
// Telegram's own "forward to..." picker so the user chooses who to send the
// invite link to from their real chats/contacts. Falls back to a clipboard
// copy (then a raw-link toast) when that API isn't available.
export function shareCircleInvite(circle, { source = 'circle_detail' } = {}) {
  const botUsername = import.meta.env.VITE_BOT_USERNAME || 'WellCircleBot';
  const link = `https://t.me/${botUsername}?startapp=circle_${circle.join_code}`;
  const text = `Join my "${circle.name}" circle on Well Circle! ${link}`;
  const tg = window.Telegram?.WebApp;

  track('circle_invite_shared', {
    circle_id: circle.id,
    source,
    method: tg?.switchInlineQuery ? 'inline_query' : 'clipboard',
  });

  if (tg?.switchInlineQuery) {
    tg.switchInlineQuery(text, ['users', 'groups']);
    return;
  }
  navigator.clipboard.writeText(link)
    .then(() => showToast('Invite link copied!', 'success'))
    .catch(() => showToast(link));
}
