import os
import pytest
from unittest.mock import patch, MagicMock
from app.services.sheets import export_booking_to_sheets, get_access_token

@patch('app.services.sheets.httpx.Client')
@patch('app.services.sheets.jwt.encode')
@patch.dict(os.environ, {
    "GOOGLE_SHEETS_CREDENTIALS": '{"client_email": "test@test.com", "private_key": "mock_key"}',
    "GOOGLE_SHEETS_BOOKING_SHEET_ID": "mock_sheet_id"
})
def test_export_booking_to_sheets(mock_jwt_encode, mock_httpx_client):
    # Setup mocks
    mock_jwt_encode.return_value = "mock_signed_jwt"
    
    mock_client_instance = MagicMock()
    mock_httpx_client.return_value.__enter__.return_value = mock_client_instance
    
    # Mock for get_access_token (first httpx call)
    mock_token_response = MagicMock()
    mock_token_response.json.return_value = {"access_token": "mock_access_token"}
    
    # Mock for appending row (second httpx call)
    mock_append_response = MagicMock()
    
    # Configure the mock client to return different responses based on the call
    mock_client_instance.post.side_effect = [mock_token_response, mock_append_response]
    
    # Execute
    export_booking_to_sheets(
        name="Test User",
        phone_number="+251911234567",
        datetime_str="2026-07-20 10:00:00",
        service_type="Service",
        service_name="Massage Therapy"
    )
    
    # Assert
    assert mock_client_instance.post.call_count == 2
    
    # Verify token request
    token_call_args = mock_client_instance.post.call_args_list[0]
    assert token_call_args[0][0] == "https://oauth2.googleapis.com/token"
    assert token_call_args[1]["data"]["grant_type"] == "urn:ietf:params:oauth:grant-type:jwt-bearer"
    assert token_call_args[1]["data"]["assertion"] == "mock_signed_jwt"
    
    # Verify append request
    append_call_args = mock_client_instance.post.call_args_list[1]
    assert append_call_args[0][0] == "https://sheets.googleapis.com/v4/spreadsheets/mock_sheet_id/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS"
    assert append_call_args[1]["headers"]["Authorization"] == "Bearer mock_access_token"
    assert append_call_args[1]["json"]["values"] == [["Test User", "+251911234567", "2026-07-20 10:00:00", "Service", "Massage Therapy"]]
