"""Post routes - creating posts and reacting."""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.crud.post import create_post, get_posts, react_to_post

router = APIRouter()

class PostCreate(BaseModel):
    community_id: Optional[str] = None
    circle_id: Optional[str] = None
    content: str
    # Strava-style activity stats — all optional, a plain text post omits them.
    activity_type: Optional[str] = None
    distance_km: Optional[float] = None
    duration_min: Optional[int] = None
    photo_url: Optional[str] = None

class ReactionCreate(BaseModel):
    emoji: str
    points_gifted: int = 0

@router.post("")
def api_create_post(post_in: PostCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        if post_in.circle_id:
            from app.crud.circle_subscription import has_circle_access
            if not has_circle_access(db, UUID(post_in.circle_id), user.id):
                raise HTTPException(status_code=403, detail="Paid circle access required")
        post = create_post(
            db,
            user_id=user.id,
            content=post_in.content,
            community_id=UUID(post_in.community_id) if post_in.community_id else None,
            circle_id=UUID(post_in.circle_id) if post_in.circle_id else None,
            activity_type=post_in.activity_type,
            distance_km=post_in.distance_km,
            duration_min=post_in.duration_min,
            photo_url=post_in.photo_url,
        )
        return {"id": post.id, "message": "Post created successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("")
def api_get_posts(
    community_id: Optional[str] = Query(None),
    circle_id: Optional[str] = Query(None),
    limit: int = Query(20, le=50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if circle_id:
        from app.crud.circle_subscription import has_circle_access
        if not has_circle_access(db, UUID(circle_id), user.id):
            raise HTTPException(status_code=403, detail="Paid circle access required")
    posts = get_posts(
        db,
        community_id=UUID(community_id) if community_id else None,
        circle_id=UUID(circle_id) if circle_id else None,
        limit=limit
    )
    return {"posts": posts}

@router.post("/{post_id}/react")
def api_react_to_post(post_id: str, reaction_in: ReactionCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.post import Post
    from app.crud.circle_subscription import has_circle_access
    post = db.query(Post).filter(Post.id == UUID(post_id)).first()
    if post and post.circle_id and not has_circle_access(db, post.circle_id, user.id):
        raise HTTPException(status_code=403, detail="Paid circle access required")
    reaction = react_to_post(db, UUID(post_id), user_id=user.id, emoji=reaction_in.emoji, points_to_gift=reaction_in.points_gifted)
    return {"message": "Reaction added successfully", "points_gifted": reaction.points_gifted}

class CommentCreate(BaseModel):
    content: str
    parent_comment_id: Optional[str] = None

@router.post("/{post_id}/comments")
def api_create_comment(post_id: str, comment_in: CommentCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.crud.post import create_comment
    from app.models.post import Post
    from app.crud.circle_subscription import has_circle_access
    post = db.query(Post).filter(Post.id == UUID(post_id)).first()
    if post and post.circle_id and not has_circle_access(db, post.circle_id, user.id):
        raise HTTPException(status_code=403, detail="Paid circle access required")
    comment = create_comment(
        db, UUID(post_id), user_id=user.id, content=comment_in.content,
        parent_comment_id=UUID(comment_in.parent_comment_id) if comment_in.parent_comment_id else None,
    )
    return {"id": comment.id, "message": "Comment added successfully"}

