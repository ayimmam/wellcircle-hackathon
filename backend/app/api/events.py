"""Events API."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.models.provider_event import ProviderEvent
from app.models.provider import Provider
from app.models.booking import Booking
from app.models.user_notification import UserNotification
from app.models.event_inventory_log import EventInventoryLog
from app.schemas.event import EventCreate, EventUpdate, EventResponse, EventListResponse
from app.dependencies import get_current_user, get_current_provider, get_current_super_admin

router = APIRouter()


def compute_urgency(spots_remaining: int) -> str:
    if spots_remaining <= 2:
        return "high"
    elif spots_remaining <= 5:
        return "medium"
    return "low"


@router.get("/events", response_model=EventListResponse)
def list_all_events(
    db: Session = Depends(get_db),
    from_date: Optional[datetime] = Query(None, alias="from"),
    to_date: Optional[datetime] = Query(None, alias="to"),
    category: Optional[str] = None,
    boosted_only: bool = False,
    limit: int = 20,
    page: int = 1
):
    """Discovery endpoint for upcoming events."""
    if not from_date:
        from_date = datetime.now(timezone.utc)
    if not to_date:
        to_date = from_date + timedelta(days=7)

    query = db.query(ProviderEvent, Provider).join(Provider, ProviderEvent.provider_id == Provider.id)
    
    query = query.filter(
        ProviderEvent.starts_at >= from_date,
        ProviderEvent.starts_at < to_date,
        ProviderEvent.is_cancelled == False
    )
    
    if category:
        query = query.filter(Provider.category == category)
    if boosted_only:
        query = query.filter(ProviderEvent.is_boosted == True)
        
    # Sort boosted first, then by date
    query = query.order_by(ProviderEvent.is_boosted.desc(), ProviderEvent.starts_at.asc())
    
    total = query.count()
    results = query.offset((page - 1) * limit).limit(limit).all()
    
    events_list = []
    for event, provider in results:
        event_dict = {
            "id": str(event.id),
            "provider_id": str(event.provider_id),
            "service_name": event.service_name,
            "description": event.description,
            "starts_at": event.starts_at,
            "ends_at": event.ends_at,
            "capacity": event.capacity,
            "spots_remaining": event.spots_remaining,
            "price_etb": event.price_etb,
            "is_cancelled": event.is_cancelled,
            "is_boosted": event.is_boosted,
            "created_at": event.created_at,
            "provider_name": provider.name,
            "provider_category": provider.category,
            "provider_cover_photo_url": provider.cover_photo_url,
            "urgency": compute_urgency(event.spots_remaining)
        }
        events_list.append(event_dict)
        
    return {"events": events_list, "count": total, "page": page}


@router.get("/providers/{provider_id}/events", response_model=EventListResponse)
def list_provider_events(
    provider_id: str,
    db: Session = Depends(get_db),
    from_date: Optional[datetime] = Query(None, alias="from"),
    to_date: Optional[datetime] = Query(None, alias="to"),
    include_cancelled: bool = False
):
    query = db.query(ProviderEvent, Provider).join(Provider, ProviderEvent.provider_id == Provider.id).filter(
        ProviderEvent.provider_id == provider_id
    )
    
    if from_date:
        query = query.filter(ProviderEvent.starts_at >= from_date)
    if to_date:
        query = query.filter(ProviderEvent.starts_at < to_date)
    if not include_cancelled:
        query = query.filter(ProviderEvent.is_cancelled == False)
        
    query = query.order_by(ProviderEvent.starts_at.asc())
    
    results = query.all()
    events_list = []
    for event, provider in results:
        event_dict = {
            "id": str(event.id),
            "provider_id": str(event.provider_id),
            "service_name": event.service_name,
            "description": event.description,
            "starts_at": event.starts_at,
            "ends_at": event.ends_at,
            "capacity": event.capacity,
            "spots_remaining": event.spots_remaining,
            "price_etb": event.price_etb,
            "is_cancelled": event.is_cancelled,
            "is_boosted": event.is_boosted,
            "created_at": event.created_at,
            "provider_name": provider.name,
            "provider_category": provider.category,
            "provider_cover_photo_url": provider.cover_photo_url,
            "urgency": compute_urgency(event.spots_remaining)
        }
        events_list.append(event_dict)
        
    return {"events": events_list, "count": len(events_list), "page": 1}


@router.post("/providers/me/events", response_model=EventResponse, status_code=201)
def create_event(
    event_in: EventCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_provider)
):
    provider = db.query(Provider).filter(Provider.owner_user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=403, detail="Not linked to a provider")

    new_event = ProviderEvent(
        provider_id=provider.id,
        service_name=event_in.service_name,
        description=event_in.description,
        starts_at=event_in.starts_at,
        ends_at=event_in.ends_at,
        capacity=event_in.capacity,
        spots_remaining=event_in.capacity,
        price_etb=event_in.price_etb
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    
    # Write inventory log
    inv_log = EventInventoryLog(
        event_id=new_event.id,
        delta=event_in.capacity,
        reason="provider_correction"
    )
    db.add(inv_log)
    db.commit()
    
    return new_event


@router.patch("/providers/me/events/{event_id}", response_model=EventResponse)
def update_event(
    event_id: str,
    event_in: EventUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_provider)
):
    provider = db.query(Provider).filter(Provider.owner_user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=403, detail="Not linked to a provider")

    event = db.query(ProviderEvent).filter(ProviderEvent.id == event_id, ProviderEvent.provider_id == provider.id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event_in.capacity is not None:
        booked_count = event.capacity - event.spots_remaining
        if event_in.capacity < booked_count:
            raise HTTPException(status_code=422, detail="Cannot reduce capacity below current bookings")
        # Update spots remaining based on new capacity
        capacity_diff = event_in.capacity - event.capacity
        event.capacity = event_in.capacity
        event.spots_remaining += capacity_diff
        
        db.add(EventInventoryLog(
            event_id=event.id,
            delta=capacity_diff,
            reason="manual_adjustment"
        ))

    if event_in.description is not None:
        event.description = event_in.description

    if event_in.is_cancelled is not None and event_in.is_cancelled == True and not event.is_cancelled:
        event.is_cancelled = True
        # Find all successful bookings
        bookings = db.query(Booking).filter(Booking.event_id == event.id, Booking.payment_status == 'success').all()
        for b in bookings:
            # Create notification
            from app.services.notification_service import create_notification
            create_notification(
                db,
                user_id=b.user_id,
                type="booking_cancelled",
                title="Your booking was cancelled",
                body=f"Your booking for {event.service_name} on {event.starts_at.strftime('%Y-%m-%d')} has been cancelled by the provider.",
                action_url="/my-bookings"
            )
            # TODO: Refund logic (Phase 4)
            
    db.commit()
    db.refresh(event)
    return event


@router.post("/admin/providers/{provider_id}/events/{event_id}/boost")
def boost_event(
    provider_id: str,
    event_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_super_admin)
):
    event = db.query(ProviderEvent).filter(ProviderEvent.id == event_id, ProviderEvent.provider_id == provider_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    event.is_boosted = True
    db.commit()
    return {"event_id": str(event.id), "is_boosted": True}
