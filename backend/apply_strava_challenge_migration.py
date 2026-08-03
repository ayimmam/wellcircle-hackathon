import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    print("DATABASE_URL must be set")
    exit(1)

# Fix URL for psycopg2 if needed
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

def run_migration():
    with engine.begin() as conn:
        print("Adding challenge_type and target_value columns to community_challenges...")
        
        # Check if columns exist
        result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='community_challenges'"))
        columns = [row[0] for row in result.fetchall()]
        
        if "challenge_type" not in columns:
            conn.execute(text("ALTER TABLE community_challenges ADD COLUMN challenge_type VARCHAR(50) NOT NULL DEFAULT 'checkin'"))
            print("Added challenge_type column.")
        else:
            print("challenge_type column already exists.")
            
        if "target_value" not in columns:
            conn.execute(text("ALTER TABLE community_challenges ADD COLUMN target_value FLOAT"))
            print("Added target_value column.")
        else:
            print("target_value column already exists.")

if __name__ == "__main__":
    run_migration()
    print("Migration complete.")
