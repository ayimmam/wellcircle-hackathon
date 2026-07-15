import os
import json
import time
import logging
import httpx
from jose import jwt

logger = logging.getLogger(__name__)

SCOPES = "https://www.googleapis.com/auth/spreadsheets"
TOKEN_URI = "https://oauth2.googleapis.com/token"

def get_access_token() -> str:
    creds_json = os.environ.get("GOOGLE_SHEETS_CREDENTIALS")
    if not creds_json:
        logger.warning("GOOGLE_SHEETS_CREDENTIALS is not set. Google Sheets integration is disabled.")
        return None
    
    try:
        creds = json.loads(creds_json)
        iat = int(time.time())
        exp = iat + 3600
        payload = {
            "iss": creds["client_email"],
            "scope": SCOPES,
            "aud": TOKEN_URI,
            "exp": exp,
            "iat": iat
        }
        
        # Sign the JWT using the private key
        signed_jwt = jwt.encode(payload, creds["private_key"], algorithm="RS256")
        
        # Request access token
        with httpx.Client() as client:
            resp = client.post(TOKEN_URI, data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": signed_jwt
            })
            resp.raise_for_status()
            return resp.json()["access_token"]
    except Exception as e:
        logger.error(f"Failed to get Google Sheets access token: {e}")
        return None

def export_booking_to_sheets(name: str, phone_number: str, datetime_str: str, service_type: str, service_name: str):
    """
    Appends a new booking row to the Google Sheet.
    Order: [Name, Phone Number, Date & Time, Service Type, Service Name]
    """
    sheet_id = os.environ.get("GOOGLE_SHEETS_BOOKING_SHEET_ID")
    if not sheet_id:
        logger.warning("GOOGLE_SHEETS_BOOKING_SHEET_ID is not set.")
        return

    access_token = get_access_token()
    if not access_token:
        return

    values = [[
        name or "Unknown",
        phone_number or "N/A",
        datetime_str,
        service_type,
        service_name
    ]]
    
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS"
    
    try:
        with httpx.Client() as client:
            resp = client.post(
                url,
                headers={"Authorization": f"Bearer {access_token}"},
                json={"values": values}
            )
            resp.raise_for_status()
            logger.info("Successfully appended booking to Google Sheets")
    except Exception as e:
        logger.error(f"Error appending booking to Google Sheets: {e}")
