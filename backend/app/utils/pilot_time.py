"""Pilot calendar helpers. WellCircle's daily habits use Addis Ababa dates."""

from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

PILOT_TIMEZONE = ZoneInfo("Africa/Addis_Ababa")


def pilot_day_start_utc(now: datetime | None = None) -> datetime:
    """Return the UTC instant at which the current Addis Ababa day began."""
    instant = now or datetime.now(timezone.utc)
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=timezone.utc)
    local_date = instant.astimezone(PILOT_TIMEZONE).date()
    return datetime.combine(local_date, time.min, tzinfo=PILOT_TIMEZONE).astimezone(timezone.utc)


def pilot_date(instant: datetime) -> date:
    """Get the calendar date users see for an aware timestamp."""
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=timezone.utc)
    return instant.astimezone(PILOT_TIMEZONE).date()
