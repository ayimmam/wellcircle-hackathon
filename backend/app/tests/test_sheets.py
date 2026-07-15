from unittest.mock import patch
import os
import pytest
from app.services.sheets import export_booking_to_sheets

@patch('app.services.sheets.build')
@patch.dict(os.environ, {
    "GOOGLE_SHEETS_CREDENTIALS": '{"type": "service_account", "client_email": "test@test.com"}',
    "GOOGLE_SHEETS_BOOKING_SHEET_ID": "mock_sheet_id"
})
@patch('app.services.sheets.Credentials.from_service_account_info')
def test_export_booking_to_sheets(mock_credentials, mock_build):
    mock_service = mock_build.return_value
    mock_spreadsheets = mock_service.spreadsheets.return_value
    mock_values = mock_spreadsheets.values.return_value
    mock_append = mock_values.append.return_value
    
    # Execute the sync
    export_booking_to_sheets(
        name="Test User",
        phone_number="+251911234567",
        datetime_str="2026-07-20 10:00:00",
        service_type="Service",
        service_name="Massage Therapy"
    )
    
    # Assert
    mock_build.assert_called_once_with('sheets', 'v4', credentials=mock_credentials.return_value)
    
    mock_values.append.assert_called_once_with(
        spreadsheetId="mock_sheet_id",
        range="A1",
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={
            'values': [["Test User", "+251911234567", "2026-07-20 10:00:00", "Service", "Massage Therapy"]]
        }
    )
