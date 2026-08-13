"""Rename the existing Kuriftu pilot-partner provider row to Boston Day Spa
and reseed it with the confirmed data from the official Boston Day Spa PDF
(docs/Kuriftu Resort - boston day spa.pdf) — see
docs/FEATURE_PLAN_FOR_YOU_AND_PILOT_FOCUS.md Phase 1.

One live provider, no second row: edits the existing "kuriftu"/"boston day
spa" row in place, modeled on update_kuriftu_services.py and
seed_kuriftu_placeholder.py's own instructions.

Prices are null until B1 (owner price confirmation) lands — every service is
priced-on-enquiry and booked by phone.

Usage: cd backend && python seed_boston_day_spa.py
Requires apply_provider_launch_migration.py (or alembic 014) to have run
first, so is_coming_soon/sheets_export_enabled/facilities/navigation_tips
exist, and apply_provider_contact_migration.py for contact_phone/email.
"""
import json
import os
import sys

import psycopg2
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))
from upload_boston_assets import upload_all  # noqa: E402

DESCRIPTION = (
    "Boston Day Spa is where the Kuriftu brand was born, a testament to our "
    "commitment to community empowerment… What began as a capacity-building "
    "project in Addis Ababa has transformed into a sanctuary of well-being, "
    "showcasing the work of celebrated Ethiopian artists like Merikokeb Berhanu."
)

CONTACT_PHONE = "+251 11 662 3808"
CONTACT_EMAIL = "booking@kurifturesorts.com"

FACILITIES = [
    "Professional hair styling and barber studio",
    "Dedicated manicure lounge",
    "Relaxing pedicure space",
    "Serene massage room",
    "Luxury facial suite",
    "Waxing studio",
    "Full-service spa",
]

# (service key -> Cloudinary asset name from upload_boston_assets.py)
SERVICES = [
    ("Hair Salon", "service-hair-salon"),
    ("Steam / Sauna / Jacuzzi", "service-steam-sauna-jacuzzi"),
    ("Massage Cave", "service-massage-cave"),
    ("Mani / Pedi", "service-mani-pedi"),
    ("Facial", "service-facial"),
    ("Wax", "service-wax"),
    ("Barber", "service-barber"),
]

# Official Google Maps place link (Boston Day Spa, Africa Avenue, Addis Ababa).
MAP_URL = "https://maps.app.goo.gl/sXa4uMEJKqGmmmZC7"

NAVIGATION_TIPS = [
    {"title": "Location", "detail": "Located in the heart of Addis Ababa, Bole."},
    {"title": "Call ahead", "detail": f"{CONTACT_PHONE} or +251 11 663 6557 to confirm your visit."},
]


def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not found.")
        return

    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    cur.execute(
        "SELECT id, name FROM providers WHERE name ILIKE %s OR name ILIKE %s",
        ("%kuriftu%", "%boston day spa%"),
    )
    rows = cur.fetchall()

    if not rows:
        print("No provider matching 'kuriftu' or 'boston day spa' found — "
              "run seed_kuriftu_placeholder.py first.")
        cur.close()
        conn.close()
        return

    if len(rows) > 1:
        print("More than one matching provider found — refusing to guess which to rename:")
        for pid, name in rows:
            print(f"  {pid}  {name}")
        cur.close()
        conn.close()
        return

    provider_id, existing_name = rows[0]

    urls = upload_all()
    if "cover-hero" not in urls or len([n for n, _ in SERVICES if urls.get(_)]) == 0:
        print("Warning: some Cloudinary uploads are missing — continuing with what succeeded.")

    cover_photo_url = urls.get("cover-hero")
    photos = [urls[f"gallery-{i:02d}"] for i in range(1, 7) if f"gallery-{i:02d}" in urls]

    services = [
        {
            "name": name,
            "description": None,
            "photo_url": urls.get(asset_key),
            "price": None,
            "duration": None,
            "booking_method": "phone",
        }
        for name, asset_key in SERVICES
    ]

    cur.execute(
        """UPDATE providers
           SET name = %s, location_text = %s, description = %s,
               category = %s, is_featured = TRUE, status = 'active',
               is_coming_soon = FALSE, sheets_export_enabled = TRUE,
               contact_phone = %s, contact_email = %s,
               cover_photo_url = %s, photos = %s,
               facilities = %s, services = %s,
               price_range = %s, navigation_tips = %s, map_url = %s
           WHERE id = %s""",
        (
            "Boston Day Spa",
            "Bole, Addis Ababa",
            DESCRIPTION,
            "spa",
            CONTACT_PHONE,
            CONTACT_EMAIL,
            cover_photo_url,
            json.dumps(photos),
            json.dumps(FACILITIES),
            json.dumps(services),
            "Price on enquiry",
            json.dumps(NAVIGATION_TIPS),
            MAP_URL,
            str(provider_id),
        ),
    )
    conn.commit()
    print(f"Renamed '{existing_name}' ({provider_id}) to Boston Day Spa with "
          f"{len(services)} services, is_coming_soon=FALSE, sheets_export_enabled=TRUE.")

    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
