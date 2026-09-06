from datetime import datetime
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_, and_
from fastapi import HTTPException

from app.models.post import Post, Reaction, PostComment
from app.models.user import User
from app.models.circle import Circle, CircleMember
from app.models.community import Community

# For You feed: content truncation for the Phase 2 bootstrap payload budget —
# full content loads on the destination screen (circle/community), not here.
FEED_CONTENT_TRUNCATE_AT = 280

def create_post(
    db: Session,
    user_id: UUID,
    content: str,
    community_id: Optional[UUID] = None,
    circle_id: Optional[UUID] = None,
    activity_type: Optional[str] = None,
    distance_km: Optional[float] = None,
    duration_min: Optional[int] = None,
    photo_url: Optional[str] = None,
) -> Post:
    if not community_id and not circle_id:
        raise ValueError("Either community_id or circle_id must be provided")

    post = Post(
        user_id=user_id,
        community_id=community_id,
        circle_id=circle_id,
        content=content,
        activity_type=activity_type,
        distance_km=distance_km,
        duration_min=duration_min,
        photo_url=photo_url,
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    if circle_id:
        _notify_circle_of_new_post(db, post)

    return post


def _notify_circle_of_new_post(db: Session, post: Post) -> None:
    """WP3: fan out an in-app notification to every other circle member when
    someone posts. Best-effort — a notification failure must never block the
    post itself from having been created."""
    try:
        from app.models.circle import Circle
        from app.models.user_notification import UserNotification

        circle = db.query(Circle).filter(Circle.id == post.circle_id).first()
        author = db.query(User).filter(User.id == post.user_id).first()
        if not circle or not author:
            return

        member_ids = [
            row[0] for row in
            db.query(CircleMember.user_id)
            .filter(CircleMember.circle_id == post.circle_id, CircleMember.user_id != post.user_id)
            .all()
        ]
        if not member_ids:
            return

        author_name = author.name or "Someone"
        if post.activity_type and post.distance_km:
            preview = f"{author_name} logged a {post.activity_type} — {post.distance_km} km. Congratulate them!"
        else:
            preview = (post.content or "")[:140]

        notifications = [
            UserNotification(
                user_id=member_id,
                type="circle_activity",
                title=f"{author_name} shared an activity in {circle.name}",
                body=preview,
                action_url=f"/circle/{post.circle_id}",
                is_read=False,
            )
            for member_id in member_ids
        ]
        db.bulk_save_objects(notifications)
        db.commit()
    except Exception:
        db.rollback()


def _assemble_posts(db: Session, posts_data, *, include_comments: bool) -> List[dict]:
    """Shared batching + assembly for any (Post, User) row list — one query
    for every post's reactions, and either one query for full comment threads
    or one COUNT query for just the count, instead of per-post round trips."""
    post_ids = [p.id for p, _ in posts_data]

    reactions_by_post = {}
    total_points_by_post = {}
    if post_ids:
        for r in db.query(Reaction).filter(Reaction.post_id.in_(post_ids)).all():
            summary = reactions_by_post.setdefault(r.post_id, {})
            summary[r.emoji] = summary.get(r.emoji, 0) + 1
            total_points_by_post[r.post_id] = total_points_by_post.get(r.post_id, 0) + r.points_gifted

    comments_by_post = {}
    comment_count_by_post = {}
    if post_ids:
        if include_comments:
            comment_rows = (
                db.query(PostComment, User)
                .join(User, PostComment.user_id == User.id)
                .filter(PostComment.post_id.in_(post_ids))
                .order_by(PostComment.created_at.asc())
                .all()
            )
            # Build a flat lookup first, then nest replies under their parent —
            # one level deep only.
            comment_dicts = {}
            for c, cu in comment_rows:
                comment_dicts[c.id] = {
                    "id": c.id,
                    "content": c.content,
                    "created_at": c.created_at,
                    "parent_comment_id": c.parent_comment_id,
                    "user": {"id": cu.id, "name": cu.name, "photo_url": cu.photo_url},
                    "replies": [],
                }
            for c, _ in comment_rows:
                d = comment_dicts[c.id]
                if c.parent_comment_id and c.parent_comment_id in comment_dicts:
                    comment_dicts[c.parent_comment_id]["replies"].append(d)
                else:
                    comments_by_post.setdefault(c.post_id, []).append(d)
        else:
            for post_id, count in (
                db.query(PostComment.post_id, func.count(PostComment.id))
                .filter(PostComment.post_id.in_(post_ids))
                .group_by(PostComment.post_id)
                .all()
            ):
                comment_count_by_post[post_id] = count

    result = []
    for p, u in posts_data:
        item = {
            "id": p.id,
            "content": p.content,
            "is_system_event": getattr(p, "is_system_event", False),
            "activity_type": p.activity_type,
            "distance_km": float(p.distance_km) if p.distance_km is not None else None,
            "duration_min": p.duration_min,
            "photo_url": p.photo_url,
            "user": {
                "id": u.id,
                "name": u.name,
                "photo_url": u.photo_url
            },
            "created_at": p.created_at,
            "reactions": reactions_by_post.get(p.id, {}),
            "total_points_gifted": total_points_by_post.get(p.id, 0),
        }
        if include_comments:
            item["comments"] = comments_by_post.get(p.id, [])
        else:
            item["comment_count"] = comment_count_by_post.get(p.id, 0)
        result.append(item)
    return result


def get_posts(db: Session, community_id: Optional[UUID] = None, circle_id: Optional[UUID] = None, limit: int = 20) -> List[dict]:
    query = db.query(Post, User).join(User, Post.user_id == User.id)
    if community_id:
        query = query.filter(Post.community_id == community_id)
    elif circle_id:
        query = query.filter(Post.circle_id == circle_id)

    posts_data = query.order_by(desc(Post.created_at)).limit(limit).all()
    return _assemble_posts(db, posts_data, include_comments=True)


def get_public_feed_posts(db: Session, limit: int = 10, before: Optional[datetime] = None) -> List[dict]:
    """For You feed source: posts from public, free circles or from any
    provider community — never a private or paid circle, never a
    system-generated join/check-in notice. `comment_count` only (Phase 2
    payload budget); full threads load on the destination screen."""
    query = (
        db.query(Post, User)
        .join(User, Post.user_id == User.id)
        .outerjoin(Circle, Post.circle_id == Circle.id)
        .filter(Post.is_system_event == False)
        .filter(
            or_(
                Post.community_id.isnot(None),
                and_(
                    Post.circle_id.isnot(None),
                    Circle.is_private == False,
                    Circle.is_paid == False,
                ),
            )
        )
    )
    if before:
        query = query.filter(Post.created_at < before)

    posts_data = query.order_by(desc(Post.created_at)).limit(limit).all()
    items = _assemble_posts(db, posts_data, include_comments=False)

    # Truncate content for the bootstrap payload budget (Phase 2).
    for item in items:
        content = item["content"] or ""
        if len(content) > FEED_CONTENT_TRUNCATE_AT:
            item["content"] = content[:FEED_CONTENT_TRUNCATE_AT]
            item["truncated"] = True
        else:
            item["truncated"] = False

    # One batched query per source kind — never per post.
    circle_ids = {p.circle_id for p, _ in posts_data if p.circle_id}
    community_ids = {p.community_id for p, _ in posts_data if p.community_id}

    circles_by_id = {}
    circle_member_counts = {}
    if circle_ids:
        for c in db.query(Circle).filter(Circle.id.in_(circle_ids)).all():
            circles_by_id[c.id] = c
        for circle_id, count in (
            db.query(CircleMember.circle_id, func.count(CircleMember.user_id))
            .filter(CircleMember.circle_id.in_(circle_ids))
            .group_by(CircleMember.circle_id)
            .all()
        ):
            circle_member_counts[circle_id] = count

    communities_by_id = {}
    if community_ids:
        for comm in db.query(Community).filter(Community.id.in_(community_ids)).all():
            communities_by_id[comm.id] = comm

    for item, (p, _u) in zip(items, posts_data):
        if p.circle_id:
            circle = circles_by_id.get(p.circle_id)
            item["source"] = {
                "kind": "circle",
                "id": p.circle_id,
                "name": circle.name if circle else None,
                "member_count": circle_member_counts.get(p.circle_id, 0),
            }
        else:
            community = communities_by_id.get(p.community_id)
            item["source"] = {
                "kind": "community",
                "id": p.community_id,
                "name": community.name if community else None,
                "member_count": community.member_count if community else 0,
            }

    return items

def react_to_post(db: Session, post_id: UUID, user_id: UUID, emoji: str, points_to_gift: int = 0) -> Reaction:
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    giver = db.query(User).filter(User.id == user_id).first()
    receiver = db.query(User).filter(User.id == post.user_id).first()

    if points_to_gift > 0:
        giver_balance = giver.points_balance or 0
        receiver_balance = receiver.points_balance or 0

        if giver_balance < points_to_gift:
            raise HTTPException(status_code=400, detail="Not enough points to gift")

        # Transfer points via ledger
        from app.services.points import apply_transaction, TXN_GIFT_SENT, TXN_GIFT_RECEIVED
        apply_transaction(db, giver, -points_to_gift, TXN_GIFT_SENT,
                          reference_id=post.id,
                          note=f"Gift to {receiver.name or 'user'}")
        apply_transaction(db, receiver, points_to_gift, TXN_GIFT_RECEIVED,
                          reference_id=post.id,
                          note=f"Gift from {giver.name or 'user'}")

    reaction = Reaction(
        post_id=post_id,
        user_id=user_id,
        emoji=emoji,
        points_gifted=points_to_gift
    )
    db.add(reaction)
    db.commit()
    db.refresh(reaction)
    return reaction

def create_comment(
    db: Session,
    post_id: UUID,
    user_id: UUID,
    content: str,
    parent_comment_id: Optional[UUID] = None,
) -> PostComment:
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if parent_comment_id:
        parent = db.query(PostComment).filter(PostComment.id == parent_comment_id).first()
        if not parent or parent.post_id != post_id:
            raise HTTPException(status_code=422, detail="Parent comment not found on this post")
        if parent.parent_comment_id is not None:
            raise HTTPException(status_code=422, detail="Replies can only be one level deep")

    comment = PostComment(
        post_id=post_id,
        user_id=user_id,
        content=content,
        parent_comment_id=parent_comment_id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment
