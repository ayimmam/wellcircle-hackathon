// On provider.wellcircle.et the portal is the whole site, so its routes live
// at root paths ('/', '/login', '/overview', ...) instead of under
// /provider-portal — avoids the redundant path segment on its own subdomain.
export const isProviderPortalDomain = () =>
  typeof window !== 'undefined' && window.location.hostname === 'provider.wellcircle.et';

export const providerPortalBase = () => (isProviderPortalDomain() ? '' : '/provider-portal');
