// V2 UX: 12h/24h time-slot display. Internal state/payloads always stay 24h
// ("14:00") — only what's rendered to the user changes.

export function detectTimeFormat() {
  try {
    const hourCycle = Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle;
    if (hourCycle === 'h23' || hourCycle === 'h24') return '24h';
    if (hourCycle === 'h11' || hourCycle === 'h12') return '12h';
  } catch {
    // Intl not available / hourCycle unsupported — fall through to default
  }
  return '12h';
}

export function formatSlot(slot24, format) {
  if (format === '24h') return slot24;
  const [hStr, mStr] = slot24.split(':');
  let h = parseInt(hStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${period}`;
}

export function effectiveTimeFormat(user) {
  return user?.time_format || detectTimeFormat();
}
