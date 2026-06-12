import os
import psycopg2
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

def generate_products():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not set")
        return

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    # Get all providers
    cur.execute("SELECT id, name, category, location_text FROM providers;")
    providers = cur.fetchall()

    if not providers:
        print("No providers found.")
        return

    # Delete existing products to avoid duplicates during re-runs
    cur.execute("DELETE FROM products;")
    print("Cleared existing products.")

    products_to_insert = []
    
    for provider in providers:
        prov_id, name, category, location = provider
        
        # Product 1: Digital Service
        p1_id = str(uuid.uuid4())
        p1_name = f"1-Day {category.capitalize()} Pass"
        p1_desc = f"Access to {name} facilities for one day."
        p1_price = 50 if category == 'gym' else 70
        products_to_insert.append((
            p1_id, prov_id, p1_name, p1_desc, "digital", p1_price,
            "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400",
            '[]', 50, 3, "2026-12-31T23:59:59Z", "Show digital voucher at reception.",
            False, True
        ))

        # Product 2: Physical Item
        p2_id = str(uuid.uuid4())
        p2_name = f"{name} Branded T-Shirt"
        p2_desc = f"Moisture-wicking branded t-shirt from {name}."
        p2_price = 150
        products_to_insert.append((
            p2_id, prov_id, p2_name, p2_desc, "physical", p2_price,
            "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400",
            '[]', 20, 1, "2026-12-31T23:59:59Z", "Will be shipped to your address.",
            True, True
        ))

    insert_query = """
        INSERT INTO products (
            id, provider_id, name, description, type, price_etb,
            image_url, images, quantity_in_stock, max_redemptions_per_user,
            expiry_date, provider_instructions, shipping_required, is_active
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s
        )
    """

    for prod in products_to_insert:
        cur.execute(insert_query, prod)

    print(f"Successfully seeded {len(products_to_insert)} products into the database.")

    cur.close()
    conn.close()

if __name__ == "__main__":
    generate_products()
