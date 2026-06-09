import os
import json
import psycopg2
from dotenv import load_dotenv
import re

load_dotenv()
db_url = os.environ["DATABASE_URL"]

conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

# We will replace Adona Spa Lodge (provider 3) with Shanti Yoga Addis
provider_3_id = "11111111-0000-0000-0000-000000000003"

shanti_services = [
    { "name": 'Drop-in Yoga Class', "price": 500, "duration": '60 min' },
    { "name": 'Monthly Unlimited Pass', "price": 2800, "duration": '30 days' },
    { "name": '10-Class Pack', "price": 3500, "duration": 'Flexible' },
    { "name": 'Private 1-on-1 Session', "price": 1800, "duration": '75 min' },
    { "name": "Beginner's Yoga (4 weeks)", "price": 3000, "duration": '8 sessions' }
]

cur.execute("""
    UPDATE providers 
    SET name = 'Shanti Yoga Addis', 
        category = 'yoga',
        description = 'Addis Ababa''s most loved yoga studio, blending Hatha and Vinyasa practices with breathwork and mindfulness rooted in Ethiopian wellness traditions.',
        location_text = 'Bole Medhanialem, Bole Sub-City, Addis Ababa',
        lat = 9.0054, 
        lng = 38.7868,
        price_range = 'ETB 500 – 3,000',
        rating = 4.9,
        cover_photo_url = 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800',
        services = %s
    WHERE id = %s
""", (json.dumps(shanti_services), provider_3_id))

print(f"Updated {cur.rowcount} provider row(s) to Shanti Yoga Addis.")

cur.close()
conn.close()
