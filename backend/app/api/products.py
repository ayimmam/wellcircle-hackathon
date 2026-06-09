"""Product store routes — browse, redeem, user redemptions."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_optional_user
from app.models.user import User
from app.crud.product import (
    browse_products, get_product_detail, redeem_product, get_user_redemptions,
)
from app.schemas.product import (
    ProductListResponse, ProductDetail, ProductRedeemRequest,
    RedemptionResponse, UserRedemptionsResponse,
)

router = APIRouter()


@router.get("", response_model=ProductListResponse)
async def list_products(
    search: str | None = Query(None),
    provider_id: str | None = Query(None),
    type: str | None = Query(None),
    price_min: int | None = Query(None),
    price_max: int | None = Query(None),
    in_stock_only: bool = Query(False),
    sort_by: str = Query("newest"),
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=50),
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    interest = user.interest_category if user else None
    pid = UUID(provider_id) if provider_id else None
    items, total = browse_products(
        db,
        search=search,
        provider_id=pid,
        product_type=type,
        price_min=price_min,
        price_max=price_max,
        in_stock_only=in_stock_only,
        sort_by=sort_by,
        page=page,
        per_page=per_page,
        user_interest=interest,
    )
    return ProductListResponse(products=items, total=total, page=page, per_page=per_page)


@router.get("/{product_id}", response_model=ProductDetail)
async def product_detail(
    product_id: str,
    db: Session = Depends(get_db),
):
    detail = get_product_detail(db, UUID(product_id))
    if not detail:
        raise HTTPException(status_code=404, detail="Product not found")
    return detail


@router.post("/{product_id}/redeem", response_model=RedemptionResponse, status_code=201)
async def redeem(
    product_id: str,
    request: ProductRedeemRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = redeem_product(
            db, UUID(product_id), user, delivery_address=request.delivery_address
        )
    except ValueError as e:
        msg = str(e)
        if "already redeemed" in msg:
            raise HTTPException(status_code=409, detail=msg)
        raise HTTPException(status_code=422, detail=msg)
    return result
