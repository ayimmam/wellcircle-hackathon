"""Weekly ranks (leaderboard) API."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.crud import ranks as ranks_crud
from app.schemas.ranks import RanksResponse

router = APIRouter()


@router.get("/ranks", response_model=RanksResponse)
def get_ranks(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Trailing 7-day weekly leaderboard for communities and individuals."""
    return {
        "communities": ranks_crud.get_top_communities(db),
        "users": ranks_crud.get_top_users(db),
        "me": ranks_crud.get_my_rank(db, current_user.id),
    }
