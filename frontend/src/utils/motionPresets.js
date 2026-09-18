/**
 * Shared Motion animation presets for WellCircle.
 * Import what you need — all configs use transform/opacity only
 * so they stay on the compositor thread and never cause layout thrash.
 */

/** Standard spring for UI taps (snappy, physical feel) */
export const tapSpring = { type: 'spring', stiffness: 500, damping: 30 };

/** Slower spring for layout transitions (smooth, deliberate) */
export const layoutSpring = { type: 'spring', stiffness: 380, damping: 32 };

/** Card tap variant — scale down slightly on press */
export const cardTapVariants = {
  rest: { scale: 1 },
  tap:  { scale: 0.97 },
};

/** Fade-in-up for feed items entering the viewport */
export const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring', stiffness: 320, damping: 26 },
};

/** Sheet slide-up entrance */
export const slideUp = {
  initial:  { opacity: 0, y: 40 },
  animate:  { opacity: 1, y: 0 },
  exit:     { opacity: 0, y: 40 },
  transition: { type: 'spring', stiffness: 380, damping: 34 },
};
