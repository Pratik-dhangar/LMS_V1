"""API endpoints for E-Commerce Store (Public Catalog Browsing)
"""
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.core.config import settings
from app.crud import product_crud
from app.schemas.product import (
    ProductResponse, ProductCatalogResponse, ProductFilters
)
from app.utils.s3_utils import S3Manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/store", tags=["Store - Public"])


def get_public_url(file_path: Optional[str]) -> Optional[str]:
    """Convert S3 key or local path to public URL"""
    if not file_path:
        return None
    
    # If it's already a full HTTP URL, return as-is
    if file_path.startswith("http"):
        return file_path
    
    # If using S3, convert the S3 key to a public URL
    if settings.USE_S3:
        try:
            s3_manager = S3Manager(bucket_name=settings.S3_BUCKET_NAME)
            public_url = s3_manager.get_public_url(file_path)
            logger.info(f"Store: Converted S3 path {file_path} to public URL")
            return public_url
        except Exception as e:
            logger.warning(f"Store: Error converting S3 URL for {file_path}: {str(e)}", exc_info=True)
            # Fallback to direct URL construction
            fallback_url = f"https://{settings.S3_BUCKET_NAME}.s3.ap-south-1.amazonaws.com/{file_path}"
            return fallback_url
    
    # For local storage, return the path as-is (will be served by static handler)
    return file_path


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
        
        # Convert S3 URLs to public URLs for all products
        for product in products:
            if hasattr(product, 'image_url') and product.image_url:
                product.image_url = get_public_url(product.image_url)
            if hasattr(product, 'thumbnail_url') and product.thumbnail_url:
                product.thumbnail_url = get_public_url(product.thumbnail_url)
        
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
    
    # Convert S3 URLs to public URLs
    if product.image_url:
        product.image_url = get_public_url(product.image_url)
    if product.thumbnail_url:
        product.thumbnail_url = get_public_url(product.thumbnail_url)
    
    return product
