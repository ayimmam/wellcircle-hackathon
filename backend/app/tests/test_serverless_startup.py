"""A Vercel cold start must not issue schema DDL on a user request."""

import asyncio


def test_serverless_lifespan_skips_schema_work(monkeypatch):
    from app import main
    from app.database import Base
    from app import database_schema

    def unexpected(*_args, **_kwargs):
        raise AssertionError("serverless startup attempted a database migration")

    monkeypatch.setattr(main, "IS_SERVERLESS", True)
    monkeypatch.setattr(main.settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(Base.metadata, "create_all", unexpected)
    monkeypatch.setattr(database_schema, "ensure_db_schema", unexpected)

    async def start():
        async with main.lifespan(main.app):
            pass

    asyncio.run(start())
