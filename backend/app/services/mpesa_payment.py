"""M-Pesa Daraja STK Push payment service (Secondary)."""

import base64
import httpx
from datetime import datetime
from app.config import settings

DARAJA_SANDBOX_URL = "https://sandbox.safaricom.co.ke"
DARAJA_PROD_URL = "https://api.safaricom.co.ke"


def _get_base_url():
    if settings.ENVIRONMENT == "production":
        return DARAJA_PROD_URL
    return DARAJA_SANDBOX_URL


async def _get_access_token() -> str:
    """Get Daraja OAuth access token."""
    credentials = base64.b64encode(
        f"{settings.MPESA_CONSUMER_KEY}:{settings.MPESA_CONSUMER_SECRET}".encode()
    ).decode()

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{_get_base_url()}/oauth/v1/generate?grant_type=client_credentials",
            headers={"Authorization": f"Basic {credentials}"},
        )
        return resp.json()["access_token"]


async def initiate_stk_push(
    phone_number: str,
    amount: int,
    account_ref: str,
    description: str = "Well Circle Booking",
) -> dict:
    """
    Trigger M-Pesa STK Push to user's phone.
    Returns: { checkout_request_id } or { error }
    """
    if not settings.MPESA_CONSUMER_KEY:
        return {
            "checkout_request_id": f"mock_ws_CO_{account_ref}",
            "mock": True,
        }

    try:
        token = await _get_access_token()
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        password = base64.b64encode(
            f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}".encode()
        ).decode()

        payload = {
            "BusinessShortCode": settings.MPESA_SHORTCODE,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": amount,
            "PartyA": phone_number,
            "PartyB": settings.MPESA_SHORTCODE,
            "PhoneNumber": phone_number,
            "CallBackURL": settings.MPESA_CALLBACK_URL,
            "AccountReference": account_ref,
            "TransactionDesc": description,
        }

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{_get_base_url()}/mpesa/stkpush/v1/processrequest",
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )
            data = resp.json()
            if data.get("ResponseCode") == "0":
                return {"checkout_request_id": data["CheckoutRequestID"]}
            return {"error": data.get("errorMessage", "STK Push failed")}
    except Exception as e:
        return {"error": str(e)}


def verify_mpesa_callback(payload: dict) -> dict:
    """Parse M-Pesa Daraja callback."""
    try:
        body = payload.get("Body", {}).get("stkCallback", {})
        return {
            "result_code": body.get("ResultCode"),
            "checkout_request_id": body.get("CheckoutRequestID"),
            "result_desc": body.get("ResultDesc"),
        }
    except Exception:
        return {"result_code": -1}
