import { isWebApp } from './platform';
export function featureShareLink(tag) {
  if (!isWebApp()) {
    const bot = import.meta.env.VITE_BOT_USERNAME || 'WellCircleBot';
    return `https://t.me/${bot}?startapp=${encodeURIComponent(tag)}`;
  }
  const origin = window.location.origin;
  const destinations = [['post_', '/post/'], ['provider_', '/provider/'], ['event_', '/event/']];
  for (const [prefix, path] of destinations) {
    if (tag.startsWith(prefix)) {
      const id = encodeURIComponent(tag.slice(prefix.length));
      return `${origin}${path}${id}${prefix === 'event_' ? '/rsvp' : ''}`;
    }
  }
  return `${origin}/home`;
}
