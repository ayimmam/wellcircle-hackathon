import { describe, it, expect } from 'vitest';
import { promoApplies, computeDiscountEtb } from '../utils/promo';

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
