"""One-time Telegram pin claim uses the points ledger."""

import asyncio

from app.tests.test_points_economy import TestSession, _create_user
from app.api.bot import claim_pin_bot_bonus
from app.models.point_transaction import PointTransaction
from app.services.points import TXN_PIN_BOT_BONUS


def test_pin_bonus_is_credited_once():
    db = TestSession()
    try:
        user = _create_user(db, 990001234)
        first = asyncio.run(claim_pin_bot_bonus(user.telegram_id, db, True))
        second = asyncio.run(claim_pin_bot_bonus(user.telegram_id, db, True))
        db.refresh(user)

        assert first == {"awarded": True, "points_awarded": 200, "points_balance": 200}
        assert second == {"awarded": False, "points_awarded": 0, "points_balance": 200}
        assert user.points_balance == 200
        assert db.query(PointTransaction).filter(
            PointTransaction.user_id == user.id,
            PointTransaction.type == TXN_PIN_BOT_BONUS,
        ).count() == 1
    finally:
        db.close()
