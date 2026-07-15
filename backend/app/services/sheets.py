import os
import json
import logging
from typing import Optional, List
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

# [Name, Phone Number, Date & Time, Service Type, Service Name]
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def get_sheets_service():
    """Builds and returns the Google Sheets API service using the service account key."""
    creds_json = os.environ.get("GOOGLE_SHEETS_CREDENTIALS")
    if not creds_json:
        logger.warning("GOOGLE_SHEETS_CREDENTIALS is not set. Google Sheets integration is disabled.")
        return None
    
    try:
        creds_dict = json.loads(creds_json)
        creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
        service = build('sheets', 'v4', credentials=creds)
        return service
    except Exception as e:
        logger.error(f"Failed to initialize Google Sheets service: {e}")
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

    service = get_sheets_service()
    if not service:
        return

    # Prepare values
    values = [[
        name or "Unknown",
        phone_number or "N/A",
        datetime_str,
        service_type,
        service_name
    ]]
    
    body = {
        'values': values
    }
    
    # We assume there is a sheet named 'Sheet1' or we can just use the first sheet by not specifying the sheet name.
    # The default range to append to can just be A1 (it will append at the bottom).
    range_name = 'A1'
    
    try:
        result = service.spreadsheets().values().append(
            spreadsheetId=sheet_id,
            range=range_name,
            valueInputOption='USER_ENTERED',
            insertDataOption='INSERT_ROWS',
            body=body
        ).execute()
        
        logger.info(f"Successfully appended booking to Google Sheets: {result.get('updates').get('updatedRange')}")
    except Exception as e:
        logger.error(f"Error appending booking to Google Sheets: {e}")
