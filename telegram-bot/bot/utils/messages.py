"""Message templates for the Well Circle bot."""

WELCOME_MESSAGE = """
🟢 <b>Welcome to Well Circle, {name}!</b>

Your tribe, your wellness. Right where you chat.

Tap the button below to open Well Circle and complete your profile — it takes 30 seconds.

🏋️ Discover wellness providers near you
👥 Join community circles for accountability
🏆 Earn Legacy Points with daily check-ins
💳 Book and pay — all inside Telegram
"""

REENGAGEMENT_MESSAGE = """
👋 Hey {name}! We miss you at Well Circle.

Your wellness circle has been active — new check-ins, new members, and new sessions dropping this week.

Don't let your Legacy Points decay! 🌱

Tap /start to jump back in. Your tribe is waiting. 💪
"""

NO_STAFF_EVENTS_MESSAGE = """
You're not the designated staff for any ended event awaiting evidence right now.

Ask the provider to set you as staff on an event before it ends, then come back with /evidence.
"""

EVIDENCE_PICK_EVENT_MESSAGE = "📸 Which event are you submitting evidence for?"

EVIDENCE_ASK_PHOTO_MESSAGE = "Send a photo of the event as proof of participation."

EVIDENCE_NOT_A_PHOTO_MESSAGE = "That's not a photo — please send a photo, or /cancel."

EVIDENCE_SUBMITTED_MESSAGE = """
✅ Evidence submitted for <b>{event_name}</b>.

An admin will review it and attendees will be notified when points are awarded.
"""

EVIDENCE_CANCELLED_MESSAGE = "Evidence submission cancelled."

WEEKLY_DIGEST_MESSAGE = """
📊 <b>{circle_name}</b> — weekly wrap-up

🔥 {top_scorer} topped your circle with {top_points} pts this week!

Keep checking in to climb the leaderboard. 💪
"""
