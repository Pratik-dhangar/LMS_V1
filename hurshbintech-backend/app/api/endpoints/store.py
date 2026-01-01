"""API endpoints for E-Commerce Store (Public Catalog Browsing)
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.crud import product_crud
from app.schemas.product import (
    ProductResponse, ProductCatalogResponse, ProductFilters
)

router = APIRouter(prefix="/store", tags=["Store - Public"])


@router.get("/products", response_model=ProductCatalogResponse)
async def browse_products(
    search: Optional[str] = Query(None, max_length=255),
    category_id: Optional[str] = Query(None, description="Category UUID"),
    age_group_ids: Optional[str] = Query(None, description="Comma-separated UUIDs"),
    skill_ids: Optional[str] = Query(None, description="Comma-separated UUIDs"),
    price_min: Optional[str] = Query(None),  # Accept as string to handle empty values
    price_max: Optional[str] = Query(None),  # Accept as string to handle empty values
    sort: str = Query("featured", regex="^(featured|price_asc|price_desc|newest|bestseller)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Browse product catalog with filters and pagination (Public)"""
    
    # Convert price_min and price_max to float if provided
    price_min_val = None
    price_max_val = None
    
    if price_min and price_min.strip():
        try:
            price_min_val = float(price_min)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid price_min format"
            )
    
    if price_max and price_max.strip():
        try:
            price_max_val = float(price_max)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid price_max format"
            )
    
    # Convert category_id string to UUID if provided and not empty
    category_uuid = None
    if category_id and category_id.strip():
        try:
            category_uuid = UUID(category_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid category_id format"
            )
    
    # Create filters object
    filters = ProductFilters(
        search=search,
        category_id=category_uuid,
        age_group_ids=age_group_ids,
        skill_ids=skill_ids,
        price_min=price_min_val,
        price_max=price_max_val,
        sort=sort,
        page=page,
        limit=limit
    )
    
    try:
        products, total = await product_crud.get_catalog_products(db, filters)
        
        # Calculate pagination info
        total_pages = (total + filters.limit - 1) // filters.limit
        
        return {
            "products": products,
            "pagination": {
                "total": total,
                "page": filters.page,
                "limit": filters.limit,
                "pages": total_pages
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch products: {str(e)}"
        )


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product_detail(
    product_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get detailed product information (Public)"""
    product = await product_crud.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product
