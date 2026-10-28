# Telegram browser authentication

The browser app uses Telegram's official legacy Login SDK at
`https://telegram.org/js/telegram-widget.js?22`, followed by the existing
`POST /api/auth/telegram-widget` exchange. Telegram hosts phone/code entry and
account confirmation; Well Circle never asks for or handles Telegram login
codes, passwords or SMS delivery. Google sign-in remains available alongside it.

## Bot identity and authorized website

`GET /api/auth/telegram/config` returns the public numeric ID derived from the
backend's configured `TELEGRAM_BOT_TOKEN`. The browser must load this endpoint
rather than hardcode a separate ID, so popup login and server-side HMAC
verification always use the same bot. The token itself is never returned.
The current locally configured bot was verified with Telegram `getMe` as
`@WellcircleBot`, ID `8839515595`. Old browser ID `7851608933` is invalid.

Telegram also requires the website domain to be registered with BotFather.
The bot owner should open `@BotFather`, select `@WellcircleBot`, and authorize
`https://app.wellcircle.et` under Login Widget / Allowed URLs, preserving any
existing provider/website URLs. For the legacy widget, BotFather's `/setdomain`
command is documented by Telegram; check existing domain usage before replacing
it so another frontend is not disconnected. Never post the bot token in chat,
the browser build, documentation or a screenshot.

An anonymous visit to the legacy authorization URL should display Telegram's
login form, not `bot_id invalid` or `Bot domain invalid`. Changing the numeric ID
alone does not authorize the domain. If BotFather's new Allowed URLs menu does
not authorize the legacy widget, configure its legacy domain using `/setdomain`
with the existing domain usage understood first.

## Browser and backend behavior

The browser preloads the SDK and backend config before enabling the Telegram
button. The SDK handles its `auth_result` message envelope, popup-source checks,
close/cancel behavior and cookie-based fallback. The app exchanges the SDK's
signed user object and displays delivery/authorization failures visibly.
Malformed/cancelled callbacks never create a session. The app does not request
permission for the bot to message the user merely to sign in.

The backend verifies the widget HMAC using SHA256 of the bot token, rejects
stale timestamps, timestamps over 60 seconds in the future and non-positive
Telegram IDs, and issues the normal Well Circle JWT. Existing Telegram accounts
retain their Telegram ID and user record. Login does not automatically merge a
separate Google account.

Run all app gates in `AGENTS.md` plus backend tests. Deploy the backend before
uploading the browser build to cPanel. Verify the public bot config, Telegram's
acceptance of the domain, invalid-signature rejection, popup confirmation,
first-login onboarding, repeat login, cancellation, and return destinations.
Bot token changes belong in backend/bot environments; there is no longer a
`VITE_TELEGRAM_BOT_ID` or `WEB_TELEGRAM_BOT_ID` setting to synchronize.

References: [Telegram legacy widget](https://core.telegram.org/widgets/login-legacy),
[official SDK](https://telegram.org/js/telegram-widget.js?22).
