import { describe, it, expect } from 'vitest';
import { promoApplies, computeDiscountEtb, daysLeft, expiryLabel } from '../utils/promo';

describe('promoApplies', () => {
  const base = { id: 'p1', headline: 'Presale', discount_pct: 20, audience: 'first_time' };

  it('applies when there is a discount and eligibility is unknown or true', () => {
    expect(promoApplies(base)).toBe(true);
    expect(promoApplies({ ...base, user_eligible: true })).toBe(true);
    expect(promoApplies({ ...base, user_eligible: undefined })).toBe(true);
  });

  it('does not apply when the user is known-ineligible', () => {
    expect(promoApplies({ ...base, user_eligible: false })).toBe(false);
  });

  it('does not apply without a positive discount', () => {
    expect(promoApplies(null)).toBe(false);
    expect(promoApplies(undefined)).toBe(false);
    expect(promoApplies({ ...base, discount_pct: 0 })).toBe(false);
    expect(promoApplies({ ...base, discount_pct: null })).toBe(false);
  });
});

describe('computeDiscountEtb', () => {
  it('takes a flat % off, rounded (mirrors backend compute_discount_etb)', () => {
    expect(computeDiscountEtb(2040, 20)).toBe(408);
    expect(computeDiscountEtb(2550, 20)).toBe(510);
    expect(computeDiscountEtb(333, 10)).toBe(33);
  });

  it('returns 0 for missing/zero inputs', () => {
    expect(computeDiscountEtb(2040, 0)).toBe(0);
    expect(computeDiscountEtb(2040, null)).toBe(0);
    expect(computeDiscountEtb(0, 20)).toBe(0);
    expect(computeDiscountEtb(null, 20)).toBe(0);
  });

  it('never discounts below zero', () => {
    expect(computeDiscountEtb(100, 100)).toBe(100);
  });
});

describe('daysLeft / expiryLabel (honest urgency)', () => {
  const now = new Date('2026-07-13T10:00:00Z');
  const inDays = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

  it('computes whole days remaining (ceil)', () => {
    expect(daysLeft(inDays(3), now)).toBe(3);
    expect(daysLeft(inDays(0.5), now)).toBe(1);
    expect(daysLeft(now.toISOString(), now)).toBe(0);
    expect(daysLeft(inDays(-2), now)).toBe(-2);
  });

  it('handles missing/garbage dates', () => {
    expect(daysLeft(null, now)).toBeNull();
    expect(daysLeft('not-a-date', now)).toBeNull();
    expect(expiryLabel(null, now)).toBeNull();
    expect(expiryLabel(inDays(-1), now)).toBeNull();
  });

  it('frames < 7 days as a countdown, otherwise a plain date', () => {
    expect(expiryLabel(now.toISOString(), now)).toBe('⏳ Expires today');
    expect(expiryLabel(inDays(1), now)).toBe('⏳ Expires tomorrow');
    expect(expiryLabel(inDays(3), now)).toBe('⏳ Expires in 3 days');
    expect(expiryLabel(inDays(14), now)).toMatch(/^Valid until /);
  });
});
