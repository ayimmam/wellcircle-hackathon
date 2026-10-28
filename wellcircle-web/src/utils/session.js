export function takePostRedirect() {
  const path = sessionStorage.getItem('wc_post_redirect');
  sessionStorage.removeItem('wc_post_redirect');
  // Saved deep links must stay on this origin and cannot loop back to sign-in.
  return path && /^\/(?![/\\])/.test(path) && !/^\/(login|onboarding)(?:[/?#]|$)/.test(path) ? path : '/home';
}
