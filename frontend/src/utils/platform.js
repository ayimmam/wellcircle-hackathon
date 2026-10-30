/** Both builds share features; only browser authentication and hosting differ. */
export const isWebApp = () => import.meta.env.VITE_APP_SURFACE === 'web';
export const SESSION_EXPIRED_EVENT = 'wellcircle:session-expired';
