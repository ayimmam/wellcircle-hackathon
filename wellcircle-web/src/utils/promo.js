// Presale promo helpers. The backend is authoritative — it re-derives
// eligibility and the discount when the booking is created; these mirror its
// logic so the UI can predict the price before paying.

/**
 * Whether a provider's active_promotion will apply to this user's booking.
 * `user_eligible` is only present on the provider-detail response (it needs a
 * user context); when absent we optimistically show the promo and let the
 * backend decide.
 */
export function promoApplies(promotion) {
  if (!promotion || !promotion.discount_pct || promotion.discount_pct <= 0) return false;
  return promotion.user_eligible !== false;
}

/** Flat % off the booking total, never discounting below zero. */
export function computeDiscountEtb(amountEtb, discountPct) {
  if (!discountPct || discountPct <= 0 || !amountEtb || amountEtb <= 0) return 0;
  return Math.min(Math.round((amountEtb * discountPct) / 100), amountEtb);
}

/**
 * Whole days until a promo expires (ceil — "expires today" is 0, tomorrow
 * is 1). Returns null for missing/invalid dates; negative for past dates.
 * Used for honest urgency framing ("expires in 3 days") — real expiries only.
 */
export function daysLeft(validUntil, now = new Date()) {
  if (!validUntil) return null;
  const expiry = new Date(validUntil);
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

/** "⏳ Expires in N days" under a week, otherwise a plain date. */
export function expiryLabel(validUntil, now = new Date()) {
  const days = daysLeft(validUntil, now);
  if (days === null || days < 0) return null;
  if (days === 0) return '⏳ Expires today';
  if (days === 1) return '⏳ Expires tomorrow';
  if (days < 7) return `⏳ Expires in ${days} days`;
  return `Valid until ${new Date(validUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}
