/**
 * Browser-auth adapter registry for the shared Connected Sign-ins screen.
 *
 * The linking *feature* is shared, but the Google popup and Telegram Login
 * Widget are browser-only. The website registers those helpers at startup;
 * the Telegram Mini App never does, so the shared screen degrades to the
 * read-only view instead of trying to host a popup.
 *
 * Adapter shape:
 *   google:   { configured: boolean, signIn(): Promise<string> }
 *   telegram: { prepare(): Promise<unknown>, signIn(): Promise<object> }
 */
let providers = null;

export function registerLinkingProviders(next) {
  providers = next || null;
}

export function getLinkingProviders() {
  return providers;
}

// Test helper only — lets a test reset the registry between cases.
export function clearLinkingProviders() {
  providers = null;
}
