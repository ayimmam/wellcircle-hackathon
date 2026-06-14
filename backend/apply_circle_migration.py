import os
import psycopg2
from dotenv import load_dotenv

def run_migration():
    load_dotenv()
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found.")
        return

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    try:
        cur.execute("ALTER TABLE circles ADD COLUMN is_private BOOLEAN DEFAULT FALSE;")
        print("Added is_private column to circles.")
    except Exception as e:
        print(f"Column is_private might already exist: {e}")

    try:
        cur.execute("ALTER TABLE circles ADD COLUMN join_code VARCHAR(50);")
        print("Added join_code column to circles.")
    except Exception as e:
        print(f"Column join_code might already exist: {e}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    run_migration()
