"""Pydantic schemas for E-Commerce Product module
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


# Enums
class ProductVisibilityEnum(str):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"


# Category Schemas
class ProductCategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    icon_url: Optional[str] = None
    display_order: int = Field(default=0, ge=0)


class ProductCategoryCreate(ProductCategoryBase):
    pass


class ProductCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    icon_url: Optional[str] = None
    display_order: Optional[int] = Field(None, ge=0)


class ProductCategoryResponse(ProductCategoryBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Age Group Schemas
class AgeGroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    min_age: Optional[int] = Field(None, ge=0, le=100)
    max_age: Optional[int] = Field(None, ge=0, le=100)


class AgeGroupCreate(AgeGroupBase):
    pass


class AgeGroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    min_age: Optional[int] = Field(None, ge=0, le=100)
    max_age: Optional[int] = Field(None, ge=0, le=100)


class AgeGroupResponse(AgeGroupBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Skill Focus Schemas
class SkillFocusBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class SkillFocusCreate(SkillFocusBase):
    pass


class SkillFocusUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None


class SkillFocusResponse(SkillFocusBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Product Schemas
class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category_id: Optional[UUID] = None
    price: Decimal = Field(..., gt=0, decimal_places=2)
    discount_percentage: Decimal = Field(default=0, ge=0, le=100, decimal_places=2)
    stock_quantity: int = Field(default=0, ge=0)
    visibility: str = Field(default="DRAFT")
    tags: Optional[List[str]] = Field(default=None)


class ProductCreate(ProductBase):
    age_group_ids: Optional[List[UUID]] = Field(default=[])
    skill_ids: Optional[List[UUID]] = Field(default=[])
    
    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v):
        if v is not None:
            allowed_tags = ["Recommended", "Bestseller", "New"]
            for tag in v:
                if tag not in allowed_tags:
                    raise ValueError(f"Invalid tag: {tag}. Allowed: {allowed_tags}")
        return v


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category_id: Optional[UUID] = None
    price: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    discount_percentage: Optional[Decimal] = Field(None, ge=0, le=100, decimal_places=2)
    stock_quantity: Optional[int] = Field(None, ge=0)
    visibility: Optional[str] = None
    tags: Optional[List[str]] = None
    age_group_ids: Optional[List[UUID]] = None
    skill_ids: Optional[List[UUID]] = None
    
    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v):
        if v is not None:
            allowed_tags = ["Recommended", "Bestseller", "New"]
            for tag in v:
                if tag not in allowed_tags:
                    raise ValueError(f"Invalid tag: {tag}. Allowed: {allowed_tags}")
        return v


class ProductResponse(ProductBase):
    id: UUID
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    category: Optional[ProductCategoryResponse] = None
    age_groups: List[AgeGroupResponse] = []
    skills: List[SkillFocusResponse] = []
    final_price: float
    stock_available: bool
    created_by_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductListItem(BaseModel):
    """Simplified product schema for catalog listing"""
    id: UUID
    name: str
    description: Optional[str] = None
    price: Decimal
    discount_percentage: Decimal
    final_price: float
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    tags: Optional[List[str]] = None
    category: Optional[ProductCategoryResponse] = None
    age_groups: List[AgeGroupResponse] = []
    stock_available: bool

    class Config:
        from_attributes = True


class ProductCatalogResponse(BaseModel):
    """Response for catalog browsing with pagination"""
    products: List[ProductListItem]
    pagination: dict


# Store Filter Schemas
class ProductFilters(BaseModel):
    """Query parameters for filtering products"""
    search: Optional[str] = Field(None, max_length=255)
    category_id: Optional[UUID] = None
    age_group_ids: Optional[str] = None  # Comma-separated UUIDs
    skill_ids: Optional[str] = None  # Comma-separated UUIDs
    price_min: Optional[Decimal] = Field(None, ge=0)
    price_max: Optional[Decimal] = Field(None, ge=0)
    sort: str = Field(default="featured")  # featured, price_asc, price_desc, newest, bestseller
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)
