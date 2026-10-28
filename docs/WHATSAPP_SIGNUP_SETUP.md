# WhatsApp sign-up setup for Well Circle

The browser app uses **WhatsApp Cloud API authentication messages** to verify
phone ownership. The Meta App ID and app secret shown in Basic Settings do
not send OTP messages. The Meta app secret and the WhatsApp access token
are different credentials; neither belongs in the frontend or the upload ZIP.

## 1. Add WhatsApp to the Meta app

Open your app in Meta for Developers and add the WhatsApp product/use case.
If the existing app does not offer that product, create a business app using
the WhatsApp setup flow and associate it with the correct business portfolio.
The setup needs a business portfolio, a WhatsApp Business Account (WABA) and
a business phone number. Follow Meta's requirements for verification and
payment setup before production delivery.

Official reference: [Meta's WhatsApp Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/collection/wlk6lh4/whatsapp-cloud-api).

## 2. Test the Meta connection first

In WhatsApp → API Setup (called Getting Started in some versions of the UI):

1. Use the Meta test sender and add your own verified recipient number.
2. Send Meta's supplied sample message to that recipient from the setup panel.
3. Confirm that it arrives in WhatsApp.
4. Record the **Phone number ID**, **WABA ID** and supported **Graph API version**
   displayed by the setup panel. The phone number ID is an API identifier,
   not the visible telephone number.

Test senders are restricted to the recipients Meta allows in that setup.
Use a registered business sender for public sign-ups.

## 3. Register the real sender and an authentication template

Add and verify the phone number that will send Well Circle login messages.
In WhatsApp Manager → Message templates, create an **Authentication** template
named, for example, `wellcircle_login`, in English (US), with a **Copy code**
button. Set the code-expiration notice to ten minutes to match the backend.
Wait for approval. Use the exact approved template name and language code.

The backend sends the same six-digit code in the template body and its OTP
button parameter. It does not use a free-form text message for first-contact
login, and it does not silently switch to development codes after a failure.

References: [Meta messages API](https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages),
[Meta authentication template example](https://www.postman.com/meta/whatsapp-business-platform/request/6vkv46u/create-authentication-template-w-otp-copy-code-button).

## 4. Configure a production access token

In Meta Business Settings, create or select the system user used by your
backend, assign the app and WhatsApp Business Account assets it needs, and
generate a system-user access token with the necessary WhatsApp permissions.
Sending requires `whatsapp_business_messaging`; account/template management
uses `whatsapp_business_management`. Use only the permissions needed by the
operator or application doing that work. Keep the token in the backend's
secret environment. The temporary token from API Setup expires and should
not be your production credential.

If the app secret was exposed in a screenshot, reset it yourself in Meta
before production use and update any server-side integrations that used it.
Do not paste either credential into chat, source control, a public page, or a
variable beginning with `VITE_`.

## 5. Publish the legal pages

Both frontend builds generate these public, static HTML pages from the
shared document source (`frontend/src/data/legal.js`). They are included in
the cPanel ZIP and require neither sign-in nor JavaScript:

- Privacy Policy: `https://app.wellcircle.et/privacy.html`
- Terms of Service: `https://app.wellcircle.et/terms.html`
- Data deletion instructions: `https://app.wellcircle.et/data-deletion.html`

After uploading the build, use those links in Meta App Settings → Basic.
For App domains, use `app.wellcircle.et` and `wellcircle.et` without URL paths.
The app also provides `/privacy`, `/terms`, and `/data-deletion` routes for
in-app reading. Review the policy text against your actual operating practices
before the public release; the support contact is `hello@wellcircle.et`.

## 6. Apply the backend migration before deploying code

Migration `027_durable_whatsapp_otp.py` creates only the OTP challenge table
and its indexes. In PostgreSQL it enables row-level security without public
client policies, keeping the table accessible through the trusted backend.
Use the production migration process after checking the current Alembic
revision. Apply `027` before enabling the updated sign-in endpoints.

OTP state, attempt limits and rate limits live in PostgreSQL, so a code sent
by one Vercel instance can be verified by another. The implementation uses
transaction locks for concurrent phone/IP reservations, and row locks for
single-use verification. Codes are HMAC-protected using the backend JWT
secret, expire after ten minutes and are limited to five attempts. Old
challenge records are pruned when new challenges are created.

## 7. Set backend production environment variables

In the **backend** Vercel project (`wellcircle-hackathon-backend`) or the
backend server's environment, configure:

```dotenv
ENVIRONMENT=production
WHATSAPP_PHONE_NUMBER_ID=<registered sender phone-number ID>
WHATSAPP_API_TOKEN=<system-user WhatsApp access token>
WHATSAPP_OTP_TEMPLATE_NAME=wellcircle_login
WHATSAPP_OTP_TEMPLATE_LANGUAGE=en_US
WHATSAPP_API_VERSION=<supported vXX.X version from Meta API Setup>
```

The backend's existing `DATABASE_URL` and `JWT_SECRET` are also required.
Redeploy the backend after changing environment variables. Uploading the
static cPanel frontend does **not** deploy or configure the backend.

The legacy Twilio Verify option remains supported when the `TWILIO_*`
credentials are configured instead. SMS requires an appropriately configured
verification provider; the browser's default channel is WhatsApp.

## 8. Run the real sign-up check

After configuration and deployment, use a phone number you control:

1. Open `https://app.wellcircle.et` and enter that WhatsApp number.
2. Request a code once. Confirm that the authentication template arrives.
3. Enter the code; a first-time user should reach onboarding, and an existing
   WhatsApp user should reach the original account.
4. Verify that reuse of the same code fails and that an invited new user
   returns to the invite after onboarding.

A successful API start means the provider accepted the message, not that a
handset received it. Check Meta's sender status, recipient restrictions,
template approval/language and delivery status if a message does not arrive.
HTTP 503 indicates missing provider setup or a delivery/verification outage;
HTTP 429 indicates a rate limit. Production never returns the code or logs it.
