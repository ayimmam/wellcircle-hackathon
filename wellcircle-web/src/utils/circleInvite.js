import { showToast } from '../components/Toast';
import { track } from '../analytics';

export function shareCircleInvite(circle, { source = 'circle_detail' } = {}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.wellcircle.et';
  const link = `${origin}/circle/${circle.id}?join=${circle.join_code}`;
  const text = `Join my "${circle.name}" circle on Well Circle! ${link}`;

  track('circle_invite_shared', {
    circle_id: circle.id,
    source,
    method: typeof navigator !== 'undefined' && navigator.share ? 'web_share' : 'clipboard',
  });

  if (typeof navigator !== 'undefined' && navigator.share) {
    navigator.share({ title: 'Well Circle', text, url: link }).catch(() => {});
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(link)
      .then(() => showToast('Invite link copied to clipboard!', 'success'))
      .catch(() => showToast(link));
  } else {
    showToast(link);
  }
}
