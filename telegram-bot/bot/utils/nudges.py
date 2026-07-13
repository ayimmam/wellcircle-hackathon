"""Re-entry nudge builder — pure functions, no Telegram imports, unit-testable.

Turns one entry of `GET /api/bot/inactive-users` into the message the bot
sends. When the backend attached an applicable promotion, the nudge references
it ("come back and use your discount before it expires") and carries a
Mini App deep link whose start_param the frontend tracks as `reentry_open`.
"""

from datetime import datetime
from typing import Optional

from bot.utils.messages import (
    REENGAGEMENT_MESSAGE,
    REENGAGEMENT_PROMO_MESSAGE,
    REENGAGEMENT_PROMO_BUTTON,
)

# start_param prefix parsed by the Mini App (AuthContext.handleStartParam) —
# same deep-link mechanism as `circle_{join_code}` invite links.
REENTRY_PROMO_PARAM = "reentry_promo_{provider_id}"


def _format_expiry(valid_until: Optional[str]) -> str:
    """ISO timestamp → 'Sun, Jul 26'; falls back to 'soon' on anything odd."""
    if not valid_until:
        return "soon"
    try:
        dt = datetime.fromisoformat(valid_until.replace("Z", "+00:00"))
        return dt.strftime("%a, %b %d")
    except ValueError:
        return "soon"


def build_reengagement_nudge(user: dict, bot_username: Optional[str] = None) -> dict:
    """Build the nudge for one inactive user.

    Returns {"text": str, "button_text": str|None, "deep_link": str|None}.
    Promo-aware when user["promo"] has a discount; generic otherwise.
    """
    name = user.get("name", "there")
    promo = user.get("promo")

    if not promo or not promo.get("discount_pct"):
        return {
            "text": REENGAGEMENT_MESSAGE.format(name=name),
            "button_text": None,
            "deep_link": None,
        }

    text = REENGAGEMENT_PROMO_MESSAGE.format(
        name=name,
        headline=promo.get("headline", "A discount is waiting for you"),
        discount_pct=promo["discount_pct"],
        provider_name=promo.get("provider_name", "your wellness provider"),
        expires_on=_format_expiry(promo.get("valid_until")),
    )

    deep_link = None
    if bot_username and promo.get("provider_id"):
        start_param = REENTRY_PROMO_PARAM.format(provider_id=promo["provider_id"])
        deep_link = f"https://t.me/{bot_username}?startapp={start_param}"

    return {
        "text": text,
        "button_text": REENGAGEMENT_PROMO_BUTTON.format(discount_pct=promo["discount_pct"]),
        "deep_link": deep_link,
    }
