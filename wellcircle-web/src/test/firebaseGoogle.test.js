const sdk = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({})), getApps: vi.fn(() => []), initializeAuth: vi.fn(),
  GoogleAuthProvider: vi.fn(), signInWithPopup: vi.fn(), signOut: vi.fn(),
  getIdToken: vi.fn(), useDeviceLanguage: vi.fn(), setCustomParameters: vi.fn(),
}));
vi.mock('firebase/app', () => ({ initializeApp: sdk.initializeApp, getApps: sdk.getApps }));
vi.mock('firebase/auth', () => ({
  initializeAuth: sdk.initializeAuth, inMemoryPersistence: 'memory-only',
  browserPopupRedirectResolver: 'browser-popup-resolver',
  GoogleAuthProvider: sdk.GoogleAuthProvider,
  signInWithPopup: sdk.signInWithPopup, signOut: sdk.signOut,
}));
beforeEach(() => {
  vi.resetModules();
  for (const key of ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'APP_ID']) vi.stubEnv('VITE_FIREBASE_'+key, 'test-'+key);
  sdk.initializeAuth.mockReturnValue({ useDeviceLanguage: sdk.useDeviceLanguage });
  sdk.GoogleAuthProvider.mockImplementation(function () { this.setCustomParameters = sdk.setCustomParameters; });
  sdk.signInWithPopup.mockResolvedValue({ user: { getIdToken: sdk.getIdToken } });
  sdk.getIdToken.mockResolvedValue('signed-google-token');
  sdk.signOut.mockResolvedValue(undefined);
  for (const mock of Object.values(sdk)) mock.mockClear();
});
afterEach(() => vi.unstubAllEnvs());
it('requires public config and never attempts login when it is missing', async () => {
  vi.stubEnv('VITE_FIREBASE_API_KEY', '');
  const { firebaseGoogleConfigured, signInWithGoogle } = await import('../utils/firebaseGoogle');
  expect(firebaseGoogleConfigured).toBe(false);
  await expect(signInWithGoogle()).rejects.toThrow('not available yet');
  expect(sdk.signInWithPopup).not.toHaveBeenCalled();
});
it('uses Google account selection and memory-only persistence then signs out of Firebase', async () => {
  const { signInWithGoogle } = await import('../utils/firebaseGoogle');
  expect(await signInWithGoogle()).toBe('signed-google-token');
  expect(sdk.initializeAuth).toHaveBeenCalledWith({}, {
    persistence: 'memory-only', popupRedirectResolver: 'browser-popup-resolver',
  });
  expect(sdk.setCustomParameters).toHaveBeenCalledWith({ prompt: 'select_account' });
  expect(sdk.signOut).toHaveBeenCalledTimes(1);
});
it('maps popup failures to safe actionable messages and permits retry', async () => {
  sdk.signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-blocked', message: 'raw-provider-detail' });
  const { signInWithGoogle } = await import('../utils/firebaseGoogle');
  await expect(signInWithGoogle()).rejects.toThrow('allow pop-ups');
  expect(await signInWithGoogle()).toBe('signed-google-token');
});
it('keeps a token for backend retries and clears it after app login or logout', async () => {
  const { signInWithGoogle, clearGoogleSignIn } = await import('../utils/firebaseGoogle');
  await signInWithGoogle(); await signInWithGoogle();
  expect(sdk.signInWithPopup).toHaveBeenCalledTimes(1);
  clearGoogleSignIn(); await signInWithGoogle();
  expect(sdk.signInWithPopup).toHaveBeenCalledTimes(2);
});
