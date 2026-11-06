"""Phase F — CORS allow-list and API security-header regression tests."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import settings
from app.utils.security import install_cors, security_headers_middleware


def _app() -> FastAPI:
    app = FastAPI()

    @app.get("/probe")
    def probe():
        return {"ok": True}

    install_cors(app)
    app.middleware("http")(security_headers_middleware)
    return app


@pytest.fixture
def client():
    return TestClient(_app())


@pytest.mark.parametrize(
    "origin",
    [
        "https://app.wellcircle.et",
        "https://wellcircle.et",
        "https://wellcircle-hackathon.vercel.app",
        "https://web.telegram.org",
        "http://localhost:5174",
    ],
)
def test_first_party_origins_are_allowed(client, origin):
    response = client.get("/probe", headers={"Origin": origin})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"


@pytest.mark.parametrize(
    "origin",
    [
        "https://evil.vercel.app",
        "https://wellcircle-hackathon-preview.vercel.app",
        "https://wellcircle.et.evil.example",
    ],
)
def test_arbitrary_origins_are_rejected(client, origin):
    response = client.get("/probe", headers={"Origin": origin})
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_preflight_allows_first_party_and_rejects_unknown_origin(client):
    allowed = client.options(
        "/probe",
        headers={
            "Origin": "https://app.wellcircle.et",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "https://app.wellcircle.et"

    denied = client.options(
        "/probe",
        headers={
            "Origin": "https://evil.vercel.app",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert denied.status_code == 400
    assert "access-control-allow-origin" not in denied.headers


def test_preview_regex_is_opt_in_only(monkeypatch):
    monkeypatch.setattr(
        settings,
        "CORS_ORIGIN_REGEX",
        r"^https://wellcircle-hackathon-[a-z0-9-]+\.vercel\.app$",
    )
    client = TestClient(_app())

    preview = client.get(
        "/probe", headers={"Origin": "https://wellcircle-hackathon-pr-123.vercel.app"}
    )
    assert preview.headers["access-control-allow-origin"] == (
        "https://wellcircle-hackathon-pr-123.vercel.app"
    )

    wrong_project = client.get(
        "/probe", headers={"Origin": "https://other-app-pr-123.vercel.app"}
    )
    assert "access-control-allow-origin" not in wrong_project.headers


def test_security_headers_are_present_and_hsts_is_production_only(client, monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    response = client.get("/probe")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert response.headers["x-frame-options"] == "DENY"
    assert "default-src 'none'" in response.headers["content-security-policy"]
    assert "strict-transport-security" not in response.headers

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    production = client.get("/probe")
    assert production.headers["strict-transport-security"] == (
        "max-age=31536000; includeSubDomains"
    )
