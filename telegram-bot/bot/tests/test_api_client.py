"""
Tests for bot.services.api_client — covers all 8 backend API endpoints.

Mocks httpx.AsyncClient to verify URLs, request methods, JSON bodies, query parameters,
authentication headers (X-Bot-API-Key), per-call timeouts (10s standard, 15s for digests),
and HTTP error propagation.
"""

import asyncio
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from bot.config import BACKEND_URL, BOT_API_KEY
from bot.services import api_client


def _make_mock_response(json_data=None, status_code=200):
    """Helper to construct a mock HTTP response."""
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


def _setup_mock_client(mock_response):
    """Sets up an AsyncMock client context manager."""
    client_instance = AsyncMock()
    client_instance.post = AsyncMock(return_value=mock_response)
    client_instance.get = AsyncMock(return_value=mock_response)

    client_context = MagicMock()
    client_context.__aenter__ = AsyncMock(return_value=client_instance)
    client_context.__aexit__ = AsyncMock(return_value=None)

    client_cls = MagicMock(return_value=client_context)
    return client_cls, client_instance


def test_register_user_success():
    """Verify POST /api/bot/register with payload, headers, and timeout."""
    mock_resp = _make_mock_response({"user_id": "u-123", "created": True})
    client_cls, client_inst = _setup_mock_client(mock_resp)

    with patch("bot.services.api_client.httpx.AsyncClient", client_cls):
        res = asyncio.run(
            api_client.register_user(
                telegram_id=98765,
                telegram_handle="yoni_dev",
                photo_url="https://wellcircle.et/photo.jpg",
            )
        )

    assert res == {"user_id": "u-123", "created": True}
    client_cls.assert_called_once_with(timeout=10, follow_redirects=True)
    client_inst.post.assert_awaited_once_with(
        f"{BACKEND_URL}/api/bot/register",
        json={
            "telegram_id": 98765,
            "telegram_handle": "yoni_dev",
            "photo_url": "https://wellcircle.et/photo.jpg",
        },
        headers={
            "Content-Type": "application/json",
            "X-Bot-API-Key": BOT_API_KEY,
        },
    )


def test_register_user_minimal():
    """Verify registration with optional handle and photo_url omitted."""
    mock_resp = _make_mock_response({"created": False})
    client_cls, client_inst = _setup_mock_client(mock_resp)

    with patch("bot.services.api_client.httpx.AsyncClient", client_cls):
        res = asyncio.run(api_client.register_user(telegram_id=111))

    assert res == {"created": False}
    client_inst.post.assert_awaited_once_with(
        f"{BACKEND_URL}/api/bot/register",
        json={
            "telegram_id": 111,
            "telegram_handle": None,
            "photo_url": None,
        },
        headers={
            "Content-Type": "application/json",
            "X-Bot-API-Key": BOT_API_KEY,
        },
    )


def test_check_admin_access_success():
    """Verify GET /api/bot/users/{id}/admin-access."""
    mock_resp = _make_mock_response({"is_super_admin": True})
    client_cls, client_inst = _setup_mock_client(mock_resp)

    with patch("bot.services.api_client.httpx.AsyncClient", client_cls):
        res = asyncio.run(api_client.check_admin_access(telegram_id=456))

    assert res == {"is_super_admin": True}
    client_cls.assert_called_once_with(timeout=10, follow_redirects=True)
    client_inst.get.assert_awaited_once_with(
        f"{BACKEND_URL}/api/bot/users/456/admin-access",
        headers={
            "Content-Type": "application/json",
            "X-Bot-API-Key": BOT_API_KEY,
        },
    )


def test_get_inactive_users_default_and_custom_days():
    """Verify GET /api/bot/inactive-users with default and customized days."""
    mock_resp = _make_mock_response({"inactive_users": [{"telegram_id": 1}]})
    client_cls, client_inst = _setup_mock_client(mock_resp)

    with patch("bot.services.api_client.httpx.AsyncClient", client_cls):
        # Default days=7
        res = asyncio.run(api_client.get_inactive_users())
        assert len(res["inactive_users"]) == 1
        client_inst.get.assert_awaited_with(
            f"{BACKEND_URL}/api/bot/inactive-users",
            params={"days": 7},
            headers={
                "Content-Type": "application/json",
                "X-Bot-API-Key": BOT_API_KEY,
            },
        )

        # Custom days=14
        asyncio.run(api_client.get_inactive_users(days=14))
        client_inst.get.assert_awaited_with(
            f"{BACKEND_URL}/api/bot/inactive-users",
            params={"days": 14},
            headers={
                "Content-Type": "application/json",
                "X-Bot-API-Key": BOT_API_KEY,
            },
        )


def test_get_streaks_at_risk():
    """Verify GET /api/bot/streaks-at-risk."""
    mock_resp = _make_mock_response({"users": [{"telegram_id": 999, "current_streak": 5}]})
    client_cls, client_inst = _setup_mock_client(mock_resp)

    with patch("bot.services.api_client.httpx.AsyncClient", client_cls):
        res = asyncio.run(api_client.get_streaks_at_risk())

    assert res["users"][0]["current_streak"] == 5
    client_cls.assert_called_once_with(timeout=10, follow_redirects=True)
    client_inst.get.assert_awaited_once_with(
        f"{BACKEND_URL}/api/bot/streaks-at-risk",
        headers={
            "Content-Type": "application/json",
            "X-Bot-API-Key": BOT_API_KEY,
        },
    )


def test_mark_reengagement_sent():
    """Verify POST /api/bot/users/{id}/reengagement-sent."""
    mock_resp = _make_mock_response({"ok": True})
    client_cls, client_inst = _setup_mock_client(mock_resp)

    with patch("bot.services.api_client.httpx.AsyncClient", client_cls):
        res = asyncio.run(api_client.mark_reengagement_sent(telegram_id=777))

    assert res == {"ok": True}
    client_cls.assert_called_once_with(timeout=10, follow_redirects=True)
    client_inst.post.assert_awaited_once_with(
        f"{BACKEND_URL}/api/bot/users/777/reengagement-sent",
        headers={
            "Content-Type": "application/json",
            "X-Bot-API-Key": BOT_API_KEY,
        },
    )


def test_get_staff_events():
    """Verify GET /api/bot/staff-events with telegram_id query parameter."""
    mock_resp = _make_mock_response({"events": [{"event_id": "e1", "service_name": "Yoga"}]})
    client_cls, client_inst = _setup_mock_client(mock_resp)

    with patch("bot.services.api_client.httpx.AsyncClient", client_cls):
        res = asyncio.run(api_client.get_staff_events(telegram_id=555))

    assert len(res["events"]) == 1
    client_cls.assert_called_once_with(timeout=10, follow_redirects=True)
    client_inst.get.assert_awaited_once_with(
        f"{BACKEND_URL}/api/bot/staff-events",
        params={"telegram_id": 555},
        headers={
            "Content-Type": "application/json",
            "X-Bot-API-Key": BOT_API_KEY,
        },
    )


def test_submit_evidence():
    """Verify POST /api/bot/evidence with payload, headers, and timeout."""
    mock_resp = _make_mock_response({"status": "pending_review"})
    client_cls, client_inst = _setup_mock_client(mock_resp)

    with patch("bot.services.api_client.httpx.AsyncClient", client_cls):
        res = asyncio.run(
            api_client.submit_evidence(
                telegram_id=555,
                event_id="evt-42",
                telegram_file_id="photo_file_abc",
            )
        )

    assert res == {"status": "pending_review"}
    client_cls.assert_called_once_with(timeout=10, follow_redirects=True)
    client_inst.post.assert_awaited_once_with(
        f"{BACKEND_URL}/api/bot/evidence",
        json={
            "telegram_id": 555,
            "event_id": "evt-42",
            "telegram_file_id": "photo_file_abc",
        },
        headers={
            "Content-Type": "application/json",
            "X-Bot-API-Key": BOT_API_KEY,
        },
    )


def test_get_circle_digests_timeout_15():
    """Verify GET /api/bot/circle-digests preserves the extended 15s timeout."""
    mock_resp = _make_mock_response({"circles": [{"circle_name": "Runners"}]})
    client_cls, client_inst = _setup_mock_client(mock_resp)

    with patch("bot.services.api_client.httpx.AsyncClient", client_cls):
        res = asyncio.run(api_client.get_circle_digests())

    assert len(res["circles"]) == 1
    # Note: 15s timeout as required by C3 weekly circle digest query!
    client_cls.assert_called_once_with(timeout=15, follow_redirects=True)
    client_inst.get.assert_awaited_once_with(
        f"{BACKEND_URL}/api/bot/circle-digests",
        headers={
            "Content-Type": "application/json",
            "X-Bot-API-Key": BOT_API_KEY,
        },
    )


def test_api_client_http_error_propagation():
    """Verify HTTP status errors (e.g. 500 Internal Server Error) raise properly."""
    mock_resp = _make_mock_response(status_code=500)
    client_cls, client_inst = _setup_mock_client(mock_resp)

    with patch("bot.services.api_client.httpx.AsyncClient", client_cls):
        with pytest.raises(httpx.HTTPStatusError):
            asyncio.run(api_client.register_user(telegram_id=123))


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
