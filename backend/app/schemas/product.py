"""Product and redemption request/response schemas."""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class ProductRedeemRequest(BaseModel):
    delivery_address: Optional[str] = None


class ProductListItem(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    type: str
    price_etb: int
    image_url: Optional[str] = None
    provider_id: str
    provider_name: str
    max_redemptions_per_user: int = 1
    expiry_date: Optional[datetime] = None
    is_in_stock: bool = True
    is_recommended: bool = False


class ProductListResponse(BaseModel):
    products: List[ProductListItem]
    total: int
    page: int
    per_page: int


class ProductProviderBrief(BaseModel):
    id: str
    name: str
    category: str
    location_text: Optional[str] = None
    rating: Optional[float] = None


class ProductDetail(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    type: str
    price_etb: int
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    provider: ProductProviderBrief
    quantity_in_stock: int = 0
    max_redemptions_per_user: int = 1
    expiry_date: Optional[datetime] = None
    provider_instructions: Optional[str] = None
    shipping_required: bool = False
    redemption_count: int = 0


class RedemptionDetails(BaseModel):
    product_name: str
    points_spent: int
    new_balance: int
    provider_instructions: Optional[str] = None
    delivery_address: Optional[str] = None


class RedemptionResponse(BaseModel):
    redemption_id: str
    redemption_code: Optional[str] = None
    delivery_status: str
    message: str
    details: RedemptionDetails


class UserRedemptionItem(BaseModel):
    id: str
    product_name: str
    product_image_url: Optional[str] = None
    provider_name: str
    points_spent: int
    redeemed_at: datetime
    type: str
    delivery_status: str
    redemption_code: Optional[str] = None
    delivery_address: Optional[str] = None
    provider_notes: Optional[str] = None


class UserRedemptionsResponse(BaseModel):
    redemptions: List[UserRedemptionItem]
    count: int


class AdminProductItem(BaseModel):
    id: str
    name: str
    provider_id: str
    provider_name: str
    type: str
    price_etb: int
    quantity_in_stock: int
    redemption_count: int = 0
    is_active: bool
    created_at: datetime


class AdminProductListResponse(BaseModel):
    products: List[AdminProductItem]
    total: int


class StockUpdateRequest(BaseModel):
    quantity: int = Field(..., ge=0)


class StockUpdateResponse(BaseModel):
    product_id: str
    quantity_in_stock: int
    updated: bool


class RedemptionStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(pending|confirmed|shipped|delivered)$")
    notes: Optional[str] = None


class RedemptionStatusUpdateResponse(BaseModel):
    redemption_id: str
    delivery_status: str
    provider_notes: Optional[str] = None


class ProviderProductCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    type: str = Field(..., pattern="^(digital|physical)$")
    price_etb: int = Field(..., gt=0)
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    quantity_in_stock: int = Field(0, ge=0)
    max_redemptions_per_user: int = Field(1, ge=1)
    expiry_date: Optional[datetime] = None
    digital_code_template: Optional[str] = None
    provider_instructions: Optional[str] = None
    shipping_required: bool = False


class ProviderProductUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    price_etb: Optional[int] = Field(None, gt=0)
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    quantity_in_stock: Optional[int] = Field(None, ge=0)
    max_redemptions_per_user: Optional[int] = Field(None, ge=1)
    expiry_date: Optional[datetime] = None
    provider_instructions: Optional[str] = None
    shipping_required: Optional[bool] = None
    is_active: Optional[bool] = None
