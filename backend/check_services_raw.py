import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ["DATABASE_URL"]

conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("SELECT id, name, services FROM providers LIMIT 1")
row = cur.fetchone()
print(f"Provider: {row[1]}")
print(f"Services raw: {repr(row[2])}")
print(f"Services type: {type(row[2])}")

cur.close()
conn.close()
