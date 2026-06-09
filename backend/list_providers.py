import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ["DATABASE_URL"]

conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("SELECT id, name, category FROM providers")
rows = cur.fetchall()
for row in rows:
    print(f"ID: {row[0]} | Name: {row[1]} | Category: {row[2]}")

cur.close()
conn.close()
