"""/evidence conversation — provider-designated staff submit event participation
proof (D2). Replaces the ad-hoc "DM the admin" flow with a structured queue:
list ended events this user is staff for → pick one → send a photo → backend
queues it for admin review.
"""

import logging

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from bot.services.api_client import get_staff_events, submit_evidence
from bot.utils.messages import (
    EVIDENCE_ASK_PHOTO_MESSAGE,
    EVIDENCE_CANCELLED_MESSAGE,
    EVIDENCE_NOT_A_PHOTO_MESSAGE,
    EVIDENCE_PICK_EVENT_MESSAGE,
    EVIDENCE_SUBMITTED_MESSAGE,
    NO_STAFF_EVENTS_MESSAGE,
)

logger = logging.getLogger(__name__)

PICK_EVENT, AWAIT_PHOTO = range(2)


async def evidence_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Entry point for /evidence — list ended events this user is staff for."""
    telegram_id = update.effective_user.id
    try:
        data = await get_staff_events(telegram_id)
    except Exception as e:
        logger.error(f"staff-events lookup failed for {telegram_id}: {e}")
        await update.message.reply_text("Couldn't reach Well Circle right now — try again shortly.")
        return ConversationHandler.END

    events = data.get("events", [])
    if not events:
        await update.message.reply_text(NO_STAFF_EVENTS_MESSAGE)
        return ConversationHandler.END

    context.user_data["evidence_events"] = {e["event_id"]: e["service_name"] for e in events}
    keyboard = [
        [InlineKeyboardButton(
            f"{e['service_name']} — {e['provider_name']}",
            callback_data=e["event_id"],
        )]
        for e in events
    ]
    await update.message.reply_text(
        EVIDENCE_PICK_EVENT_MESSAGE,
        reply_markup=InlineKeyboardMarkup(keyboard),
    )
    return PICK_EVENT


async def evidence_event_chosen(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    context.user_data["evidence_event_id"] = query.data
    context.user_data["evidence_event_name"] = context.user_data.get("evidence_events", {}).get(query.data, "the event")
    await query.edit_message_text(EVIDENCE_ASK_PHOTO_MESSAGE)
    return AWAIT_PHOTO


async def evidence_photo_received(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message.photo:
        await update.message.reply_text(EVIDENCE_NOT_A_PHOTO_MESSAGE)
        return AWAIT_PHOTO

    event_id = context.user_data.get("evidence_event_id")
    telegram_id = update.effective_user.id
    # Largest resolution is last in the list
    file_id = update.message.photo[-1].file_id

    try:
        await submit_evidence(telegram_id, event_id, file_id)
    except Exception as e:
        logger.error(f"evidence submit failed for {telegram_id}, event {event_id}: {e}")
        await update.message.reply_text("Submission failed — please try /evidence again shortly.")
        return ConversationHandler.END

    event_name = context.user_data.get("evidence_event_name", "the event")
    await update.message.reply_text(
        EVIDENCE_SUBMITTED_MESSAGE.format(event_name=event_name),
        parse_mode="HTML",
    )
    _clear_evidence_state(context)
    return ConversationHandler.END


async def evidence_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    _clear_evidence_state(context)
    await update.message.reply_text(EVIDENCE_CANCELLED_MESSAGE)
    return ConversationHandler.END


def _clear_evidence_state(context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data.pop("evidence_event_id", None)
    context.user_data.pop("evidence_event_name", None)
    context.user_data.pop("evidence_events", None)


evidence_conversation = ConversationHandler(
    entry_points=[CommandHandler("evidence", evidence_start)],
    states={
        PICK_EVENT: [CallbackQueryHandler(evidence_event_chosen)],
        AWAIT_PHOTO: [
            MessageHandler(filters.ALL & ~filters.COMMAND, evidence_photo_received),
        ],
    },
    fallbacks=[CommandHandler("cancel", evidence_cancel)],
)
