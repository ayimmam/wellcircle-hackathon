// Human-readable labels/icons for the providers the backend can verify.
// Opaque provider subjects are intentionally not mapped here: they are never
// rendered, so nothing in the UI can leak them by accident.
const PROVIDERS = {
  google: { label: 'Google', icon: 'mail' },
  telegram: { label: 'Telegram', icon: 'send' },
  whatsapp: { label: 'WhatsApp', icon: 'smartphone' },
  password: { label: 'Password', icon: 'lock' },
};

export function providerLabel(provider) {
  return PROVIDERS[provider]?.label || 'Sign-in method';
}

export function providerIcon(provider) {
  return PROVIDERS[provider]?.icon || 'shield';
}
