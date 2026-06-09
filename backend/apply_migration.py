import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ["DATABASE_URL"]

# psycopg2 needs the postgresql:// url, which it is.
conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

queries = [
    # Alter providers
    "ALTER TABLE providers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'",
    "ALTER TABLE providers ADD COLUMN IF NOT EXISTS onboarded_by_admin BOOLEAN DEFAULT false",
    "ALTER TABLE providers ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ",
    "ALTER TABLE providers ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ",
    "UPDATE providers SET status = 'active' WHERE status IS NULL",
    
    # Create provider_invites
    """CREATE TABLE IF NOT EXISTS provider_invites (
        id UUID PRIMARY KEY,
        invite_code VARCHAR(20) NOT NULL UNIQUE,
        created_by_user_id UUID NOT NULL REFERENCES users(id),
        used_by_user_id UUID REFERENCES users(id),
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        used_at TIMESTAMPTZ
    )""",
    
    # Create products
    """CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY,
        provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL,
        price_etb INTEGER NOT NULL,
        image_url VARCHAR(500),
        images JSONB,
        quantity_in_stock INTEGER DEFAULT 0,
        max_redemptions_per_user INTEGER DEFAULT 1,
        expiry_date TIMESTAMPTZ,
        digital_code_template VARCHAR(255),
        provider_instructions TEXT,
        shipping_required BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    )""",
    
    # Create user_redemptions
    """CREATE TABLE IF NOT EXISTS user_redemptions (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id),
        product_id UUID NOT NULL REFERENCES products(id),
        points_spent INTEGER NOT NULL,
        redemption_code VARCHAR(50),
        delivery_status VARCHAR(50) DEFAULT 'pending',
        delivery_address TEXT,
        delivery_notes TEXT,
        provider_notes TEXT,
        redeemed_at TIMESTAMPTZ DEFAULT now(),
        delivered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    )""",
    
    # Create admin_notifications
    """CREATE TABLE IF NOT EXISTS admin_notifications (
        id UUID PRIMARY KEY,
        admin_user_id UUID NOT NULL REFERENCES users(id),
        event_type VARCHAR(50),
        related_provider_id UUID REFERENCES providers(id),
        related_user_id UUID REFERENCES users(id),
        message TEXT,
        is_read BOOLEAN DEFAULT false,
        bot_message_sent BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now()
    )"""
]

for q in queries:
    try:
        cur.execute(q)
        print("Executed:", q.split()[0:3])
    except Exception as e:
        print("Error on", q.split()[0:3], e)

cur.close()
conn.close()
print("Migration applied successfully.")
