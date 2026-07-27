export function haptic(type) {
  const tg = window.Telegram?.WebApp;
  if (!tg?.HapticFeedback) return;

  if (type === 'selection') {
    tg.HapticFeedback.selectionChanged();
  } else if (type.startsWith('impact.')) {
    const style = type.split('.')[1]; // light, medium, heavy, rigid, soft
    tg.HapticFeedback.impactOccurred(style);
  } else if (type.startsWith('notification.')) {
    const status = type.split('.')[1]; // error, success, warning
    tg.HapticFeedback.notificationOccurred(status);
  }
}
