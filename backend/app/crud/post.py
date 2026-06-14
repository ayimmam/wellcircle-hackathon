from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi import HTTPException

from app.models.post import Post, Reaction
from app.models.user import User

def create_post(db: Session, user_id: UUID, content: str, community_id: Optional[UUID] = None, circle_id: Optional[UUID] = None) -> Post:
    if not community_id and not circle_id:
        raise ValueError("Either community_id or circle_id must be provided")
        
    post = Post(
        user_id=user_id,
        community_id=community_id,
        circle_id=circle_id,
        content=content
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post

def get_posts(db: Session, community_id: Optional[UUID] = None, circle_id: Optional[UUID] = None, limit: int = 20) -> List[dict]:
    query = db.query(Post, User).join(User, Post.user_id == User.id)
    if community_id:
        query = query.filter(Post.community_id == community_id)
    elif circle_id:
        query = query.filter(Post.circle_id == circle_id)
        
    posts_data = query.order_by(desc(Post.created_at)).limit(limit).all()
    
    result = []
    for p, u in posts_data:
        # Get reactions
        reactions = db.query(Reaction).filter(Reaction.post_id == p.id).all()
        reaction_summary = {}
        total_points_gifted = 0
        for r in reactions:
            reaction_summary[r.emoji] = reaction_summary.get(r.emoji, 0) + 1
            total_points_gifted += r.points_gifted
            
        result.append({
            "id": p.id,
            "content": p.content,
            "is_system_event": getattr(p, "is_system_event", False),
            "user": {
                "id": u.id,
                "name": u.name,
                "photo_url": u.photo_url
            },
            "created_at": p.created_at,
            "reactions": reaction_summary,
            "total_points_gifted": total_points_gifted
        })
    return result

def react_to_post(db: Session, post_id: UUID, user_id: UUID, emoji: str, points_to_gift: int = 0) -> Reaction:
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
        
    giver = db.query(User).filter(User.id == user_id).first()
    receiver = db.query(User).filter(User.id == post.user_id).first()
    
    if points_to_gift > 0:
        if giver.points_balance < points_to_gift:
            raise HTTPException(status_code=400, detail="Not enough points to gift")
        
        # Transfer points
        giver.points_balance -= points_to_gift
        receiver.points_balance += points_to_gift
        
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
