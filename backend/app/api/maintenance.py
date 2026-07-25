"""Serverless cron entry points."""
import secrets

from fastapi import APIRouter, Header, HTTPException

from app.config import settings
from app.services.scheduler import phase15_maintenance_job

router = APIRouter()


@router.post("/cron/maintenance")
def maintenance(
    authorization: str | None = Header(None),
    x_cron_secret: str | None = Header(None),
):
    supplied = x_cron_secret
    if authorization and authorization.startswith("Bearer "):
        supplied = authorization[7:]
    if not settings.CRON_SECRET or not supplied or not secrets.compare_digest(supplied, settings.CRON_SECRET):
        raise HTTPException(status_code=401, detail="Invalid cron secret")
    return phase15_maintenance_job()
