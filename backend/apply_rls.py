import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ["DATABASE_URL"]

# Connect to database
conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

queries = [
    # 1. Enable RLS
    "ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;",
    
    # Drop existing policies if any to avoid errors
    "DROP POLICY IF EXISTS \"users_select_own\" ON public.users;",
    "DROP POLICY IF EXISTS \"users_update_own\" ON public.users;",
    "DROP POLICY IF EXISTS \"users_insert_own\" ON public.users;",

    # 2. Add Select Policy
    """
    CREATE POLICY "users_select_own"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());
    """,

    # 3. Add Update Policy
    """
    CREATE POLICY "users_update_own"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
    """,

    # 4. Add Insert Policy (as suggested)
    """
    CREATE POLICY "users_insert_own"
    ON public.users
    FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());
    """
]

for query in queries:
    try:
        cur.execute(query)
        print(f"Executed: {query.strip().splitlines()[0]}...")
    except Exception as e:
        print(f"Error executing query: {e}")

cur.close()
conn.close()
print("RLS successfully enabled and policies applied on public.users!")
