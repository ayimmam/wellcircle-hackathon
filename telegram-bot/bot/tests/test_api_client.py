"""
Tests for bot.services.api_client — covers all 8 backend API endpoints.

The refactored api_client uses a shared httpx.AsyncClient (Y2).  Tests patch
`bot.services.api_client.get_http_client` so each test receives a fresh
AsyncMock — this exercises the real function bodies (URL construction, JSON
payload, query params, per-call timeout) without touching the network.
"""

import asyncio
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from bot.config import BACKEND_URL
from bot.services import api_client
from bot.services.api_client import (
    _TIMEOUT_DEFAULT,
    _TIMEOUT_DIGEST,
    close_http_client,
    init_http_client,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_response(json_data=None, status_code=200):
    """Return a mock httpx.Response."""
    response = MagicMock(spec=httpx.Response)
    response.status_code = status_code
    response.json.return_value = json_data or {}
    if status_code >= 400:
        req = httpx.Request("GET", "http://test")
        response.raise_for_status.side_effect = httpx.HTTPStatusError(
            f"HTTP {status_code}", request=req, response=response
        )
    else:
        response.raise_for_status.return_value = None
    return response


def _mock_client(mock_response):
    """Return an AsyncMock client whose .get / .post return *mock_response*."""
    client = AsyncMock(spec=httpx.AsyncClient)
    client.get = AsyncMock(return_value=mock_response)
    client.post = AsyncMock(return_value=mock_response)
    return client


# ---------------------------------------------------------------------------
# Lifecycle tests
# ---------------------------------------------------------------------------

def test_init_and_close_client():
    """Verify the lifecycle functions set and clear the module-level client."""
    # Start clean
    asyncio.run(close_http_client())
    assert api_client._http_client is None

    asyncio.run(init_http_client())
    assert api_client._http_client is not None

    asyncio.run(close_http_client())
    assert api_client._http_client is None


def test_init_client_idempotent(caplog):
    """Calling init twice logs a warning and does not create a second client."""
    asyncio.run(close_http_client())
    asyncio.run(init_http_client())
    first = api_client._http_client

    import logging
    with caplog.at_level(logging.WARNING, logger="bot.services.api_client"):
        asyncio.run(init_http_client())

    assert api_client._http_client is first  # same object
    assert "more than once" in caplog.text

    asyncio.run(close_http_client())


def test_get_http_client_before_init_raises():
    """get_http_client() must raise RuntimeError when not initialised."""
    asyncio.run(close_http_client())
    with pytest.raises(RuntimeError, match="not initialised"):
        api_client.get_http_client()


# ---------------------------------------------------------------------------
# API function tests — patch get_http_client to inject a mock client
# ---------------------------------------------------------------------------

def test_register_user_success():
    """Verify POST /api/bot/register — URL, payload, and timeout."""
    mock_resp = _make_mock_response({"user_id": "u-123", "created": True})
    client = _mock_client(mock_resp)

    with patch("bot.services.api_client.get_http_client", return_value=client):
        res = asyncio.run(
            api_client.register_user(
                telegram_id=98765,
                telegram_handle="yoni_dev",
                photo_url="https://wellcircle.et/photo.jpg",
            )
        )

    assert res == {"user_id": "u-123", "created": True}
    client.post.assert_awaited_once_with(
        f"{BACKEND_URL}/api/bot/register",
        json={
            "telegram_id": 98765,
            "telegram_handle": "yoni_dev",
            "photo_url": "https://wellcircle.et/photo.jpg",
        },
        timeout=_TIMEOUT_DEFAULT,
    )


def test_register_user_minimal():
    """Verify optional telegram_handle and photo_url default to None."""
    mock_resp = _make_mock_response({"created": False})
    client = _mock_client(mock_resp)

    with patch("bot.services.api_client.get_http_client", return_value=client):
        res = asyncio.run(api_client.register_user(telegram_id=111))

    assert res == {"created": False}
    client.post.assert_awaited_once_with(
        f"{BACKEND_URL}/api/bot/register",
        json={"telegram_id": 111, "telegram_handle": None, "photo_url": None},
        timeout=_TIMEOUT_DEFAULT,
    )


def test_check_admin_access():
    """Verify GET /api/bot/users/{id}/admin-access."""
    mock_resp = _make_mock_response({"is_super_admin": True})
    client = _mock_client(mock_resp)

    with patch("bot.services.api_client.get_http_client", return_value=client):
        res = asyncio.run(api_client.check_admin_access(telegram_id=456))

    assert res == {"is_super_admin": True}
    client.get.assert_awaited_once_with(
        f"{BACKEND_URL}/api/bot/users/456/admin-access",
        timeout=_TIMEOUT_DEFAULT,
    )


def test_get_inactive_users_default_and_custom_days():
    """Verify GET /api/bot/inactive-users with default and custom `days`."""
    mock_resp = _make_mock_response({"inactive_users": [{"telegram_id": 1}]})
    client = _mock_client(mock_resp)

    with patch("bot.services.api_client.get_http_client", return_value=client):
        res = asyncio.run(api_client.get_inactive_users())
        assert len(res["inactive_users"]) == 1
        client.get.assert_awaited_with(
            f"{BACKEND_URL}/api/bot/inactive-users",
            params={"days": 7},
            timeout=_TIMEOUT_DEFAULT,
        )

        asyncio.run(api_client.get_inactive_users(days=14))
        client.get.assert_awaited_with(
            f"{BACKEND_URL}/api/bot/inactive-users",
            params={"days": 14},
            timeout=_TIMEOUT_DEFAULT,
        )


def test_get_streaks_at_risk():
    """Verify GET /api/bot/streaks-at-risk."""
    mock_resp = _make_mock_response({"users": [{"telegram_id": 999, "current_streak": 5}]})
    client = _mock_client(mock_resp)

    with patch("bot.services.api_client.get_http_client", return_value=client):
        res = asyncio.run(api_client.get_streaks_at_risk())

    assert res["users"][0]["current_streak"] == 5
    client.get.assert_awaited_once_with(
        f"{BACKEND_URL}/api/bot/streaks-at-risk",
        timeout=_TIMEOUT_DEFAULT,
    )


def test_mark_reengagement_sent():
    """Verify POST /api/bot/users/{id}/reengagement-sent."""
    mock_resp = _make_mock_response({"ok": True})
    client = _mock_client(mock_resp)

    with patch("bot.services.api_client.get_http_client", return_value=client):
        res = asyncio.run(api_client.mark_reengagement_sent(telegram_id=777))

    assert res == {"ok": True}
    client.post.assert_awaited_once_with(
        f"{BACKEND_URL}/api/bot/users/777/reengagement-sent",
        timeout=_TIMEOUT_DEFAULT,
    )


def test_get_staff_events():
    """Verify GET /api/bot/staff-events with telegram_id query param."""
    mock_resp = _make_mock_response({"events": [{"event_id": "e1", "service_name": "Yoga"}]})
    client = _mock_client(mock_resp)

    with patch("bot.services.api_client.get_http_client", return_value=client):
        res = asyncio.run(api_client.get_staff_events(telegram_id=555))

    assert len(res["events"]) == 1
    client.get.assert_awaited_once_with(
        f"{BACKEND_URL}/api/bot/staff-events",
        params={"telegram_id": 555},
        timeout=_TIMEOUT_DEFAULT,
    )


def test_submit_evidence():
    """Verify POST /api/bot/evidence with full payload."""
    mock_resp = _make_mock_response({"status": "pending_review"})
    client = _mock_client(mock_resp)

    with patch("bot.services.api_client.get_http_client", return_value=client):
        res = asyncio.run(
            api_client.submit_evidence(
                telegram_id=555,
                event_id="evt-42",
                telegram_file_id="photo_file_abc",
            )
        )

    assert res == {"status": "pending_review"}
    client.post.assert_awaited_once_with(
        f"{BACKEND_URL}/api/bot/evidence",
        json={
            "telegram_id": 555,
            "event_id": "evt-42",
            "telegram_file_id": "photo_file_abc",
        },
        timeout=_TIMEOUT_DEFAULT,
    )


def test_get_circle_digests_uses_extended_timeout():
    """Verify GET /api/bot/circle-digests uses the 15 s digest timeout, not the 10 s default."""
    mock_resp = _make_mock_response({"circles": [{"circle_name": "Runners"}]})
    client = _mock_client(mock_resp)

    with patch("bot.services.api_client.get_http_client", return_value=client):
        res = asyncio.run(api_client.get_circle_digests())

    assert len(res["circles"]) == 1
    client.get.assert_awaited_once_with(
        f"{BACKEND_URL}/api/bot/circle-digests",
        timeout=_TIMEOUT_DIGEST,   # must be the 15 s budget, not _TIMEOUT_DEFAULT
    )
    # Extra guard: the two timeout objects must be distinct values
    assert _TIMEOUT_DIGEST != _TIMEOUT_DEFAULT


def test_http_error_propagation():
    """Verify HTTP 5xx errors from the backend raise httpx.HTTPStatusError."""
    mock_resp = _make_mock_response(status_code=500)
    client = _mock_client(mock_resp)

    with patch("bot.services.api_client.get_http_client", return_value=client):
        with pytest.raises(httpx.HTTPStatusError):
            asyncio.run(api_client.register_user(telegram_id=123))


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
