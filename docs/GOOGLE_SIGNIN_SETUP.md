# Google / Gmail sign-in

The web app uses Firebase Google sign-in and Telegram login. SMS and WhatsApp
are absent from the browser login screen. Google sign-in uses the existing
`wellcircle-auth` Firebase project and does not require a phone number, SMS,
Blaze billing or a service-account private key.

## Console setup

In Firebase Console → Authentication → Sign-in method, enable **Google**.
Choose the public project name and a support email from your project account,
then Save. Under Settings → Authorized domains, add `app.wellcircle.et`.
Keep the Phone provider disabled. There is no need to finish a billing upgrade.

Use the default basic Google identity scopes. The app only receives the Google
account identifier, verified email, name and profile photo. It never requests
Gmail messages, contacts or Drive files.

## Configuration

The ignored `wellcircle-web/.env.production` contains these public Web app
values from Firebase Project settings → General:

```dotenv
VITE_FIREBASE_API_KEY=the_apiKey_value
VITE_FIREBASE_AUTH_DOMAIN=wellcircle-auth.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=wellcircle-auth
VITE_FIREBASE_APP_ID=the_appId_value
```

The backend must use `FIREBASE_PROJECT_ID=wellcircle-auth`. Dependencies live
in both `backend/requirements.txt` (local/CI) and `backend/api/requirements.txt`
(the Vercel function entry point). The browser exchanges a Firebase Google
ID token at `POST /api/auth/firebase` for the normal Well Circle JWT.

Google signs the Firebase token; the backend verifies its signature,
expiration, audience, issuer and authentication time. It accepts only a Google
provider with a verified email and Google subject in the signed identity claims.
Phone, password and other Firebase-provider tokens are rejected. Identity is
keyed by Google's stable subject, so existing Google users keep their accounts
and points. Equal email addresses never cause a silent account merge.

The backend includes `WEB_FRONTEND_URL=https://app.wellcircle.et` in CORS alongside
all configured `CORS_ORIGINS` and `FRONTEND_URL` entries. No schema migration is
required for this provider change.

## Release and verify

Run the frontend tests, browser tests, lint and both builds specified in
`AGENTS.md`, plus backend `pytest app/tests -q`. Deploy the backend and upload
`wellcircle-web/dist/` to cPanel using [the deployment guide](../wellcircle-web/README.md).
Check the live build digest, Google and Telegram buttons, public legal pages,
backend health, CORS preflight, and rejection of invalid tokens. Complete an
interactive Google sign-in to confirm first-login onboarding and repeat login.
Popup cancellation and blocked popups should show friendly errors.

For automatic releases, configure GitHub variables `WEB_FIREBASE_API_KEY`,
`WEB_FIREBASE_AUTH_DOMAIN`, `WEB_FIREBASE_PROJECT_ID` and `WEB_FIREBASE_APP_ID`,
alongside the existing cPanel upload settings. These are public project config;
never place a service-account private key in a Vite variable.

Reference: [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin).
