import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ["DATABASE_URL"]
conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("SELECT id, name FROM providers WHERE id = '11111111-0000-0000-0000-000000000003'")
prov = cur.fetchone()
print("Provider 3:", prov)

cur.close()
conn.close()
