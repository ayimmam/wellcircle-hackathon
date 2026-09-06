"""Follower graph CRUD."""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.follower import Follower
from app.models.user import User


def follow_user(db: Session, follower_id, following_id):
    if follower_id == following_id:
        raise ValueError("You cannot follow yourself")
    existing = db.query(Follower).filter_by(follower_id=follower_id, following_id=following_id).first()
    if existing:
        return existing
    if not db.query(User.id).filter(User.id == following_id).first():
        raise LookupError("User not found")
    row = Follower(follower_id=follower_id, following_id=following_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def unfollow_user(db: Session, follower_id, following_id):
    count = db.query(Follower).filter_by(
        follower_id=follower_id, following_id=following_id
    ).delete(synchronize_session=False)
    db.commit()
    return bool(count)


def is_following(db: Session, follower_id, following_id):
    return db.query(Follower.follower_id).filter_by(
        follower_id=follower_id, following_id=following_id
    ).first() is not None


def get_follower_count(db: Session, user_id):
    return db.query(func.count(Follower.follower_id)).filter(Follower.following_id == user_id).scalar() or 0


def get_following_count(db: Session, user_id):
    return db.query(func.count(Follower.following_id)).filter(Follower.follower_id == user_id).scalar() or 0


def get_counts_for_users(db: Session, user_ids):
    if not user_ids:
        return {}, {}
    follower_counts = dict(db.query(Follower.following_id, func.count(Follower.follower_id)).filter(
        Follower.following_id.in_(user_ids)
    ).group_by(Follower.following_id).all())
    following_counts = dict(db.query(Follower.follower_id, func.count(Follower.following_id)).filter(
        Follower.follower_id.in_(user_ids)
    ).group_by(Follower.follower_id).all())
    return follower_counts, following_counts


def _page(query, page, per_page):
    total = query.count()
    rows = query.offset((page - 1) * per_page).limit(per_page).all()
    return rows, total


def get_followers(db: Session, user_id, page=1, per_page=20):
    query = (
        db.query(User)
        .join(Follower, Follower.follower_id == User.id)
        .filter(Follower.following_id == user_id)
        .order_by(Follower.created_at.desc())
    )
    return _page(query, page, per_page)


def get_following(db: Session, user_id, page=1, per_page=20):
    query = (
        db.query(User)
        .join(Follower, Follower.following_id == User.id)
        .filter(Follower.follower_id == user_id)
        .order_by(Follower.created_at.desc())
    )
    return _page(query, page, per_page)
