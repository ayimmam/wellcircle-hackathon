"""Alembic environment for the Well Circle backend.

The target URL always comes from ``app.config.settings.DATABASE_URL`` so the
runner and the application cannot drift. This file deliberately does not
autogenerate or mutate metadata; revisions remain the only schema authority.

Important baseline warning
--------------------------
Revisions 001+ assume the original Well Circle schema (``users``, ``providers``,
bookings, circles, chat tables, ...) already exists. There is no 000 baseline
that creates a brand-new database. Therefore:

* a database already at revision 032 can run ``alembic upgrade head``;
* a totally empty database must NOT be treated as a fresh install — the chain
  will fail at 001. Restore a schema dump/fixture first.

Use ``alembic current`` / ``alembic history``; never run this against a shared
or production target as part of an automated deploy without an approved plan.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.database import Base

# Register every model so ``target_metadata`` is complete for review/autogen
# comparisons. Revisions still own all DDL.
import app.models  # noqa: F401,E402
import app.models.post  # noqa: F401,E402
import app.models.story  # noqa: F401,E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# Alembic interpolates ``%`` in the URL, so escape literal percent signs.
_url = settings.DATABASE_URL.replace("%", "%%")
config.set_main_option("sqlalchemy.url", _url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Generate SQL without a live connection."""
    context.configure(
        url=_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run revisions against the configured database."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
