# Browser app — app.wellcircle.et (cPanel)

The browser app builds the **same feature source** as the Telegram Mini App:
`frontend/src/App.jsx` supplies the route table and app shell; all feature
screens, components, API calls, cache, translations, animations, profile tools
and base styles come from `frontend/src`. No feature copies or synchronization
step are needed. New shared routes automatically appear in both builds.

Only browser sign-in/session handling, login/landing UI, phone-login country
options and CSS additions live here. Vite substitutes browser AuthContext for
shared imports; runtime dependencies are deduplicated to prevent split React,
API-token, toast or cache instances. `shared-source.js` rejects duplicate
feature modules during development/build, and `npm run check:parity` verifies
the integration and dependency coverage. CI also exercises browser sessions,
shared routes, expiry recovery and invite/share links.

Telegram-only pin bonuses, staff evidence photos and bot reminders stay in the
bot. The shared Help & support page links users to those actions. In-app
notifications, points, circles, bookings, rewards and the wellness concierge
use the same backend and features in both apps. A separate Google
login does not automatically merge its account with an existing Telegram user.

## Develop and verify

From the repository root:

```sh
npm ci --prefix frontend
npm ci --prefix wellcircle-web
npm run dev --prefix wellcircle-web
npm test --prefix frontend
npm run test:web --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
npm run build --prefix wellcircle-web
```

Browser builds use `VITE_APP_SURFACE=web` (defined in Vite config) and call the
backend directly on cPanel, since this host has no Vercel `/api` proxy. An
explicit `VITE_API_BASE_URL` overrides the backend origin. `.env.production`
contains this environment's public build settings and is not committed.
Both deployments use the same backend and identities.

## Publish to cPanel

A Vercel deployment does **not** publish the browser build. After tests pass:

```sh
CPANEL_SSH_KEY="$HOME/.ssh/wellcircle_cpanel" bash wellcircle-web/deploy-sftp.sh
```

The default SSH target is `wellcircle.et:22` with user `ethiowzj`.
Always resolve the domain afresh: old hosting screenshots or reverse-DNS
records may refer to another address. `CPANEL_HOST_KEY_ALIAS` preserves the
pinned domain identity if an explicit management hostname is supplied.

The script uses the SFTP subsystem for all remote operations; it needs no
remote shell access. It first authenticates and checks the document root,
then builds with parity enforcement. It downloads the old entry point as a
local backup, uploads a remote `index.previous.html`, transfers assets while
retaining old hashes for existing tabs, and switches the entry point last
using SFTP rename. A failed transfer leaves the previous entry point in place.
The printed local deployment-record directory contains the backup and batch files. Host, username and port are optional positional arguments; the document
root can be set with `CPANEL_REMOTE_PATH`. It preserves normal SSH host-key
verification and expects an already authorized key.

Verify the production HTML references the new hashed assets and that direct
links such as `/event/<id>/rsvp`, `/help` and `/profile` receive the SPA entry
point. `dist/build-info.json` identifies the shared source digest used by a
build. To package a manual upload, zip **all contents** of `dist/`, including
`.htaccess`. The old checked-in `dist-cpanel.zip` is historical; always build
fresh instead of uploading it.

## Automatic releases

`.github/workflows/deploy-cpanel-web.yml` publishes the browser build after a
successful CI run for `main`, using that CI run's exact commit. It can also be
run manually on `main`. Configure repository secrets `CPANEL_SSH_PRIVATE_KEY`
(the existing authorized deployment key) and `CPANEL_KNOWN_HOSTS` (the verified
server host key) to enable uploads. The agent does not copy private keys into
GitHub automatically. Without those secrets, the workflow fails with a clear
configuration message and does not deploy.

Repository variables `CPANEL_HOST`, `CPANEL_HOST_KEY_ALIAS`, `CPANEL_USER`, `CPANEL_PORT` and
`CPANEL_WEB_ROOT` override the defaults shown in the script. Optional build
variables are `WEB_API_BASE_URL`, `WEB_BOT_USERNAME` and
`WEB_FIREBASE_*` settings. Telegram’s numeric bot ID is fetched from the backend at runtime. The workflow reruns browser tests, uploads assets before
switching HTML, and checks that production's shared-source digest matches the
build. Configure hosting connectivity and these secrets once so subsequent
shared-feature releases update both products.

## SSH authorization

If the server replies `Permission denied (publickey,...)`, connectivity is
working but the account has not accepted the deployment key. In cPanel →
SSH Access → Manage SSH Keys, authorize the public key matching
`SHA256:RJILmhE7mwRPmfs8USA1lGFahsjUYaG64ZxCxpm0qjQ` (local public key:
`~/.ssh/wellcircle_cpanel.pub`). Keep the private key local; never paste it
into the public-key import field. The target document root still needs to be
verified over SSH before the first upload.

## Google sign-in and legal pages

The browser login uses Google/Gmail through Firebase and Telegram. SMS and
WhatsApp are removed from the login screen. Follow
[Google sign-in setup](../docs/GOOGLE_SIGNIN_SETUP.md) for the existing public
Firebase config, backend project ID and console settings. No SMS billing plan
or service-account private key is needed. Keep Firebase Phone disabled.

The build includes public `/privacy.html`, `/terms.html` and
`/data-deletion.html` documents generated from the shared legal source. The
browser login links the corresponding shared routes.

For Telegram popup authentication, bot identity and domain authorization, see
[Telegram web login setup](../docs/TELEGRAM_WEB_LOGIN_SETUP.md).
