"""Deletes synthetic users (and their dependent rows) created by
loadtest/locustfile.py runs against production. One-off, not part of the
app. Usage: DATABASE_URL=... python cleanup_loadtest_data.py
"""
import os

import psycopg2
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
conn.autocommit = False
cur = conn.cursor()

cur.execute(
    """
    SELECT id FROM users
    WHERE telegram_handle ILIKE 'loadtest\\_%' ESCAPE '\\'
       OR name ILIKE 'Load Test User%'
       OR name ILIKE 'LoadTest%'
    """
)
user_ids = [str(row[0]) for row in cur.fetchall()]
print(f"Found {len(user_ids)} load-test users to remove.")

if not user_ids:
    print("Nothing to clean up.")
    cur.close()
    conn.close()
    raise SystemExit(0)

# Delete dependents first (some have ondelete=CASCADE at the DB level, some
# don't — deleting explicitly here works either way).
dependent_tables = [
    ("bookings", "user_id"),
    ("point_transactions", "user_id"),
    ("user_redemptions", "user_id"),
    ("community_members", "user_id"),
    ("community_feed_events", "user_id"),
    ("evidence_submissions", "submitter_user_id"),
    ("evidence_submissions", "reviewed_by"),
    ("provider_events", "staff_user_id"),
    ("provider_invites", "created_by_user_id"),
    ("provider_invites", "used_by_user_id"),
    ("posts", "user_id"),
    ("reactions", "user_id"),
    ("post_comments", "user_id"),
    ("admin_notifications", "admin_user_id"),
    ("admin_notifications", "related_user_id"),
    ("circle_members", "user_id"),
    ("challenge_awards", "user_id"),
    ("user_notifications", "user_id"),
]

for table, column in dependent_tables:
    cur.execute(f"DELETE FROM {table} WHERE {column} = ANY(%s::uuid[])", (user_ids,))
    if cur.rowcount:
        print(f"  deleted {cur.rowcount} rows from {table}.{column}")

# Providers/circles owned by a load-test user shouldn't exist (the test
# never creates either), but null the FK defensively instead of deleting
# real objects if it somehow does.
cur.execute("UPDATE providers SET owner_user_id = NULL WHERE owner_user_id = ANY(%s::uuid[])", (user_ids,))
if cur.rowcount:
    print(f"  cleared owner_user_id on {cur.rowcount} providers")
cur.execute("UPDATE circles SET owner_id = NULL WHERE owner_id = ANY(%s::uuid[])", (user_ids,))
if cur.rowcount:
    print(f"  cleared owner_id on {cur.rowcount} circles")

cur.execute("DELETE FROM users WHERE id = ANY(%s::uuid[])", (user_ids,))
print(f"Deleted {cur.rowcount} users.")

conn.commit()
cur.close()
conn.close()
print("Done.")
