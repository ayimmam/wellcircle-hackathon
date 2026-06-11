from sqlalchemy.orm import Session
from app.models.user_notification import UserNotification
from app.models.user import User
from app.services.telegram_bot import send_telegram_notification

def create_notification(db: Session, user_id: str, type: str, title: str, body: str, action_url: str = None):
    notif = UserNotification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        action_url=action_url
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.telegram_id:
        text = f"<b>{title}</b>\n{body}"
        if action_url:
            text += f"\n\nOpen app to view details."
        send_telegram_notification(user.telegram_id, text)
    
    return notif
