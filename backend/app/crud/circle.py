from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.circle import Circle, CircleMember
from app.models.user import User

def create_circle(db: Session, name: str, description: str, owner_id: UUID) -> Circle:
    circle = Circle(name=name, description=description, owner_id=owner_id)
    db.add(circle)
    db.flush()
    # Add owner as member
    member = CircleMember(circle_id=circle.id, user_id=owner_id)
    db.add(member)
    db.commit()
    db.refresh(circle)
    return circle

def join_circle(db: Session, circle_id: UUID, user_id: UUID) -> Optional[Circle]:
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        return None
    
    member = db.query(CircleMember).filter(
        CircleMember.circle_id == circle_id,
        CircleMember.user_id == user_id
    ).first()
    
    if not member:
        member = CircleMember(circle_id=circle_id, user_id=user_id)
        db.add(member)
        db.commit()
        
    return circle

def get_circles(db: Session, user_id: Optional[UUID] = None) -> List[dict]:
    circles = db.query(Circle).all()
    result = []
    for c in circles:
        member_count = db.query(CircleMember).filter(CircleMember.circle_id == c.id).count()
        is_joined = False
        if user_id:
            m = db.query(CircleMember).filter(CircleMember.circle_id == c.id, CircleMember.user_id == user_id).first()
            is_joined = m is not None
        result.append({
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "owner_id": c.owner_id,
            "member_count": member_count,
            "is_joined": is_joined,
            "created_at": c.created_at
        })
    return result

def get_circle_leaderboard(db: Session, circle_id: UUID) -> List[dict]:
    members = db.query(CircleMember, User).join(User, CircleMember.user_id == User.id)\
        .filter(CircleMember.circle_id == circle_id)\
        .order_by(desc(CircleMember.weekly_points)).all()
        
    return [{
        "user_id": u.id,
        "name": u.name,
        "telegram_handle": u.telegram_handle,
        "photo_url": u.photo_url,
        "weekly_points": cm.weekly_points,
        "total_points": u.points_balance
    } for cm, u in members]
