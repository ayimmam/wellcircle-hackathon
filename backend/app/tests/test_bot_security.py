"""
Well Circle — Bot Security and Privacy Tests.
Run: cd backend && $env:DATABASE_URL="sqlite:///:memory:"; $env:TELEGRAM_BOT_TOKEN="dummy_token"; $env:JWT_SECRET="dummy_secret"; $env:VERCEL="true"; $env:PYTHONIOENCODING="utf-8"; python -m app.tests.test_bot_security
"""
import uuid

# SQLite UUID and JSONB compatibility (same monkey-patching as test_integration)
from sqlalchemy import create_engine, String, Text, TypeDecorator
from sqlalchemy.orm import sessionmaker

class SQLiteUUID(TypeDecorator):
    impl = String(36)
    cache_ok = True
    def process_bind_param(self, value, dialect):
        if value is not None:
            return str(value)
        return value
    def process_result_value(self, value, dialect):
        if value is not None:
            return uuid.UUID(value) if not isinstance(value, uuid.UUID) else value
        return value

class SQLiteJSONB(TypeDecorator):
    impl = Text()
    cache_ok = True
    def process_bind_param(self, value, dialect):
        if value is not None:
            import json
            return json.dumps(value)
        return value
    def process_result_value(self, value, dialect):
        if value is not None:
            import json
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
        return value

import sqlalchemy.dialects.postgresql as pg
pg.UUID = SQLiteUUID
pg.JSONB = SQLiteJSONB

from app.database import Base
from app.models.user import User
from app.config import settings
from app.main import app
from fastapi.testclient import TestClient

# Create test DB
engine = create_engine("sqlite:///:memory:", echo=False)
Base.metadata.create_all(bind=engine)
TestSession = sessionmaker(bind=engine)


def test_photo_url_sanitization():
    print("\nRunning test_photo_url_sanitization...")
    db = TestSession()
    try:
        # Set settings.BACKEND_URL to a dummy value
        settings.BACKEND_URL = "http://localhost:8000"
        
        # Create a user with a photo_url that contains the private telegram token
        token_url = "https://api.telegram.org/file/bot628489806:AAG-secret-token/photos/file_31.jpg"
        user = User(
            telegram_id=987654321,
            telegram_handle="hacker",
            photo_url=token_url
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # 1. Verify photo_url getter sanitizes it on retrieval
        assert user.photo_url == "http://localhost:8000/api/bot/photo/photos/file_31.jpg"
        print("   ✅ photo_url getter sanitizes token-bearing URL")
        
        # 2. Verify _photo_url still stores the raw value in the database
        assert user._photo_url == token_url
        print("   ✅ _photo_url stores raw URL in DB")
        
        # 3. Verify a normal URL is NOT sanitized
        normal_url = "https://example.com/photo.jpg"
        user.photo_url = normal_url
        db.commit()
        db.refresh(user)
        assert user.photo_url == normal_url
        print("   ✅ normal URL remains untouched")
        
    finally:
        db.close()


def test_proxy_photo_endpoint():
    print("\nRunning test_proxy_photo_endpoint...")
    client = TestClient(app)
    
    # Temporarily override BOT_TOKEN to mock value
    original_token = settings.TELEGRAM_BOT_TOKEN
    settings.TELEGRAM_BOT_TOKEN = "dummy_token"
    
    try:
        # 1. Verify absolute path starting with double slash (which FastAPI receives as empty/invalid path or absolute path) gets rejected
        response = client.get("/api/bot/photo//absolute/path")
        assert response.status_code == 400
        print("   ✅ invalid absolute path rejected")
        
        # 2. Verify invalid path with traversal gets rejected by calling the endpoint function directly
        # (since TestClient resolves client-side '..' before sending the request to the server)
        from app.api.bot import proxy_telegram_photo
        from fastapi import HTTPException
        import asyncio
        
        try:
            asyncio.run(proxy_telegram_photo("../etc/passwd"))
            assert False, "Should have raised HTTPException"
        except HTTPException as e:
            assert e.status_code == 400
            assert e.detail == "Invalid photo path"
            print("   ✅ invalid path traversal rejected")
        
    finally:
        settings.TELEGRAM_BOT_TOKEN = original_token


if __name__ == "__main__":
    test_photo_url_sanitization()
    test_proxy_photo_endpoint()
    print("\n🎉 All bot security tests passed successfully!")
