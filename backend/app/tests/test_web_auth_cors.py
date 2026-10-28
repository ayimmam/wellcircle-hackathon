"""Browser sign-in remains reachable with an older production CORS list."""
import httpx
import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings


@pytest.mark.asyncio
async def test_web_auth_preflight_preserves_legacy_origin_and_blocks_unknown_site():
    config = settings.model_copy(update={
        'CORS_ORIGINS': ['https://legacy.wellcircle.et'],
        'FRONTEND_URL': 'https://wellcircle.et',
        'WEB_FRONTEND_URL': 'https://app.wellcircle.et',
    })
    app = FastAPI()
    app.add_middleware(CORSMiddleware, allow_origins=config.cors_origins, allow_credentials=True, allow_methods=['POST'], allow_headers=['content-type'])
    async with httpx.AsyncClient(app=app, base_url='http://test') as client:
        for origin in ['https://app.wellcircle.et', 'https://wellcircle.et', 'https://legacy.wellcircle.et']:
            response = await client.options('/api/auth/firebase', headers={'Origin':origin, 'Access-Control-Request-Method':'POST', 'Access-Control-Request-Headers':'content-type'})
            assert response.status_code == 200
            assert response.headers['access-control-allow-origin'] == origin
        response = await client.options('/api/auth/firebase', headers={'Origin':'https://untrusted.example', 'Access-Control-Request-Method':'POST'})
        assert response.status_code == 400 and 'access-control-allow-origin' not in response.headers
