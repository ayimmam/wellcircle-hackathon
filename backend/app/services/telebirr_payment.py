"""Telebirr Open API payment service (Primary - Ethiopia)."""

import time
import uuid
import httpx
from typing import Optional
from app.config import settings

TELEBIRR_API_URL = "https://developer.ethiotelecom.et/v1/payment"


async def initiate_telebirr_payment(
    amount_etb: int,
    subject: str,
    return_url: str,
) -> dict:
    """
    Initiate a Telebirr payment via Open API.
    Returns: { trade_no, to_pay_url } or { error }
    """
    trade_no = f"WC{int(time.time())}{uuid.uuid4().hex[:6]}"

    payload = {
        "merchantCode": settings.TELEBIRR_MERCHANT_CODE,
        "appKey": settings.TELEBIRR_APP_KEY,
        "outTradeNo": trade_no,
        "subject": subject,
        "totalAmount": str(amount_etb),
        "shortCode": settings.TELEBIRR_MERCHANT_CODE,
        "notifyUrl": settings.TELEBIRR_NOTIFY_URL,
        "returnUrl": return_url,
        "timeoutExpress": "30",
    }

    # If credentials not configured, return mock for demo
    if not settings.TELEBIRR_MERCHANT_CODE:
        return {
            "trade_no": trade_no,
            "to_pay_url": f"https://app.ethiomobilemoney.et/pay?ref={trade_no}",
            "mock": True,
        }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(f"{TELEBIRR_API_URL}/create", json=payload)
            data = resp.json()
            if data.get("code") == "200":
                return {
                    "trade_no": trade_no,
                    "to_pay_url": data["data"]["toPayUrl"],
                }
            return {"error": data.get("msg", "Telebirr payment failed")}
    except Exception as e:
        return {"error": str(e)}


def verify_telebirr_callback(payload: dict) -> Optional[dict]:
    """
    Parse Telebirr async callback notification.
    Returns: { trade_no, result_code, amount } or None
    """
    try:
        return {
            "trade_no": payload.get("outTradeNo"),
            "result_code": str(payload.get("resultCode", "")),
            "amount": payload.get("totalAmount"),
            "transaction_no": payload.get("tradeNo"),
        }
    except Exception:
        return None
