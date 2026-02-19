"""API endpoints for E-Commerce Store (Public Catalog Browsing)
"""
import hashlib
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.core.config import settings
from app.crud import product_crud
from app.schemas.product import (
    ProductResponse, ProductCatalogResponse, ProductFilters, ProductListItem
)
from app.utils.s3_utils import convert_s3_url_to_proxy, s3_key_to_proxy
from app.services.cache_service import cache_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/store", tags=["Store - Public"])


def get_public_url(file_path: Optional[str]) -> Optional[str]:
    """Convert S3 key or path to permanent backend proxy URL"""
    if not file_path:
        return None
    if file_path.startswith("http"):
        return file_path
    if settings.USE_S3:
        if file_path.startswith("s3://"):
            return convert_s3_url_to_proxy(file_path)
        return s3_key_to_proxy(file_path)
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
    
    # Generate cache key from filters
    filters_str = f"{search}:{category_uuid}:{age_group_ids}:{skill_ids}:{price_min_val}:{price_max_val}:{sort}:{page}:{limit}"
    filters_hash = hashlib.md5(filters_str.encode()).hexdigest()
    cache_key = cache_service.key_product_catalog(filters_hash)
    
    # Try cache first
    cached = await cache_service.get(cache_key)
    if cached is not None:
        logger.info(f"Returning cached product catalog: {cache_key}")
        return cached
    
    try:
        products, total = await product_crud.get_catalog_products(db, filters)
        
        # Convert ORM objects to Pydantic models and handle S3 URLs
        product_list = []
        for product in products:
            # Convert ORM to Pydantic model
            product_dict = {
                'id': product.id,
                'name': product.name,
                'description': product.description,
                'price': product.price,
                'discount_percentage': product.discount_percentage,
                'final_price': product.final_price,
                'image_url': get_public_url(product.image_url) if product.image_url else None,
                'thumbnail_url': get_public_url(product.thumbnail_url) if product.thumbnail_url else None,
                'tags': product.tags,
                'category': product.category,
                'age_groups': product.age_groups,
                'stock_available': product.stock_available,
            }
            product_list.append(ProductListItem(**product_dict))
        
        # Calculate pagination info
        total_pages = (total + filters.limit - 1) // filters.limit
        
        response_data = ProductCatalogResponse(
            products=product_list,
            pagination={
                "total": total,
                "page": filters.page,
                "limit": filters.limit,
                "pages": total_pages
            }
        )
        
        # Cache the response for 5 minutes (convert to dict for caching)
        cached_response = {
            "products": [p.model_dump() for p in product_list],
            "pagination": {
                "total": total,
                "page": filters.page,
                "limit": filters.limit,
                "pages": total_pages
            }
        }
        await cache_service.set(cache_key, cached_response, cache_service.TTL_PRODUCT_CATALOG)
        
        return response_data
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
    # Try cache first
    cache_key = f"product:detail:{product_id}"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        return ProductResponse(**cached_data)

    logger.debug(f"Cache MISS: {cache_key}")
    product = await product_crud.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    # Convert S3 URLs to public URLs
    if product.image_url:
        product.image_url = get_public_url(product.image_url)
    if product.thumbnail_url:
        product.thumbnail_url = get_public_url(product.thumbnail_url)

    # Convert to Pydantic model if needed
    if hasattr(product, 'model_dump'):
        response = product
    else:
        response = ProductResponse.model_validate(product)

    # Cache for 15 minutes
    await cache_service.set(cache_key, response.model_dump(), ttl=cache_service.TTL_PRODUCT_DETAIL)

    return response
