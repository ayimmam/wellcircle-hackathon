"""Product and redemption CRUD."""

import random
import string
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.models.product import Product
from app.models.user_redemption import UserRedemption
from app.models.provider import Provider
from app.models.user import User
from app.crud.admin_notification import notify_all_admins


def _generate_redemption_code(template: Optional[str]) -> str:
    chars = string.ascii_uppercase + string.digits
    random_part = "".join(random.choices(chars, k=6))
    if template and "{RANDOM_6CHARS}" in template:
        return template.replace("{RANDOM_6CHARS}", random_part)
    if template:
        return f"{template}-{random_part}"
    return f"WC-{random_part}"


def get_provider_products(db: Session, provider_id: UUID) -> List[Product]:
    return (
        db.query(Product)
        .filter(Product.provider_id == provider_id)
        .order_by(Product.created_at.desc())
        .all()
    )


def create_product(db: Session, provider_id: UUID, **kwargs) -> Product:
    product = Product(provider_id=provider_id, **kwargs)
    db.add(product)
    db.commit()
    db.refresh(product)

    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if provider:
        notify_all_admins(
            db,
            event_type="product_created",
            message=f'{provider.name} created product "{product.name}"',
            related_provider_id=provider_id,
        )
    return product


def update_product(db: Session, product_id: UUID, provider_id: UUID, **kwargs) -> Optional[Product]:
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.provider_id == provider_id)
        .first()
    )
    if not product:
        return None
    for key, value in kwargs.items():
        if value is not None and hasattr(product, key):
            setattr(product, key, value)
    product.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(product)
    return product


def get_product_by_id(db: Session, product_id: UUID) -> Optional[Product]:
    return db.query(Product).filter(Product.id == product_id).first()


def get_redemption_count(db: Session, product_id: UUID) -> int:
    return db.query(UserRedemption).filter(UserRedemption.product_id == product_id).count()


def browse_products(
    db: Session,
    search: Optional[str] = None,
    provider_id: Optional[UUID] = None,
    product_type: Optional[str] = None,
    price_min: Optional[int] = None,
    price_max: Optional[int] = None,
    in_stock_only: bool = False,
    sort_by: str = "newest",
    page: int = 1,
    per_page: int = 12,
    user_interest: Optional[str] = None,
) -> tuple[List[dict], int]:
    now = datetime.now(timezone.utc)
    query = (
        db.query(Product, Provider)
        .join(Provider, Product.provider_id == Provider.id)
        .filter(
            Product.is_active == True,  # noqa: E712
            or_(Provider.status == "active", Provider.status.is_(None)),
            or_(Product.expiry_date.is_(None), Product.expiry_date > now),
        )
    )

    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
    if provider_id:
        query = query.filter(Product.provider_id == provider_id)
    if product_type:
        query = query.filter(Product.type == product_type)
    if price_min is not None:
        query = query.filter(Product.price_etb >= price_min)
    if price_max is not None:
        query = query.filter(Product.price_etb <= price_max)
    if in_stock_only:
        query = query.filter(Product.quantity_in_stock > 0)

    total = query.count()

    if sort_by == "price_asc":
        query = query.order_by(Product.price_etb.asc())
    elif sort_by == "price_desc":
        query = query.order_by(Product.price_etb.desc())
    elif sort_by == "popular":
        subq = (
            db.query(UserRedemption.product_id, func.count(UserRedemption.id).label("cnt"))
            .group_by(UserRedemption.product_id)
            .subquery()
        )
        query = query.outerjoin(subq, Product.id == subq.c.product_id).order_by(
            func.coalesce(subq.c.cnt, 0).desc()
        )
    else:
        query = query.order_by(Product.created_at.desc())

    rows = query.offset((page - 1) * per_page).limit(per_page).all()

    popular_ids = set()
    if not user_interest:
        popular = (
            db.query(UserRedemption.product_id, func.count(UserRedemption.id).label("cnt"))
            .group_by(UserRedemption.product_id)
            .order_by(func.count(UserRedemption.id).desc())
            .limit(10)
            .all()
        )
        popular_ids = {str(p[0]) for p in popular}

    items = []
    for product, provider in rows:
        is_recommended = False
        if user_interest and provider.category == user_interest:
            is_recommended = True
        elif str(product.id) in popular_ids:
            is_recommended = True

        items.append({
            "id": str(product.id),
            "name": product.name,
            "description": product.description,
            "type": product.type,
            "price_etb": product.price_etb,
            "image_url": product.image_url,
            "provider_id": str(provider.id),
            "provider_name": provider.name,
            "max_redemptions_per_user": product.max_redemptions_per_user,
            "expiry_date": product.expiry_date,
            "is_in_stock": product.quantity_in_stock > 0,
            "is_recommended": is_recommended,
        })
    return items, total


def get_product_detail(db: Session, product_id: UUID) -> Optional[dict]:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return None

    provider = db.query(Provider).filter(Provider.id == product.provider_id).first()
    if not provider:
        return None

    redemption_count = get_redemption_count(db, product.id)
    return {
        "id": str(product.id),
        "name": product.name,
        "description": product.description,
        "type": product.type,
        "price_etb": product.price_etb,
        "image_url": product.image_url,
        "images": product.images or [],
        "provider": {
            "id": str(provider.id),
            "name": provider.name,
            "category": provider.category,
            "location_text": provider.location_text,
            "rating": provider.rating,
        },
        "quantity_in_stock": product.quantity_in_stock,
        "max_redemptions_per_user": product.max_redemptions_per_user,
        "expiry_date": product.expiry_date,
        "provider_instructions": product.provider_instructions,
        "shipping_required": product.shipping_required,
        "redemption_count": redemption_count,
    }


def redeem_product(
    db: Session,
    product_id: UUID,
    user: User,
    delivery_address: Optional[str] = None,
) -> dict:
    now = datetime.now(timezone.utc)
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product or not product.is_active:
        raise ValueError("Product is no longer available.")
    if product.quantity_in_stock <= 0:
        raise ValueError("Product is no longer available.")
    if product.expiry_date and product.expiry_date <= now:
        raise ValueError("Product is no longer available.")

    if product.shipping_required and not delivery_address:
        raise ValueError("Delivery address is required for this product.")

    user_count = (
        db.query(UserRedemption)
        .filter(UserRedemption.user_id == user.id, UserRedemption.product_id == product_id)
        .count()
    )
    if user_count >= product.max_redemptions_per_user:
        raise ValueError(
            f"You have already redeemed this product maximum times (limit: {product.max_redemptions_per_user})"
        )

    if user.points_balance < product.price_etb:
        raise ValueError(
            f"Insufficient Legacy Points. You have {user.points_balance} points; need {product.price_etb}."
        )

    redemption_code = None
    if product.type == "digital":
        redemption_code = _generate_redemption_code(product.digital_code_template)

    user.points_balance -= product.price_etb
    product.quantity_in_stock -= 1
    if product.quantity_in_stock == 0:
        product.is_active = False

    redemption = UserRedemption(
        user_id=user.id,
        product_id=product.id,
        points_spent=product.price_etb,
        redemption_code=redemption_code,
        delivery_address=delivery_address,
        delivery_status="pending",
    )
    db.add(redemption)
    db.commit()
    db.refresh(redemption)

    provider = db.query(Provider).filter(Provider.id == product.provider_id).first()
    if provider:
        notify_all_admins(
            db,
            event_type="product_redeemed",
            message=f'{user.name or "User"} redeemed "{product.name}" from {provider.name}',
            related_provider_id=provider.id,
            related_user_id=user.id,
        )

    return {
        "redemption_id": str(redemption.id),
        "redemption_code": redemption_code,
        "delivery_status": redemption.delivery_status,
        "message": "Product redeemed! Check redemption details below.",
        "details": {
            "product_name": product.name,
            "points_spent": product.price_etb,
            "new_balance": user.points_balance,
            "provider_instructions": product.provider_instructions,
            "delivery_address": delivery_address,
        },
    }


def get_user_redemptions(db: Session, user_id: UUID) -> List[dict]:
    rows = (
        db.query(UserRedemption, Product, Provider)
        .join(Product, UserRedemption.product_id == Product.id)
        .join(Provider, Product.provider_id == Provider.id)
        .filter(UserRedemption.user_id == user_id)
        .order_by(UserRedemption.redeemed_at.desc())
        .all()
    )
    items = []
    for redemption, product, provider in rows:
        items.append({
            "id": str(redemption.id),
            "product_name": product.name,
            "product_image_url": product.image_url,
            "provider_name": provider.name,
            "points_spent": redemption.points_spent,
            "redeemed_at": redemption.redeemed_at,
            "type": product.type,
            "delivery_status": redemption.delivery_status,
            "redemption_code": redemption.redemption_code,
            "delivery_address": redemption.delivery_address,
            "provider_notes": redemption.provider_notes,
        })
    return items


def admin_list_products(
    db: Session,
    provider_id: Optional[UUID] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[List[dict], int]:
    query = db.query(Product, Provider).join(Provider, Product.provider_id == Provider.id)

    if provider_id:
        query = query.filter(Product.provider_id == provider_id)
    if status == "active":
        query = query.filter(Product.is_active == True)  # noqa: E712
    elif status == "inactive":
        query = query.filter(Product.is_active == False)  # noqa: E712
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))

    total = query.count()
    rows = (
        query.order_by(Product.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    items = []
    for product, provider in rows:
        items.append({
            "id": str(product.id),
            "name": product.name,
            "provider_id": str(provider.id),
            "provider_name": provider.name,
            "type": product.type,
            "price_etb": product.price_etb,
            "quantity_in_stock": product.quantity_in_stock,
            "redemption_count": get_redemption_count(db, product.id),
            "is_active": product.is_active,
            "created_at": product.created_at,
        })
    return items, total


def update_product_stock(db: Session, product_id: UUID, quantity: int) -> Optional[Product]:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return None
    product.quantity_in_stock = quantity
    if quantity > 0 and not product.is_active:
        product.is_active = True
    product.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(product)
    return product


def update_redemption_status(
    db: Session,
    redemption_id: UUID,
    status: str,
    notes: Optional[str] = None,
) -> Optional[UserRedemption]:
    redemption = db.query(UserRedemption).filter(UserRedemption.id == redemption_id).first()
    if not redemption:
        return None
    redemption.delivery_status = status
    if notes:
        redemption.provider_notes = notes
    if status == "delivered":
        redemption.delivered_at = datetime.now(timezone.utc)
    redemption.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(redemption)
    return redemption


def get_provider_redemptions(db: Session, provider_id: UUID, limit: int = 10) -> List[dict]:
    rows = (
        db.query(UserRedemption, Product, User)
        .join(Product, UserRedemption.product_id == Product.id)
        .join(User, UserRedemption.user_id == User.id)
        .filter(Product.provider_id == provider_id)
        .order_by(UserRedemption.redeemed_at.desc())
        .limit(limit)
        .all()
    )
    items = []
    for redemption, product, user in rows:
        items.append({
            "id": str(redemption.id),
            "user_name": user.name,
            "product_name": product.name,
            "redemption_code": redemption.redemption_code,
            "redeemed_at": redemption.redeemed_at.isoformat(),
            "delivery_status": redemption.delivery_status,
        })
    return items
