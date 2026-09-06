/**
 * Well Circle — Constants and enums.
 */

export const INTEREST_CATEGORIES = [
  { value: 'yoga', label: 'Yoga 🧘', emoji: '🧘' },
  { value: 'gym', label: 'Gym 💪', emoji: '💪' },
  { value: 'nutrition', label: 'Nutrition 🥗', emoji: '🥗' },
  { value: 'spa', label: 'Spa 💆', emoji: '💆' },
  { value: 'therapy', label: 'Therapy 🧠', emoji: '🧠' },
  { value: 'running', label: 'Running 🏃', emoji: '🏃' },
];

export const EXERCISE_FREQUENCY = [
  { value: 'never', label: 'Never' },
  { value: 'rarely', label: 'Rarely (1-2x/month)' },
  { value: 'sometimes', label: 'Sometimes (1-2x/week)' },
  { value: 'regular', label: 'Regular (3-4x/week)' },
  { value: 'daily', label: 'Daily' },
];

export const TIERS = {
  seed: { name: 'Seed', emoji: '🌱', min: 0 },
  sprout: { name: 'Sprout', emoji: '🌿', min: 100 },
  grove: { name: 'Grove', emoji: '🌳', min: 300 },
  forest: { name: 'Forest', emoji: '🌲', min: 700 },
};

export const NEIGHBORHOODS = [
  'Bole', 'Kazanchis', 'Piassa', 'CMC', 'Sarbet', 'Megenagna', 'Other',
];

export const NEIGHBORHOOD_ALERTS = {
  Bole: 'New yoga session opening in Bole this Saturday — 3 spots left.',
  Kazanchis: 'A new gym near Kazanchis is offering free first-week trial.',
  Piassa: 'Nutritionist in Piassa offering 20% off this weekend.',
  CMC: 'Running group forming near CMC — join your neighbors!',
  Sarbet: 'Spa day deal in Sarbet — book before Friday.',
  Megenagna: 'Free outdoor fitness class this Sunday at Megenagna.',
  Other: 'Check out trending wellness providers near you.',
};
