# Retired: Firebase SMS sign-in

SMS sign-in was replaced with Google/Gmail sign-in to avoid SMS costs. Keep the
Firebase Phone provider disabled and do not enable Blaze billing for sign-in.
The browser no longer sends or confirms SMS codes, and `/api/auth/firebase`
accepts only verified Google-provider tokens.

Follow [Google sign-in setup](GOOGLE_SIGNIN_SETUP.md) for the current configuration.
