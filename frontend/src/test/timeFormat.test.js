import { describe, it, expect } from 'vitest';
import { formatSlot, effectiveTimeFormat } from '../utils/timeFormat';

describe('formatSlot', () => {
  it('converts 24h to 12h correctly', () => {
    expect(formatSlot('00:00', '12h')).toBe('12:00 AM');
    expect(formatSlot('12:00', '12h')).toBe('12:00 PM');
    expect(formatSlot('18:30', '12h')).toBe('6:30 PM');
    expect(formatSlot('09:00', '12h')).toBe('9:00 AM');
    expect(formatSlot('23:45', '12h')).toBe('11:45 PM');
  });

  it('passes 24h through unchanged', () => {
    expect(formatSlot('06:00', '24h')).toBe('06:00');
    expect(formatSlot('18:30', '24h')).toBe('18:30');
  });
});

describe('effectiveTimeFormat', () => {
  it('uses the user preference when set', () => {
    expect(effectiveTimeFormat({ time_format: '24h' })).toBe('24h');
    expect(effectiveTimeFormat({ time_format: '12h' })).toBe('12h');
  });

  it('falls back to a detected default when unset', () => {
    const result = effectiveTimeFormat({ time_format: null });
    expect(['12h', '24h']).toContain(result);
  });

  it('falls back to a detected default for a null user', () => {
    const result = effectiveTimeFormat(null);
    expect(['12h', '24h']).toContain(result);
  });
});
