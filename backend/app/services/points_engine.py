"""Legacy Points engine — tier calculation and decay logic."""


def get_points_tier(balance: int) -> tuple:
    """Returns (tier_name, emoji) based on points balance."""
    if balance >= 700:
        return ("forest", "🌲")
    elif balance >= 300:
        return ("grove", "🌳")
    elif balance >= 100:
        return ("sprout", "🌿")
    else:
        return ("seed", "🌱")


POINTS_CHECKIN = 10
POINTS_DECAY_PER_DAY = 5
DECAY_AFTER_DAYS = 3
