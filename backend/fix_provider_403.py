import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ["DATABASE_URL"]
conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

ids = [628489806, 746296167]

# Make both users providers
for tid in ids:
    cur.execute("UPDATE users SET is_provider = true WHERE telegram_id = %s RETURNING id", (tid,))
    row = cur.fetchone()
    if row:
        user_id = row[0]
        # Assign the mock provider to the first user we find (or both, wait, a provider can only have 1 owner)
        # Let's assign 111...3 to the first one
        if tid == 628489806:
            cur.execute("UPDATE providers SET owner_user_id = %s WHERE id = '11111111-0000-0000-0000-000000000003'", (user_id,))
        print(f"User {tid} updated to provider.")

cur.close()
conn.close()
