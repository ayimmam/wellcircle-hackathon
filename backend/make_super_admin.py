import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ["DATABASE_URL"]

conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

ids = [628489806, 746296167]

for telegram_id in ids:
    cur.execute("UPDATE users SET is_super_admin = true WHERE telegram_id = %s", (telegram_id,))
    if cur.rowcount > 0:
        print(f"User {telegram_id} updated to super_admin successfully.")
    else:
        print(f"User {telegram_id} not found in the database. (They must open the mini-app first to be created)")

cur.close()
conn.close()
