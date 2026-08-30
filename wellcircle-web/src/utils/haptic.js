// Haptic feedback — web version.
// Falls back to the Vibration API on Android; no-ops on desktop.
export function haptic(type) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    if (type === 'selection') {
      navigator.vibrate(10);
    } else if (type.startsWith('impact.')) {
      const style = type.split('.')[1];
      const ms = { light: 15, medium: 30, heavy: 50, rigid: 40, soft: 20 };
      navigator.vibrate(ms[style] || 20);
    } else if (type.startsWith('notification.')) {
      navigator.vibrate([30, 50, 30]);
    }
  }
}
