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
