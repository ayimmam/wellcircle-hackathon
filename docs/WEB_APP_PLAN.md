# Well Circle Web App — `app.wellcircle.et`

**Status:** plan, not yet implemented.
**Goal:** let people use Well Circle without Telegram — either because they
don't have it, or because they'd rather not run the app inside a chat client.

Sign-in options, **in this order**: **WhatsApp → Telegram → Google.**

---

## 1. The one hard blocker

Everything else in this plan is routine. This is not:

```python
# backend/app/models/user.py
telegram_id = Column(BigInteger, unique=True, nullable=False, index=True)
```

**A user's identity *is* their Telegram ID.** A WhatsApp or Google user
doesn't have one. The codebase already knows this is a problem and has worked
around it once — `create_boston_provider_login.py` allocates a *synthetic
negative* `telegram_id` for the front-desk account, on the reasoning that real
Telegram IDs are always positive. That's a clever patch for one account and an
unworkable basis for a public sign-up flow.

There is also `login_username` / `password_hash` on `User` — a second
identity path bolted onto the same row. A third (WhatsApp) and fourth (Google)
should not be bolted on the same way.

### Proposed model

Add an identities table and demote `telegram_id` to one identity among several:

```python
class AuthIdentity(Base):
    __tablename__ = "auth_identities"
    id           = Column(UUID, primary_key=True, default=uuid.uuid4)
    user_id      = Column(UUID, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider     = Column(String(20), nullable=False)   # 'telegram' | 'whatsapp' | 'google'
    subject      = Column(String(255), nullable=False)  # tg id | E.164 phone | Google 'sub'
    email        = Column(String(255), nullable=True)   # google only
    verified_at  = Column(DateTime(timezone=True), nullable=False)
    created_at   = Column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (UniqueConstraint("provider", "subject"),)
```

Migration, in this order — each step is independently deployable:

1. Create `auth_identities`. Backfill one `telegram` row per existing user
   from `users.telegram_id`. **No behaviour change yet.**
2. Make `users.telegram_id` **nullable**. Keep it populated for Telegram users
   — the bot addresses people by it (`/api/bot/register`,
   `/api/bot/inactive-users`, `/api/bot/users/{telegram_id}/...`), and
   rewriting the bot is not worth it. It becomes a denormalised convenience
   column, not the primary key of identity.
3. Point `/api/auth/telegram` and `/api/auth/telegram-widget` at
   `auth_identities` for lookup, writing both tables.
4. Add the WhatsApp and Google endpoints.
5. Retire the synthetic-negative-ID hack; migrate that account to a
   `whatsapp` or password identity row.

`get_user_by_telegram_id()` stays (the bot needs it) but stops being the only
way in.

### Account linking — decide this before writing code

Someone signs up with WhatsApp on `app.wellcircle.et`. Two weeks later they
open the Mini App from a friend's Telegram invite. **Do they get their account
or a new one?**

Recommended rule:

- **Phone number is the join key.** `users.phone_number` already exists in
  E.164 and `PhoneInput`/`utils/phone.js` already normalise it.
- WhatsApp sign-in supplies a verified phone by construction.
- Telegram sign-in can request one via the Mini App's
  `requestContact` / the bot's contact-share button.
- Google supplies an email, never a phone → **Google alone cannot auto-link.**
  A Google user who later opens the Mini App gets a "these look like the same
  person — link them?" prompt, confirmed by the user, never inferred.
- Never auto-link on name or photo.

Two accounts merging is a data problem (points, streaks, circle memberships,
bookings). Getting the rule right at sign-up is much cheaper than writing a
merge tool later.

---

## 2. Sign-in options

### 2.1 WhatsApp (first, most prominent)

The right default for Ethiopia — highest penetration of the three, and the
phone number it yields is the field that makes linking work.

**There is no "Sign in with WhatsApp" OAuth product.** What exists is
phone-number verification *delivered over* WhatsApp:

| Route | Notes |
| --- | --- |
| **WhatsApp Business Cloud API** (Meta, direct) | Authentication-category template message with a one-time code. Requires a Meta Business account, a verified business, a registered WhatsApp Business number, and template approval. Cheapest per message at volume. |
| **BSP (Twilio Verify, MessageBird, Infobip)** | Same delivery, someone else owns the Meta relationship and the template approval. Higher per-message cost, materially faster to launch. |

**Recommendation: launch on a BSP, keep the option to move direct.** Template
approval is the long pole and it is not on the critical path for a pilot.

**Always ship an SMS fallback.** WhatsApp OTP delivery fails for users whose
number isn't on WhatsApp, and a login screen that can strand a user is worse
than one extra integration.

Flow:

```
POST /api/auth/whatsapp/start    { phone: "+2519xxxxxxxx" }
  → rate-limited; sends a 6-digit code; returns { request_id, expires_in }
POST /api/auth/whatsapp/verify   { request_id, code }
  → 200 { token, user, is_new_user }
```

Server-side requirements, none optional:
- Per-phone **and** per-IP rate limits; OTP endpoints are abused constantly.
- Codes hashed at rest, single-use, ≤10 min TTL, ≤5 attempts then invalidate.
- Constant-time comparison.
- Normalise to E.164 before lookup so `0911…` and `+251911…` are one account.

### 2.2 Telegram (second)

**Mostly already built.** `POST /api/auth/telegram-widget` exists and
`app/services/telegram_login_widget.py` already validates the HMAC. It's used
by the provider portal today.

Two changes:
- It currently **rejects non-providers** (`if not user or not user.is_provider:
  403`) and never creates users. The consumer web app needs a variant that
  creates on first login, like `/api/auth/telegram` does.
- Register `app.wellcircle.et` as an allowed domain on the bot via
  `@BotFather` → `/setdomain`.

Worth stating plainly: **this is the cheapest of the three to ship** and it
reuses code that is already in production. It is second in the list because
someone who is happy with Telegram is already served by the Mini App — this
option exists for people who want Telegram identity in a normal browser tab.

### 2.3 Google (third)

Google Identity Services, authorization-code flow with PKCE. Verify the ID
token **server-side** against Google's JWKS — signature, `iss`, `aud`, `exp`,
and `email_verified`. Never trust a token the browser decoded for you.

```
POST /api/auth/google  { credential: "<id_token>" }
  → 200 { token, user, is_new_user }
```

Identity subject is Google's `sub`, never the email — emails change hands.

---

## 3. Frontend

### 3.1 Third domain mode

`utils/providerPortal.js` already establishes the pattern: one codebase, one
Vercel project, behaviour switched on hostname. Generalise it rather than
adding a second one-off:

```js
// utils/appMode.js
export const APP_MODE = {
  MINI_APP: 'mini_app',        // inside Telegram (window.Telegram.WebApp.initData present)
  WEB:      'web',             // app.wellcircle.et
  PROVIDER: 'provider_portal', // provider.wellcircle.et
};
```

`isProviderPortalDomain()` becomes `getAppMode() === APP_MODE.PROVIDER`, so the
existing call sites in `Header`, `BottomNav`, and `App.jsx` keep working.

**Mini App vs web is a capability check, not a hostname check** — the Mini App
is served from the same origin as the web app in some configurations. Branch on
`window.Telegram?.WebApp?.initData` being present and non-empty.

### 3.2 What breaks outside Telegram

Thirteen files touch `window.Telegram`. Most already guard with `?.`, but
guarding against a crash is not the same as having a fallback:

| Surface | File | Outside Telegram |
| --- | --- | --- |
| Auth via `initData` | `context/AuthContext.jsx` | **Must** branch to the new login screen instead of falling back to `'mock-init-data'` |
| Back button | `hooks/useTelegramBackButton.js` | No-ops. Web needs a visible in-app back affordance — `body.in-telegram` CSS currently *hides* the chevrons |
| Double-back-to-exit | `hooks/useDoubleBackToExit.js` | No-ops (correct — there's nothing to exit) |
| Haptics | `utils/haptic.js` | No-ops. Consider the Vibration API on Android |
| Theme/header colour | `context/ThemeContext.jsx`, `hooks/useTelegramHeaderColor.js` | No-ops. Web needs its own `<meta name="theme-color">` |
| Circle invites | `utils/circleInvite.js` | Telegram share sheet unavailable → use Web Share API, fall back to copy-link |
| Opening external links | `ProfileScreen` (Strava), `ProviderDetail` (maps) | `window.Telegram.WebApp.openLink` → plain `window.open` |
| Contact sharing | onboarding | No `requestContact` → the phone step becomes a normal `PhoneInput` |

The `body.in-telegram` CSS block at the bottom of `index.css` hides back
buttons on the assumption that Telegram's own chrome provides them. That
assumption is exactly backwards on the web and needs a matching `body.in-web`
treatment.

### 3.3 New screens

- **`/login`** — the three options in order (WhatsApp, Telegram, Google), plus
  the OTP entry step. This is the first screen a non-Telegram user ever sees;
  it should carry the same one-line pitch as `/about`.
- **Marketing root `/`** — `SplashScreen` currently assumes an authenticated
  Telegram session. On the web, `/` for a logged-out visitor should be a short
  landing page (what this is, three steps, sign in) — much of which the new
  `AboutScreen` copy already covers.
- **Session expiry** — the Mini App can silently re-auth from `initData`
  forever. The web app cannot: a JWT will expire in front of the user, so
  every screen needs a real 401 → `/login` path.

### 3.4 Session storage

The current model — JWT in `localStorage` under `wc_token` — is acceptable in
the Telegram WebView. On a public web origin it is more exposed to XSS.

**Recommendation:** short-lived access token in memory + refresh token in an
`httpOnly; Secure; SameSite=Lax` cookie for web mode. The Mini App can keep
its current scheme; the token *issuing* endpoints are shared, the storage is
per-mode. Do not do this by halves — a refresh cookie plus a long-lived
`localStorage` token is the worst of both.

---

## 4. Notifications and re-engagement

This is the part most likely to be underestimated.

Re-engagement today runs entirely through the bot: `GET /api/bot/inactive-users`,
`GET /api/bot/streaks-at-risk`, `POST /api/bot/users/{telegram_id}/reengagement-sent`.
**Every one of those is keyed on `telegram_id`.** A WhatsApp or Google user is
invisible to all of it — and streak reminders are the single biggest reopen
lever the app has.

Options, cheapest first:

1. **WhatsApp template messages** for users with a verified phone. Same BSP as
   the OTP, different template category (utility/marketing — note that
   marketing templates need opt-in and cost more).
2. **Web Push** (VAPID) for `app.wellcircle.et`. Free, works on Android
   Chrome and desktop; iOS Safari requires the user to add to home screen
   first, so it can't be the only channel.
3. **Email** for Google users, who supply one by construction.

Whatever is chosen, the queries need to select by *notifiable channel* rather
than by `telegram_id`, which means the bot endpoints get a sibling rather than
a rewrite.

---

## 5. Delivery order

Each phase is shippable and independently useful.

| Phase | Work | Ship gate |
| --- | --- | --- |
| **1. Identity** | `auth_identities` + backfill + nullable `telegram_id`; existing auth paths rewritten to use it | Mini App and provider portal behave identically to today |
| **2. Web shell** | `getAppMode()`, web-mode chrome, back affordance, `/login` and landing page, 401 handling | `app.wellcircle.et` runs the app with **Telegram Login Widget only** — reuses code that already exists, so this is the fastest path to a working web app |
| **3. WhatsApp** | BSP integration, OTP endpoints + rate limiting, SMS fallback, phone-based linking | Primary option, listed first |
| **4. Google** | GIS + server-side ID-token verification, explicit link prompt | All three options live |
| **5. Notifications** | Channel-aware re-engagement, web push, WhatsApp templates | Non-Telegram users get streak reminders |
| **6. Retire hacks** | Synthetic negative `telegram_id`; fold `login_username`/`password_hash` into `auth_identities` | One identity model |

Phase 2 before Phase 3 is deliberate: it puts a working web app in front of
users while the WhatsApp business verification and template approval — the
slowest external dependency here, and the one nobody controls — is still in
flight.

---

## 6. Open questions

1. **WhatsApp provider** — direct Meta Cloud API or a BSP? Cost per OTP at
   expected volume vs. weeks to launch.
2. **Does the web app get the provider portal too**, or does that stay on
   `provider.wellcircle.et`? Two portals on two domains is more surface than a
   pilot needs.
3. **Points parity** — do web users earn points identically? They should, but
   check-in currently has no anti-abuse beyond the Telegram account being a
   real Telegram account. Phone verification is comparable; Google sign-in is
   materially cheaper to farm.
4. **Which domain is canonical for sharing?** Circle invite links currently
   assume a Telegram deep link. A shared link should probably open the web app
   with an "open in Telegram" affordance, not the reverse.
5. **Does the bot stay the primary notification channel** for Telegram users,
   with web push as an addition, or do both fire? Double-notifying is a fast
   way to get muted.
