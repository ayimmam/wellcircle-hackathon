"""Migration: Create auth_identities table, make users.telegram_id nullable,
and backfill existing telegram users into auth_identities.

Run: python apply_auth_identities_migration.py
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment")
    exit(1)

# Ensure pgbouncer compatibility if query params present
conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

print("🚀 Running auth_identities migration...")

# 1. Create auth_identities table
cur.execute("""
CREATE TABLE IF NOT EXISTS auth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_auth_identity_provider_subject UNIQUE (provider, subject)
);
CREATE INDEX IF NOT EXISTS ix_auth_identities_user_id ON auth_identities(user_id);
""")
print("✅ Created auth_identities table and index")

# 2. Make users.telegram_id nullable
cur.execute("""
ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL;
""")
print("✅ Made users.telegram_id nullable")

# 3. Backfill telegram users into auth_identities
cur.execute("""
INSERT INTO auth_identities (id, user_id, provider, subject, verified_at, created_at)
SELECT
    gen_random_uuid(),
    id,
    'telegram',
    telegram_id::text,
    COALESCE(created_at, NOW()),
    COALESCE(created_at, NOW())
FROM users
WHERE telegram_id IS NOT NULL
ON CONFLICT (provider, subject) DO NOTHING;
""")
print(f"✅ Backfilled {cur.rowcount} telegram identities")

cur.close()
conn.close()
print("🎉 Migration complete!")
