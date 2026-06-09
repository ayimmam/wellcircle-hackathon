import os
import json
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ["DATABASE_URL"]

conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

default_services = [
    {"name": "Monthly Membership", "price": 2500, "duration": "30 days"},
    {"name": "Day Pass", "price": 250, "duration": "1 day"},
    {"name": "Personal Training (1hr)", "price": 1200, "duration": "60 min"}
]

services_json = json.dumps(default_services)

# Update all providers that have no services
cur.execute("UPDATE providers SET services = %s WHERE services IS NULL OR services::text = '[]'", (services_json,))
print(f"Updated {cur.rowcount} providers with default services.")

cur.close()
conn.close()
