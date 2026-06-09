import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ["DATABASE_URL"]

conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("SELECT id, name, services FROM providers WHERE name ILIKE '%Adona%'")
row = cur.fetchone()
if row:
    print(f"Provider: {row[1]}")
    print(f"Services: {row[2]}")
else:
    print("Not found")

cur.close()
conn.close()
