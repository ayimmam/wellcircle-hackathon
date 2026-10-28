// Browser-only identity adapter; application sessions and API calls stay shared.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const firebaseGoogleConfigured = Object.values(config).every(Boolean);
let runtime;
let verifiedToken;

function googleAuthError(error) {
  const messages = {
    'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
    'auth/cancelled-popup-request': 'A sign-in window is already open. Please complete it first.',
    'auth/popup-blocked': 'Please allow pop-ups for this site, then try Google sign-in again.',
    'auth/unauthorized-domain': 'Google sign-in is unavailable on this website. Please contact support.',
    'auth/operation-not-allowed': 'Google sign-in is being set up. Please use Telegram or contact support.',
    'auth/configuration-not-found': 'Google sign-in is being set up. Please use Telegram or contact support.',
    'auth/network-request-failed': 'Check your internet connection and try again.',
    'auth/account-exists-with-different-credential': 'This account uses another sign-in method. Please use that method or contact support.',
  };
  return new Error(messages[error?.code] || 'Google sign-in could not complete. Please try again or contact support.');
}

export function prepareGoogleSignIn() {
  if (!firebaseGoogleConfigured) return Promise.reject(new Error('Google sign-in is not available yet. Please use Telegram or contact support.'));
  if (!runtime) {
    runtime = Promise.all([import('firebase/app'), import('firebase/auth')]).then(([appSdk, authSdk]) => {
      const app = appSdk.getApps().find(app => app.name === 'wellcircle-google') || appSdk.initializeApp(config, 'wellcircle-google');
      const auth = authSdk.initializeAuth(app, {
        persistence: authSdk.inMemoryPersistence,
        popupRedirectResolver: authSdk.browserPopupRedirectResolver,
      });
      auth.useDeviceLanguage();
      return { auth, ...authSdk };
    }).catch(error => { runtime = null; throw googleAuthError(error); });
  }
  return runtime;
}

export async function signInWithGoogle() {
  const sdk = await prepareGoogleSignIn();
  // Retry a failed backend exchange without another consent window. Tokens
  // remain in memory for at most five minutes; never persist Google credentials.
  if (verifiedToken && verifiedToken.until > Date.now()) return verifiedToken.value;
  try {
    const provider = new sdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await sdk.signInWithPopup(sdk.auth, provider);
    const value = await result.user.getIdToken();
    verifiedToken = { value, until: Date.now() + 5 * 60 * 1000 };
    return value;
  } catch (error) {
    throw googleAuthError(error);
  } finally {
    await sdk.signOut(sdk.auth);
  }
}

export function clearGoogleSignIn() { verifiedToken = null; }
