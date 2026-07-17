import { describe, it, expect } from 'vitest';
import { isNearUser, nearbyProviders, nearbyEvents } from '../utils/nearby';

const providers = [
  { id: 'p1', location_text: 'Bole Sub-City, near Edna Mall, Addis Ababa' },
  { id: 'p2', location_text: 'Bole Medhanialem' },
  { id: 'p3', location_text: 'Kazanchis' },
];

describe('isNearUser', () => {
  it('matches case-insensitively as a substring of location_text', () => {
    expect(isNearUser(providers[0], 'Bole')).toBe(true);
    expect(isNearUser(providers[1], 'bole')).toBe(true);
    expect(isNearUser(providers[2], 'Bole')).toBe(false);
  });

  it('returns false for a null/empty neighbourhood or missing location_text', () => {
    expect(isNearUser(providers[0], null)).toBe(false);
    expect(isNearUser(providers[0], '')).toBe(false);
    expect(isNearUser({ location_text: null }, 'Bole')).toBe(false);
  });
});

describe('nearbyProviders', () => {
  it('filters to matching providers only', () => {
    expect(nearbyProviders(providers, 'Bole').map(p => p.id)).toEqual(['p1', 'p2']);
    expect(nearbyProviders(providers, 'Kazanchis').map(p => p.id)).toEqual(['p3']);
  });
});

describe('nearbyEvents', () => {
  it('filters events through their provider match', () => {
    const events = [
      { id: 'e1', provider_id: 'p1' },
      { id: 'e2', provider_id: 'p3' },
    ];
    expect(nearbyEvents(events, providers, 'Bole').map(e => e.id)).toEqual(['e1']);
  });
});
